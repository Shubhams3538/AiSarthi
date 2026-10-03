import { startAgent, type AgentProcess } from "agents/client";
import { ProviderIdSchema, type ProviderId } from "commons/types";
import { MessageModel, RunModel, SessionModel, WorkspaceModel } from "db/client";
import { toMessage, toRun } from "./dto";
import type { Hub } from "./hub";

interface ActiveRun {
  sessionId: string;
  agent: AgentProcess;
}

interface ExecutionParams {
  runId: string;
  sessionId: string;
  provider: ProviderId;
  prompt: string;
  cwd: string;
}

/**
 * Owns the lifecycle of agent runs.
 *
 * Starting a run records the user's prompt, spawns the provider CLI inside the
 * workspace directory and streams stdout/stderr to every connected client. When
 * the process exits the transcript is persisted as an assistant message and the
 * run record is finalised.
 */
export class RunManager {
  private readonly active = new Map<string, ActiveRun>();

  constructor(private readonly hub: Hub) {}

  /** Stop a run if it is still active. Returns false when the run is unknown. */
  cancel(runId: string): boolean {
    const run = this.active.get(runId);
    if (!run) return false;
    run.agent.cancel();
    return true;
  }

  /** Validate the session, persist the prompt, then execute in the background. */
  async start(sessionId: string, prompt: string): Promise<void> {
    const session = await SessionModel.findById(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const workspace = await WorkspaceModel.findById(session.workspace);
    if (!workspace) throw new Error(`Workspace ${String(session.workspace)} not found`);

    const provider = ProviderIdSchema.parse(session.provider);

    const userMessage = await MessageModel.create({
      session: session._id,
      role: "user",
      content: prompt,
    });
    this.hub.broadcast({
      type: "message.created",
      payload: { message: toMessage(userMessage) },
    });

    const run = await RunModel.create({
      session: session._id,
      provider,
      prompt,
      status: "running",
    });
    this.hub.broadcast({ type: "run.started", payload: { run: toRun(run) } });

    void this.execute({
      runId: String(run._id),
      sessionId: String(session._id),
      provider,
      prompt,
      cwd: workspace.path,
    });
  }

  private async execute(params: ExecutionParams): Promise<void> {
    const { runId, sessionId, provider, prompt, cwd } = params;
    let stdout = "";
    let stderr = "";

    try {
      const agent = startAgent({
        provider,
        prompt,
        cwd,
        onOutput: ({ stream, chunk }) => {
          if (stream === "stdout") stdout += chunk;
          else stderr += chunk;
          this.hub.broadcast({
            type: "run.output",
            payload: { runId, sessionId, stream, chunk },
          });
        },
      });

      this.active.set(runId, { sessionId, agent });
      const result = await agent.done;
      this.active.delete(runId);

      const status = result.cancelled
        ? "cancelled"
        : result.exitCode === 0
          ? "completed"
          : "failed";

      await this.finalize(runId, sessionId, {
        status,
        exitCode: result.exitCode,
        stdout,
        stderr,
      });
    } catch (error) {
      // Most commonly this is `ENOENT`: the provider binary is not installed.
      this.active.delete(runId);
      const message = error instanceof Error ? error.message : String(error);

      await this.finalize(runId, sessionId, {
        status: "failed",
        exitCode: null,
        stdout,
        stderr: stderr ? `${stderr}\n${message}` : message,
      });
    }
  }

  private async finalize(
    runId: string,
    sessionId: string,
    outcome: { status: "completed" | "failed" | "cancelled"; exitCode: number | null; stdout: string; stderr: string },
  ): Promise<void> {
    const run = await RunModel.findByIdAndUpdate(
      runId,
      { status: outcome.status, exitCode: outcome.exitCode, endedAt: new Date() },
      { returnDocument: "after" },
    );

    const content =
      outcome.stdout.trim() ||
      outcome.stderr.trim() ||
      "(the agent exited without producing any output)";

    const assistantMessage = await MessageModel.create({
      session: sessionId,
      role: "assistant",
      content,
    });
    this.hub.broadcast({
      type: "message.created",
      payload: { message: toMessage(assistantMessage) },
    });

    if (run) {
      this.hub.broadcast({ type: "run.completed", payload: { run: toRun(run) } });
    }
  }
}
