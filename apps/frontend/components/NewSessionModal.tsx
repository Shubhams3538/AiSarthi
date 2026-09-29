"use client";

import { useState, type FormEvent } from "react";
import { PROVIDERS, type ProviderId } from "commons/types";
import { useOrchestrator } from "@/lib/orchestrator";

interface NewSessionModalProps {
  workspaceId: string;
  onClose: () => void;
}

export function NewSessionModal({ workspaceId, onClose }: NewSessionModalProps) {
  const { createSession } = useOrchestrator();
  const [provider, setProvider] = useState<ProviderId>("claude");
  const [title, setTitle] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createSession({ workspaceId, provider, title: title.trim() || undefined });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(event) => event.stopPropagation()} onSubmit={submit}>
        <h2>New session</h2>
        <p>Choose which coding agent should work in this workspace.</p>

        <div className="providers">
          {PROVIDERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={`provider-option${provider === entry.id ? " active" : ""}`}
              onClick={() => setProvider(entry.id)}
            >
              <span>
                <span className="name">{entry.label}</span>
                <span className="desc">{entry.description}</span>
              </span>
            </button>
          ))}
        </div>

        <label className="field" style={{ marginTop: 16 }}>
          <span>Title (optional)</span>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g. Fix the login flow"
          />
        </label>

        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Create session
          </button>
        </div>
      </form>
    </div>
  );
}
