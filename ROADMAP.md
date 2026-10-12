# aiSarthi upcoming goals

Recorded 2026-10-10. All goals below are **pending**. This is the agreed backlog,
not a record of completed work. Read [PROJECT_STATUS.md](PROJECT_STATUS.md) for
implemented behavior, validation evidence, and limitations.

## Resume point

When the user asks to continue development, begin with **Goal 1** unless they
select another goal. Inspect the current code, Git state, installed CLIs, and
running services first. Preserve existing work and use a disposable Git project
for provider tests. Do not mark a provider verified based only on fixture tests.

Work on one bounded goal at a time. Update its status, record what was changed
and verified in PROJECT_STATUS.md, and leave the precise next step at handoff.
Saving this backlog does not itself start provider requests, authorize new
account access, broaden permissions, or authorize public deployment.

## Goal 1 — Verify real provider execution

Status: pending. Priority: first.

- Verify installed/authenticated providers using a disposable Git project.
- Test creating a small file, a follow-up edit referring to it, cancellation,
  and reloading the saved conversation.
- Inspect actual file contents and provider permission behavior.
- Record results separately for Claude, Codex, and Cursor; report unavailable
  providers as unverified rather than completed.

Complete when: each available provider's real workflow has recorded evidence,
failures have been resolved or documented, and unavailable providers have an
explicit follow-up check. Fixture-based tests remain available for regression.

## Goal 2 — Make provider access and permissions explicit

Status: pending. Priority: second.

- Let users deliberately enable or disable each provider.
- Offer read-only and workspace-write modes where supported, enforced by the
  backend adapter rather than just a frontend setting.
- Show the selected workspace, permission mode, and authentication source
  without displaying secrets. Distinguish stored keys, environment credentials,
  and saved CLI login where that can be established accurately.
- Keep provider permission protections in effect and make denied operations
  understandable in the UI.

Complete when: disabled providers cannot run through the API; the selected
permission mode reaches the CLI; read-only behavior and authentication-source
display have meaningful tests; ambiguous authentication state is labelled.

## Goal 3 — Improve the chat experience

Status: pending. Priority: third.

- Render Markdown and code blocks with syntax highlighting.
- Separate assistant answers, tool activity, and errors.
- Show clearer progress, including starting, running, cancelling, and finished
  states. Verify each provider's structured-event format before integrating it.
- Preserve the existing UI design and reconnect behavior.

Complete when: representative responses, code, tool events, failures, and
reloaded conversations render correctly; untrusted output cannot execute HTML
or scripts; plain-text fallback remains usable.

## Goal 4 — Show changed files and diffs

Status: pending. Priority: fourth.

- Show which files changed during a run and let users inspect their diffs.
- Establish a baseline before each run so existing user edits are distinguishable
  from newly observed changes; avoid claiming attribution that cannot be proven.
- Include newly created files and handle cancelled or failed runs.
- Keep file reads within the selected workspace and preserve existing edits.

Complete when: users can review changes in the UI, pre-existing dirty work is
preserved and identified, and path/symlink boundaries are tested.

## Goal 5 — Improve session management and continuity

Status: pending. Priority: fifth.

- Rename and archive sessions, search conversations, and export transcripts.
- Define archive/restore behavior without deleting saved history.
- Investigate native provider session continuation instead of relying solely
  on the current bounded transcript replay.
- Associate continuation IDs with the correct provider and workspace; handle
  unavailable or expired native sessions with an explicit fallback.

Complete when: session management persists across reloads, exports are usable,
search is bounded, and any implemented native continuation has real provider
evidence. Unsupported providers retain a documented replay fallback.

## Goal 6 — Isolate concurrent work

Status: pending. Priority: sixth. Depends on Goal 4's change-review baseline.

- Use separate Git worktrees before agents run concurrently on the same project.
- Preserve tracked and untracked user work and distinguish each run's checkout.
- Show worktree/branch ownership and provide a reviewable integration workflow.
- Record cleanup and conflict handling; keep unfinished work recoverable.

Complete when: concurrent runs cannot overwrite each other's checkout, changes
can be reviewed independently, and interruption/conflict tests preserve work.

## Goal 7 — Harden persistence and operation

Status: pending. Priority: seventh; bounded improvements can accompany earlier
goals when required.

- Protect stored credentials and plan migration of existing plaintext records.
  Keep secrets out of API responses, logs, and transcript exports.
- Add transcript/run pagination and bounded search, output, and buffering.
- Provide database backup and restore instructions with a verified restore test.
- Add CI checks for types, lint, tests, and the production build; use fixture
  agents and an isolated MongoDB instance without real provider credentials.

Complete when: credential protection and migration are tested, long conversations
load within defined bounds, restore has been demonstrated, and CI runs the
documented checks successfully.

## Later direction — Public multi-user hosting

Status: deferred; not part of the current local-app goals.

This would require explicit product decisions plus authentication,
authorization, tenant isolation, isolated execution environments, and a separate
credential boundary. Revisit after the local workflow is verified and hardened.
