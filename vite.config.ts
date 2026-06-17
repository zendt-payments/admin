import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vitest/config";

const analyze = process.env.ANALYZE === "1" || process.env.ANALYZE === "true";

export default defineConfig(() => ({
  // Required for Capacitor — absolute `/assets/...` paths break the Android WebView shell.
  base: "./",
  plugins: [
    tailwindcss(),
    react(),
    ...(analyze
      ? [
          visualizer({
            filename: "dist/stats.html",
            gzipSize: true,
            brotliSize: true,
            open: false,
            template: "treemap",
          }),
        ]
      : []),
  ],
  server: {
    host: true,
    allowedHosts: [".ngrok-free.dev", ".ngrok-free.app", ".ngrok.io"],
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  preview: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
  define: {
    global: "globalThis",
  },
  build: {
    target: "es2020",
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    esbuild: {
      legalComments: "none",
    },
    rollupOptions: {
      // Cognito's CookieStorage does `import * as Cookies from 'js-cookie'`, but
      // js-cookie v3 (pinned via `overrides` to patch GHSA-qjx8-664m-686j) only
      // has a default export. We never use CookieStorage (the user pool uses the
      // default localStorage), so this is dead code — silence just this warning.
      onwarn(warning, warn) {
        if (
          warning.code === "MISSING_EXPORT" &&
          typeof warning.id === "string" &&
          warning.id.includes("amazon-cognito-identity-js") &&
          warning.id.includes("CookieStorage")
        ) {
          return;
        }
        warn(warning);
      },
      output: {
        // Function form (not the object form): the object/array form only matches
        // each package's entry module and lets the bulk (e.g. react-dom, swiper)
        // leak into the main `index` chunk. Bucketing by path keeps each library
        // fully inside its vendor chunk — so libs used only by lazy routes stay
        // out of the eager initial payload.
        manualChunks(id) {
          if (!id.includes("/node_modules/")) return;
          if (/\/node_modules\/(react|react-dom|scheduler|use-sync-external-store)\//.test(id))
            return "vendor-react";
          if (
            /\/node_modules\/(react-router|react-router-dom|@remix-run\/router|cookie|set-cookie-parser)\//.test(
              id
            )
          )
            return "vendor-react";
          if (id.includes("/node_modules/@tanstack/")) return "vendor-query";
          if (/\/node_modules\/(motion|motion-dom|motion-utils|framer-motion)\//.test(id))
            return "vendor-motion";
          if (/\/node_modules\/(react-select|react-international-phone)\//.test(id)) return "vendor-select";
          if (/\/node_modules\/(react-easy-crop|swiper)\//.test(id)) return "vendor-media";
          if (id.includes("/node_modules/amazon-cognito-identity-js/")) return "vendor-cognito";
          // Everything else (Capacitor core + native plugins, lucide, shared
          // helpers like tslib, etc.) stays in ONE chunk. Do NOT split Capacitor
          // into its own chunk: it shares low-level helpers with the other native
          // plugins, which creates a circular chunk dependency that the Android
          // WebView fails to initialize (white screen on launch).
          return "vendor";
        },
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setupTests.ts"],
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8" as const,
      reporter: ["text"],
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/**/*.test.*", "src/**/*.spec.*", "src/main.tsx"],
    },
  },
}));
