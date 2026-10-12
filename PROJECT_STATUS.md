# aiSarthi implementation status

Updated 2026-10-10.

## Upcoming work

[ROADMAP.md](ROADMAP.md) contains the seven prioritized upcoming goals and their
completion criteria. All are pending. The next goal is real provider verification
in a disposable Git project; resume there unless the user selects another goal.
Project-level agent instructions in AGENTS.md point future agents to these files.

## Scope and decisions

The project is a local, single-user coding-agent orchestrator built with Bun,
Next.js, WebSockets, MongoDB/Mongoose, and installed provider CLIs. Existing
architecture, UI, and uncommitted provider-credential work were preserved.
Public multi-user hosting would require a different authentication and execution
boundary; it is outside this local app's current behavior.

## Implemented

- Validated absolute workspace directories, reuse of an existing registered path,
  and correlated creation acknowledgements before dialogs close.
- Provider CLI availability in setup and session selection, optional credential
  save/remove, saved-login fallback, and correct `CODEX_API_KEY` injection.
- Readable CLI text output, stdin prompts for Claude/Codex, split UTF-8 decoding,
  bounded retained output, and concurrent stdout/stderr draining.
- Bounded recent-transcript context for follow-up prompts.
- A per-session run lock, pending-run controls, failure diagnostics, persisted
  final output, and cancellation of macOS/Linux process groups.
- Session/run snapshots, restored browser selection, reconnect hydration,
  stale-response filtering, and preservation of newer completion events.
- Startup recovery for interrupted runs, shutdown cancellation/persistence,
  local-only listeners, browser Origin/Host checks, and database health endpoint.
- MongoDB Compose setup, environment templates, production start scripts,
  repaired frontend ESLint command, and Bun regression tests.

## Validation evidence

- 17 tests passed, exercising real fixture subprocesses, loopback WebSockets,
  and local MongoDB in unique test databases. No model requests were made.
- Browser checked: invalid-path rejection keeps the form open; corrected path
  selects the workspace; missing Cursor is disabled; Codex session creation opens
  chat; reload restores workspace/session; setup displays installed binaries and
  correct key variable names.
- Clean Chrome window rendered setup correctly without hydration errors. The
  regular window's warning showed browser-extension attributes added before React
  hydration; no app-level suppression was added.
- Type checking passed across all six typed apps/packages, ESLint passed for the
  frontend and shared UI, and the Next.js production build passed. Compose
  configuration and `git diff --check` also passed.
- `bun run start` started both production apps; the production setup page was
  reloaded in Chrome and displayed the connected backend/provider availability.

## Remaining limits and next acceptance check

- Live provider authentication, model responses, and actual edits by each agent
  have not been verified. Claude and Codex are installed; Cursor was absent during
  the inspection. The real process adapter was tested with fixture executables.
- History replay includes only the most recent 12 turns/24,000 characters. Native
  provider session continuation and richer structured tool-event rendering remain
  potential future improvements.
- API keys remain plaintext in the local database, matching the existing setup
  implementation. No multi-user accounts or public deployment are implemented.
- Windows cancellation stops the process directly; child-group cancellation was
  implemented and tested on macOS.
- Registering an existing workspace reuses its record. Legacy duplicate workspace
  records are preserved; there is no destructive cleanup or migration.
- A browser smoke check registered this project and created an empty Codex session
  named `Project development` in the local app database. Existing records remain.

Next acceptance check: use an authenticated installed CLI in a disposable project,
ask it to create a small file, send a follow-up referencing that file, cancel a
long-running request, and reload the conversation. Check actual file contents and
provider permission behavior. This validates the provider boundary beyond the
fixture-tested app workflow.
