import { z } from "zod";

/**
 * Shared contract between the orchestrator backend and the web UI.
 *
 * Everything that crosses the WebSocket boundary is validated with zod on the
 * way in and typed with `z.infer` everywhere else. Keep this package free of
 * runtime dependencies other than zod so the frontend can import it directly.
 */

/* -------------------------------------------------------------------------- */
/* Providers                                                                   */
/* -------------------------------------------------------------------------- */

export const ProviderIdSchema = z.enum(["claude", "codex", "cursor"]);
export type ProviderId = z.infer<typeof ProviderIdSchema>;

export interface ProviderMeta {
  id: ProviderId;
  label: string;
  /** Binary that must be installed and on PATH for this agent to run. */
  binary: string;
  description: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "claude",
    label: "Claude Code",
    binary: "claude",
    description: "Anthropic's Claude Code CLI.",
  },
  {
    id: "codex",
    label: "Codex",
    binary: "codex",
    description: "OpenAI's Codex CLI.",
  },
  {
    id: "cursor",
    label: "Cursor",
    binary: "cursor-agent",
    description: "Cursor's headless agent CLI.",
  },
];

export const PROVIDERS_BY_ID: Record<ProviderId, ProviderMeta> = Object.fromEntries(
  PROVIDERS.map((provider) => [provider.id, provider]),
) as Record<ProviderId, ProviderMeta>;

/* -------------------------------------------------------------------------- */
/* Domain models                                                               */
/* -------------------------------------------------------------------------- */

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const RunStatusSchema = z.enum(["running", "completed", "failed", "cancelled"]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  createdAt: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const CreateWorkspaceSchema = WorkspaceSchema.pick({
  name: true,
  path: true,
});
export type CreateWorkspaceSchemaType = z.infer<typeof CreateWorkspaceSchema>;

export const SessionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  provider: ProviderIdSchema,
  title: z.string(),
  createdAt: z.string(),
});
export type Session = z.infer<typeof SessionSchema>;

export const CreateSessionSchema = z.object({
  workspaceId: z.string(),
  provider: ProviderIdSchema,
  title: z.string().min(1).max(120).optional(),
});
export type CreateSessionSchemaType = z.infer<typeof CreateSessionSchema>;

export const MessageSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  role: MessageRoleSchema,
  content: z.string(),
  createdAt: z.string(),
});
export type Message = z.infer<typeof MessageSchema>;

export const RunSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  provider: ProviderIdSchema,
  prompt: z.string(),
  status: RunStatusSchema,
  exitCode: z.number().nullable().optional(),
  startedAt: z.string(),
  endedAt: z.string().nullable().optional(),
});
export type Run = z.infer<typeof RunSchema>;

export const StartRunSchema = z.object({
  sessionId: z.string(),
  prompt: z.string().min(1),
});
export type StartRunSchemaType = z.infer<typeof StartRunSchema>;

/* -------------------------------------------------------------------------- */
/* WebSocket protocol                                                          */
/* -------------------------------------------------------------------------- */

/** Messages sent by the browser to the orchestrator. */
export const ClientMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("workspace.list") }),
  z.object({ type: z.literal("workspace.create"), payload: CreateWorkspaceSchema }),
  z.object({ type: z.literal("session.list"), payload: z.object({ workspaceId: z.string() }) }),
  z.object({ type: z.literal("session.create"), payload: CreateSessionSchema }),
  z.object({ type: z.literal("session.messages"), payload: z.object({ sessionId: z.string() }) }),
  z.object({ type: z.literal("run.start"), payload: StartRunSchema }),
  z.object({ type: z.literal("run.cancel"), payload: z.object({ runId: z.string() }) }),
]);
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ClientMessageType = ClientMessage["type"];

/** Messages sent by the orchestrator to the browser. */
export const ServerMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("error"), payload: z.object({ message: z.string() }) }),
  z.object({ type: z.literal("workspace.list"), payload: z.object({ workspaces: z.array(WorkspaceSchema) }) }),
  z.object({ type: z.literal("workspace.created"), payload: z.object({ workspace: WorkspaceSchema }) }),
  z.object({ type: z.literal("session.list"), payload: z.object({ sessions: z.array(SessionSchema) }) }),
  z.object({ type: z.literal("session.created"), payload: z.object({ session: SessionSchema }) }),
  z.object({ type: z.literal("session.messages"), payload: z.object({ messages: z.array(MessageSchema) }) }),
  z.object({ type: z.literal("message.created"), payload: z.object({ message: MessageSchema }) }),
  z.object({ type: z.literal("run.started"), payload: z.object({ run: RunSchema }) }),
  z.object({
    type: z.literal("run.output"),
    payload: z.object({
      runId: z.string(),
      sessionId: z.string(),
      stream: z.enum(["stdout", "stderr"]),
      chunk: z.string(),
    }),
  }),
  z.object({ type: z.literal("run.completed"), payload: z.object({ run: RunSchema }) }),
]);
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ServerMessageType = ServerMessage["type"];

/** Narrow a payload to a single protocol message type. */
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;
