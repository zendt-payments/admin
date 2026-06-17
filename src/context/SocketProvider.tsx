import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getAuthTokenAsync } from "../services/auth";
import {
  connectRealtimeSocket,
  type RealtimeConnection,
  type RealtimeMessage,
} from "../services/realtimeSocket";
import { invalidateOnRealtimeEvent } from "../lib/dashboardQueries";
import { useAuth } from "./AuthContext";

type SocketContextValue = {
  isConnected: boolean;
};

const SocketContext = createContext<SocketContextValue>({ isConnected: false });

const SEEN_EVENT_IDS_MAX = 200;
const INVALIDATE_DEBOUNCE_MS = 300;

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const connectionRef = useRef<RealtimeConnection | null>(null);
  const seenEventIds = useRef<Set<string>>(new Set());
  const invalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingTypes = useRef<Set<string>>(new Set());
  const pendingData = useRef<Map<string, Record<string, unknown>>>(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const rememberEventId = useCallback((eventId: string | null | undefined): boolean => {
    if (!eventId) return true;
    if (seenEventIds.current.has(eventId)) return false;
    seenEventIds.current.add(eventId);
    if (seenEventIds.current.size > SEEN_EVENT_IDS_MAX) {
      const first = seenEventIds.current.values().next().value;
      if (first) seenEventIds.current.delete(first);
    }
    return true;
  }, []);

  const flushInvalidations = useCallback(() => {
    invalidateTimer.current = null;
    const types = [...pendingTypes.current];
    pendingTypes.current.clear();
    const dataByType = new Map(pendingData.current);
    pendingData.current.clear();

    void (async () => {
      for (const type of types) {
        await invalidateOnRealtimeEvent(queryClient, type, dataByType.get(type));
      }
    })();
  }, [queryClient]);

  const scheduleInvalidation = useCallback(
    (type: string, data?: Record<string, unknown>) => {
      pendingTypes.current.add(type);
      if (data) pendingData.current.set(type, data);
      if (invalidateTimer.current) return;
      invalidateTimer.current = setTimeout(flushInvalidations, INVALIDATE_DEBOUNCE_MS);
    },
    [flushInvalidations]
  );

  const handleEvent = useCallback(
    (msg: RealtimeMessage) => {
      if (!rememberEventId(msg.eventId)) return;
      scheduleInvalidation(msg.type, msg.data);
    },
    [rememberEventId, scheduleInvalidation]
  );

  useEffect(() => {
    if (isLoading || !isAuthenticated) {
      connectionRef.current?.disconnect();
      connectionRef.current = null;
      setIsConnected(false);
      return;
    }

    connectionRef.current = connectRealtimeSocket(getAuthTokenAsync, handleEvent, setIsConnected);

    return () => {
      if (invalidateTimer.current) {
        clearTimeout(invalidateTimer.current);
        invalidateTimer.current = null;
      }
      connectionRef.current?.disconnect();
      connectionRef.current = null;
      setIsConnected(false);
    };
  }, [isAuthenticated, isLoading, handleEvent]);

  return <SocketContext.Provider value={{ isConnected }}>{children}</SocketContext.Provider>;
}

export function useSocketConnected(): boolean {
  return useContext(SocketContext).isConnected;
}
