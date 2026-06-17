import type { ReactNode } from "react";

/**
 * Wraps dashboard route outlet content. PageContainer / full-screen panels
 * own their own safe-area padding; this shell only provides layout flex.
 */
export default function DashboardOutletShell({ children }: { children: ReactNode }) {
  return <div className="w-full min-h-0 flex-1 flex flex-col">{children}</div>;
}
