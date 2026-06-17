import { useMemo, useRef, useState } from "react";
import { dataService } from "../../services/dataService";
import { getCurrencySymbol } from "../../constants/invoiceCurrencies";
import { paymentLinkStatusColorClass, paymentLinkStatusLabel } from "../../lib/paymentLinkStatus";
import { StaggeredList, StaggerItem } from "../motion";
import { DashboardPageTitle } from "./DashboardTitles";
import BackButton from "./BackButton";
import { DASH_QUERY_STALE, activityRefetchInterval, dqk } from "../../lib/dashboardQueries";
import { useSocketConnected } from "../../context/SocketProvider";
import DashboardEmptyState from "./DashboardEmptyState";
import { useInfiniteListQuery } from "../../hooks/useInfiniteListQuery";
import { useScrollSentinel } from "../../hooks/useScrollSentinel";
import ListRowsSkeleton from "./ListRowsSkeleton";
import type { PaymentLinkTab } from "../../lib/paymentLinkListParams";
import DashboardFullScreenPanel from "../layout/DashboardFullScreenPanel";

export default function PaymentStatusPage() {
  const socketConnected = useSocketConnected();
  const [filter, setFilter] = useState<PaymentLinkTab>("all");
  const scrollRef = useRef<HTMLDivElement>(null);

  const listParams = useMemo(() => ({ tab: filter, sort: "newest" as const }), [filter]);

  const {
    items: links,
    isPending,
    isSuccess,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
  } = useInfiniteListQuery({
    queryKey: dqk.paymentLinksInfinite(listParams),
    queryFn: (cursor) =>
      dataService.getPaymentLinksPage({
        cursor,
        tab: filter,
        sort: "newest",
      }),
    staleTime: DASH_QUERY_STALE.txsList,
    refetchInterval: activityRefetchInterval(socketConnected),
  });

  const sentinelRef = useScrollSentinel(loadMore, Boolean(hasNextPage), scrollRef);
  const listLoading = isPending && links.length === 0;

  const tab = (active: boolean) =>
    `text-caption tracking-normal cursor-pointer pb-[3px] transition-all whitespace-nowrap ${
      active ? "text-white border-b border-white/20" : "text-white/40 hover:text-white/60"
    }`;

  return (
    <DashboardFullScreenPanel>
      <div className="-ml-2 -mt-1 mb-2 shrink-0">
        <BackButton />
      </div>

      <header className="shrink-0">
        <DashboardPageTitle as="h2" className="!font-semibold">
          Payment Status
        </DashboardPageTitle>
      </header>

      <div className="mt-6 flex shrink-0 flex-wrap items-center gap-4 border-b border-white/10 pb-4">
        <span className={tab(filter === "all")} onClick={() => setFilter("all")}>
          All
        </span>
        <span className={tab(filter === "unpaid")} onClick={() => setFilter("unpaid")}>
          Unpaid
        </span>
        <span className={tab(filter === "pending")} onClick={() => setFilter("pending")}>
          Inprogress
        </span>
        <span className={tab(filter === "paid")} onClick={() => setFilter("paid")}>
          Paid
        </span>
        <span className={tab(filter === "failed")} onClick={() => setFilter("failed")}>
          Failed
        </span>
        <span className={tab(filter === "inactive")} onClick={() => setFilter("inactive")}>
          Cancelled
        </span>
      </div>

      <div ref={scrollRef} className="mt-4 min-h-0 flex-1 overflow-y-auto pb-4 pr-1">
        {listLoading && <ListRowsSkeleton rows={5} />}

        {!listLoading && (
          <StaggeredList className="space-y-2">
            {links.map((link) => {
              const statusLabel = paymentLinkStatusLabel({
                status: link.status,
                zwitchPaymentStatus: link.zwitchPaymentStatus,
                zwitchStatusRaw: link.zwitchStatusRaw,
              });
              const statusClass = paymentLinkStatusColorClass({
                status: link.status,
                zwitchPaymentStatus: link.zwitchPaymentStatus,
                zwitchStatusRaw: link.zwitchStatusRaw,
              });
              const customer = link.customerName || link.customer.name || "Customer";
              const amountStr = `${getCurrencySymbol(link.currency || "INR")} ${link.amount.toLocaleString("en-IN")}`;

              return (
                <StaggerItem
                  key={link.id}
                  className="rounded-[10px] border border-white/10 bg-[#1E1E1E] px-3 py-2.5 text-caption"
                >
                  <div className="flex items-center justify-between gap-2 min-w-0">
                    <span className="truncate text-white/90 min-w-0">
                      <span className="text-white/50">Payment ID:</span>{" "}
                      <span className="font-medium">{link.displayId || link.id}</span>
                    </span>
                    <span className={`shrink-0 font-medium ${statusClass}`}>{statusLabel}</span>
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2 min-w-0">
                    <span className="truncate text-white/60 min-w-0">{customer}</span>
                    <span className="shrink-0 tabular-nums text-white/90">{amountStr}</span>
                  </div>
                  {(link.description || link.statusDate) && (
                    <p className="mt-0.5 truncate text-white/40">
                      {link.description || "—"}
                      {link.statusDate ? ` · ${link.statusDate}` : ""}
                    </p>
                  )}
                </StaggerItem>
              );
            })}

            {isSuccess && links.length === 0 && (
              <DashboardEmptyState
                title="No payment status in this filter"
                subtitle="Payment status appears when you create a link and receive payments"
              />
            )}
          </StaggeredList>
        )}

        <div ref={sentinelRef} className="h-1" aria-hidden />
        {isFetchingNextPage && <p className="py-4 text-center text-caption text-white/40">Loading more…</p>}
      </div>
    </DashboardFullScreenPanel>
  );
}
