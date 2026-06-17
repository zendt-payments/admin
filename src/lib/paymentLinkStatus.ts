import { TEST_MODE } from "../services/testMode";

export type PaymentLinkLifecycleStatus = "active" | "paid" | "expired" | "cancelled";
export type PaymentLinkZwitchStatus = "none" | "pending" | "completed" | "failed";

export type PaymentLinkStatusInput = {
  status?: string;
  zwitchPaymentStatus?: PaymentLinkZwitchStatus | string;
  /** Exact Zwitch webhook status (mock / API `zwitch_status_raw`). */
  zwitchStatusRaw?: string;
};

function isZwitchSuccess(raw: string) {
  const s = raw.toLowerCase();
  return s === "success" || s === "completed" || s === "succeeded" || s === "captured" || s === "paid";
}

function isZwitchFailed(raw: string) {
  const s = raw.toLowerCase();
  return s === "failed" || s === "failure";
}

function isZwitchPending(raw: string) {
  const s = raw.toLowerCase();
  return (
    s === "pending" || s === "processing" || s === "created" || s === "attempted" || s === "late_authorized"
  );
}

/** Display label for exact Zwitch status strings (test mode): `late_authorized` → `Late Authorized`. */
export function formatZwitchRawStatusLabel(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/_/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/** Whether a link should count as paid (filters, badges). */
export function isPaymentLinkPaid(input: PaymentLinkStatusInput): boolean {
  const lifecycle = String(input.status || "active").toLowerCase();
  const zwitch = String(input.zwitchPaymentStatus || "none").toLowerCase();
  const raw = String(input.zwitchStatusRaw || "").trim();
  return lifecycle === "paid" || zwitch === "completed" || (!!raw && isZwitchSuccess(raw));
}

export function paymentLinkStatusLabel(input: PaymentLinkStatusInput): string {
  const raw = String(input.zwitchStatusRaw || "").trim();
  if (TEST_MODE) {
    return raw ? formatZwitchRawStatusLabel(raw) : "";
  }

  const lifecycle = String(input.status || "active").toLowerCase();
  const zwitch = String(input.zwitchPaymentStatus || "none").toLowerCase() as PaymentLinkZwitchStatus;
  if (lifecycle === "cancelled") return "Cancelled";
  if (lifecycle === "expired") return "Expired";
  if (isPaymentLinkPaid(input)) return "Paid";
  if (zwitch === "failed") return "Failed";
  if (zwitch === "pending") return "Inprogress";
  if (lifecycle === "active" && (zwitch === "none" || !zwitch)) return "Unpaid";
  return "Unpaid";
}

/**
 * Payment status colors on dark cards (#161616 / #1a1a1a).
 * Hex values in PAYMENT_STATUS_COLORS_HEX — keep class strings in sync.
 */
export const PAYMENT_STATUS_COLORS_HEX = {
  /** Unpaid — link live, no payment yet */
  awaiting: "#FFFFFF",
  /** Inprogress — Zwitch pending / processing */
  inprogress: "#F5C451",
  /** Paid — completed (matches FX rate positive green) */
  paid: "#3DDC84",
  /** Failed */
  failed: "#FF7B8A",
  /** Cancelled / expired */
  inactive: "rgba(255,255,255,0.45)",
  testNeutral: "rgba(255,255,255,0.5)",
} as const;

const PAYMENT_STATUS_COLOR = {
  awaiting: "text-white",
  inprogress: "text-[#F5C451]",
  paid: "text-[#3DDC84]",
  failed: "text-[#FF7B8A]",
  inactive: "text-white/45",
  testNeutral: "text-white/50",
} as const;

function paymentStatusColorFromRaw(raw: string): string {
  if (isZwitchFailed(raw)) return PAYMENT_STATUS_COLOR.failed;
  if (isZwitchSuccess(raw)) return PAYMENT_STATUS_COLOR.paid;
  if (isZwitchPending(raw)) return PAYMENT_STATUS_COLOR.inprogress;
  return PAYMENT_STATUS_COLOR.testNeutral;
}

export function paymentLinkStatusColorClass(input: PaymentLinkStatusInput): string {
  const raw = String(input.zwitchStatusRaw || "").trim();
  if (TEST_MODE && raw) return paymentStatusColorFromRaw(raw);

  const lifecycle = String(input.status || "active").toLowerCase();
  const zwitch = String(input.zwitchPaymentStatus || "none").toLowerCase();
  if (lifecycle === "cancelled" || lifecycle === "expired") return PAYMENT_STATUS_COLOR.inactive;
  if (isPaymentLinkPaid(input)) return PAYMENT_STATUS_COLOR.paid;
  if (zwitch === "failed") return PAYMENT_STATUS_COLOR.failed;
  if (zwitch === "pending") return PAYMENT_STATUS_COLOR.inprogress;
  if (lifecycle === "active" && (zwitch === "none" || !zwitch)) return PAYMENT_STATUS_COLOR.awaiting;
  return PAYMENT_STATUS_COLOR.awaiting;
}
