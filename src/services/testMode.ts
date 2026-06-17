export const TEST_MODE = import.meta.env.VITE_TEST_MODE === "true";

export const TEST_EMAIL = "test@zendt.app";
export const TEST_PASSWORD = "Test@1234";

/** Synthetic Cognito-ish tokens — only used when VITE_TEST_MODE=true (no JWKS). */
export const TEST_AUTH_ID_TOKEN = "test.jwt.token";
export const TEST_AUTH_ACCESS_TOKEN = "test.access.token";
export const TEST_AUTH_REFRESH_TOKEN = "test.refresh.token";

const SESSION_KEY = "zendt_test_session";

export function hasTestSession(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(SESSION_KEY) === "1";
}

export function setTestSession(active: boolean): void {
  if (typeof localStorage === "undefined") return;
  if (active) localStorage.setItem(SESSION_KEY, "1");
  else localStorage.removeItem(SESSION_KEY);
}
