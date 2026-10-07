# backend

The aiSarthi orchestrator. Connects to MongoDB and serves the WebSocket API the
UI drives.

## Running

```bash
bun install          # from the repo root
bun run index.ts     # from apps/backend
```

Requires a MongoDB instance reachable at `DB_URL` (defaults to
`mongodb://localhost:27017/aisarthi`). See `.env.example`.

## Layout

| File               | Responsibility                                            |
| ------------------ | --------------------------------------------------------- |
| `index.ts`         | Bootstrap: connect Mongo, start the WebSocket server.     |
| `src/protocol.ts`  | Parse/validate inbound frames, serialise outbound frames. |
| `src/hub.ts`       | Track connected clients and broadcast server messages.    |
| `src/handlers.ts`  | Route a validated message to the code that owns it.       |
| `src/runs.ts`      | Spawn agents, stream output, persist transcripts.         |
| `src/dto.ts`       | Mongo documents → wire DTOs.                              |

## Protocol

Every frame is `{ "type": "...", "payload": { ... } }`. The full set of client
and server messages is defined in `packages/commons`.
