import { useMemo, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Copy, Loader2, Share2, X } from "lucide-react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { useAppToast } from "../../context/ToastContext";
import { dataService } from "../../services/dataService";
import { shareText } from "../../utils/shareText";
import { TEST_MODE } from "../../services/testMode";
import KycGate from "../shared/KycGate";
import { StaggeredList, StaggerItem, MotionSheet } from "../motion";
import { DashboardPageTitle, DashboardSectionTitle, dashboardDialogTitleClass } from "./DashboardTitles";
import { useInfiniteListQuery } from "../../hooks/useInfiniteListQuery";
import { useScrollSentinel } from "../../hooks/useScrollSentinel";
import {
  DASH_QUERY_STALE,
  activityRefetchInterval,
  dqk,
  invalidatePaymentLinkQueries,
} from "../../lib/dashboardQueries";
import { paymentLinksManageParams } from "../../lib/paymentLinkListParams";
import { DEFAULT_LIST_PAGE_SIZE } from "../../lib/pagination";
import { useSocketConnected } from "../../context/SocketProvider";
import ListRowsSkeleton from "./ListRowsSkeleton";
import DashboardEmptyState from "./DashboardEmptyState";
import ToggleCheckbox from "./ToggleCheckbox";
import { DASHBOARD_FIELD_FIXED_HEIGHT, DASHBOARD_INPUT_FIELD_10 } from "../shared/ClientSearchPicker";

const sortOptions = ["Newest first", "Oldest first", "Amount high to low"];
const statusOptions = ["Created", "Partially paid", "Paid", "Cancelled", "Expired"];

const statusToBackend: Record<string, string> = {
  Created: "active",
  "Partially paid": "partially_paid",
  Paid: "paid",
  Cancelled: "cancelled",
  Expired: "expired",
};

const backendToDisplay: Record<string, string> = Object.fromEntries(
  Object.entries(statusToBackend).map(([display, backend]) => [backend, display])
);

const paymentLinkIconBtn =
  "inline-flex items-center justify-center rounded-[10px] p-2 transition-colors disabled:opacity-40";

const durationOptions = [
  "Past 7 days",
  "Past 30 days",
  "Past 90 days",
  "Past 1 year",
  "This month",
  "This year",
  "All time",
];

function ConfirmCancelModal({
  isOpen,
  onClose,
  onConfirm,
  cancelling,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cancelling: boolean;
}) {
  return (
    <MotionSheet open={isOpen} onClose={onClose} variant="center" className="zendt-dashboard-cairo">
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <h3 className={dashboardDialogTitleClass}>Cancel payment link?</h3>
          <p className="text-white/60 text-body">
            Are you sure you want to cancel this payment link? This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="rounded-[10px] border border-white/10 px-4 py-2 text-body text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
          >
            No, keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            className="rounded-[10px] bg-red-500/20 border border-red-500/30 px-4 py-2 text-body text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Yes, cancel it"}
          </button>
        </div>
      </div>
    </MotionSheet>
  );
}

