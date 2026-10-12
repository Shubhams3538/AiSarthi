# aiSarthi

One local UI for **Claude Code**, **Codex**, and **Cursor**.

Register a project folder, create an agent session, send a prompt, watch its
output, and return to the saved conversation later. aiSarthi runs the agent CLIs
installed on your machine; it does not embed a model.

## Start locally

Requires Bun 1.4+, MongoDB, and at least one installed/authenticated agent CLI.
The backend and agent processes run on the same machine as your project folders.

```bash
bun install
bun run db:start
bun run dev
```

Open <http://127.0.0.1:3001>. Add an existing **absolute directory path**, create
a session, choose an installed agent, and send a prompt. Use ⌘/Ctrl+Enter to run
and **Stop** to cancel. On macOS/Linux, cancellation also signals the agent's
child process group, escalating to SIGKILL after three seconds if necessary.

If you already have MongoDB listening on port 27017, use that instead of starting
the Compose service. For the pre-existing `mongodb` container:

```bash
docker start mongodb
bun run dev
```

MongoDB data persists in the Compose volume; `bun run db:stop` stops the Compose
service without removing its data. The Compose commands manage only this
project's Compose service, not a separately created `mongodb` container.

## Agent login and optional keys

Authenticate each installed CLI using its normal login flow. `/setup` reports
which binaries are available on the backend's PATH. Missing binaries are disabled
in the new-session picker; an API key alone does not install a CLI.

Alternatively, save a provider key on `/setup`. Keys are injected into the
provider process as `ANTHROPIC_API_KEY`, `CODEX_API_KEY`, or `CURSOR_API_KEY`.
Deleting a stored key restores the CLI's normal login/environment fallback.
Credential responses expose configured status and timestamps, never key values.

Codex expects the workspace to be a Git repository and runs with its
`workspace-write` sandbox. Provider permission controls remain
in effect: aiSarthi does not bypass permission checks. A headless CLI may reject
an operation that needs interactive approval; the transcript records its error.
See the [Codex non-interactive documentation](https://learn.chatgpt.com/docs/non-interactive-mode)
and [Cursor headless documentation](https://cursor.com/docs/cli/headless).

## Configuration

Copy `apps/backend/.env.example` to `apps/backend/.env` and
`apps/frontend/.env.example` to `apps/frontend/.env.local` when overriding defaults.

- `DB_URL`: defaults to `mongodb://127.0.0.1:27017/aisarthi`.
- `PORT`: backend HTTP/WebSocket port, defaults to `3000`.
- `ALLOWED_ORIGINS`: comma-separated browser origins; defaults to
  `http://localhost:3001,http://127.0.0.1:3001`.
- `NEXT_PUBLIC_WS_URL`: frontend WebSocket URL, defaults to `ws://127.0.0.1:3000`.
  Rebuild the frontend when changing it for a production build.

`GET http://127.0.0.1:3000/health` reports backend/database availability. Both apps
bind to loopback. WebSocket upgrades reject unexpected browser origins and hosts.
This is a single-user local tool: credentials are stored as plaintext in local
MongoDB, and trusted native local clients can connect without a browser Origin.
It has no account authentication or tenant isolation for public hosting.

## How the code fits together

- `apps/frontend`: Next.js App Router UI; sidebar, workspace/session dialogs,
  chat, and provider setup. `lib/orchestrator.tsx` owns one validated WebSocket
  connection, request acknowledgements, reconnection, and React state.
- `apps/backend`: Bun server with HTTP health and a WebSocket API. `src/server.ts`
  owns startup/shutdown, `handlers.ts` routes requests, and `runs.ts` owns process
  lifecycles and transcript persistence.
- `packages/commons`: Zod domain models, provider metadata, and both sides of
  the wire protocol. Frames have `type`, optional `payload`, and optional
  `requestId` for matching mutation acknowledgements/errors.
- `packages/db`: Mongoose workspace, session, message, run, and credential models.
- `packages/agents`: CLI command construction, subprocess pipes, incremental
  UTF-8 decoding, and cancellation.
- `packages/ui`, `eslint-config`, `typescript-config`: shared starter utilities
  and tooling; the application currently uses its own components and CSS.

Each session allows one active run. Different sessions can run concurrently.
Follow-up prompts include at most the latest 12 messages and 24,000 characters
of prior context; this is bounded transcript replay, not native CLI session resume.
The original user prompt is stored separately from that generated context.

Reloading restores the selected workspace/session, transcript, run statuses, and
active output. Completed output is persisted; in-memory output is bounded to
2,000,000 characters per run. A restart marks unfinished runs failed because
processes cannot be resumed by the orchestrator. Text output streams when the
CLI flushes it; some providers buffer text until their answer is complete.

## Checks and production commands

```bash
bun run check-types
bun run lint
bun run test
bun run build
bun run start
```

Tests require local MongoDB on port 27017. Integration tests create and remove a
unique `aisarthi_test_*` database and invoke fixture executables through the real
agent adapter. They do not call models or use your provider credentials. Coverage
includes protocol validation, credentials, subprocess streaming, cancellation
including child processes, reconnect snapshots, provider failures, restart
recovery, conversation context, and frontend state races.

`bun run build` builds the Next.js frontend; Bun runs backend TypeScript directly.
`bun run start` starts both apps against the configured MongoDB. See
[PROJECT_STATUS.md](PROJECT_STATUS.md) for validation evidence and current limits.
Upcoming work and completion criteria are tracked in [ROADMAP.md](ROADMAP.md).
