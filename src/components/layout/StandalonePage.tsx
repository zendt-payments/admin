import type { ReactNode } from "react";

interface StandalonePageProps {
  children: ReactNode;
  className?: string;
  /** Center content vertically (pay checkout, errors). */
  centered?: boolean;
}

/** Routes outside the dashboard shell (pay, launch loading, etc.). */
export default function StandalonePage({ children, className, centered = false }: StandalonePageProps) {
  return (
    <div
      className={[
        "min-h-screen w-full bg-[#141414] px-6 pt-safe pb-safe",
        centered ? "flex items-center justify-center" : "flex flex-col",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
