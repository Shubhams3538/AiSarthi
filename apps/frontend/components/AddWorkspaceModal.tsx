"use client";

import { useState, type FormEvent } from "react";
import { useOrchestrator } from "@/lib/orchestrator";

interface AddWorkspaceModalProps {
  onClose: () => void;
}

export function AddWorkspaceModal({ onClose }: AddWorkspaceModalProps) {
  const { createWorkspace } = useOrchestrator();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !path.trim()) return;
    createWorkspace({ name: name.trim(), path: path.trim() });
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
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
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary">
            Add workspace
          </button>
        </div>
      </form>
    </div>
  );
}
