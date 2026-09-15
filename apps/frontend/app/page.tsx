"use client";

import { useState, type FormEvent } from "react";
import { useOrchestrator } from "@/lib/orchestrator";

export default function Home() {
  const { status, workspaces, activeWorkspaceId, createWorkspace, selectWorkspace, error } =
    useOrchestrator();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !path.trim()) return;
    createWorkspace({ name: name.trim(), path: path.trim() });
    setName("");
    setPath("");
    setAdding(false);
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <h1>aiSarthi</h1>
          <p>One UI for Claude, Codex &amp; Cursor</p>
        </div>

        <div className="sidebar-section">
          <div className="section-header">
            <span>Workspaces</span>
            <button className="btn ghost" onClick={() => setAdding(true)}>
              + Add
            </button>
          </div>
          <div className="section-scroll">
            {workspaces.length === 0 ? (
              <p className="empty">No workspaces yet. Add one to get started.</p>
            ) : (
              workspaces.map((workspace) => (
                <button
                  key={workspace.id}
                  className={`list-item${activeWorkspaceId === workspace.id ? " active" : ""}`}
                  onClick={() => selectWorkspace(workspace.id)}
                >
                  <span className="label">{workspace.name}</span>
                  <span className="meta">{workspace.path}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <span className="title">aiSarthi orchestrator</span>
          <span className="spacer" />
          <span className="badge">
            <span className={`dot ${status}`} />
            {status}
          </span>
        </header>

        {error ? <div className="error">{error}</div> : null}

        <div className="content">
          <div className="centered">
            <h2>{activeWorkspaceId ? "Workspace selected" : "Select a workspace"}</h2>
            <p>Sessions and agent runs will appear here.</p>
          </div>
        </div>
      </main>

      {adding ? (
        <div className="modal-backdrop" onClick={() => setAdding(false)}>
          <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
            <h2>Add workspace</h2>
            <p>Point aiSarthi at a folder on this machine.</p>
            <label className="field">
              <span>Name</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoFocus />
            </label>
            <label className="field">
              <span>Path</span>
              <input
                value={path}
                onChange={(event) => setPath(event.target.value)}
                placeholder="/Users/me/projects/app"
              />
            </label>
            <div className="modal-actions">
              <button type="button" className="btn ghost" onClick={() => setAdding(false)}>
                Cancel
              </button>
              <button type="submit" className="btn primary">
                Add workspace
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
