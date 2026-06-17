import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { useEffect, useState } from "react";

/**
 * Increments when the app returns to foreground (native) or the browser tab
 * becomes visible. Use as a `useEffect` dependency to re-fetch local state.
 */
export function useAppResumeTick(): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);

    const onVisibility = () => {
      if (document.visibilityState === "visible") bump();
    };
    document.addEventListener("visibilitychange", onVisibility);

    let removeNative: (() => void) | undefined;
    if (Capacitor.isNativePlatform()) {
      const sub = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive) bump();
      });
      removeNative = () => {
        void sub.then((handle) => handle.remove());
      };
    }

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      removeNative?.();
    };
  }, []);

  return tick;
}
