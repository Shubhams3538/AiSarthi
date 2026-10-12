"use client";

import Link from "next/link";
import { useState } from "react";
import { AddWorkspaceModal } from "@/components/AddWorkspaceModal";
import { ChatPanel } from "@/components/ChatPanel";
import { NewSessionModal } from "@/components/NewSessionModal";
import { Sidebar } from "@/components/Sidebar";
import { useOrchestrator } from "@/lib/orchestrator";

export default function Home() {
  const {
    workspaces,
    activeWorkspaceId,
    activeSessionId,
    credentials,
    error,
    dismissError,
  } = useOrchestrator();
  const [adding, setAdding] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);

  const workspace =
    workspaces.find((entry) => entry.id === activeWorkspaceId) ?? null;
  const hasAgentKey = credentials.some((entry) => entry.configured);

  return (
    <div className="app">
      <Sidebar
        onAddWorkspace={() => setAdding(true)}
        onNewSession={() => setCreatingSession(true)}
      />

      <main className="main">
        <header className="topbar">
          <span className="title">
            {workspace ? workspace.name : "aiSarthi"}
          </span>
          {workspace ? <span className="path">{workspace.path}</span> : null}
        </header>

        {error ? (
          <div className="error" role="alert">
            {error}{" "}
            <button
              className="btn ghost"
              onClick={dismissError}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        ) : null}

        <div className="content">
          {activeSessionId ? (
            <ChatPanel />
          ) : (
            <div className="centered">
              <h2>
                {workspace ? "Start a new session" : "Select a workspace"}
              </h2>
              <p>
                {workspace
                  ? "Pick an agent in the sidebar to open a session."
                  : "Add a workspace to point aiSarthi at a project."}
              </p>
              {hasAgentKey ? null : (
                <p>
                  API keys are optional. Use your CLI login or{" "}
                  <Link href="/setup">add a key here</Link>.
                </p>
              )}
            </div>
          )}
        </div>
      </main>

      {adding ? <AddWorkspaceModal onClose={() => setAdding(false)} /> : null}
      {creatingSession && workspace ? (
        <NewSessionModal
          workspaceId={workspace.id}
          onClose={() => setCreatingSession(false)}
        />
      ) : null}
    </div>
  );
}
