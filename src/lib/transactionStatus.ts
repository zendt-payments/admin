export type TransactionStatus = "pending" | "completed" | "failed";

export function normalizeTransactionStatus(raw: unknown): TransactionStatus | undefined {
  const s = String(raw || "").toLowerCase();
  if (s === "pending" || s === "completed" || s === "failed") return s;
  return undefined;
}
