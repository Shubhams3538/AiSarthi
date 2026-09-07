import type { WebSocket } from "ws";
import { MessageModel, SessionModel, WorkspaceModel } from "db/client";
import { PROVIDERS_BY_ID, type ClientMessage, type ProviderId } from "commons/types";
import { send } from "./protocol";
import { toMessage, toSession, toWorkspace } from "./dto";
import type { Hub } from "./hub";

export interface HandlerContext {
  ws: WebSocket;
  hub: Hub;
}

const defaultTitle = (provider: ProviderId): string =>
  `${PROVIDERS_BY_ID[provider].label} session`;

/**
 * Routes a validated client message to the code that owns it.
 *
 * Handlers never throw at the caller — validation errors and missing records
 * are reported back to the requesting socket as `error` frames.
 */
export async function handleMessage(
  ctx: HandlerContext,
  message: ClientMessage,
): Promise<void> {
  switch (message.type) {
    case "workspace.list": {
      const workspaces = await WorkspaceModel.find().sort({ createdAt: -1 });
      send(ctx.ws, {
        type: "workspace.list",
        payload: { workspaces: workspaces.map(toWorkspace) },
      });
      return;
    }

    case "workspace.create": {
      const workspace = await WorkspaceModel.create({
        name: message.payload.name,
        path: message.payload.path,
      });
      ctx.hub.broadcast({
        type: "workspace.created",
        payload: { workspace: toWorkspace(workspace) },
      });
      return;
    }

    case "session.list": {
      const sessions = await SessionModel.find({ workspace: message.payload.workspaceId }).sort({
        createdAt: -1,
      });
      send(ctx.ws, {
        type: "session.list",
        payload: { sessions: sessions.map(toSession) },
      });
      return;
    }

    case "session.create": {
      const { workspaceId, provider, title } = message.payload;
      const workspace = await WorkspaceModel.findById(workspaceId);
      if (!workspace) {
        send(ctx.ws, { type: "error", payload: { message: `Workspace ${workspaceId} not found` } });
        return;
      }
      const session = await SessionModel.create({
        workspace: workspace._id,
        provider,
        title: title?.trim() || defaultTitle(provider),
      });
      ctx.hub.broadcast({
        type: "session.created",
        payload: { session: toSession(session) },
      });
      return;
    }

    case "session.messages": {
      const messages = await MessageModel.find({ session: message.payload.sessionId }).sort({
        createdAt: 1,
      });
      send(ctx.ws, {
        type: "session.messages",
        payload: { messages: messages.map(toMessage) },
      });
      return;
    }

    case "run.start":
    case "run.cancel": {
      send(ctx.ws, {
        type: "error",
        payload: { message: "Agent runs are not wired up yet" },
      });
      return;
    }
  }
}
