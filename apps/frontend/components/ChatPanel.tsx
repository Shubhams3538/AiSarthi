"use client";

import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from "react";
import { PROVIDERS_BY_ID } from "commons/types";
import { useOrchestrator } from "@/lib/orchestrator";

export function ChatPanel() {
  const {
    sessions,
    activeSessionId,
    messages,
    runs,
    output,
    startRun,
    cancelRun,
    status,
    loadingSession,
    startingSessionId,
  } = useOrchestrator();
  const [prompt, setPrompt] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  const session =
    sessions.find((entry) => entry.id === activeSessionId) ?? null;
  const activeRun =
    runs.find(
      (run) => run.sessionId === activeSessionId && run.status === "running",
    ) ?? null;
  const streaming = activeRun ? (output[activeRun.id] ?? "") : "";

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, streaming]);

  const send = async () => {
    if (
      !activeSessionId ||
      !prompt.trim() ||
      activeRun ||
      startingSessionId ||
      loadingSession ||
      status !== "connected"
    )
      return;
    if (await startRun(activeSessionId, prompt.trim())) setPrompt("");
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      send();
    }
  };

  return (
    <div className="chat">
      <div className="transcript">
        {loadingSession ? <p className="hint">Loading conversation…</p> : null}
        {messages.length === 0 && !activeRun && !loadingSession ? (
          <p className="hint">
            Send a prompt to start{" "}
            {session ? PROVIDERS_BY_ID[session.provider].label : "an agent"} in
            this session.
          </p>
        ) : null}

        {messages.map((message) => (
          <div key={message.id} className={`message ${message.role}`}>
            <div className="who">{message.role}</div>
            <div className="bubble">{message.content}</div>
          </div>
        ))}

        {activeRun ? (
          <div className="message assistant">
            <div className="who">
              {PROVIDERS_BY_ID[activeRun.provider].label} · running
            </div>
            <div className="bubble streaming">{streaming || "…"}</div>
          </div>
        ) : null}

        {runs.length > 0 && !activeRun ? (
          <p className="hint" role="status">
            Last run: {runs.at(-1)?.status}
          </p>
        ) : null}
        <div ref={endRef} />
      </div>

      <form className="composer" onSubmit={submit}>
        <textarea
          aria-label="Prompt"
          maxLength={32000}
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask the agent to change something…"
        />
        <div className="composer-actions">
          <button
            type="submit"
            className="btn primary"
            disabled={
              !prompt.trim() ||
              Boolean(activeRun) ||
              Boolean(startingSessionId) ||
              loadingSession ||
              status !== "connected"
            }
          >
            {startingSessionId ? "Starting…" : "Run"}
          </button>
          {activeRun ? (
            <button
              type="button"
              className="btn"
              disabled={status !== "connected"}
              onClick={() => cancelRun(activeRun.id)}
            >
              Stop
            </button>
          ) : null}
          <span className="spacer" />
          <span className="hint">⌘/Ctrl + Enter to run</span>
        </div>
      </form>
    </div>
  );
}
