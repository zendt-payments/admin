import { createContext, useContext, type ReactNode } from "react";
import { useReducedMotion } from "motion/react";

const ReducedMotionCtx = createContext<boolean>(false);

/** Low-end devices (flagged by native-preflight) use cheap fades instead of springs. */
const isLowPowerDevice =
  typeof document !== "undefined" && document.documentElement.classList.contains("perf-lite");

/**
 * Reduced when the OS requests it OR the device was flagged low-end. On capable
 * hardware nothing changes; on weak Android devices this turns per-navigation
 * spring transitions into a fast opacity fade, removing the main-thread jank.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  const reduced = (useReducedMotion() ?? false) || isLowPowerDevice;
  return <ReducedMotionCtx.Provider value={reduced}>{children}</ReducedMotionCtx.Provider>;
}

export function useReducedMotionCtx(): boolean {
  return useContext(ReducedMotionCtx);
}
