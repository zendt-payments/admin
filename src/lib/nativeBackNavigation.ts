/** How the native back gesture / hardware back key should behave. */
export type NativeBackAction = "history-back" | "dashboard-home" | "exit-app";

const NO_HISTORY_BACK_PATHS = new Set(["/", "/splash", "/login", "/pay"]);

/**
 * Top-level pages opened from the global features drawer. They can be reached
 * from any screen, so back must always return to the dashboard home (one layer),
 * not to whichever page happened to precede them in history.
 */
const DASHBOARD_HOME_BACK_PATHS = new Set(["/dashboard/invoice-options"]);

function isDashboardHomePath(pathname: string): boolean {
  return pathname === "/dashboard/home" || pathname === "/dashboard";
}

function canGoBackInHistory(): boolean {
  return (window.history.state?.idx ?? 0) > 0;
}

/**
 * Resolves in-app back navigation for Android/iOS native shells and BackButton.
 * Goes one step back in history when possible; from dashboard home, exits the app.
 */
export function getNativeBackAction(pathname: string): NativeBackAction {
  if (isDashboardHomePath(pathname)) return "exit-app";

  if (DASHBOARD_HOME_BACK_PATHS.has(pathname)) return "dashboard-home";

  if (pathname.startsWith("/dashboard")) {
    if (canGoBackInHistory()) return "history-back";
    return "dashboard-home";
  }

  if (NO_HISTORY_BACK_PATHS.has(pathname)) return "exit-app";

  if (canGoBackInHistory()) return "history-back";

  return "exit-app";
}
