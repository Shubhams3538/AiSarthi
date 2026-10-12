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
  /**
   * Environment variable the CLI reads an API key from. When a credential is
   * stored for this provider the orchestrator injects it under this name while
   * spawning, so no key ever has to sit in the shell environment.
   */
  apiKeyEnvVar: string;
  /** Where the user creates a key, linked from the setup page. */
  apiKeyUrl: string;
}

export const PROVIDERS: ProviderMeta[] = [
  {
    id: "claude",
    label: "Claude Code",
    binary: "claude",
    description: "Anthropic's Claude Code CLI.",
    apiKeyEnvVar: "ANTHROPIC_API_KEY",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
  },
  {
    id: "codex",
    label: "Codex",
    binary: "codex",
    description: "OpenAI's Codex CLI.",
    apiKeyEnvVar: "CODEX_API_KEY",
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
  {
    id: "cursor",
    label: "Cursor",
    binary: "cursor-agent",
    description: "Cursor's headless agent CLI.",
    apiKeyEnvVar: "CURSOR_API_KEY",
    apiKeyUrl: "https://cursor.com/docs/cli/reference/authentication",
  },
];

export const PROVIDERS_BY_ID: Record<ProviderId, ProviderMeta> =
  Object.fromEntries(
    PROVIDERS.map((provider) => [provider.id, provider]),
  ) as Record<ProviderId, ProviderMeta>;

/* -------------------------------------------------------------------------- */
/* Domain models                                                               */
/* -------------------------------------------------------------------------- */

export const MessageRoleSchema = z.enum(["user", "assistant", "system"]);
export type MessageRole = z.infer<typeof MessageRoleSchema>;

export const RunStatusSchema = z.enum([
  "running",
  "completed",
  "failed",
  "cancelled",
]);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  createdAt: z.string(),
});
export type Workspace = z.infer<typeof WorkspaceSchema>;

export const ObjectIdSchema = z
  .string()
  .regex(/^[a-f\d]{24}$/i, "Invalid record ID");

export const CreateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  path: z.string().trim().min(1).max(4096),
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
  workspaceId: ObjectIdSchema,
  provider: ProviderIdSchema,
  title: z.string().trim().min(1).max(120).optional(),
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
  sessionId: ObjectIdSchema,
  prompt: z.string().trim().min(1).max(32000),
});
export type StartRunSchemaType = z.infer<typeof StartRunSchema>;

/* -------------------------------------------------------------------------- */
/* Provider credentials                                                        */
/* -------------------------------------------------------------------------- */

/**
 * A stored API key for a provider.
 *
 * The key itself never crosses the wire: the UI only learns whether a provider
 * is configured and when it last changed.
 */
export const ProviderCredentialSchema = z.object({
  provider: ProviderIdSchema,
  configured: z.boolean(),
  updatedAt: z.string().nullable(),
});
export type ProviderCredential = z.infer<typeof ProviderCredentialSchema>;

export const SaveProviderCredentialSchema = z.object({
  provider: ProviderIdSchema,
  apiKey: z.string().trim().min(1).max(512),
});
export type SaveProviderCredentialSchemaType = z.infer<
  typeof SaveProviderCredentialSchema
>;

export const DeleteProviderCredentialSchema = z.object({
  provider: ProviderIdSchema,
});
export type DeleteProviderCredentialSchemaType = z.infer<
  typeof DeleteProviderCredentialSchema
>;

/* -------------------------------------------------------------------------- */
/* WebSocket protocol                                                          */
/* -------------------------------------------------------------------------- */

/** Messages sent by the browser to the orchestrator. */
export const ClientMessageSchema = z
  .discriminatedUnion("type", [
    z.object({ type: z.literal("workspace.list") }),
    z.object({
      type: z.literal("workspace.create"),
      payload: CreateWorkspaceSchema,
    }),
    z.object({
      type: z.literal("session.list"),
      payload: z.object({ workspaceId: ObjectIdSchema }),
    }),
    z.object({
      type: z.literal("session.create"),
      payload: CreateSessionSchema,
    }),
    z.object({
      type: z.literal("session.messages"),
      payload: z.object({ sessionId: ObjectIdSchema }),
    }),
    z.object({ type: z.literal("run.start"), payload: StartRunSchema }),
    z.object({
      type: z.literal("run.cancel"),
      payload: z.object({ runId: ObjectIdSchema }),
    }),
    z.object({ type: z.literal("credentials.list") }),
    z.object({
      type: z.literal("credentials.save"),
      payload: SaveProviderCredentialSchema,
    }),
    z.object({
      type: z.literal("credentials.delete"),
      payload: DeleteProviderCredentialSchema,
    }),
  ])
  .and(z.object({ requestId: z.string().max(100).optional() }));
export type ClientMessage = z.infer<typeof ClientMessageSchema>;
export type ClientMessageType = ClientMessage["type"];

/** Messages sent by the orchestrator to the browser. */
export const ServerMessageSchema = z
  .discriminatedUnion("type", [
    z.object({
      type: z.literal("error"),
      payload: z.object({ message: z.string() }),
    }),
    z.object({
      type: z.literal("workspace.list"),
      payload: z.object({ workspaces: z.array(WorkspaceSchema) }),
    }),
    z.object({
      type: z.literal("workspace.created"),
      payload: z.object({ workspace: WorkspaceSchema }),
    }),
    z.object({
      type: z.literal("session.list"),
      payload: z.object({
        workspaceId: z.string(),
        sessions: z.array(SessionSchema),
      }),
    }),
    z.object({
      type: z.literal("session.created"),
      payload: z.object({ session: SessionSchema }),
    }),
    z.object({
      type: z.literal("session.messages"),
      payload: z.object({
        sessionId: z.string(),
        messages: z.array(MessageSchema),
        runs: z.array(RunSchema),
        output: z.record(z.string(), z.string()),
      }),
    }),
    z.object({
      type: z.literal("message.created"),
      payload: z.object({ message: MessageSchema }),
    }),
    z.object({
      type: z.literal("run.started"),
      payload: z.object({ run: RunSchema }),
    }),
    z.object({
      type: z.literal("run.output"),
      payload: z.object({
        runId: z.string(),
        sessionId: z.string(),
        stream: z.enum(["stdout", "stderr"]),
        chunk: z.string(),
      }),
    }),
    z.object({
      type: z.literal("run.completed"),
      payload: z.object({ run: RunSchema }),
    }),
    z.object({
      type: z.literal("credentials.list"),
      payload: z.object({
        credentials: z.array(ProviderCredentialSchema),
        providers: z.array(
          z.object({ id: ProviderIdSchema, available: z.boolean() }),
        ),
      }),
    }),
    z.object({
      type: z.literal("credentials.saved"),
      payload: z.object({ credential: ProviderCredentialSchema }),
    }),
    z.object({
      type: z.literal("credentials.deleted"),
      payload: z.object({ provider: ProviderIdSchema }),
    }),
  ])
  .and(z.object({ requestId: z.string().optional() }));
export type ServerMessage = z.infer<typeof ServerMessageSchema>;
export type ServerMessageType = ServerMessage["type"];

/** Narrow a payload to a single protocol message type. */
export type ServerMessageOf<T extends ServerMessageType> = Extract<
  ServerMessage,
  { type: T }
>;
