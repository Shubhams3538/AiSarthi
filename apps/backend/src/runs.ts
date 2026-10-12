import {
  startAgent,
  isProviderAvailable,
  type AgentProcess,
} from "agents/client";
import { PROVIDERS_BY_ID, ProviderIdSchema } from "commons/types";
import {
  MessageModel,
  ProviderCredentialModel,
  RunModel,
  SessionModel,
  WorkspaceModel,
} from "db/client";
import { stat } from "node:fs/promises";
import { toMessage, toRun } from "./dto";
import type { Hub } from "./hub";

interface ActiveRun {
  sessionId: string;
  agent?: AgentProcess;
  cancelled: boolean;
  output: string;
}

// Keep recent conversation context bounded; each CLI reads project instructions itself.
export function conversationPrompt(
  history: { role: string; content: string }[],
  prompt: string,
): string {
  if (!history.length) return prompt;
  const recent: typeof history = [];
  let remaining = 24000;
  for (const message of history.slice(-12).reverse()) {
    if (remaining <= 0) break;
    const content = message.content.slice(-remaining);
    recent.unshift({ role: message.role, content });
    remaining -= content.length;
  }
  return `Continue this aiSarthi conversation. Previous messages are context for the current request.\n${JSON.stringify(recent)}\n\nCurrent request:\n${prompt}`;
}

export class RunManager {
  private readonly active = new Map<string, ActiveRun>();
  private readonly busySessions = new Set<string>();
  private readonly jobs = new Set<Promise<void>>();
  private closing = false;
  private readonly starting = new Set<Promise<void>>();

  constructor(
    private readonly hub: Hub,
    private readonly spawn = startAgent,
    private readonly available = isProviderAvailable,
  ) {}

  outputFor(sessionId: string): Record<string, string> {
    return Object.fromEntries(
      [...this.active]
        .filter(([, run]) => run.sessionId === sessionId)
        .map(([id, run]) => [id, run.output]),
    );
  }

  cancel(runId: string): boolean {
    const run = this.active.get(runId);
    if (!run) return false;
    run.cancelled = true;
    run.agent?.cancel();
    return true;
  }

  async shutdown(): Promise<void> {
    this.closing = true;
    for (const id of this.active.keys()) this.cancel(id);
    await Promise.allSettled([...this.starting]);
    for (const id of this.active.keys()) this.cancel(id);
    await Promise.allSettled([...this.jobs]);
  }

  start(sessionId: string, prompt: string, requestId?: string): Promise<void> {
    const pending = this.prepare(sessionId, prompt, requestId).finally(() =>
      this.starting.delete(pending),
    );
    this.starting.add(pending);
    return pending;
  }

  private async prepare(
    sessionId: string,
    prompt: string,
    requestId?: string,
  ): Promise<void> {
    if (this.closing) throw new Error("Orchestrator is shutting down");
    if (this.busySessions.has(sessionId))
      throw new Error("This session already has a running agent");
    this.busySessions.add(sessionId);
    try {
      const session = await SessionModel.findById(sessionId);
      if (!session) throw new Error("Session not found");
      const workspace = await WorkspaceModel.findById(session.workspace);
      if (!workspace) throw new Error("Workspace not found");
      const provider = ProviderIdSchema.parse(session.provider);
      if (!this.available(provider))
        throw new Error(
          `${PROVIDERS_BY_ID[provider].binary} is not installed on PATH`,
        );
      if (!(await stat(workspace.path)).isDirectory())
        throw new Error("Workspace path must be a directory");
      const history = await MessageModel.find({ session: sessionId })
        .sort({ createdAt: -1, _id: -1 })
        .limit(12);
      const credential = await ProviderCredentialModel.findOne({ provider });
      if (this.closing) throw new Error("Orchestrator is shutting down");
      const run = await RunModel.create({
        session: session._id,
        provider,
        prompt,
        status: "running",
      });
      const runId = String(run._id);
      const active: ActiveRun = { sessionId, cancelled: false, output: "" };
      this.active.set(runId, active);
      const job = (async () => {
        let status: "completed" | "cancelled" | "failed" = "failed";
        let exitCode: number | null = null;
        let stdout = "";
        let stderr = "";
        const onOutput = ({
          stream,
          chunk,
        }: {
          stream: "stdout" | "stderr";
          chunk: string;
        }) => {
          // Bound retained output; continue draining the process even after the limit.
          const retained = chunk.slice(
            0,
            Math.max(0, 2_000_000 - active.output.length),
          );
          if (!retained) return;
          active.output += retained;
          if (stream === "stdout") stdout += retained;
          else stderr += retained;
          this.hub.broadcast({
            type: "run.output",
            payload: { runId, sessionId, stream, chunk: retained },
          });
        };
        try {
          const userMessage = await MessageModel.create({
            session: sessionId,
            role: "user",
            content: prompt,
          });
          this.hub.broadcast({
            type: "message.created",
            payload: { message: toMessage(userMessage) },
          });
          this.hub.broadcast({
            type: "run.started",
            requestId,
            payload: { run: toRun(run) },
          });
          if (this.closing) active.cancelled = true;
          if (!active.cancelled) {
            active.agent = this.spawn({
              provider,
              cwd: workspace.path,
              prompt: conversationPrompt(history.reverse(), prompt),
              env: credential
                ? {
                    [PROVIDERS_BY_ID[provider].apiKeyEnvVar]: credential.apiKey,
                  }
                : undefined,
              onOutput,
            });
            const result = await active.agent.done;
            exitCode = result.exitCode;
            active.cancelled ||= result.cancelled;
          }
          status = active.cancelled
            ? "cancelled"
            : exitCode === 0
              ? "completed"
              : "failed";
        } catch (error) {
          onOutput({
            stream: "stderr",
            chunk: `\n${error instanceof Error ? error.message : String(error)}`,
          });
          status = active.cancelled ? "cancelled" : "failed";
        }
        const content =
          [stdout.trim(), status === "failed" ? stderr.trim() : ""]
            .filter(Boolean)
            .join("\n\n") ||
          stderr.trim() ||
          (status === "cancelled"
            ? "Run cancelled."
            : "The agent exited without producing output.");
        const assistant = await MessageModel.create({
          session: sessionId,
          role: "assistant",
          content,
        });
        const finished = await RunModel.findByIdAndUpdate(
          runId,
          { status, exitCode, endedAt: new Date(), output: active.output },
          { returnDocument: "after" },
        );
        this.hub.broadcast({
          type: "message.created",
          payload: { message: toMessage(assistant) },
        });
        if (finished)
          this.hub.broadcast({
            type: "run.completed",
            payload: { run: toRun(finished) },
          });
      })()
        .catch((error) => {
          console.error("Failed to persist run outcome:", error);
          this.hub.broadcast({
            type: "error",
            payload: {
              message:
                "Could not save the run outcome. Reconnect to reload its state.",
            },
          });
        })
        .finally(() => {
          this.active.delete(runId);
          this.busySessions.delete(sessionId);
          this.jobs.delete(job);
        });
      this.jobs.add(job);
    } catch (error) {
      this.busySessions.delete(sessionId);
      throw error;
    }
  }
}
