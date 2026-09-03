# agents

Provider adapters that spawn local AI coding agents and stream their output.

Each provider is a thin wrapper around a CLI binary that is already installed
and authenticated on the host:

| Provider | Binary         | Non-interactive invocation            |
| -------- | -------------- | ------------------------------------- |
| Claude   | `claude`       | `claude -p <prompt>`                  |
| Codex    | `codex`        | `codex exec <prompt>`                 |
| Cursor   | `cursor-agent` | `cursor-agent -p <prompt>`            |

The package exposes a single `startAgent()` entry point which returns a handle
with a `done` promise and a `cancel()` method so the orchestrator can fan agent
output out over a WebSocket.

```ts
import { startAgent } from "agents/client";

const agent = startAgent({
  provider: "claude",
  prompt: "Summarise the repo",
  cwd: "/path/to/workspace",
  onOutput: ({ stream, chunk }) => process.stdout.write(chunk),
});

await agent.done;
```
