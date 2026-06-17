import type { ReactNode } from "react";

interface PageContainerProps {
  children: ReactNode;
  className?: string;
}

export default function PageContainer({ children, className }: PageContainerProps) {
  return (
    <div
      className={[
        "w-full max-w-3xl mx-auto flex flex-col space-y-6 min-h-screen bg-[#141414] pb-safe-tab",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
