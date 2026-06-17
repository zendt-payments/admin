import { Capacitor } from "@capacitor/core";
import { QueryClient, focusManager } from "@tanstack/react-query";

const native = typeof window !== "undefined" && Capacitor.isNativePlatform();

/** Wire Capacitor app foreground events into TanStack Query's focus manager. */
if (typeof window !== "undefined" && native) {
  void import("@capacitor/app").then(({ App }) => {
    focusManager.setEventListener((handleFocus) => {
      const sub = App.addListener("appStateChange", ({ isActive }) => {
        handleFocus(isActive);
      });
      return () => {
        void sub.then((handle) => handle.remove());
      };
    });
  });
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 45_000,
      gcTime: 10 * 60_000,
      retry: 1,
      /** Native: refetch stale queries when app returns from background (via focusManager above). */
      refetchOnWindowFocus: native,
      /** Network reconnect on mobile often fires spuriously; avoids full-cache churn in APK. */
      refetchOnReconnect: native ? false : true,
    },
  },
});
