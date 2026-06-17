import { Capacitor, SystemBars, SystemBarsStyle } from "@capacitor/core";

/**
 * Low-end device heuristic → toggles `html.perf-lite`, which (via index.css and
 * MotionContext) drops GPU-expensive effects (backdrop blur, big shadows) and
 * swaps spring page transitions for cheap fades. This keeps low-RAM / few-core
 * Android devices smooth on navigation + typing, while high-end devices keep the
 * full-fidelity experience untouched.
 *
 * iOS is excluded: many iPhones match the core-count heuristic but still need
 * decorative glows, and iOS uses the static SVG asset path instead of CSS blur.
 */
if (typeof document !== "undefined") {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const mem = nav.deviceMemory; // GB, rounded (Chromium/Android WebView)
  const cores = nav.hardwareConcurrency; // logical cores
  const isAndroid = Capacitor.getPlatform() === "android";
  const isLowEnd =
    isAndroid &&
    ((typeof mem === "number" && mem > 0 && mem <= 4) ||
      (typeof cores === "number" && cores > 0 && cores <= 4));
  if (isLowEnd) document.documentElement.classList.add("perf-lite");
}

/**
 * Runs before other app modules so CSS can target the WebView shell.
 * Disables smooth scrolling class hook for native — smoother on Android WebView.
 */
if (typeof document !== "undefined" && Capacitor.isNativePlatform()) {
  document.documentElement.classList.add("native-app");

  void SystemBars.setStyle({ style: SystemBarsStyle.Dark }).catch(() => {
    /* Non-fatal — config default still applies. */
  });

  const viewport = document.querySelector('meta[name="viewport"]');
  viewport?.setAttribute(
    "content",
    "width=device-width,initial-scale=1,maximum-scale=1,minimum-scale=1,user-scalable=no,viewport-fit=cover"
  );

  const blockGestureZoom = (event: Event) => {
    event.preventDefault();
  };
  document.addEventListener("gesturestart", blockGestureZoom, { passive: false });
  document.addEventListener("gesturechange", blockGestureZoom, { passive: false });
  document.addEventListener("gestureend", blockGestureZoom, { passive: false });
}
