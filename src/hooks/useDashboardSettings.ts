import { useState, useEffect } from "react";
import { getPersistent, setPersistent } from "../lib/storage";

export type DashboardSection = "transactions" | "wallets";

type DashboardSettings = Record<DashboardSection, boolean>;

const STORAGE_KEY = "zendt_dashboard_settings";

const DEFAULT_SETTINGS: DashboardSettings = {
  transactions: true,
  wallets: true,
};

export function useDashboardSettings() {
  const [settings, setSettings] = useState<DashboardSettings>(DEFAULT_SETTINGS);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getPersistent(STORAGE_KEY);
        if (cancelled || !stored) {
          setReady(true);
          return;
        }
        const parsed = JSON.parse(stored) as Partial<DashboardSettings>;
        if (typeof parsed.transactions === "boolean" && typeof parsed.wallets === "boolean") {
          setSettings({
            transactions: parsed.transactions,
            wallets: parsed.wallets,
          });
        } else if (typeof parsed.transactions === "boolean") {
          setSettings({
            transactions: parsed.transactions,
            wallets: DEFAULT_SETTINGS.wallets,
          });
        }
      } catch (error) {
        console.error("Failed to load dashboard settings:", error);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    (async () => {
      try {
        await setPersistent(STORAGE_KEY, JSON.stringify(settings));
      } catch (error) {
        console.error("Failed to save dashboard settings:", error);
      }
    })();
  }, [settings, ready]);

  const toggleSection = (section: DashboardSection) => {
    setSettings((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  return {
    settings,
    toggleSection,
  };
}
