import { createServer } from "node:http";
import mongoose from "mongoose";
import { WebSocketServer } from "ws";
import { RunModel } from "db/client";
import { Hub } from "./hub";
import { RunManager } from "./runs";
import { handleMessage } from "./handlers";
import { parseClientMessage, send } from "./protocol";

export async function startServer(options: {
  dbUrl: string;
  port: number;
  origins?: string[];
  createRuns?: (hub: Hub) => RunManager;
}) {
  await mongoose.connect(options.dbUrl, { serverSelectionTimeoutMS: 5000 });
  // Runs cannot survive an orchestrator crash; don't leave them running forever.
  await RunModel.updateMany(
    { status: "running" },
    {
      status: "failed",
      endedAt: new Date(),
      output: "Orchestrator stopped before this run finished.",
    },
  );
  const hub = new Hub();
  const runs = options.createRuns?.(hub) ?? new RunManager(hub);
  const origins = new Set(
    options.origins ?? ["http://localhost:3001", "http://127.0.0.1:3001"],
  );
  const http = createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      const healthy = mongoose.connection.readyState === 1;
      res.writeHead(healthy ? 200 : 503, {
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          status: healthy ? "ok" : "unavailable",
          database: healthy ? "connected" : "disconnected",
        }),
      );
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });
  const server = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  http.on("upgrade", (request, socket, head) => {
    // Only the local UI can drive agents or access credentials. Origin-less native clients are allowed.
    const host = request.headers.host?.split(":")[0];
    if (
      !host ||
      !["localhost", "127.0.0.1"].includes(host) ||
      (request.headers.origin && !origins.has(request.headers.origin))
    ) {
      socket.end("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n");
      return;
    }
    server.handleUpgrade(request, socket, head, (ws) =>
      server.emit("connection", ws, request),
    );
  });
  const requests = new Set<Promise<void>>();
  let closing = false;
  server.on("connection", (ws) => {
    hub.add(ws);
    let queue = Promise.resolve();
    ws.on("message", (raw) => {
      if (closing) return;
      queue = queue
        .then(async () => {
          const parsed = parseClientMessage(raw);
          if (!parsed.ok) {
            send(ws, {
              type: "error",
              requestId: parsed.requestId,
              payload: { message: parsed.error },
            });
            return;
          }
          try {
            await handleMessage({ ws, hub, runs }, parsed.message);
          } catch (error) {
            send(ws, {
              type: "error",
              requestId: parsed.message.requestId,
              payload: {
                message: error instanceof Error ? error.message : String(error),
              },
            });
          }
        })
        .catch((error) => console.error("WebSocket handler failed:", error));
      const task = queue;
      requests.add(task);
      void task.finally(() => requests.delete(task));
    });
    ws.on("close", () => hub.remove(ws));
    ws.on("error", (error) => console.error("WebSocket error:", error));
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(options.port, "127.0.0.1", resolve);
  });
  const address = http.address();
  return {
    port: typeof address === "object" && address ? address.port : options.port,
    async close() {
      closing = true;
      // Stop accepting work before waiting for processes and persistence.
      for (const client of server.clients)
        client.close(1001, "Orchestrator shutting down");
      const stopped = runs.shutdown();
      await Promise.allSettled([...requests]);
      await stopped;
      for (const client of server.clients) client.terminate();
      await new Promise<void>((resolve) => server.close(() => resolve()));
      await new Promise<void>((resolve) => http.close(() => resolve()));
      await mongoose.disconnect();
    },
  };
}
