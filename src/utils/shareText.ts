import { Capacitor } from "@capacitor/core";

export type ShareTextOptions = {
  title?: string;
  /** Android share-sheet title (Capacitor `dialogTitle`) */
  dialogTitle?: string;
};

function isUserDismissedShareError(e: unknown): boolean {
  const name = e && typeof e === "object" && "name" in e ? String((e as { name: unknown }).name) : "";
  if (name === "AbortError") return true;
  const msg =
    e && typeof e === "object" && "message" in e
      ? String((e as { message: unknown }).message).toLowerCase()
      : "";
  return msg.includes("cancel") || msg.includes("abort");
}

/**
 * Shares plain text using the device share sheet (Android/iOS: Messages, WhatsApp, Mail, etc.).
 * On Capacitor native WebViews, uses @capacitor/share (WebView often has no `navigator.share`).
 * Falls back to copying to the clipboard when sharing is unavailable (typical on desktop).
 */
export async function shareText(
  text: string,
  opts?: ShareTextOptions
): Promise<{ ok: boolean; used: "share" | "clipboard" | "none" }> {
  const t = text.trim() || " ";

  if (Capacitor.isNativePlatform()) {
    try {
      const { Share } = await import("@capacitor/share");
      await Share.share({
        title: opts?.title,
        text: t,
        dialogTitle: opts?.dialogTitle ?? opts?.title ?? "Share",
      });
      return { ok: true, used: "share" };
    } catch (e: unknown) {
      if (isUserDismissedShareError(e)) {
        return { ok: true, used: "share" };
      }
      // Real failure: try clipboard below
    }
  }

  if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
    try {
      await navigator.share({ title: opts?.title, text: t });
      return { ok: true, used: "share" };
    } catch (e: unknown) {
      if (isUserDismissedShareError(e)) {
        return { ok: true, used: "share" };
      }
    }
  }

  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(t);
      return { ok: true, used: "clipboard" };
    }
  } catch {
    /* continue */
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = t;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    return { ok: true, used: "clipboard" };
  } catch {
    return { ok: false, used: "none" };
  }
}
