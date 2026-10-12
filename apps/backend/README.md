# backend

The Bun/MongoDB orchestrator for aiSarthi. From the repository root, start MongoDB
and run `bun run dev`. For backend only, run `bun run dev` in this directory.
`bun run start` runs without file watching.

`index.ts` reads environment settings; `src/server.ts` starts a loopback HTTP and
WebSocket server after connecting MongoDB and repairing interrupted run states.
`GET /health` reports database availability. Browser connections must have an
allowed Origin and localhost/127.0.0.1 Host.

- `src/protocol.ts`: validate inbound frames and serialize outbound frames.
- `src/hub.ts`: connected-client broadcasts.
- `src/handlers.ts`: workspace, session, credential, and run requests.
- `src/runs.ts`: recent conversation context, session run locking, cancellation,
  process output, persistence, and shutdown.
- `src/dto.ts`: Mongo documents to wire records, without credential secrets.
- `tests/`: protocol/adapter checks and real MongoDB/WebSocket/subprocess tests.

Use the root README for configuration, commands, and security/validation limits.
