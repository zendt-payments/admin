import type { ReactNode } from "react";

/** Main screen headline — use for dashboard page titles (consistent size + weight everywhere). */
export const dashboardPageTitleClass = "text-title font-light tracking-tight text-white";

/** In-screen section headings (e.g. “Payment history”, card blocks). */
export const dashboardSectionTitleClass = "text-callout font-medium tracking-tight text-white/95";

/** Modal / confirmation sheet titles. */
export const dashboardDialogTitleClass = "text-callout font-medium tracking-tight text-white";

/** Optional muted label above a primary title. */
export const dashboardEyebrowClass = "text-caption font-medium tracking-[0.14em] text-white/40 uppercase";

export function DashboardPageTitle({
  children,
  as: Tag = "h1",
  className = "",
}: {
  children: ReactNode;
  as?: "h1" | "h2" | "h3";
  className?: string;
}) {
  return <Tag className={[dashboardPageTitleClass, className].filter(Boolean).join(" ")}>{children}</Tag>;
}

export function DashboardSectionTitle({
  children,
  as: Tag = "h3",
  className = "",
}: {
  children: ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <Tag className={[dashboardSectionTitleClass, className].filter(Boolean).join(" ")}>{children}</Tag>
  );
}
