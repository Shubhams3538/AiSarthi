import { WebSocket } from "ws";
import type { ServerMessage } from "commons/types";
import { serialize } from "./protocol";

/**
 * Tracks every connected browser and fans messages out to them.
 *
 * The orchestrator is a local, single-user tool, so for now a broadcast to all
 * sockets is the right granularity: any open tab sees workspace, session and
 * run events as they happen.
 */
export class Hub {
  private readonly clients = new Set<WebSocket>();

  add(ws: WebSocket): void {
    this.clients.add(ws);
  }

  remove(ws: WebSocket): void {
    this.clients.delete(ws);
  }

  broadcast(message: ServerMessage): void {
    const payload = serialize(message);
    for (const client of this.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  }
}
