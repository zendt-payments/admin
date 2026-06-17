import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { performAppBack } from "../lib/appBack";

/**
 * Intercepts Android back / edge-swipe: one step back in history until dashboard
 * home, then exits the app on the next gesture.
 */
export function useNativeBackButton(): void {
  const navigate = useNavigate();
  const location = useLocation();
  const pathnameRef = useRef(location.pathname);

  useEffect(() => {
    pathnameRef.current = location.pathname;
  }, [location.pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listener = App.addListener("backButton", () => {
      performAppBack(navigate);
    });

    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [navigate]);
}
