/// <reference types="bun" />
import { expect, test } from "bun:test";
import { initialState, reducer } from "../lib/orchestrator";
import type { Run } from "commons/types";

const run: Run = {
  id: "run",
  sessionId: "current",
  provider: "codex",
  prompt: "hello",
  status: "running",
  startedAt: new Date().toISOString(),
};
const state = {
  ...initialState,
  activeWorkspaceId: "workspace",
  activeSessionId: "current",
};

test("late responses and completion events from another session are ignored", () => {
  expect(
    reducer(state, {
      type: "server",
      message: {
        type: "session.list",
        payload: { workspaceId: "other", sessions: [] },
      },
    }),
  ).toBe(state);
  expect(
    reducer(state, {
      type: "server",
      message: {
        type: "session.messages",
        payload: { sessionId: "other", messages: [], runs: [], output: {} },
      },
    }),
  ).toBe(state);
  expect(
    reducer(state, {
      type: "server",
      message: {
        type: "run.completed",
        payload: { run: { ...run, sessionId: "other" } },
      },
    }),
  ).toBe(state);
});

test("reload snapshots restore active runs and accumulated output", () => {
  const loaded = reducer(
    { ...state, loadingSession: true },
    {
      type: "server",
      message: {
        type: "session.messages",
        payload: {
          sessionId: "current",
          messages: [],
          runs: [run],
          output: { run: "partial" },
        },
      },
    },
  );
  expect(loaded.loadingSession).toBe(false);
  expect(loaded.runs[0]?.status).toBe("running");
  expect(loaded.output.run).toBe("partial");
  const finished = reducer(loaded, {
    type: "server",
    message: {
      type: "run.completed",
      payload: { run: { ...run, status: "completed" } },
    },
  });
  expect(finished.output.run).toBeUndefined();
  expect(finished.runs[0]?.status).toBe("completed");
});

test("a snapshot cannot overwrite newer completion events", () => {
  const completed = {
    ...state,
    runs: [{ ...run, status: "completed" as const }],
  };
  const loaded = reducer(completed, {
    type: "server",
    message: {
      type: "session.messages",
      payload: { sessionId: "current", messages: [], runs: [run], output: {} },
    },
  });
  expect(loaded.runs[0]?.status).toBe("completed");
});

test("changing workspaces clears pending run and loading state", () => {
  const switched = reducer(
    { ...state, loadingSession: true, startingSessionId: "current" },
    { type: "selectWorkspace", workspaceId: "other" },
  );
  expect(switched.startingSessionId).toBeNull();
  expect(switched.loadingSession).toBe(false);
  expect(switched.activeSessionId).toBeNull();
});
