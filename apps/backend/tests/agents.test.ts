import { expect, test } from "bun:test";
import { buildCommand } from "agents/client";
import { PROVIDERS_BY_ID } from "commons/types";
import { conversationPrompt } from "../src/runs";
import { parseClientMessage } from "../src/protocol";

test("Codex uses stdin and workspace sandbox; credentials use CODEX_API_KEY", () => {
  const command = buildCommand("codex", "a prompt with $() and quotes");
  expect(command.args).toContain("workspace-write");
  expect(command.args.at(-1)).toBe("-");
  expect(command.args).not.toContain(
    "--dangerously-bypass-approvals-and-sandbox",
  );
  expect(PROVIDERS_BY_ID.codex.apiKeyEnvVar).toBe("CODEX_API_KEY");
});

test("Claude returns readable text and Cursor receives a literal argv prompt", () => {
  expect(buildCommand("claude", "prompt").args).toContain("text");
  expect(buildCommand("cursor", "$(touch /tmp/should-not-exist)").args[1]).toBe(
    "$(touch /tmp/should-not-exist)",
  );
});

test("conversation context retains latest turns within a bounded prompt", () => {
  expect(conversationPrompt([], "hello")).toBe("hello");
  const prompt = conversationPrompt(
    Array.from({ length: 20 }, (_, index) => ({
      role: "user",
      content: `turn-${index}:` + "x".repeat(10000),
    })),
    "latest",
  );
  expect(prompt.length).toBeLessThan(25000);
  expect(prompt).toContain("turn-19");
  expect(prompt).not.toContain("turn-0:");
  expect(prompt).toEndWith("latest");
});

test("protocol rejects whitespace-only prompts and malformed JSON", () => {
  expect(parseClientMessage("broken").ok).toBe(false);
  expect(
    parseClientMessage(
      JSON.stringify({
        type: "run.start",
        payload: { sessionId: "a".repeat(24), prompt: "   " },
      }),
    ).ok,
  ).toBe(false);
});
