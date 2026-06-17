// Seeded URL keeps the same generated avatar on every render/navigation
export const DEFAULT_AVATAR_URL = "/user-default.svg";

/** `user-default.svg` is a square with rx≈10/36 — not a circle. */
export function isDefaultAvatar(src: string): boolean {
  if (!src) return true;
  if (src === DEFAULT_AVATAR_URL) return true;
  return src.endsWith("/user-default.svg") || src.endsWith("user-default.svg");
}

/** Corner radius ratio matching user-default.svg (10/36) — use for default avatar frames only. */
export const DEFAULT_AVATAR_RADIUS_CLASS = "rounded-[28%]";
