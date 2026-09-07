import mongoose from "mongoose";
import { WebSocketServer } from "ws";
import { handleMessage } from "./src/handlers";
import { Hub } from "./src/hub";
import { parseClientMessage, send } from "./src/protocol";

/**
 * aiSarthi orchestrator entrypoint.
 *
 * Connects to MongoDB, then opens a WebSocket server that the web UI talks to.
 * All real work lives in `src/`; this file only wires the pieces together.
 */

const DB_URL = process.env.DB_URL ?? "mongodb://localhost:27017/aisarthi";
const PORT = Number(process.env.PORT ?? 3000);

async function main(): Promise<void> {
  await mongoose.connect(DB_URL);
  console.log(`Connected to MongoDB at ${DB_URL}`);

  const hub = new Hub();
  const server = new WebSocketServer({ port: PORT });

  server.on("connection", (ws) => {
    hub.add(ws);
    console.log("Client connected");

    ws.on("message", async (raw) => {
      const parsed = parseClientMessage(raw);
      if (!parsed.ok) {
        send(ws, { type: "error", payload: { message: parsed.error } });
        return;
      }

      try {
        await handleMessage({ ws, hub }, parsed.message);
      } catch (error) {
        console.error(`Failed to handle "${parsed.message.type}":`, error);
        send(ws, {
          type: "error",
          payload: { message: error instanceof Error ? error.message : String(error) },
        });
      }
    });

    ws.on("close", () => {
      hub.remove(ws);
      console.log("Client disconnected");
    });

    ws.on("error", (error) => console.error("WebSocket error:", error));
  });

  console.log(`WebSocket server running on ws://localhost:${PORT}`);
}

main().catch((error) => {
  console.error("Failed to start orchestrator:", error);
  process.exit(1);
});
