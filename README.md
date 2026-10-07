# aiSarthi

One UI for **Claude Code**, **Codex** and **Cursor**.

aiSarthi is a local coding-agent orchestrator. Instead of juggling a terminal per
agent, you register a project as a *workspace*, open a *session* against one of
the agent CLIs you already have installed, and drive it from a single chat view.
Prompts are streamed as they happen and every transcript is persisted.

> aiSarthi does not embed a model. It shells out to the coding agents on your
> machine and funnels their output to the browser.

## How it works

```
┌──────────────┐        WebSocket (JSON)        ┌──────────────┐
│  Next.js UI  │  ───────────────────────────▶  │   backend    │
│ apps/frontend│  ◀───────────────────────────  │ apps/backend │
└──────────────┘   { type, payload } frames      └──────┬───────┘
                                                        │
                        ┌───────────────────────────────┼───────────────────┐
                        │                               │                   │
                   ┌────▼────┐                    ┌─────▼─────┐       ┌──────▼──────┐
                   │   db    │                    │  agents   │       │   commons   │
                   │ mongoose│                    │ spawn CLI │       │ schemas +   │
                   └─────────┘                    └───────────┘       │  protocol   │
                                                                      └─────────────┘
```

- **`packages/commons`** — the single source of truth for the wire protocol:
  zod schemas for workspaces, sessions, messages, runs and every WebSocket
  frame, plus provider metadata. Backend and frontend both import it.
- **`packages/db`** — Mongoose models (`Workspace`, `Session`, `Message`,
  `Run`) and the document types consumers rely on.
- **`packages/agents`** — provider adapters. Each CLI has a different
  non-interactive entry point, so `startAgent()` normalises command building,
  spawning, output streaming and cancellation behind one interface.
- **`apps/backend`** — connects to MongoDB, opens the WebSocket server and
  routes validated frames to handlers. `RunManager` owns agent lifecycles:
  it records the prompt, spawns the CLI in the workspace directory, streams
  `run.output` frames and persists the result as an assistant message.
- **`apps/frontend`** — a Next.js App Router UI. `lib/orchestrator.tsx` holds
  the single WebSocket connection and exposes it as React state; the sidebar and
  chat panel are pure consumers of that state.

## Providers

| Provider    | Binary         | Non-interactive command                  |
| ----------- | -------------- | ---------------------------------------- |
| Claude Code | `claude`       | `claude -p <prompt> --output-format ...` |
| Codex       | `codex`        | `codex exec <prompt>`                    |
| Cursor      | `cursor-agent` | `cursor-agent -p <prompt>`               |

Install and authenticate at least one of these before running a session.

## Getting started

1. **Start MongoDB.** The repo ships with a Docker setup:

   ```bash
   docker start mongodb   # or: docker run -d -p 27017:27017 --name mongodb mongo
   ```

2. **Install and run:**

   ```bash
   bun install
   bun run dev
   ```

   This starts the orchestrator on `ws://localhost:3000` and the UI on
   <http://localhost:3001>.

3. Open the UI, add a workspace pointing at a project folder, create a session
   and pick an agent.

### Environment

| Variable              | Where           | Default                              |
| --------------------- | --------------- | ------------------------------------ |
| `DB_URL`              | `apps/backend`  | `mongodb://localhost:27017/aisarthi` |
| `PORT`                | `apps/backend`  | `3000`                               |
| `NEXT_PUBLIC_WS_URL`  | `apps/frontend` | `ws://localhost:3000`                |

## Scripts

```bash
bun run dev          # run every app in watch mode
bun run build        # build everything
bun run check-types  # type-check every package and app
bun run lint         # lint
bun run format       # prettier
```

## Project layout

```
apps/
  backend/     WebSocket orchestrator + MongoDB
  frontend/    Next.js UI
packages/
  agents/      CLI provider adapters
  commons/     Shared schemas and protocol types
  db/          Mongoose models
  eslint-config/ typescript-config/ ui/   (from the Turborepo starter)
```
