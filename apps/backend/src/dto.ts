import type { HydratedDocument } from "mongoose";
import type { MessageDoc, RunDoc, SessionDoc, WorkspaceDoc } from "db/client";
import type { Message, ProviderId, Run, Session, Workspace } from "commons/types";

/**
 * Mongo documents -> wire DTOs.
 *
 * `_id` becomes a plain string id and all dates become ISO strings so the
 * frontend never has to know about ObjectIds.
 */

// Records written before timestamps were enabled (or by an older schema) can be
// missing their dates entirely. Never let one such document break a whole list.
const iso = (value: Date | string | null | undefined): string => {
  if (!value) return new Date(0).toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date(0).toISOString() : date.toISOString();
};

export function toWorkspace(doc: HydratedDocument<WorkspaceDoc>): Workspace {
  return {
    id: String(doc._id),
    name: doc.name,
    path: doc.path,
    createdAt: iso(doc.createdAt),
  };
}

export function toSession(doc: HydratedDocument<SessionDoc>): Session {
  return {
    id: String(doc._id),
    workspaceId: String(doc.workspace),
    provider: doc.provider as ProviderId,
    title: doc.title,
    createdAt: iso(doc.createdAt),
  };
}

export function toMessage(doc: HydratedDocument<MessageDoc>): Message {
  return {
    id: String(doc._id),
    sessionId: String(doc.session),
    role: doc.role,
    content: doc.content,
    createdAt: iso(doc.createdAt),
  };
}

export function toRun(doc: HydratedDocument<RunDoc>): Run {
  return {
    id: String(doc._id),
    sessionId: String(doc.session),
    provider: doc.provider as ProviderId,
    prompt: doc.prompt,
    status: doc.status,
    exitCode: doc.exitCode,
    startedAt: iso(doc.createdAt),
    endedAt: doc.endedAt ? iso(doc.endedAt) : null,
  };
}
