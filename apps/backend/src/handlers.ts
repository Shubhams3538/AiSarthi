import { realpath, stat } from "node:fs/promises";
import { isAbsolute } from "node:path";
import { isProviderAvailable } from "agents/client";
import type { WebSocket } from "ws";
import {
  MessageModel,
  ProviderCredentialModel,
  SessionModel,
  RunModel,
  WorkspaceModel,
} from "db/client";
import {
  PROVIDERS,
  PROVIDERS_BY_ID,
  type ClientMessage,
  type ProviderId,
} from "commons/types";
import { send } from "./protocol";
import {
  toCredential,
  toCredentialList,
  toMessage,
  toSession,
  toWorkspace,
  toRun,
} from "./dto";
import type { Hub } from "./hub";
import type { RunManager } from "./runs";

export interface HandlerContext {
  ws: WebSocket;
  hub: Hub;
  runs: RunManager;
}

const defaultTitle = (provider: ProviderId): string =>
  `${PROVIDERS_BY_ID[provider].label} session`;

/**
 * Routes a validated client message to the code that owns it.
 *
 * The server reports validation and persistence failures to the requesting socket.
 */
export async function handleMessage(
  ctx: HandlerContext,
  message: ClientMessage,
): Promise<void> {
  const reply = (response: Parameters<typeof send>[1]) =>
    send(ctx.ws, { ...response, requestId: message.requestId });
  switch (message.type) {
    case "workspace.list": {
      const workspaces = await WorkspaceModel.find().sort({ createdAt: -1 });
      reply({
        type: "workspace.list",
        payload: { workspaces: workspaces.map(toWorkspace) },
      });
      return;
    }

    case "workspace.create": {
      if (!isAbsolute(message.payload.path))
        throw new Error("Use an absolute workspace path");
      const path = await realpath(message.payload.path);
      if (!(await stat(path)).isDirectory())
        throw new Error("Workspace path must be a directory");
      const existing = await WorkspaceModel.findOne({ path });
      const workspace =
        existing ??
        (await WorkspaceModel.create({ name: message.payload.name, path }));
      ctx.hub.broadcast({
        type: "workspace.created",
        requestId: message.requestId,
        payload: { workspace: toWorkspace(workspace) },
      });
      return;
    }

    case "session.list": {
      const sessions = await SessionModel.find({
        workspace: message.payload.workspaceId,
      }).sort({
        createdAt: -1,
      });
      reply({
        type: "session.list",
        payload: {
          workspaceId: message.payload.workspaceId,
          sessions: sessions.map(toSession),
        },
      });
      return;
    }

    case "session.create": {
      const { workspaceId, provider, title } = message.payload;
      const workspace = await WorkspaceModel.findById(workspaceId);
      if (!workspace) {
        reply({
          type: "error",
          payload: { message: `Workspace ${workspaceId} not found` },
        });
        return;
      }
      const session = await SessionModel.create({
        workspace: workspace._id,
        provider,
        title: title?.trim() || defaultTitle(provider),
      });
      ctx.hub.broadcast({
        type: "session.created",
        requestId: message.requestId,
        payload: { session: toSession(session) },
      });
      return;
    }

    case "session.messages": {
      const sessionId = message.payload.sessionId;
      if (!(await SessionModel.exists({ _id: sessionId })))
        throw new Error("Session not found");
      const messages = await MessageModel.find({ session: sessionId }).sort({
        createdAt: 1,
        _id: 1,
      });
      const runs = await RunModel.find({ session: sessionId }).sort({
        createdAt: 1,
        _id: 1,
      });
      reply({
        type: "session.messages",
        payload: {
          sessionId,
          messages: messages.map(toMessage),
          runs: runs.map(toRun),
          output: {
            ...Object.fromEntries(
              runs.map((run) => [String(run._id), run.output ?? ""]),
            ),
            ...ctx.runs.outputFor(sessionId),
          },
        },
      });
      return;
    }

    case "run.start": {
      await ctx.runs.start(
        message.payload.sessionId,
        message.payload.prompt,
        message.requestId,
      );
      return;
    }

    case "run.cancel": {
      const cancelled = ctx.runs.cancel(message.payload.runId);
      if (!cancelled) {
        reply({
          type: "error",
          payload: { message: `Run ${message.payload.runId} is not active` },
        });
      }
      return;
    }

    case "credentials.list": {
      const credentials = await ProviderCredentialModel.find();
      reply({
        type: "credentials.list",
        payload: {
          credentials: toCredentialList(credentials),
          providers: PROVIDERS.map(({ id }) => ({
            id,
            available: isProviderAvailable(id),
          })),
        },
      });
      return;
    }

    case "credentials.save": {
      const { provider } = message.payload;
      const apiKey = message.payload.apiKey.trim();
      if (!apiKey) {
        reply({
          type: "error",
          payload: { message: "API key must not be empty" },
        });
        return;
      }

      // One document per provider, so saving again replaces the previous key.
      const credential = await ProviderCredentialModel.findOneAndUpdate(
        { provider },
        { provider, apiKey },
        { upsert: true, returnDocument: "after" },
      );
      if (!credential) {
        reply({
          type: "error",
          payload: { message: `Could not save ${provider} credential` },
        });
        return;
      }

      ctx.hub.broadcast({
        type: "credentials.saved",
        requestId: message.requestId,
        payload: { credential: toCredential(credential) },
      });
      return;
    }

    case "credentials.delete": {
      const { provider } = message.payload;
      await ProviderCredentialModel.deleteOne({ provider });
      ctx.hub.broadcast({
        type: "credentials.deleted",
        requestId: message.requestId,
        payload: { provider },
      });
      return;
    }
  }
}
