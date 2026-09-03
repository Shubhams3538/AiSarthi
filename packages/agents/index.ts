import { PROVIDERS_BY_ID, type ProviderId } from "commons/types";

/**
 * Agent adapters.
 *
 * aiSarthi does not embed a model — it shells out to the coding agents the user
 * already has installed and authenticated, then funnels their stdout/stderr
 * back to the UI. Each CLI exposes a different non-interactive entry point, so
 * `buildCommand` normalises all three behind one interface.
 */

export interface AgentCommand {
  bin: string;
  args: string[];
}

export interface AgentOutputEvent {
  stream: "stdout" | "stderr";
  chunk: string;
}

export interface AgentResult {
  exitCode: number | null;
  cancelled: boolean;
}

export interface StartAgentOptions {
  provider: ProviderId;
  prompt: string;
  /** Working directory the agent runs inside (the workspace path). */
  cwd: string;
  /** Extra environment variables merged over `process.env`. */
  env?: Record<string, string>;
  onOutput: (event: AgentOutputEvent) => void;
}

export interface AgentProcess {
  pid: number | undefined;
  done: Promise<AgentResult>;
  cancel: () => void;
}

/** Build the argv used to invoke a provider non-interactively. */
export function buildCommand(provider: ProviderId, prompt: string): AgentCommand {
  switch (provider) {
    case "claude":
      return {
        bin: "claude",
        args: ["-p", prompt, "--output-format", "stream-json", "--verbose"],
      };
    case "codex":
      return { bin: "codex", args: ["exec", prompt] };
    case "cursor":
      return { bin: "cursor-agent", args: ["-p", prompt] };
  }
}

/** Whether the provider's binary is present on the host's PATH. */
export function isProviderAvailable(provider: ProviderId): boolean {
  return Boolean(Bun.which(PROVIDERS_BY_ID[provider].binary));
}

/** Human-readable preview of the command that would run, for logging/telemetry. */
export function describeCommand(provider: ProviderId, prompt: string): string {
  const { bin, args } = buildCommand(provider, prompt);
  return [bin, ...args].join(" ");
}

/**
 * Spawn an agent and stream its output.
 *
 * Returns immediately with a handle; stdout and stderr are drained
 * concurrently so a chatty agent cannot deadlock on a full pipe buffer.
 */
export function startAgent(options: StartAgentOptions): AgentProcess {
  const { bin, args } = buildCommand(options.provider, options.prompt);

  const proc = Bun.spawn([bin, ...args], {
    cwd: options.cwd,
    env: { ...process.env, ...options.env } as Record<string, string | undefined>,
    stdout: "pipe",
    stderr: "pipe",
  });

  let cancelled = false;

  const pump = async (stream: "stdout" | "stderr", source: ReadableStream<Uint8Array>) => {
    const decoder = new TextDecoder();
    for await (const chunk of source) {
      options.onOutput({ stream, chunk: decoder.decode(chunk) });
    }
  };

  const done = (async (): Promise<AgentResult> => {
    await Promise.all([pump("stdout", proc.stdout), pump("stderr", proc.stderr)]);
    const exitCode = await proc.exited;
    return { exitCode, cancelled };
  })();

  return {
    pid: proc.pid,
    done,
    cancel: () => {
      cancelled = true;
      proc.kill();
    },
  };
}
