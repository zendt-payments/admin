import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { invalidateOnRealtimeEvent, activityRefetchInterval, dqk } from "../../src/lib/dashboardQueries";

/**
 * Pre-deployment smoke: simulates webhook → WebSocket message → React Query invalidation.
 */
describe("realtime payment flow (integration smoke)", () => {
  it("payment.completed triggers full dashboard cache refresh", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "payment.completed", {
      transactionId: "tx-1",
      amount: 2500,
      currency: "INR",
      reference: "INV-100",
      hasInvoice: true,
    });

    const keys = spy.mock.calls.map((call) => call[0]?.queryKey);
    expect(keys).toContainEqual(["paymentLinks"]);
    expect(keys).toContainEqual(dqk.latestCompletedTransaction);
    expect(keys).toContainEqual(["transactions"]);
    expect(keys).toContainEqual(dqk.invoicesInfinite);
  });

  it("polling is disabled while socket connected and enabled as fallback", () => {
    expect(activityRefetchInterval(true)).toBe(false);
    expect(activityRefetchInterval(false)).toBe(45_000);
  });

  it("handles typical webhook event sequence without duplicate invoice invalidation", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "payment_link.updated", { status: "active" });
    await invalidateOnRealtimeEvent(qc, "payment.updated", { status: "pending" });
    await invalidateOnRealtimeEvent(qc, "payment.completed", { hasInvoice: false });

    const invoiceInvalidations = spy.mock.calls.filter(
      (call) => JSON.stringify(call[0]?.queryKey) === JSON.stringify(dqk.invoicesInfinite)
    );
    expect(invoiceInvalidations.length).toBe(1);
  });
});
