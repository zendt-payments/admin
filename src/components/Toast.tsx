import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";

export type ToastTone = "info" | "success" | "error" | "warning";

export const TOAST_AUTO_DISMISS_MS = {
  default: 4200,
  success: 5200,
  error: 45000,
  warning: 45000,
} as const;

type ToastProps = {
  message: string;
  subMessage?: string;
  icon?: React.ReactNode;
  visible: boolean;
  /** Visual emphasis. Defaults to "info". */
  tone?: ToastTone;
  /** Called when the user dismisses an error/warning toast early. */
  onDismiss?: () => void;
};

/**
 * Tones live as inline styles so we don't depend on Tailwind generating
 * dynamic class names. The faint colored ring + soft icon-bg is enough
 * accent without overpowering the dark UI.
 */
const TONE_STYLES: Record<ToastTone, { ring: string; iconBg: string; iconColor: string }> = {
  info: { ring: "rgba(255,255,255,0.12)", iconBg: "rgba(255,255,255,0.12)", iconColor: "#FFFFFF" },
  success: { ring: "rgba(52,211,153,0.45)", iconBg: "rgba(52,211,153,0.18)", iconColor: "#34D399" },
  error: { ring: "rgba(244,63,94,0.55)", iconBg: "rgba(244,63,94,0.18)", iconColor: "#FB7185" },
  warning: { ring: "rgba(251,191,36,0.50)", iconBg: "rgba(251,191,36,0.18)", iconColor: "#FBBF24" },
};

function DefaultIcon({ tone }: { tone: ToastTone }) {
  const color = TONE_STYLES[tone].iconColor;
  if (tone === "success") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  if (tone === "error") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
    );
  }
  if (tone === "warning") {
    return (
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    );
  }
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  );
}

function inferTone(message: string): ToastTone {
  const m = message.toLowerCase();
  if (m.includes("error") || m.includes("invalid") || m.includes("failed") || m.includes("required"))
    return "error";
  if (m.includes("success") || m.includes("copied") || m.includes("saved") || m.includes("sent"))
    return "success";
  if (m.includes("warn") || m.includes("blocked") || m.includes("denied")) return "warning";
  return "info";
}

/** Auto-dismiss duration for toasts; error/warning stay visible for 45s. */
export function getToastAutoDismissMs(options?: { tone?: ToastTone; message?: string }): number {
  const resolvedTone = options?.tone ?? (options?.message ? inferTone(options.message) : "info");
  if (resolvedTone === "error") return TOAST_AUTO_DISMISS_MS.error;
  if (resolvedTone === "warning") return TOAST_AUTO_DISMISS_MS.warning;
  if (resolvedTone === "success") return TOAST_AUTO_DISMISS_MS.success;
  return TOAST_AUTO_DISMISS_MS.default;
}

/**
 * App-wide toast.
 *
 * - Rendered via React Portal directly into document.body so ancestor
 *   transforms (page transition motion.div) can never steal `position: fixed`.
 *   This was the source of the "scroll up to see validation error" bug.
 * - Spring-in / soft fade-out via framer-motion for premium feel.
 * - Honors prefers-reduced-motion via the existing transition-all duration.
 * - role/aria-live are set per tone so screen readers announce errors
 *   immediately and info toasts politely.
 */
export default function Toast({ message, subMessage, icon, visible, tone, onDismiss }: ToastProps) {
  if (typeof document === "undefined") return null;

  const resolvedTone = tone ?? inferTone(message);
  const t = TONE_STYLES[resolvedTone];
  const isError = resolvedTone === "error";
  const canDismiss = !!onDismiss && (resolvedTone === "error" || resolvedTone === "warning");

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          role={isError ? "alert" : "status"}
          aria-live={isError ? "assertive" : "polite"}
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.98 }}
          transition={{ type: "spring", stiffness: 520, damping: 32, mass: 0.6 }}
          style={{
            position: "fixed",
            top: "max(var(--zendt-safe-top, env(safe-area-inset-top, 0px)), 16px)",
            right: 16,
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            gap: 10,
            maxWidth: "calc(100vw - 32px)",
            padding: canDismiss ? "10px 10px 10px 14px" : "10px 14px",
            borderRadius: 14,
            border: `1px solid ${t.ring}`,
            background: "rgba(20, 20, 20, 0.86)",
            backdropFilter: "blur(18px) saturate(140%)",
            WebkitBackdropFilter: "blur(18px) saturate(140%)",
            boxShadow: "0 18px 45px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255,255,255,0.06) inset",
            color: "#fff",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              flex: "0 0 auto",
              width: 26,
              height: 26,
              borderRadius: 999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: t.iconBg,
            }}
          >
            {icon ?? <DefaultIcon tone={resolvedTone} />}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.2 }}>{message}</div>
            {subMessage && (
              <div
                style={{ marginTop: 2, fontSize: 11, lineHeight: 1.35, color: "rgba(255,255,255,0.72)" }}
              >
                {subMessage}
              </div>
            )}
          </div>
          {canDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Dismiss notification"
              style={{
                flex: "0 0 auto",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 24,
                height: 24,
                marginLeft: 2,
                border: "none",
                borderRadius: 999,
                background: "rgba(255,255,255,0.08)",
                color: "rgba(255,255,255,0.72)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                aria-hidden
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          ) : null}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
