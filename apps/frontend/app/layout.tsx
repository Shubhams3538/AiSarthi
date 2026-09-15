import type { Metadata } from "next";
import type { ReactNode } from "react";
import { OrchestratorProvider } from "@/lib/orchestrator";
import "./globals.css";

export const metadata: Metadata = {
  title: "aiSarthi",
  description: "One UI for Claude Code, Codex and Cursor",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <OrchestratorProvider>{children}</OrchestratorProvider>
      </body>
    </html>
  );
}
