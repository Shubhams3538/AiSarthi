"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  type ReactNode,
} from "react";
import type {
  ClientMessage,
  Message,
  ProviderId,
  Run,
  ServerMessage,
  Session,
  Workspace,
} from "commons/types";

/**
 * Single WebSocket connection to the orchestrator, exposed to the UI as React
 * state. Components never touch the socket directly; they call the action
 * helpers below and read the derived state.
 *
 * The orchestrator rebroadcasts every event to every socket, so the reducer
 * filters events down to the workspace/session the user is currently viewing.
 */

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3000";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface OrchestratorState {
  status: ConnectionStatus;
  workspaces: Workspace[];
  sessions: Session[];
  messages: Message[];
  runs: Run[];
  /** Live output keyed by run id, accumulated as `run.output` frames arrive. */
  output: Record<string, string>;
  activeWorkspaceId: string | null;
  activeSessionId: string | null;
  error: string | null;
}

const initialState: OrchestratorState = {
  status: "connecting",
  workspaces: [],
  sessions: [],
  messages: [],
  runs: [],
  output: {},
  activeWorkspaceId: null,
  activeSessionId: null,
  error: null,
};

type Action =
  | { type: "connection"; status: ConnectionStatus }
  | { type: "server"; message: ServerMessage }
  | { type: "selectWorkspace"; workspaceId: string | null }
  | { type: "selectSession"; sessionId: string | null }
  | { type: "dismissError" };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function reducer(state: OrchestratorState, action: Action): OrchestratorState {
  switch (action.type) {
    case "connection":
      return { ...state, status: action.status };

    case "dismissError":
      return { ...state, error: null };

    case "selectWorkspace":
      return {
        ...state,
        activeWorkspaceId: action.workspaceId,
        activeSessionId: null,
        sessions: [],
        messages: [],
        runs: [],
        output: {},
      };

    case "selectSession":
      return {
        ...state,
        activeSessionId: action.sessionId,
        messages: [],
        runs: [],
        output: {},
      };

    case "server":
      return applyServerMessage(state, action.message);

    default:
      return state;
  }
}

function applyServerMessage(state: OrchestratorState, message: ServerMessage): OrchestratorState {
  switch (message.type) {
    case "error":
      return { ...state, error: message.payload.message };

    case "workspace.list":
      return { ...state, workspaces: message.payload.workspaces };

    case "workspace.created":
      return { ...state, workspaces: upsert(state.workspaces, message.payload.workspace) };

    case "session.list":
      return { ...state, sessions: message.payload.sessions };

    case "session.created": {
      const { session } = message.payload;
      if (session.workspaceId !== state.activeWorkspaceId) return state;
      return { ...state, sessions: upsert(state.sessions, session) };
    }

    case "session.messages":
      return { ...state, messages: message.payload.messages };

    case "message.created": {
      const { message: created } = message.payload;
      if (created.sessionId !== state.activeSessionId) return state;
      return { ...state, messages: upsert(state.messages, created) };
    }

    case "run.started": {
      const { run } = message.payload;
      if (run.sessionId !== state.activeSessionId) return state;
      return {
        ...state,
        runs: upsert(state.runs, run),
        output: { ...state.output, [run.id]: state.output[run.id] ?? "" },
      };
    }

    case "run.output": {
      const { runId, sessionId, chunk } = message.payload;
      if (sessionId !== state.activeSessionId) return state;
      return {
        ...state,
        output: { ...state.output, [runId]: (state.output[runId] ?? "") + chunk },
      };
    }

    case "run.completed":
      return { ...state, runs: upsert(state.runs, message.payload.run) };

    default:
      return state;
  }
}

export interface OrchestratorValue extends OrchestratorState {
  createWorkspace: (input: { name: string; path: string }) => void;
  createSession: (input: { workspaceId: string; provider: ProviderId; title?: string }) => void;
  selectWorkspace: (workspaceId: string) => void;
  selectSession: (sessionId: string) => void;
  startRun: (sessionId: string, prompt: string) => void;
  cancelRun: (runId: string) => void;
  dismissError: () => void;
}

const OrchestratorContext = createContext<OrchestratorValue | null>(null);

export function OrchestratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<WebSocket | null>(null);
  // Set when the user creates a session so the matching `session.created`
  // broadcast can be auto-selected.
  const pendingSessionWorkspace = useRef<string | null>(null);

  const send = useCallback((message: ClientMessage) => {
    const socket = socketRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (disposed) return;
      dispatch({ type: "connection", status: "connecting" });

      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;

      socket.onopen = () => {
        dispatch({ type: "connection", status: "connected" });
        send({ type: "workspace.list" });
      };

      socket.onmessage = (event) => {
        let message: ServerMessage;
        try {
          message = JSON.parse(String(event.data)) as ServerMessage;
        } catch {
          return;
        }

        if (
          message.type === "session.created" &&
          pendingSessionWorkspace.current === message.payload.session.workspaceId
        ) {
          pendingSessionWorkspace.current = null;
          const sessionId = message.payload.session.id;
          dispatch({ type: "selectSession", sessionId });
          send({ type: "session.messages", payload: { sessionId } });
        }

        dispatch({ type: "server", message });
      };

      socket.onclose = () => {
        if (disposed) return;
        dispatch({ type: "connection", status: "disconnected" });
        retryTimer = setTimeout(connect, 1500);
      };

      socket.onerror = () => socket.close();
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      socketRef.current?.close();
    };
  }, [send]);

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      dispatch({ type: "selectWorkspace", workspaceId });
      send({ type: "session.list", payload: { workspaceId } });
    },
    [send],
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      dispatch({ type: "selectSession", sessionId });
      send({ type: "session.messages", payload: { sessionId } });
    },
    [send],
  );

  const createWorkspace = useCallback(
    (input: { name: string; path: string }) => send({ type: "workspace.create", payload: input }),
    [send],
  );

  const createSession = useCallback(
    (input: { workspaceId: string; provider: ProviderId; title?: string }) => {
      pendingSessionWorkspace.current = input.workspaceId;
      send({ type: "session.create", payload: input });
    },
    [send],
  );

  const startRun = useCallback(
    (sessionId: string, prompt: string) =>
      send({ type: "run.start", payload: { sessionId, prompt } }),
    [send],
  );

  const cancelRun = useCallback(
    (runId: string) => send({ type: "run.cancel", payload: { runId } }),
    [send],
  );

  const dismissError = useCallback(() => dispatch({ type: "dismissError" }), []);

  const value = useMemo<OrchestratorValue>(
    () => ({
      ...state,
      createWorkspace,
      createSession,
      selectWorkspace,
      selectSession,
      startRun,
      cancelRun,
      dismissError,
    }),
    [state, createWorkspace, createSession, selectWorkspace, selectSession, startRun, cancelRun, dismissError],
  );

  return <OrchestratorContext.Provider value={value}>{children}</OrchestratorContext.Provider>;
}

export function useOrchestrator(): OrchestratorValue {
  const value = useContext(OrchestratorContext);
  if (!value) throw new Error("useOrchestrator must be used inside <OrchestratorProvider>");
  return value;
}
