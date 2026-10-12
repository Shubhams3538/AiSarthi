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
import { ServerMessageSchema } from "commons/types";
import type {
  ClientMessage,
  Message,
  ProviderCredential,
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

const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? "ws://127.0.0.1:3000";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export interface OrchestratorState {
  status: ConnectionStatus;
  workspaces: Workspace[];
  sessions: Session[];
  messages: Message[];
  runs: Run[];
  /** Configured API keys per provider — never the secrets themselves. */
  credentials: ProviderCredential[];
  providers: { id: ProviderId; available: boolean }[];
  loadingSession: boolean;
  startingSessionId: string | null;
  /** Live output keyed by run id, accumulated as `run.output` frames arrive. */
  output: Record<string, string>;
  activeWorkspaceId: string | null;
  activeSessionId: string | null;
  error: string | null;
}

export const initialState: OrchestratorState = {
  status: "connecting",
  workspaces: [],
  sessions: [],
  messages: [],
  runs: [],
  credentials: [],
  providers: [],
  loadingSession: false,
  startingSessionId: null,
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
  | { type: "dismissError" }
  | { type: "startPending"; sessionId: string };

function upsert<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

function upsertCredential(
  list: ProviderCredential[],
  item: ProviderCredential,
): ProviderCredential[] {
  const index = list.findIndex((entry) => entry.provider === item.provider);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

export function reducer(
  state: OrchestratorState,
  action: Action,
): OrchestratorState {
  switch (action.type) {
    case "connection":
      return { ...state, status: action.status, startingSessionId: null };
    case "startPending":
      return { ...state, startingSessionId: action.sessionId, error: null };

    case "dismissError":
      return { ...state, error: null };

    case "selectWorkspace":
      return {
        ...state,
        activeWorkspaceId: action.workspaceId,
        activeSessionId: null,
        startingSessionId: null,
        loadingSession: false,
        sessions: [],
        messages: [],
        runs: [],
        output: {},
      };

    case "selectSession":
      return {
        ...state,
        activeSessionId: action.sessionId,
        loadingSession: Boolean(action.sessionId),
        startingSessionId: null,
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

function applyServerMessage(
  state: OrchestratorState,
  message: ServerMessage,
): OrchestratorState {
  switch (message.type) {
    case "error":
      return {
        ...state,
        error: message.payload.message,
        startingSessionId: null,
        loadingSession: false,
      };

    case "workspace.list":
      return { ...state, workspaces: message.payload.workspaces };

    case "workspace.created":
      return {
        ...state,
        workspaces: upsert(state.workspaces, message.payload.workspace),
      };

    case "session.list":
      if (message.payload.workspaceId !== state.activeWorkspaceId) return state;
      return { ...state, sessions: message.payload.sessions };

    case "session.created": {
      const { session } = message.payload;
      if (session.workspaceId !== state.activeWorkspaceId) return state;
      return { ...state, sessions: upsert(state.sessions, session) };
    }

    case "session.messages":
      if (message.payload.sessionId !== state.activeSessionId) return state;
      return {
        ...state,
        loadingSession: false,
        messages: state.messages.reduce(
          (list, item) => upsert(list, item),
          message.payload.messages,
        ),
        runs: state.runs.reduce(
          (list, item) => upsert(list, item),
          message.payload.runs,
        ),
        output: { ...state.output, ...message.payload.output },
      };

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
        startingSessionId: null,
        runs: upsert(state.runs, run),
        output: { ...state.output, [run.id]: state.output[run.id] ?? "" },
      };
    }

    case "run.output": {
      const { runId, sessionId, chunk } = message.payload;
      if (sessionId !== state.activeSessionId) return state;
      return {
        ...state,
        output: {
          ...state.output,
          [runId]: (state.output[runId] ?? "") + chunk,
        },
      };
    }

    case "run.completed": {
      const { run } = message.payload;
      if (run.sessionId !== state.activeSessionId) return state;
      const output = { ...state.output };
      delete output[run.id];
      return { ...state, runs: upsert(state.runs, run), output };
    }

    case "credentials.list":
      return {
        ...state,
        credentials: message.payload.credentials,
        providers: message.payload.providers,
      };

    case "credentials.saved":
      return {
        ...state,
        credentials: upsertCredential(
          state.credentials,
          message.payload.credential,
        ),
      };

    case "credentials.deleted":
      return {
        ...state,
        credentials: upsertCredential(state.credentials, {
          provider: message.payload.provider,
          configured: false,
          updatedAt: null,
        }),
      };

    default:
      return state;
  }
}

export interface OrchestratorValue extends OrchestratorState {
  createWorkspace: (input: { name: string; path: string }) => Promise<void>;
  createSession: (input: {
    workspaceId: string;
    provider: ProviderId;
    title?: string;
  }) => Promise<void>;
  selectWorkspace: (workspaceId: string) => void;
  selectSession: (sessionId: string) => void;
  startRun: (sessionId: string, prompt: string) => Promise<boolean>;
  cancelRun: (runId: string) => void;
  saveCredential: (provider: ProviderId, apiKey: string) => Promise<void>;
  deleteCredential: (provider: ProviderId) => Promise<void>;
  dismissError: () => void;
}

const OrchestratorContext = createContext<OrchestratorValue | null>(null);

export function OrchestratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const socketRef = useRef<WebSocket | null>(null);
  const selection = useRef<{
    workspaceId: string | null;
    sessionId: string | null;
  }>({ workspaceId: null, sessionId: null });
  const pending = useRef(
    new Map<
      string,
      {
        resolve: (message: ServerMessage) => void;
        reject: (error: Error) => void;
        timer: ReturnType<typeof setTimeout>;
      }
    >(),
  );

  const send = useCallback((message: ClientMessage): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      dispatch({
        type: "server",
        message: {
          type: "error",
          payload: {
            message: "Orchestrator is offline. Reconnect before trying again.",
          },
        },
      });
      return false;
    }
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  const request = useCallback(
    (message: ClientMessage) =>
      new Promise<ServerMessage>((resolve, reject) => {
        dispatch({ type: "dismissError" });
        const requestId = crypto.randomUUID();
        const timer = setTimeout(() => {
          pending.current.delete(requestId);
          reject(
            new Error(
              "The orchestrator did not respond. Reconnect and check whether the action completed.",
            ),
          );
        }, 15000);
        pending.current.set(requestId, { resolve, reject, timer });
        if (!send({ ...message, requestId })) {
          clearTimeout(timer);
          pending.current.delete(requestId);
          reject(new Error("Orchestrator is offline"));
        }
      }),
    [send],
  );

  const remember = useCallback(() => {
    try {
      localStorage.setItem(
        "aisarthi.selection",
        JSON.stringify(selection.current),
      );
    } catch {
      /* Storage may be unavailable. */
    }
  }, []);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("aisarthi.selection") ?? "null",
      );
      if (saved && typeof saved.workspaceId === "string") {
        selection.current = {
          workspaceId: saved.workspaceId,
          sessionId:
            typeof saved.sessionId === "string" ? saved.sessionId : null,
        };
        dispatch({
          type: "selectWorkspace",
          workspaceId: selection.current.workspaceId,
        });
        dispatch({
          type: "selectSession",
          sessionId: selection.current.sessionId,
        });
      }
    } catch {
      /* Ignore invalid saved state. */
    }
    let disposed = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const rejectPending = () => {
      for (const entry of pending.current.values()) {
        clearTimeout(entry.timer);
        entry.reject(
          new Error(
            "Connection closed. Reconnect and check whether the action completed.",
          ),
        );
      }
      pending.current.clear();
    };
    const connect = () => {
      if (disposed) return;
      dispatch({ type: "connection", status: "connecting" });
      const socket = new WebSocket(WS_URL);
      socketRef.current = socket;
      socket.onopen = () => {
        if (disposed) return;
        dispatch({ type: "connection", status: "connected" });
        send({ type: "workspace.list" });
        send({ type: "credentials.list" });
        const { workspaceId, sessionId } = selection.current;
        if (workspaceId)
          send({ type: "session.list", payload: { workspaceId } });
        if (sessionId) {
          dispatch({ type: "selectSession", sessionId });
          send({ type: "session.messages", payload: { sessionId } });
        }
      };
      socket.onmessage = (event) => {
        if (disposed) return;
        let parsed;
        try {
          parsed = ServerMessageSchema.safeParse(
            JSON.parse(String(event.data)),
          );
        } catch {
          return;
        }
        if (!parsed.success) return;
        const message = parsed.data;
        dispatch({ type: "server", message });
        if (message.requestId) {
          const entry = pending.current.get(message.requestId);
          if (entry) {
            clearTimeout(entry.timer);
            pending.current.delete(message.requestId);
            if (message.type === "error")
              entry.reject(new Error(message.payload.message));
            else entry.resolve(message);
          }
        }
      };
      socket.onclose = () => {
        if (disposed) return;
        rejectPending();
        dispatch({ type: "connection", status: "disconnected" });
        retryTimer = setTimeout(connect, 1500);
      };
      socket.onerror = () => socket.close();
    };
    connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      rejectPending();
      socketRef.current?.close();
    };
  }, [send, remember]);

  const selectWorkspace = useCallback(
    (workspaceId: string) => {
      selection.current = { workspaceId, sessionId: null };
      remember();
      dispatch({ type: "selectWorkspace", workspaceId });
      send({ type: "session.list", payload: { workspaceId } });
    },
    [send, remember],
  );

  const selectSession = useCallback(
    (sessionId: string) => {
      selection.current.sessionId = sessionId;
      remember();
      dispatch({ type: "selectSession", sessionId });
      send({ type: "session.messages", payload: { sessionId } });
    },
    [send, remember],
  );

  const createWorkspace = useCallback(
    async (input: { name: string; path: string }) => {
      const response = await request({
        type: "workspace.create",
        payload: input,
      });
      if (response.type === "workspace.created")
        selectWorkspace(response.payload.workspace.id);
    },
    [request, selectWorkspace],
  );

  const createSession = useCallback(
    async (input: {
      workspaceId: string;
      provider: ProviderId;
      title?: string;
    }) => {
      const response = await request({
        type: "session.create",
        payload: input,
      });
      if (
        response.type === "session.created" &&
        selection.current.workspaceId === input.workspaceId
      )
        selectSession(response.payload.session.id);
    },
    [request, selectSession],
  );

  const startRun = useCallback(
    async (sessionId: string, prompt: string) => {
      dispatch({ type: "startPending", sessionId });
      try {
        await request({ type: "run.start", payload: { sessionId, prompt } });
        return true;
      } catch (error) {
        dispatch({
          type: "server",
          message: {
            type: "error",
            payload: {
              message: error instanceof Error ? error.message : String(error),
            },
          },
        });
        return false;
      }
    },
    [request],
  );
  const cancelRun = useCallback(
    (runId: string) => {
      send({ type: "run.cancel", payload: { runId } });
    },
    [send],
  );
  const saveCredential = useCallback(
    async (provider: ProviderId, apiKey: string) => {
      await request({
        type: "credentials.save",
        payload: { provider, apiKey },
      });
    },
    [request],
  );
  const deleteCredential = useCallback(
    async (provider: ProviderId) => {
      await request({ type: "credentials.delete", payload: { provider } });
    },
    [request],
  );

  const dismissError = useCallback(
    () => dispatch({ type: "dismissError" }),
    [],
  );

  const value = useMemo<OrchestratorValue>(
    () => ({
      ...state,
      createWorkspace,
      createSession,
      selectWorkspace,
      selectSession,
      startRun,
      cancelRun,
      saveCredential,
      deleteCredential,
      dismissError,
    }),
    [
      state,
      createWorkspace,
      createSession,
      selectWorkspace,
      selectSession,
      startRun,
      cancelRun,
      saveCredential,
      deleteCredential,
      dismissError,
    ],
  );

  return (
    <OrchestratorContext.Provider value={value}>
      {children}
    </OrchestratorContext.Provider>
  );
}

export function useOrchestrator(): OrchestratorValue {
  const value = useContext(OrchestratorContext);
  if (!value)
    throw new Error(
      "useOrchestrator must be used inside <OrchestratorProvider>",
    );
  return value;
}
