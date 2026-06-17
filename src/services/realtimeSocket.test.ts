import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./testMode", () => ({
  TEST_MODE: false,
}));

vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false },
}));

type MockWs = {
  url: string;
  readyState: number;
  onopen: (() => void) | null;
  onmessage: ((ev: { data: string }) => void) | null;
  onclose: (() => void) | null;
  onerror: (() => void) | null;
  close: ReturnType<typeof vi.fn>;
};

const OPEN = 1;
const CLOSED = 3;

describe("getRealtimeWsUrl", () => {
  it("derives ws or wss from API URL", async () => {
    const { getRealtimeWsUrl } = await import("./realtimeSocket");
    expect(getRealtimeWsUrl()).toMatch(/^wss?:\/\//);
  });
});

describe("connectRealtimeSocket", () => {
  const instances: MockWs[] = [];

  beforeEach(() => {
    instances.length = 0;
    vi.useFakeTimers();

    class MockWebSocket {
      static OPEN = OPEN;
      url: string;
      readyState = 0;
      onopen: (() => void) | null = null;
      onmessage: ((ev: { data: string }) => void) | null = null;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      close = vi.fn(() => {
        this.readyState = CLOSED;
        this.onclose?.();
      });

      constructor(url: string) {
        this.url = url;
        const inst = this as unknown as MockWs;
        instances.push(inst);
        queueMicrotask(() => {
          this.readyState = OPEN;
          this.onopen?.();
        });
      }
    }

    vi.stubGlobal("WebSocket", MockWebSocket);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("connects with encoded token in query string", async () => {
    const { connectRealtimeSocket } = await import("./realtimeSocket");
    const onConnectionChange = vi.fn();
    const conn = connectRealtimeSocket(async () => "jwt-token-abc", vi.fn(), onConnectionChange);

    await vi.waitFor(() => expect(onConnectionChange).toHaveBeenCalledWith(true));
    expect(instances[0]?.url).toContain("/ws?token=");
    expect(instances[0]?.url).toContain(encodeURIComponent("jwt-token-abc"));

    conn.disconnect();
    expect(onConnectionChange).toHaveBeenLastCalledWith(false);
  });

  it("forwards parsed JSON messages to onEvent", async () => {
    const { connectRealtimeSocket } = await import("./realtimeSocket");
    const onEvent = vi.fn();

    connectRealtimeSocket(async () => "token", onEvent, vi.fn());
    await vi.waitFor(() => expect(instances.length).toBe(1));

    instances[0]?.onmessage?.({
      data: JSON.stringify({
        type: "payment.completed",
        eventId: "evt-1",
        data: { amount: 99 },
      }),
    });

    expect(onEvent).toHaveBeenCalledWith({
      type: "payment.completed",
      eventId: "evt-1",
      data: { amount: 99 },
    });
  });

  it("ignores malformed JSON messages", async () => {
    const { connectRealtimeSocket } = await import("./realtimeSocket");
    const onEvent = vi.fn();

    connectRealtimeSocket(async () => "token", onEvent, vi.fn());
    await vi.waitFor(() => expect(instances.length).toBe(1));

    instances[0]?.onmessage?.({ data: "not-json" });
    expect(onEvent).not.toHaveBeenCalled();
  });

  it("keeps retrying when token is unavailable without opening a socket", async () => {
    const { connectRealtimeSocket } = await import("./realtimeSocket");
    const onConnectionChange = vi.fn();

    connectRealtimeSocket(async () => null, vi.fn(), onConnectionChange);
    await vi.waitFor(() => expect(onConnectionChange).toHaveBeenCalledWith(false));

    await vi.advanceTimersByTimeAsync(1000);
    await vi.advanceTimersByTimeAsync(2000);

    expect(instances.length).toBe(0);
    expect(onConnectionChange).toHaveBeenCalledWith(false);
  });

  it("is no-op in TEST_MODE", async () => {
    vi.resetModules();
    vi.doMock("./testMode", () => ({ TEST_MODE: true }));
    const { connectRealtimeSocket } = await import("./realtimeSocket");
    const onConnectionChange = vi.fn();

    const conn = connectRealtimeSocket(async () => "token", vi.fn(), onConnectionChange);
    expect(conn.isConnected()).toBe(false);
    expect(onConnectionChange).toHaveBeenCalledWith(false);
    expect(instances.length).toBe(0);

    vi.doUnmock("./testMode");
    vi.resetModules();
  });
});
