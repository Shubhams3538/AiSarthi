"use client";

import { useState, type FormEvent } from "react";
import { useOrchestrator } from "@/lib/orchestrator";

interface AddWorkspaceModalProps {
  onClose: () => void;
}

export function AddWorkspaceModal({ onClose }: AddWorkspaceModalProps) {
  const { createWorkspace, status } = useOrchestrator();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !path.trim()) return;
    if (pending || status !== "connected") return;
    setPending(true);
    setError(null);
    try {
      await createWorkspace({ name: name.trim(), path: path.trim() });
      onClose();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add workspace"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2>Add workspace</h2>
        <p>Point aiSarthi at a folder on this machine.</p>
        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </label>
        <label className="field">
          <span>Path</span>
          <input
            value={path}
            onChange={(event) => setPath(event.target.value)}
            placeholder="/Users/me/projects/app"
          />
        </label>
        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}
        <div className="modal-actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={pending || status !== "connected"}
          >
            Add workspace
          </button>
        </div>
      </form>
    </div>
  );
}
