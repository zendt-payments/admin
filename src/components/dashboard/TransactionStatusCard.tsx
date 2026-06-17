import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import DoubleBgBox from "../doubleBgBox";
import { getCurrencySymbol } from "../../constants/invoiceCurrencies";
import {
  paymentLinkStatusColorClass,
  paymentLinkStatusLabel,
  type PaymentLinkStatusInput,
} from "../../lib/paymentLinkStatus";

const PAYMENT_STATUS_PATH = "/dashboard/payment-status";

type Props = {
  link?:
    | (PaymentLinkStatusInput & {
        amount?: number;
        currency?: string;
        customerName?: string;
        description?: string;
        statusDate?: string;
        zwitchStatusRaw?: string;
      })
    | null;
  /** Hide amount on compact dashboard tiles (full amount remains on Payment Status page). */
  showAmount?: boolean;
};

function NavigateArrowIcon() {
  return (
    <svg
      className="size-4 text-white/45"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 12h14" />
      <path d="M12 5l7 7-7 7" />
    </svg>
  );
}

function CardShell({ children }: { children: ReactNode }) {
  return (
    <Link
      to={PAYMENT_STATUS_PATH}
      className="block h-full w-full text-left transition-opacity hover:opacity-95 active:scale-[0.99]"
      aria-label="View all payment status"
    >
      {children}
    </Link>
  );
}

export default function TransactionStatusCard({ link, showAmount = true }: Props) {
  if (!link) {
    return (
      <CardShell>
        <DoubleBgBox fitContent layout="between" arcColor="#272727" className="h-full">
          <div className="flex h-full flex-col justify-between gap-4 text-left text-white">
            <div className="flex shrink-0 flex-col gap-1">
              <p className="text-caption uppercase tracking-[0.2em]">Payment</p>
              <p className="text-title font-semibold leading-tight">STATUS</p>
            </div>
            <div className="flex shrink-0 items-end justify-between gap-2">
              <p className="min-w-0 flex-1 text-body leading-snug text-white/40">No payment links yet</p>
              <span className="flex size-8 shrink-0 items-center justify-center">
                <NavigateArrowIcon />
              </span>
            </div>
          </div>
        </DoubleBgBox>
      </CardShell>
    );
  }

  const amount = link.amount ?? 0;
  const currency = link.currency || "INR";

  return (
    <CardShell>
      <DoubleBgBox fitContent layout="between" arcColor="#272727" className="h-full">
        <div className="flex h-full flex-col justify-between gap-4 text-left text-white">
          <div className="flex shrink-0 flex-col gap-1">
            <p className="text-caption uppercase tracking-[0.2em]">Payment</p>
            <p className="text-title font-semibold leading-tight">STATUS</p>
          </div>
          <div className="flex shrink-0 items-end justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <p className={`text-title font-semibold leading-snug ${paymentLinkStatusColorClass(link)}`}>
                {paymentLinkStatusLabel(link)}
              </p>
              {showAmount && (
                <p className="text-body font-light leading-snug text-white/75">
                  {getCurrencySymbol(currency)} {amount.toLocaleString("en-IN")}
                </p>
              )}
            </div>
            <span className="flex size-8 shrink-0 items-center justify-center self-end">
              <NavigateArrowIcon />
            </span>
          </div>
        </div>
      </DoubleBgBox>
    </CardShell>
  );
}
