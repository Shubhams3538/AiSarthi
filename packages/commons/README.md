# commons

Shared Zod schemas, provider metadata, and WebSocket types for aiSarthi. Import
from `commons/types`. Both backend and frontend validate incoming frames against
this contract. Request IDs correlate mutation acknowledgements; session snapshots
include transcripts, runs, and retained output.

Run `bun run check-types` from this directory, or use the root validation scripts.
