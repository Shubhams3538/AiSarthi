import { afterAll, beforeAll, expect, test } from "bun:test";
import { chmod, mkdtemp, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import mongoose from "mongoose";
import { startAgent, type StartAgentOptions } from "../../../packages/agents";
import { RunModel } from "../../../packages/db";
import {
  ServerMessageSchema,
  type ClientMessage,
  type ServerMessage,
} from "../../../packages/commons";
import { startServer } from "../src/server";
import { RunManager } from "../src/runs";

let server: Awaited<ReturnType<typeof startServer>>;
let socket: WebSocket;
let folder: string;
let workspaceId: string;
let sessionId: string;
const frames: ServerMessage[] = [];
const invocations: StartAgentOptions[] = [];
const dbUrl = `mongodb://127.0.0.1:27017/aisarthi_test_${crypto.randomUUID().replaceAll("-", "")}`;

async function waitFor(
  predicate: (frame: ServerMessage) => boolean,
  from = 0,
): Promise<ServerMessage> {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const frame = frames.slice(from).find(predicate);
    if (frame) return frame;
    await Bun.sleep(10);
  }
  throw new Error("Timed out waiting for frame");
}
async function request(message: ClientMessage) {
  const requestId = crypto.randomUUID();
  socket.send(JSON.stringify({ ...message, requestId }));
  return waitFor((frame) => frame.requestId === requestId);
}
async function connect() {
  const ws = new WebSocket(`ws://127.0.0.1:${server.port}`);
  ws.addEventListener("message", (event) =>
    frames.push(ServerMessageSchema.parse(JSON.parse(String(event.data)))),
  );
  await new Promise<void>((resolve, reject) => {
    ws.addEventListener("open", () => resolve());
    ws.addEventListener("error", () =>
      reject(new Error("WebSocket connection failed")),
    );
  });
  return ws;
}

beforeAll(async () => {
  folder = await mkdtemp(join(tmpdir(), "aisarthi-test-"));
  const bin = join(folder, "bin");
  await mkdir(bin);
  // Exercise the real adapter/process pipes without provider usage or charges.
  const fixture = `#!${process.execPath}\nconst prompt = await Bun.stdin.text();\nconst bytes = new TextEncoder().encode("Hello 🙂");\nprocess.stdout.write(bytes.slice(0, 8));\nawait Bun.sleep(30);\nprocess.stdout.write(bytes.slice(8));\nif (prompt.endsWith("tree")) { const child = Bun.spawn([process.execPath, "-e", "await Bun.sleep(30000)"], { stdout: "inherit", stderr: "inherit" }); process.stderr.write("child:" + child.pid); await Bun.sleep(30000); }\nif (prompt.endsWith("slow")) await Bun.sleep(30000);\nif (prompt.endsWith("fail")) { process.stderr.write("Provider failed"); process.exit(7); }\n`;
  for (const name of ["claude", "codex", "cursor-agent"]) {
    const path = join(bin, name);
    await Bun.write(path, fixture);
    await chmod(path, 0o755);
  }
  server = await startServer({
    dbUrl,
    port: 0,
    createRuns: (hub) =>
      new RunManager(
        hub,
        (options) => {
          invocations.push(options);
          return startAgent({
            ...options,
            env: { ...options.env, PATH: `${bin}:${process.env.PATH}` },
          });
        },
        () => true,
      ),
  });
  socket = await connect();
}, 15000);

