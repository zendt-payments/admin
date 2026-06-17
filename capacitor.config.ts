import type { CapacitorConfig } from "@capacitor/cli";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

function viteEnvFromFiles(key: string): string {
  let last = "";
  for (const name of [".env", ".env.local"] as const) {
    const p = resolve(process.cwd(), name);
    if (!existsSync(p)) continue;
    const lines = readFileSync(p, "utf8").split("\n");
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      if (trimmed.startsWith(`${key}=`)) {
        last = trimmed
          .slice(key.length + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
      }
    }
  }
  return last;
}

/** Web client ID — Android requestIdToken audience + backend verification. */
function viteGoogleWebClientFromEnvFiles(): string {
  return viteEnvFromFiles("VITE_GOOGLE_OAUTH_WEB_CLIENT_ID");
}

/** iOS client ID — GIDConfiguration.clientID fallback when JS initialize omits clientId. */
function viteGoogleIosClientFromEnvFiles(): string {
  return viteEnvFromFiles("VITE_GOOGLE_OAUTH_IOS_CLIENT_ID");
}

const config: CapacitorConfig = {
  appId: "com.zendt.app",
  appName: "Zendt",
  webDir: "dist",
  /** Match app chrome; avoids white flash behind WebView during transitions. */
  backgroundColor: "#141414",
  ios: {
    zoomEnabled: false,
  },
  android: {
    zoomEnabled: false,
  },

  plugins: {
    SystemBars: {
      /** Injects --safe-area-inset-* on Android; pairs with env() on iOS. */
      insetsHandling: "css",
      /** Light status/nav icons on #141414 app chrome. */
      style: "DARK",
      hidden: false,
      animation: "NONE",
    },
    Keyboard: {
      resize: "none",
    },
    GoogleAuth: {
      scopes: ["openid", "profile", "email"],
      /** Web client — Android requestIdToken audience; iOS serverClientID for offline/server auth. */
      serverClientId: viteGoogleWebClientFromEnvFiles(),
      iosClientId: viteGoogleIosClientFromEnvFiles(),
      /** Do not set androidClientId here — the plugin uses it for requestIdToken; Android needs the Web ID. */
      forceCodeForRefreshToken: true,
    },
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      backgroundColor: "#141414",
      androidSplashResourceName: "splash",
      androidScaleType: "CENTER_CROP",
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
