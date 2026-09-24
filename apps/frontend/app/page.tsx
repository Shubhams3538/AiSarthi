"use client";

import { useState } from "react";
import { AddWorkspaceModal } from "@/components/AddWorkspaceModal";
import { ChatPanel } from "@/components/ChatPanel";
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
          {activeSessionId ? (
            <ChatPanel />
          ) : (
            <div className="centered">
              <h2>{workspace ? "Start a new session" : "Select a workspace"}</h2>
              <p>
                {workspace
                  ? "Pick an agent in the sidebar to open a session."
                  : "Add a workspace to point aiSarthi at a project."}
              </p>
            </div>
          )}
        </div>
      </main>

      {adding ? <AddWorkspaceModal onClose={() => setAdding(false)} /> : null}
    </div>
  );
}
