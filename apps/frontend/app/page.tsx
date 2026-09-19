"use client";

import { useState } from "react";
import { AddWorkspaceModal } from "@/components/AddWorkspaceModal";
import { Sidebar } from "@/components/Sidebar";
import { useOrchestrator } from "@/lib/orchestrator";

export default function Home() {
  const { workspaces, activeWorkspaceId, activeSessionId, error } = useOrchestrator();
  const [adding, setAdding] = useState(false);

  const workspace = workspaces.find((entry) => entry.id === activeWorkspaceId) ?? null;

  return (
    <div className="app">
      <Sidebar onAddWorkspace={() => setAdding(true)} />

      <main className="main">
        <header className="topbar">
          <span className="title">{workspace ? workspace.name : "aiSarthi"}</span>
          {workspace ? <span className="path">{workspace.path}</span> : null}
        </header>

        {error ? <div className="error">{error}</div> : null}

        <div className="content">
          <div className="centered">
            <h2>
              {!workspace
                ? "Select a workspace"
                : activeSessionId
                  ? "Session ready"
                  : "Start a new session"}
            </h2>
            <p>Agent transcripts and live output will render here.</p>
          </div>
        </div>
      </main>

      {adding ? <AddWorkspaceModal onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
