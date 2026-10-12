"use client";

import { useState, type FormEvent } from "react";
import { PROVIDERS, type ProviderId } from "commons/types";
import { useOrchestrator } from "@/lib/orchestrator";

interface NewSessionModalProps {
  workspaceId: string;
  onClose: () => void;
}

export function NewSessionModal({
  workspaceId,
  onClose,
}: NewSessionModalProps) {
  const { createSession, status, providers } = useOrchestrator();
  const [provider, setProvider] = useState<ProviderId>("claude");
  const [title, setTitle] = useState("");

  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (pending || status !== "connected") return;
    setPending(true);
    setError(null);
    try {
      await createSession({
        workspaceId,
        provider,
        title: title.trim() || undefined,
      });
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
        aria-label="New session"
        onClick={(event) => event.stopPropagation()}
        onSubmit={submit}
      >
        <h2>New session</h2>
        <p>Choose which coding agent should work in this workspace.</p>

        <div className="providers">
          {PROVIDERS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              disabled={
                providers.find((item) => item.id === entry.id)?.available ===
                false
              }
              className={`provider-option${provider === entry.id ? " active" : ""}`}
              onClick={() => setProvider(entry.id)}
            >
              <span>
                <span className="name">{entry.label}</span>
                <span className="desc">
                  {providers.find((item) => item.id === entry.id)?.available ===
                  false
                    ? "CLI not installed"
                    : entry.description}
                </span>
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
            disabled={
              pending ||
              status !== "connected" ||
              providers.find((item) => item.id === provider)?.available ===
                false
            }
          >
            Create session
          </button>
        </div>
      </form>
    </div>
  );
}
