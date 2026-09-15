# frontend

The aiSarthi web UI — a single place to drive Claude Code, Codex and Cursor.

Built with [Next.js](https://nextjs.org) (App Router) and React 19. All state
flows through one WebSocket connection to `apps/backend`, managed by
`lib/orchestrator.tsx`.

## Running

```bash
bun install             # from the repo root
bun run dev             # starts Next.js on http://localhost:3001
```

The backend must be running on `ws://localhost:3000` (override with
`NEXT_PUBLIC_WS_URL`).
