import type { ReactNode } from "react";

/** Bottom-anchored scroll shell for login / signup / forgot-password. */
export default function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-end justify-center px-5 pt-safe pb-[calc(25px+var(--zendt-safe-bottom))] overflow-y-scroll no-scrollbar">
      {children}
    </div>
  );
}
