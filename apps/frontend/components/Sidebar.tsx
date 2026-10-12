"use client";

import Link from "next/link";
import { PROVIDERS_BY_ID } from "commons/types";
import { useOrchestrator } from "@/lib/orchestrator";

interface SidebarProps {
  onAddWorkspace: () => void;
  onNewSession: () => void;
}

export function Sidebar({ onAddWorkspace, onNewSession }: SidebarProps) {
  const {
    status,
    workspaces,
    sessions,
    activeWorkspaceId,
    activeSessionId,
    credentials,
    selectWorkspace,
    selectSession,
  } = useOrchestrator();

  const configuredCount = credentials.filter((entry) => entry.configured).length;

  const workspace = workspaces.find((entry) => entry.id === activeWorkspaceId) ?? null;

  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>aiSarthi</h1>
        <p>One UI for Claude, Codex &amp; Cursor</p>
      </div>

      <div className={`sidebar-section${workspace ? "" : " grow"}`}>
        <div className="section-header">
          <span>Workspaces</span>
          <button className="btn ghost" onClick={onAddWorkspace}>
            + Add
          </button>
        </div>
        <div className="section-scroll">
          {workspaces.length === 0 ? (
            <p className="empty">No workspaces yet. Add one to get started.</p>
          ) : (
            workspaces.map((entry) => (
              <button
                key={entry.id}
                className={`list-item${activeWorkspaceId === entry.id ? " active" : ""}`}
                onClick={() => selectWorkspace(entry.id)}
              >
                <span className="label">{entry.name}</span>
                <span className="meta">{entry.path}</span>
              </button>
            ))
          )}
        </div>
      </div>

      {workspace ? (
        <div className="sidebar-section grow">
          <div className="section-header">
            <span>Sessions</span>
            <button className="btn ghost" onClick={onNewSession}>
              + New
            </button>
          </div>
          <div className="section-scroll">
            {sessions.length === 0 ? (
              <p className="empty">No sessions in {workspace.name} yet.</p>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  className={`list-item${activeSessionId === session.id ? " active" : ""}`}
                  onClick={() => selectSession(session.id)}
                >
                  <span className="label">{session.title}</span>
                  <span className="meta">{PROVIDERS_BY_ID[session.provider].label}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}

      <div className="sidebar-footer">
        <span className="badge">
          <span className={`dot ${status}`} />
          {status === "connected" ? "orchestrator online" : status}
        </span>
        <Link className="btn ghost" href="/setup">
          Agent keys{configuredCount > 0 ? ` (${configuredCount})` : ""}
        </Link>
      </div>
    </aside>
  );
}
