import type { QueryClient } from "@tanstack/react-query";
import type { PaymentLinkListQuery, TransactionListQuery } from "./paymentLinkListParams";

export const DASH_QUERY_STALE = {
  txsList: 45_000,
  profileSettings: 60_000,
  kycStatus: 60_000,
  bankAccounts: 60_000,
  settingsToggles: 60_000,
  /** Open Exchange Rates free tier CDN cache is ~hourly — avoid refetch storms. */
  exchangeRates: 3_600_000,
} as const;

/** Poll payment-link + ledger data while socket is disconnected (fallback). */
export const DASH_ACTIVITY_REFETCH_MS = 45_000;

const REALTIME_PAYMENT_EVENTS = new Set([
  "payment.updated",
  "payment.completed",
  "payment.failed",
  "payment_link.updated",
]);

const REALTIME_REFERRAL_EVENTS = new Set(["referral.updated"]);

/** Disable interval polling while the WebSocket is connected. */
export function activityRefetchInterval(socketConnected: boolean): number | false {
  return socketConnected ? false : DASH_ACTIVITY_REFETCH_MS;
}

export const dqk = {
  transactionsInfinite: (status?: string, params?: TransactionListQuery) =>
    ["transactions", "infinite", status ?? "all", params ?? {}] as const,
  paymentLinksInfinite: (params?: PaymentLinkListQuery) =>
    ["paymentLinks", "infinite", params ?? {}] as const,
  invoicesInfinite: ["invoices", "infinite"] as const,
  latestPaymentLink: ["latestPaymentLink"] as const,
  latestCompletedTransaction: ["latestCompletedTransaction"] as const,
  profileSettings: ["profileSettings"] as const,
  kycStatus: ["kycStatus"] as const,
  bankAccounts: ["bankAccounts"] as const,
  settingsToggles: ["settingsToggles"] as const,
  invoiceBillFrom: ["invoiceBillFrom"] as const,
  clientsSearch: (search?: string) => ["clients", "search", search?.trim() || ""] as const,
  /** Full INR-based matrix from provider (excluding INR itself). */
  exchangeRatesAll: ["exchangeRates", "inr-all-v4"] as const,
  referralStats: ["referralStats"] as const,
};

export async function invalidateProfileSettings(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: dqk.profileSettings });
}

export async function invalidateKycStatus(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: dqk.kycStatus });
}

export async function invalidateBankAccounts(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: dqk.bankAccounts });
}

/** Refresh payment-link tiles, lists, and related ledger data after activity changes. */
export async function invalidatePaymentLinkQueries(qc: QueryClient): Promise<void> {
  await Promise.all([
    qc.invalidateQueries({ queryKey: ["paymentLinks"] }),
    qc.invalidateQueries({ queryKey: dqk.latestPaymentLink }),
    qc.invalidateQueries({ queryKey: dqk.latestCompletedTransaction }),
    qc.invalidateQueries({ queryKey: ["transactions"] }),
  ]);
}

export async function invalidateInvoiceQueries(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: dqk.invoicesInfinite });
}

async function invalidateReferralQueries(qc: QueryClient): Promise<void> {
  await qc.invalidateQueries({ queryKey: dqk.referralStats });
}

/** Map server WebSocket events to React Query cache invalidation. */
export async function invalidateOnRealtimeEvent(
  qc: QueryClient,
  type: string,
  data?: Record<string, unknown>
): Promise<void> {
  if (REALTIME_REFERRAL_EVENTS.has(type)) {
    await invalidateReferralQueries(qc);
    return;
  }

  if (!REALTIME_PAYMENT_EVENTS.has(type)) return;

  if (type === "payment.completed") {
    await Promise.all([invalidatePaymentLinkQueries(qc), invalidateInvoiceQueries(qc)]);
    return;
  }

  await invalidatePaymentLinkQueries(qc);

  if (type === "payment.updated" && data?.hasInvoice) {
    await invalidateInvoiceQueries(qc);
  }
}
