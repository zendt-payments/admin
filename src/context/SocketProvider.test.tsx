import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { RealtimeMessage } from "../services/realtimeSocket";

const connectMock = vi.fn();

let capturedOnEvent: ((msg: RealtimeMessage) => void) | null = null;

vi.mock("../services/realtimeSocket", () => ({
  connectRealtimeSocket: (...args: unknown[]) => connectMock(...args),
}));

vi.mock("./AuthContext", () => ({
  useAuth: () => ({ isAuthenticated: true, isLoading: false }),
}));

import { SocketProvider } from "./SocketProvider";
import { invalidateOnRealtimeEvent } from "../lib/dashboardQueries";

vi.mock("../lib/dashboardQueries", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../lib/dashboardQueries")>();
  return {
    ...actual,
    invalidateOnRealtimeEvent: vi.fn(actual.invalidateOnRealtimeEvent),
  };
});

function renderProvider() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SocketProvider>
        <span data-testid="probe">ok</span>
      </SocketProvider>
    </QueryClientProvider>
  );
}

describe("SocketProvider", () => {
  beforeEach(() => {
    connectMock.mockImplementation((_getToken, onEvent, onConnectionChange) => {
      capturedOnEvent = onEvent;
      onConnectionChange?.(true);
      return { disconnect: vi.fn(), isConnected: () => true };
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    capturedOnEvent = null;
  });

  it("connects realtime socket when authenticated", async () => {
    renderProvider();
    await waitFor(() => expect(connectMock).toHaveBeenCalledTimes(1));
  });

  it("debounces duplicate realtime events and dedupes by eventId", async () => {
    vi.useFakeTimers();
    renderProvider();
    expect(capturedOnEvent).not.toBeNull();

    act(() => {
      capturedOnEvent?.({ type: "payment.updated", eventId: "evt-dup", data: { status: "pending" } });
      capturedOnEvent?.({ type: "payment.updated", eventId: "evt-dup", data: { status: "pending" } });
    });

    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    expect(invalidateOnRealtimeEvent).toHaveBeenCalledTimes(1);
    expect(invalidateOnRealtimeEvent).toHaveBeenCalledWith(expect.any(QueryClient), "payment.updated", {
      status: "pending",
    });
    vi.useRealTimers();
  });
});
