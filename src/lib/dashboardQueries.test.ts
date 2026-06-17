import { describe, it, expect, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import {
  activityRefetchInterval,
  DASH_ACTIVITY_REFETCH_MS,
  invalidateOnRealtimeEvent,
  dqk,
} from "./dashboardQueries";

describe("activityRefetchInterval", () => {
  it("disables polling when socket is connected", () => {
    expect(activityRefetchInterval(true)).toBe(false);
  });

  it("uses fallback interval when socket is disconnected", () => {
    expect(activityRefetchInterval(false)).toBe(DASH_ACTIVITY_REFETCH_MS);
  });
});

describe("invalidateOnRealtimeEvent", () => {
  it("invalidates payment and invoice queries on payment.completed", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "payment.completed", { hasInvoice: true });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["paymentLinks"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: dqk.latestPaymentLink });
    expect(spy).toHaveBeenCalledWith({ queryKey: dqk.latestCompletedTransaction });
    expect(spy).toHaveBeenCalledWith({ queryKey: ["transactions"] });
    expect(spy).toHaveBeenCalledWith({ queryKey: dqk.invoicesInfinite });
  });

  it("invalidates payment queries on payment.updated", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "payment.updated", { status: "pending" });

    expect(spy).toHaveBeenCalledWith({ queryKey: ["paymentLinks"] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: dqk.invoicesInfinite });
  });

  it("invalidates invoices when payment.updated has invoice context", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "payment.updated", { hasInvoice: true });

    expect(spy).toHaveBeenCalledWith({ queryKey: dqk.invoicesInfinite });
  });

  it("invalidates payment queries on payment.failed", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "payment.failed");

    expect(spy).toHaveBeenCalledWith({ queryKey: ["transactions"] });
    expect(spy).not.toHaveBeenCalledWith({ queryKey: dqk.invoicesInfinite });
  });

  it("invalidates payment queries on payment_link.updated", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "payment_link.updated", { status: "paid" });

    expect(spy).toHaveBeenCalledWith({ queryKey: dqk.latestPaymentLink });
  });

  it("invalidates referral stats on referral.updated", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "referral.updated", { reason: "reward_credited" });

    expect(spy).toHaveBeenCalledWith({ queryKey: dqk.referralStats });
  });

  it("ignores unknown event types", async () => {
    const qc = new QueryClient();
    const spy = vi.spyOn(qc, "invalidateQueries");

    await invalidateOnRealtimeEvent(qc, "profile.updated");

    expect(spy).not.toHaveBeenCalled();
  });
});
