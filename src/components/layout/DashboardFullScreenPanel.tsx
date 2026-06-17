import type { ReactNode } from "react";

interface DashboardFullScreenPanelProps {
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}

/**
 * Full-height dashboard panel (payment status, transactions, etc.).
 * Top/bottom safe area + mobile tab bar clearance; background stays #141414 edge-to-edge.
 */
export default function DashboardFullScreenPanel({
  children,
  className,
  innerClassName,
}: DashboardFullScreenPanelProps) {
  return (
    <section
      className={["zendt-dashboard-cairo w-full h-screen overflow-hidden text-white", className]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "mx-auto flex h-full max-w-4xl flex-col rounded-b-[32px] bg-[#141414] px-6 pt-safe-header pb-safe-tab shadow-[0_35px_65px_rgba(4,4,7,0.55)] sm:px-10",
          innerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {children}
      </div>
    </section>
  );
}
