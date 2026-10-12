"use client";

import Link from "next/link";
import { useState } from "react";
import { PROVIDERS } from "commons/types";
import { useOrchestrator } from "@/lib/orchestrator";

/**
 * Agent credentials.
 *
 * Reachable at any time from the sidebar. Keys are stored in the local database
 * and injected into the agent process at spawn time, so a provider can be used
 * without exporting anything into the shell. Leaving a provider empty falls back
 * to that CLI's own stored login.
 */
export default function SetupPage() {
  const {
    status,
    credentials,
    providers,
    saveCredential,
    deleteCredential,
    error,
    dismissError,
  } = useOrchestrator();
  const [pending, setPending] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const configured = new Map(
    credentials.map((entry) => [entry.provider, entry]),
  );

  return (
    <div className="setup">
      <header className="topbar">
        <span className="title">Agent credentials</span>
        <span className="spacer" />
        <span className="badge">
          <span className={`dot ${status}`} />
          {status === "connected" ? "orchestrator online" : status}
        </span>
        <Link className="btn ghost" href="/">
          ← Back to chat
        </Link>
      </header>

      {error ? (
        <div className="error" role="button" onClick={dismissError}>
          {error}
        </div>
      ) : null}

      <div className="setup-body">
        <p className="hint">
          Keys stay in your local database and are injected only into the
          spawned agent process. Leave a provider blank to use the login that
          CLI already has on this machine.
        </p>

        {feedback ? (
          <p className="hint" role="status">
            {feedback}
          </p>
        ) : null}
        <div className="setup-grid">
          {PROVIDERS.map((provider) => {
            const entry = configured.get(provider.id);
            const isConfigured = entry?.configured ?? false;
            const draft = drafts[provider.id] ?? "";

            return (
              <form
                key={provider.id}
                className="provider-card"
                onSubmit={async (event) => {
                  event.preventDefault();
                  const apiKey = draft.trim();
                  if (!apiKey) return;
                  setPending(provider.id);
                  setFeedback(null);
                  try {
                    await saveCredential(provider.id, apiKey);
                    setDrafts((previous) => ({
                      ...previous,
                      [provider.id]: "",
                    }));
                    setFeedback(`${provider.label} key saved.`);
                  } catch (failure) {
                    setFeedback(
                      failure instanceof Error
                        ? failure.message
                        : String(failure),
                    );
                  } finally {
                    setPending(null);
                  }
                }}
              >
                <div className="provider-card-head">
                  <div>
                    <span className="name">{provider.label}</span>
                    <span className="desc">{provider.description}</span>
                  </div>
                  <span
                    className={`status-pill ${isConfigured ? "on" : "off"}`}
                  >
                    {isConfigured ? "configured" : "not set"}
                  </span>
                </div>

                <label className="field">
                  <span>{provider.apiKeyEnvVar}</span>
                  <input
                    type="password"
                    autoComplete="off"
                    spellCheck={false}
                    value={draft}
                    onChange={(event) =>
                      setDrafts((previous) => ({
                        ...previous,
                        [provider.id]: event.target.value,
                      }))
                    }
                    placeholder={
                      isConfigured
                        ? "stored — enter a new key to replace"
                        : "paste your API key"
                    }
                  />
                </label>

                <div className="provider-card-actions">
                  <a
                    className="hint link"
                    href={provider.apiKeyUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get a key ↗
                  </a>
                  <span className="spacer" />
                  {isConfigured ? (
                    <button
                      type="button"
                      className="btn ghost"
                      disabled={pending !== null || status !== "connected"}
                      onClick={async () => {
                        setPending(provider.id);
                        try {
                          await deleteCredential(provider.id);
                          setFeedback(`${provider.label} key removed.`);
                        } catch (failure) {
                          setFeedback(
                            failure instanceof Error
                              ? failure.message
                              : String(failure),
                          );
                        } finally {
                          setPending(null);
                        }
                      }}
                    >
                      Remove
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="btn primary"
                    disabled={
                      !draft.trim() ||
                      pending !== null ||
                      status !== "connected"
                    }
                  >
                    Save
                  </button>
                </div>

                <code className="binary-hint">
                  {providers.find((item) => item.id === provider.id)?.available
                    ? `${provider.binary} is installed`
                    : `${provider.binary} is not installed on PATH`}
                </code>
              </form>
            );
          })}
        </div>
      </div>
    </div>
  );
}
