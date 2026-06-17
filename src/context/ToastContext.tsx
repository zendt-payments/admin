import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import Toast, { type ToastTone, getToastAutoDismissMs } from "../components/Toast";

export type AppToastOptions = {
  message: string;
  subMessage?: string;
  tone?: ToastTone;
  /** Auto-dismiss ms (default varies by tone; error/warning default to 45s). Pass 0 to keep until next toast. */
  durationMs?: number;
};

type ToastContextValue = {
  showToast: (options: AppToastOptions) => void;
  showError: (message: string, subMessage?: string) => void;
  showSuccess: (message: string, subMessage?: string) => void;
  showWarning: (message: string, subMessage?: string) => void;
  dismissToast: () => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<(AppToastOptions & { visible: boolean }) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissToast = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setToast(null);
  }, []);

  const showToast = useCallback((options: AppToastOptions) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ ...options, visible: true });
    const duration =
      options.durationMs ?? getToastAutoDismissMs({ tone: options.tone, message: options.message });
    if (duration > 0) {
      timerRef.current = setTimeout(() => {
        setToast(null);
        timerRef.current = null;
      }, duration);
    }
  }, []);

  const showError = useCallback(
    (message: string, subMessage?: string) => {
      showToast({ message, subMessage, tone: "error" });
    },
    [showToast]
  );

  const showSuccess = useCallback(
    (message: string, subMessage?: string) => {
      showToast({ message, subMessage, tone: "success" });
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, subMessage?: string) => {
      showToast({ message, subMessage, tone: "warning" });
    },
    [showToast]
  );

  const value = useMemo(
    () => ({ showToast, showError, showSuccess, showWarning, dismissToast }),
    [showToast, showError, showSuccess, showWarning, dismissToast]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <Toast
        visible={!!toast?.visible}
        message={toast?.message ?? ""}
        subMessage={toast?.subMessage}
        tone={toast?.tone}
        onDismiss={dismissToast}
      />
    </ToastContext.Provider>
  );
}

export function useAppToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useAppToast must be used within ToastProvider");
  }
  return ctx;
}
