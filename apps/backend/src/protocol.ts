import { WebSocket } from "ws";
import {
  ClientMessageSchema,
  ServerMessageSchema,
  type ClientMessage,
  type ServerMessage,
} from "commons/types";

/**
 * Framing helpers for the orchestrator WebSocket protocol.
 *
 * Every frame is a JSON object shaped like `{ type, payload }`. Inbound frames
 * are validated before they reach the handlers so a malformed client can never
 * crash the server, and outbound frames are serialised once per broadcast.
 */

export type ParseResult =
  | { ok: true; message: ClientMessage }
  | { ok: false; error: string; requestId?: string };

export function parseClientMessage(raw: unknown): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(String(raw));
  } catch {
    return { ok: false, error: "Message must be valid JSON" };
  }

  const candidate =
    json && typeof json === "object" && "requestId" in json
      ? json.requestId
      : undefined;
  const requestId =
    typeof candidate === "string" && candidate.length <= 100
      ? candidate
      : undefined;
  const result = ClientMessageSchema.safeParse(json);
  if (!result.success) {
    const detail = result.error.issues
      .map((issue) => `${issue.path.join(".") || "message"}: ${issue.message}`)
      .join("; ");
    return { ok: false, error: `Invalid message (${detail})`, requestId };
  }

  return { ok: true, message: result.data };
}

export function serialize(message: ServerMessage): string {
  return JSON.stringify(ServerMessageSchema.parse(message));
}

export function send(ws: WebSocket, message: ServerMessage): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(serialize(message));
}