afterAll(async () => {
  socket?.close();
  if (server) {
    // Only the unique database created by this suite is ever removed.
    expect(mongoose.connection.name).toStartWith("aisarthi_test_");
    await server.close();
    await mongoose.connect(dbUrl);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
}, 15000);

test("health endpoint and invalid browser origin", async () => {
  expect((await fetch(`http://127.0.0.1:${server.port}/health`)).status).toBe(
    200,
  );
  const response = await fetch(`http://127.0.0.1:${server.port}`, {
    headers: {
      Upgrade: "websocket",
      Connection: "Upgrade",
      "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
      "Sec-WebSocket-Version": "13",
      Origin: "https://untrusted.example",
    },
  });
  expect(response.status).toBe(403);
});

test("reject invalid paths and malformed IDs", async () => {
  const error = await request({
    type: "workspace.create",
    payload: { name: "bad", path: "relative" },
  });
  expect(error.type).toBe("error");
  expect(
    (
      await request({
        type: "run.start",
        payload: { sessionId: "bad", prompt: "hello" },
      })
    ).type,
  ).toBe("error");
});

test("workspace and session creation persist and correlate acknowledgements", async () => {
  const workspace = await request({
    type: "workspace.create",
    payload: { name: "Test project", path: folder },
  });
  expect(workspace.type).toBe("workspace.created");
  if (workspace.type !== "workspace.created")
    throw new Error("Workspace not created");
  workspaceId = workspace.payload.workspace.id;
  const duplicate = await request({
    type: "workspace.create",
    payload: { name: "Same project", path: folder },
  });
  if (duplicate.type !== "workspace.created")
    throw new Error("Duplicate response invalid");
  expect(duplicate.payload.workspace.id).toBe(workspaceId);
  const session = await request({
    type: "session.create",
    payload: { workspaceId, provider: "codex", title: "Test session" },
  });
  if (session.type !== "session.created")
    throw new Error("Session not created");
  sessionId = session.payload.session.id;
  const list = await request({
    type: "session.list",
    payload: { workspaceId },
  });
  if (list.type !== "session.list") throw new Error("No sessions");
  expect(list.payload.workspaceId).toBe(workspaceId);
  expect(list.payload.sessions[0]?.id).toBe(sessionId);
});

test("credentials never cross the wire and removal is acknowledged", async () => {
  await request({
    type: "credentials.save",
    payload: { provider: "codex", apiKey: "test-secret-not-a-real-key" },
  });
  const list = await request({ type: "credentials.list" });
  expect(JSON.stringify(list)).not.toContain("test-secret-not-a-real-key");
  if (list.type !== "credentials.list") throw new Error("No credential list");
  expect(
    list.payload.credentials.find((item) => item.provider === "codex")
      ?.configured,
  ).toBe(true);
  expect(list.payload.providers).toHaveLength(3);
  expect(
    (
      await request({
        type: "credentials.delete",
        payload: { provider: "codex" },
      })
    ).type,
  ).toBe("credentials.deleted");
});

test("real process streaming preserves split UTF-8 and stores the transcript", async () => {
  const started = await request({
    type: "run.start",
    payload: { sessionId, prompt: "hello" },
  });
  if (started.type !== "run.started") throw new Error("Run not started");
  const done = await waitFor(
    (frame) =>
      frame.type === "run.completed" &&
      frame.payload.run.id === started.payload.run.id,
  );
  if (done.type !== "run.completed") throw new Error("Run not completed");
  expect(done.payload.run.status).toBe("completed");
  const snapshot = await request({
    type: "session.messages",
    payload: { sessionId },
  });
  if (snapshot.type !== "session.messages") throw new Error("Snapshot missing");
  expect(snapshot.payload.messages.map((item) => item.content)).toEqual([
    "hello",
    "Hello 🙂",
  ]);
  expect(snapshot.payload.output[started.payload.run.id]).toBe("Hello 🙂");
});

test("overlapping runs are rejected; reconnect restores live output and cancellation", async () => {
  const started = await request({
    type: "run.start",
    payload: { sessionId, prompt: "slow" },
  });
  if (started.type !== "run.started") throw new Error("Run not started");
  await waitFor(
    (frame) =>
      frame.type === "run.output" &&
      frame.payload.runId === started.payload.run.id,
  );
  const overlap = await request({
    type: "run.start",
    payload: { sessionId, prompt: "duplicate" },
  });
  expect(overlap.type).toBe("error");
  expect(invocations.at(-1)?.prompt).toContain("Hello 🙂");
  expect(invocations.at(-1)?.prompt).toEndWith("slow");
  socket.close();
  socket = await connect();
  const snapshot = await request({
    type: "session.messages",
    payload: { sessionId },
  });
  if (snapshot.type !== "session.messages") throw new Error("Snapshot missing");
  expect(snapshot.payload.runs.at(-1)?.status).toBe("running");
  expect(snapshot.payload.output[started.payload.run.id]).toStartWith("Hello");
  socket.send(
    JSON.stringify({
      type: "run.cancel",
      payload: { runId: started.payload.run.id },
    }),
  );
  const done = await waitFor(
    (frame) =>
      frame.type === "run.completed" &&
      frame.payload.run.id === started.payload.run.id,
  );
  if (done.type !== "run.completed") throw new Error("Run not completed");
  expect(done.payload.run.status).toBe("cancelled");
});

test("provider failures preserve stderr alongside stdout", async () => {
  const started = await request({
    type: "run.start",
    payload: { sessionId, prompt: "fail" },
  });
  if (started.type !== "run.started") throw new Error("Run not started");
  const done = await waitFor(
    (frame) =>
      frame.type === "run.completed" &&
      frame.payload.run.id === started.payload.run.id,
  );
  if (done.type !== "run.completed") throw new Error("Run not completed");
  expect(done.payload.run.status).toBe("failed");
  expect(done.payload.run.exitCode).toBe(7);
  const snapshot = await request({
    type: "session.messages",
    payload: { sessionId },
  });
  if (snapshot.type !== "session.messages") throw new Error("Snapshot missing");
  expect(snapshot.payload.messages.at(-1)?.content).toContain(
    "Provider failed",
  );
});

test("cancellation terminates the agent's child process group", async () => {
  const started = await request({
    type: "run.start",
    payload: { sessionId, prompt: "tree" },
  });
  if (started.type !== "run.started") throw new Error("Run not started");
  const frame = await waitFor(
    (frame) =>
      frame.type === "run.output" &&
      frame.payload.runId === started.payload.run.id &&
      frame.payload.chunk.includes("child:"),
  );
  if (frame.type !== "run.output") throw new Error("No child output");
  const childPid = Number(frame.payload.chunk.match(/child:(\d+)/)?.[1]);
  expect(childPid).toBeGreaterThan(0);
  socket.send(
    JSON.stringify({
      type: "run.cancel",
      payload: { runId: started.payload.run.id },
    }),
  );
  await waitFor(
    (frame) =>
      frame.type === "run.completed" &&
      frame.payload.run.id === started.payload.run.id,
  );
  expect(() => process.kill(childPid, 0)).toThrow();
});

test("restart repairs interrupted runs and preserves session history", async () => {
  await server.close();
  await mongoose.connect(dbUrl);
  const orphan = await RunModel.create({
    session: sessionId,
    provider: "codex",
    prompt: "orphan",
    status: "running",
  });
  await mongoose.disconnect();
  server = await startServer({ dbUrl, port: 0 });
  socket = await connect();
  const snapshot = await request({
    type: "session.messages",
    payload: { sessionId },
  });
  if (snapshot.type !== "session.messages") throw new Error("Snapshot missing");
  expect(
    snapshot.payload.runs.find((run) => run.id === String(orphan._id))?.status,
  ).toBe("failed");
  expect(snapshot.payload.messages.length).toBe(8);
});