function FilterInput({
  placeholder,
  value,
  onChange,
  className,
}: {
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${DASHBOARD_INPUT_FIELD_10}${className ? ` ${className}` : ""}`}
    />
  );
}

const paymentLinkStatusColors: Record<string, string> = {
  active: "text-orange-300",
  partially_paid: "text-amber-400",
  paid: "text-emerald-400",
  cancelled: "text-red-400/70",
  expired: "text-white/50",
};

type PaymentLinkFilterOpts = {
  statuses: string[];
  dur: string;
  sort: string;
  linkId: string;
  refId: string;
  contact: string;
  email: string;
  count: string;
};

function buildInitialAppliedFilters(): PaymentLinkFilterOpts {
  return {
    statuses: [...statusOptions],
    dur: TEST_MODE ? "All time" : durationOptions[0],
    sort: sortOptions[0],
    linkId: "",
    refId: "",
    contact: "",
    email: "",
    count: "",
  };
}

export default function PaymentLinksPage() {
  const socketConnected = useSocketConnected();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showSuccess, showError } = useAppToast();
  const [sortBy, setSortBy] = useState(sortOptions[0]);
  const [statusOpen, setStatusOpen] = useState(false);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(() => [...statusOptions]);
  const [durationOpen, setDurationOpen] = useState(false);
  const [duration, setDuration] = useState(() => (TEST_MODE ? "All time" : durationOptions[0]));
  const [filterLinkId, setFilterLinkId] = useState("");
  const [filterRefId, setFilterRefId] = useState("");
  const [filterContact, setFilterContact] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [filterCount, setFilterCount] = useState("");

  /** List uses these values only after the user taps Apply. */
  const [appliedFilters, setAppliedFilters] = useState<PaymentLinkFilterOpts>(buildInitialAppliedFilters);
  const [isApplyingFilters, setIsApplyingFilters] = useState(false);

  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [sharingLinkId, setSharingLinkId] = useState<string | null>(null);

  const listParams = useMemo(() => paymentLinksManageParams(appliedFilters), [appliedFilters]);
  const maxCount = parseInt(appliedFilters.count, 10);

  const {
    items: paymentLinks,
    isPending,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
  } = useInfiniteListQuery({
    queryKey: dqk.paymentLinksInfinite(listParams),
    queryFn: (cursor) =>
      dataService.getPaymentLinksPage({
        cursor,
        limit: maxCount > 0 ? Math.min(DEFAULT_LIST_PAGE_SIZE, maxCount) : DEFAULT_LIST_PAGE_SIZE,
        ...listParams,
      }),
    staleTime: DASH_QUERY_STALE.txsList,
    refetchInterval: activityRefetchInterval(socketConnected),
  });

  const canLoadMore = Boolean(hasNextPage) && (maxCount <= 0 || paymentLinks.length < maxCount);
  const displayedLinks = maxCount > 0 ? paymentLinks.slice(0, maxCount) : paymentLinks;
  const historyLoading = isPending && displayedLinks.length === 0;

  const sentinelRef = useScrollSentinel(loadMore, canLoadMore);

  const applyFilters = () => {
    if (isApplyingFilters) return;
    setIsApplyingFilters(true);
    requestAnimationFrame(() => {
      setAppliedFilters({
        statuses: [...selectedStatuses],
        dur: duration,
        sort: sortBy,
        linkId: filterLinkId,
        refId: filterRefId,
        contact: filterContact,
        email: filterEmail,
        count: filterCount,
      });
      window.setTimeout(() => setIsApplyingFilters(false), 400);
    });
  };

  const toggleStatus = (status: string) => {
    setSelectedStatuses((current) =>
      current.includes(status) ? current.filter((item) => item !== status) : [...current, status]
    );
  };

  const copyPaymentUrl = async (paymentUrl: string) => {
    const url = paymentUrl?.trim();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      showSuccess("Link copied!", "Payment link is now in your clipboard.");
    } catch {
      showError("Copy failed", "Could not copy the payment link.");
    }
  };

  const sharePaymentLink = async (link: {
    id: string;
    paymentUrl: string;
    customer: { name: string };
    amount: number;
    currency: string;
  }) => {
    const url = link.paymentUrl?.trim();
    if (!url) return;
    const name = link.customer.name.trim() || "there";
    const msg = `Hi ${name},\n\nPlease pay ${link.currency} ${link.amount.toLocaleString()} using this link:\n\n${url}`;
    setSharingLinkId(link.id);
    try {
      await shareText(msg);
    } finally {
      setSharingLinkId(null);
    }
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await dataService.deletePaymentLink(cancelTarget);
      await invalidatePaymentLinkQueries(queryClient);
    } catch (err) {
      console.error("Failed to cancel link:", err);
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  return (
    <KycGate>
      <PageContainer className="zendt-dashboard-cairo text-white space-y-6">
        <div className="relative z-0 flex items-center justify-between px-4 pt-12 pt-safe-header">
          <GradientBlob
            className="absolute opacity-60 blur-2xl -z-10"
            style={{ right: "82px", top: "-50px", width: "321px", height: "262px" }}
          />
          <div className="z-1 flex w-full justify-between">
            <BackButton />
          </div>
        </div>

        <section className="relative z-2 flex flex-1 flex-col rounded-t-3xl bg-[#141414] p-5 pt-10 pb-24 pb-safe-nav">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <DashboardPageTitle as="h2" className="!font-semibold">
                Payment links
              </DashboardPageTitle>
              <p className="text-body text-white/70">View and manage your payment links.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/dashboard/payment-links/new")}
              className="shrink-0 rounded-[10px] bg-white/10 px-3 py-1.5 text-caption transition hover:bg-white/20"
            >
              + Create
            </button>
          </div>

          <div className="mb-4 space-y-3">
            <FieldToggle label="Sort by" value={sortBy} onClick={() => setSortBy(nextSort(sortBy))} />

            <div className="grid grid-cols-2 gap-3">
              <FilterInput placeholder="Payment link ID" value={filterLinkId} onChange={setFilterLinkId} />
              <FilterInput placeholder="Reference ID" value={filterRefId} onChange={setFilterRefId} />
              <FilterInput
                placeholder="Customer contact"
                value={filterContact}
                onChange={setFilterContact}
              />
              <FilterInput placeholder="Customer Email" value={filterEmail} onChange={setFilterEmail} />
              <FilterInput
                placeholder="Count"
                value={filterCount}
                onChange={setFilterCount}
                className="col-span-2"
              />
            </div>

            <div>
              <FieldToggle
                label="Payment link status"
                trailingIcon={<Chevron isOpen={statusOpen} />}
                onClick={() => setStatusOpen((prev) => !prev)}
              />

              {statusOpen && (
                <div className="mt-2 rounded-[10px] border border-white/10 bg-[#1E1E1E] p-3 space-y-2 text-body text-white/80">
                  <label className="mb-2 flex min-h-[46px] items-center gap-2 rounded-[10px] border border-white/10 px-3">
                    <ToggleCheckbox
                      size="sm"
                      checked={selectedStatuses.length === statusOptions.length}
                      onChange={(checked) => setSelectedStatuses(checked ? [...statusOptions] : [])}
                    />
                    <span>All</span>
                  </label>

                  <div className="grid grid-cols-2 gap-2">
                    {statusOptions.map((status) => (
                      <label
                        key={status}
                        className="flex min-h-[46px] items-center gap-2 rounded-[10px] border border-white/10 bg-[#141414] px-3"
                      >
                        <ToggleCheckbox
                          size="sm"
                          checked={selectedStatuses.includes(status)}
                          onChange={() => toggleStatus(status)}
                        />
                        <span>{status}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <FieldToggle
                label="Duration"
                value={duration}
                trailingIcon={<Chevron isOpen={durationOpen} />}
                onClick={() => setDurationOpen((prev) => !prev)}
              />

              {durationOpen && (
                <div className="mt-2 rounded-[10px] border border-white/10 bg-[#1E1E1E] p-2 space-y-1">
                  {durationOptions.map((option) => (
                    <button
                      key={option}
                      type="button"
                      className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} flex items-center text-left transition-colors ${
                        option === duration ? "border-white/25 text-white" : "hover:border-white/20"
                      }`}
                      onClick={() => {
                        setDuration(option);
                        setDurationOpen(false);
                      }}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={applyFilters}
                disabled={isApplyingFilters}
                aria-busy={isApplyingFilters}
                className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} mt-1 inline-flex w-32 items-center justify-center gap-1.5 transition hover:border-white/20 hover:bg-white/10 disabled:cursor-wait disabled:opacity-70`}
              >
                {isApplyingFilters ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                    Applying…
                  </>
                ) : (
                  "Apply"
                )}
              </button>
            </div>
          </div>

          <div className="mb-4">
            <DashboardSectionTitle as="h3" className="!font-semibold">
              Payment history
            </DashboardSectionTitle>
          </div>

          {historyLoading && <ListRowsSkeleton rows={4} />}

          {!historyLoading && displayedLinks.length === 0 && (
            <DashboardEmptyState
              title="No payment links found"
              subtitle="Payment links will appear here when you create them"
            />
          )}

          {!historyLoading && displayedLinks.length > 0 && (
            <StaggeredList className="space-y-3 pb-10">
              {displayedLinks.map((link) => {
                const label = backendToDisplay[link.status] || link.status;
                const isCancelled = link.status === "cancelled" || link.status === "expired";
                const isPaid = link.status === "paid";
                const hasPaymentUrl = Boolean(link.paymentUrl?.trim());
                const amountStr =
                  typeof link.amount === "number"
                    ? link.amount.toLocaleString(undefined, {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 2,
                      })
                    : String(link.amount);

                return (
                  <StaggerItem
                    key={link.id}
                    className="rounded-[10px] border border-white/10 bg-[#1E1E1E] p-4 text-caption"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-white/90 min-w-0">
                        <span className="text-white/50">Payment ID:</span>{" "}
                        <span className="font-medium">{link.displayId || link.id}</span>
                      </span>
                      <span
                        className={`shrink-0 ${paymentLinkStatusColors[link.status] || "text-white/60"}`}
                      >
                        {label}
                      </span>
                    </div>

                    <div className="mt-1 text-white/70">
                      {link.customer.name} &middot;{" "}
                      <span className="font-medium text-white/90">
                        {link.currency || "USD"} {amountStr}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-caption text-white/50">{link.createdOn}</span>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          disabled={!hasPaymentUrl || isCancelled || isPaid}
                          onClick={(e) => {
                            e.stopPropagation();
                            void copyPaymentUrl(link.paymentUrl);
                          }}
                          className={`${paymentLinkIconBtn} text-white/70 hover:bg-white/10 hover:text-white`}
                          aria-label="Copy payment link"
                          title={
                            isCancelled
                              ? "Link is no longer active"
                              : isPaid
                                ? "Link has been paid"
                                : hasPaymentUrl
                                  ? "Copy"
                                  : "No payment link URL"
                          }
                        >
                          <Copy className="h-4 w-4" strokeWidth={2} />
                        </button>
                        <button
                          type="button"
                          disabled={!hasPaymentUrl || isCancelled || isPaid || sharingLinkId !== null}
                          onClick={(e) => {
                            e.stopPropagation();
                            void sharePaymentLink(link);
                          }}
                          className={`${paymentLinkIconBtn} text-white/70 hover:bg-white/10 hover:text-white`}
                          aria-label="Share payment link"
                          title={
                            isCancelled
                              ? "Link is no longer active"
                              : isPaid
                                ? "Link has been paid"
                                : hasPaymentUrl
                                  ? "Share"
                                  : "No payment link URL"
                          }
                        >
                          {sharingLinkId === link.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                          ) : (
                            <Share2 className="h-4 w-4" strokeWidth={2} />
                          )}
                        </button>
                        <button
                          type="button"
                          disabled={isCancelled || isPaid}
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelTarget(link.id);
                          }}
                          className={`${paymentLinkIconBtn} text-red-400/80 hover:bg-red-500/10 hover:text-red-300`}
                          aria-label="Cancel payment link"
                          title={
                            isCancelled
                              ? "Already cancelled"
                              : isPaid
                                ? "Paid links cannot be cancelled"
                                : "Cancel"
                          }
                        >
                          <X className="h-4 w-4" strokeWidth={2} />
                        </button>
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </StaggeredList>
          )}

          <div ref={sentinelRef} className="h-1" aria-hidden />
          {isFetchingNextPage && (
            <p className="py-4 text-center text-caption text-white/40">Loading more…</p>
          )}
        </section>

        <ConfirmCancelModal
          isOpen={cancelTarget !== null}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleConfirmCancel}
          cancelling={cancelling}
        />
      </PageContainer>
    </KycGate>
  );
}

/* Chevron icon */
function Chevron({ isOpen }: { isOpen: boolean }) {
  return isOpen ? (
    <svg xmlns="http://www.w3.org/2000/svg" width="21" height="9" fill="none">
      <path d="M0.3 0.5L7 7.2c1.8 1.8 4.5 1.8 6.3 0L20 0.5" stroke="white" strokeWidth="0.8" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" width="21" height="9" className="rotate-180" fill="none">
      <path d="M0.3 0.5L7 7.2c1.8 1.8 4.5 1.8 6.3 0L20 0.5" stroke="white" strokeWidth="0.8" />
    </svg>
  );
}

function FieldToggle({
  label,
  value,
  trailingIcon,
  onClick,
}: {
  label: string;
  value?: string;
  trailingIcon?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} flex items-center justify-between gap-3 text-left overflow-visible`}
      onClick={onClick}
    >
      <span className="shrink-0 text-body leading-normal text-white/70">{label}</span>
      <span className="flex min-w-0 flex-1 items-center justify-end gap-2 text-body leading-normal text-white">
        {value && <span className="truncate text-right">{value}</span>}
        {trailingIcon}
      </span>
    </button>
  );
}

function nextSort(current: string) {
  const index = sortOptions.indexOf(current);
  return sortOptions[(index + 1) % sortOptions.length];
}
