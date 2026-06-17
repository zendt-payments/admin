import { Preferences } from "@capacitor/preferences";

/**
 * Cross-platform persistent key/value storage (web + Capacitor iOS/Android).
 * Uses native UserDefaults / SharedPreferences on device; web uses Capacitor’s
 * implementation (with one-time migration from legacy `localStorage` keys).
 */
export async function getPersistent(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key });
  if (value != null) return value;

  if (typeof localStorage !== "undefined") {
    try {
      const legacy = localStorage.getItem(key);
      if (legacy !== null) {
        await Preferences.set({ key, value: legacy });
        localStorage.removeItem(key);
        return legacy;
      }
    } catch {
      /* ignore */
    }
  }
  return null;
}

export async function setPersistent(key: string, value: string): Promise<void> {
  await Preferences.set({ key, value });
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}

export async function removePersistent(key: string): Promise<void> {
  await Preferences.remove({ key });
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  }
}
