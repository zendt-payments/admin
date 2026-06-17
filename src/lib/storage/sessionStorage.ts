/**
 * Session-scoped storage (tab / WebView session). Same API on web and in
 * Capacitor WebView; use for splash guard and in-session navigation hints.
 */
export function getSessionItem(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

export function setSessionItem(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* quota / private mode */
  }
}

export function removeSessionItem(key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}
