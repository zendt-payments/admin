import { isApiError } from "./apiError";

const MESSAGES: Record<string, string> = {
  PHONE_IN_USE: "This phone number is already in use.",
  EMAIL_IN_USE: "This email is already in use.",
  BUSINESS_EMAIL_IN_USE: "This business email is already in use.",
  BUSINESS_PHONE_IN_USE: "This business phone number is already in use.",
  DUPLICATE_KEY: "This contact is already in use.",
};

/** User-visible message for profile PUT conflict codes, or null if not a known conflict. */
export function messageForProfileContactConflict(err: unknown): string | null {
  if (!isApiError(err) || err.status !== 409) return null;
  const c = err.code;
  if (c && MESSAGES[c]) return MESSAGES[c];
  return null;
}

/** Toast copy for profile / business save failures (409 conflicts, 400 validation, network). */
export function getProfileSaveErrorToast(err: unknown): { title: string; sub: string; tone: "error" } {
  const conflict = messageForProfileContactConflict(err);
  if (conflict) {
    return {
      title: conflict,
      sub: "Use a different number or email, or contact support.",
      tone: "error",
    };
  }
  if (isApiError(err)) {
    const msg = err.message.trim() || "Request failed";
    if (err.status === 400) {
      return { title: "Validation failed", sub: msg, tone: "error" };
    }
    return { title: "Couldn't save changes", sub: msg, tone: "error" };
  }
  return {
    title: "Couldn't save changes",
    sub: err instanceof Error ? err.message : "Try again.",
    tone: "error",
  };
}
