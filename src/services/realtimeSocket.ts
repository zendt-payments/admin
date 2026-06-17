import { Capacitor } from "@capacitor/core";
import { TEST_MODE } from "./testMode";

export type RealtimeMessage = {
  type: string;
  data?: Record<string, unknown>;
  eventId?: string | null;
};

export type RealtimeConnection = {
  disconnect: () => void;
  isConnected: () => boolean;
};

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000, 30000];

export function getRealtimeWsUrl(): string {
  const explicit = import.meta.env.VITE_WS_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const api = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");
  if (api.startsWith("https://")) return api.replace(/^https:\/\//, "wss://");
  return api.replace(/^http:\/\//, "ws://");
}

export function connectRealtimeSocket(
  getToken: () => Promise<string | null>,
  onEvent: (msg: RealtimeMessage) => void,
  onConnectionChange?: (connected: boolean) => void
): RealtimeConnection {
  if (TEST_MODE) {
    onConnectionChange?.(false);
    return { disconnect: () => {}, isConnected: () => false };
  }

  let ws: WebSocket | null = null;
  let closed = false;
  let backoffIdx = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let resumeRemove: (() => void) | undefined;

  const setConnected = (v: boolean) => onConnectionChange?.(v);

  const clearReconnect = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };

  const scheduleReconnect = () => {
    if (closed) return;
    clearReconnect();
    const delay = BACKOFF_MS[Math.min(backoffIdx, BACKOFF_MS.length - 1)]!;
    backoffIdx = Math.min(backoffIdx + 1, BACKOFF_MS.length - 1);
    reconnectTimer = setTimeout(() => {
      void open();
    }, delay);
  };

  const open = async () => {
    if (closed) return;
    const token = await getToken();
    if (!token || closed) {
      setConnected(false);
      scheduleReconnect();
      return;
    }

    if (ws) {
      ws.close();
      ws = null;
    }

    try {
      const url = `${getRealtimeWsUrl()}/ws?token=${encodeURIComponent(token)}`;
      ws = new WebSocket(url);
    } catch {
      setConnected(false);
      scheduleReconnect();
      return;
    }

    ws.onopen = () => {
      backoffIdx = 0;
      setConnected(true);
    };

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(String(ev.data)) as RealtimeMessage;
        if (msg?.type) onEvent(msg);
      } catch {
        /* ignore malformed payloads */
      }
    };

    ws.onclose = () => {
      ws = null;
      setConnected(false);
      if (!closed) scheduleReconnect();
    };

    ws.onerror = () => {
      ws?.close();
    };
  };

  void open();

  if (Capacitor.isNativePlatform()) {
    void import("@capacitor/app").then(({ App }) => {
      const sub = App.addListener("appStateChange", ({ isActive }) => {
        if (isActive && !closed && (!ws || ws.readyState !== WebSocket.OPEN)) {
          clearReconnect();
          backoffIdx = 0;
          void open();
        }
      });
      resumeRemove = () => {
        void sub.then((h) => h.remove());
      };
    });
  }

  return {
    disconnect: () => {
      closed = true;
      clearReconnect();
      resumeRemove?.();
      ws?.close();
      ws = null;
      setConnected(false);
    },
    isConnected: () => ws?.readyState === WebSocket.OPEN,
  };
}
