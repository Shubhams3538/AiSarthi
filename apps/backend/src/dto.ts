import type { HydratedDocument } from "mongoose";
import type {
  MessageDoc,
  ProviderCredentialDoc,
  RunDoc,
  SessionDoc,
  WorkspaceDoc,
} from "db/client";
import { PROVIDERS } from "commons/types";
import type {
  Message,
  ProviderCredential,
  ProviderId,
  Run,
  Session,
  Workspace,
} from "commons/types";

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

/**
 * Deliberately drops the key. The UI only needs to know whether a provider is
 * configured, never the secret itself.
 */
export function toCredential(doc: HydratedDocument<ProviderCredentialDoc>): ProviderCredential {
  return {
    provider: doc.provider as ProviderId,
    configured: Boolean(doc.apiKey),
    updatedAt: iso(doc.updatedAt),
  };
}

/** Every provider, so the setup page always renders a full list. */
export function toCredentialList(
  docs: HydratedDocument<ProviderCredentialDoc>[],
): ProviderCredential[] {
  const byProvider = new Map(docs.map((doc) => [doc.provider, toCredential(doc)]));
  return PROVIDERS.map(
    ({ id }) => byProvider.get(id) ?? { provider: id, configured: false, updatedAt: null },
  );
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
