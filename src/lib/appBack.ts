import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import type { NavigateFunction } from "react-router-dom";
import { getNativeBackAction } from "./nativeBackNavigation";

/** Runs the shared back action for UI back buttons and native hardware / edge-swipe. */
export function performAppBack(navigate: NavigateFunction): void {
  const action = getNativeBackAction(window.location.pathname);

  if (action === "history-back") {
    navigate(-1);
    return;
  }

  if (action === "dashboard-home") {
    navigate("/dashboard/home");
    return;
  }

  if (action === "exit-app" && Capacitor.isNativePlatform()) {
    void App.exitApp();
  }
}
