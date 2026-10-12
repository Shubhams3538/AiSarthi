# agents

Adapters for installed Claude Code, Codex, and Cursor CLIs. Import from
`agents/client`. `startAgent()` returns a process handle with a `done` promise
and `cancel()` method; stdout and stderr are drained concurrently with incremental
UTF-8 decoding.

Claude and Codex prompts are supplied through stdin. Cursor receives a literal
argv prompt without a shell. Output is plain text; provider buffering determines
when it arrives. Codex uses `workspace-write`; no permission-bypass flags are
added. Availability checks inspect the backend's PATH.

On macOS/Linux agents run in a separate process group. Cancellation signals that
group, including child tools, with SIGTERM and a three-second SIGKILL fallback.
Windows uses direct process cancellation.

The backend provides recent conversation history and per-run credentials. No
provider login, model, or project state is managed by this package.
