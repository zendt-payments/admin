import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataService } from "../../services/dataService";
import { getCurrencySymbol } from "../../constants/invoiceCurrencies";
import { StaggeredList, StaggerItem } from "../motion";
import { DashboardPageTitle } from "./DashboardTitles";
import BackButton from "./BackButton";
import { CounterpartyAvatar } from "./CounterpartyAvatar";
import { DASH_QUERY_STALE, activityRefetchInterval, dqk } from "../../lib/dashboardQueries";
import { useSocketConnected } from "../../context/SocketProvider";
import type { CursorPagination } from "../../lib/pagination";
import { transactionSortFromUi } from "../../lib/paymentLinkListParams";
import { useInfiniteListQuery } from "../../hooks/useInfiniteListQuery";
import { useScrollSentinel } from "../../hooks/useScrollSentinel";
import ListRowsSkeleton from "./ListRowsSkeleton";
import DashboardFullScreenPanel from "../layout/DashboardFullScreenPanel";

type FilterType = "all" | "today" | "week" | "month";
type SortType = "none" | "high" | "low";

type TransactionRow = {
  id: string | number;
  name: string;
  amount: number;
  currency?: string;
  date?: string;
  avatarUrl?: string;
};

export default function DashboardTransactions() {
  const socketConnected = useSocketConnected();
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("none");
  const scrollRef = useRef<HTMLDivElement>(null);

  const listParams = useMemo(
    () => ({
      period: filter,
      sort: transactionSortFromUi(sort),
    }),
    [filter, sort]
  );

  const {
    items: transactions,
    isPending,
    isSuccess,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
  } = useInfiniteListQuery<TransactionRow>({
    queryKey: dqk.transactionsInfinite("completed", listParams),
    queryFn: (cursor) =>
      dataService.getTransactionsPage({
        cursor,
        status: "completed",
        period: filter,
        sort: transactionSortFromUi(sort),
      }) as Promise<{
        items: TransactionRow[];
        pagination: CursorPagination;
      }>,
    staleTime: DASH_QUERY_STALE.txsList,
    refetchInterval: activityRefetchInterval(socketConnected),
  });

  const sentinelRef = useScrollSentinel(loadMore, Boolean(hasNextPage), scrollRef);
  const listLoading = isPending && transactions.length === 0;

  const summaryQuery = useQuery({
    queryKey: ["transactions", "summary", filter] as const,
    queryFn: () => dataService.getTransactionSummary({ period: filter }),
    staleTime: DASH_QUERY_STALE.txsList,
    refetchInterval: activityRefetchInterval(socketConnected),
  });

  const filteredTotal = summaryQuery.data?.total ?? 0;

  const primaryCurrency = useMemo(() => {
    return (summaryQuery.data?.currency || transactions[0]?.currency || "INR").toUpperCase();
  }, [summaryQuery.data, transactions]);

  const tab = (active: boolean) =>
    `text-caption tracking-normal cursor-pointer pb-[3px] transition-all ${
      active ? "text-white border-b border-white/20" : "text-white/40 hover:text-white/60"
    }`;

  const toggleSort = (next: "high" | "low") => {
    setSort((prev) => (prev === next ? "none" : next));
  };

  return (
    <DashboardFullScreenPanel>
      <div className="-ml-2 -mt-1 mb-2 shrink-0">
        <BackButton />
      </div>
      <header className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-3">
          <DashboardPageTitle as="h2">All Transactions</DashboardPageTitle>
          <span className="shrink-0 text-caption font-light tabular-nums text-emerald-400">
            {getCurrencySymbol(primaryCurrency)} {filteredTotal.toLocaleString("en-IN")}
          </span>
        </div>
      </header>

      <div className="flex items-center gap-5 mt-6 mb-4">
        <span className={tab(filter === "all")} onClick={() => setFilter("all")}>
          All
        </span>
        <span className={tab(filter === "today")} onClick={() => setFilter("today")}>
          Today
        </span>
        <span className={tab(filter === "week")} onClick={() => setFilter("week")}>
          Week
        </span>
        <span className={tab(filter === "month")} onClick={() => setFilter("month")}>
          Month
        </span>
        <div className="w-px h-4 bg-white/10 mx-2" />
        <span className={tab(sort === "high")} onClick={() => toggleSort("high")}>
          High ↓
        </span>
        <span className={tab(sort === "low")} onClick={() => toggleSort("low")}>
          Low ↑
        </span>
      </div>

      <hr className="border-white/10 mb-4" />

      <div ref={scrollRef} className="overflow-y-auto pr-1 flex-1 pb-4">
        {listLoading && <ListRowsSkeleton rows={6} />}

        {!listLoading && (
          <StaggeredList className="space-y-2">
            {transactions.map((tx) => (
              <StaggerItem
                key={tx.id}
                className="flex items-center justify-between gap-3 border-b border-white/5 py-3 text-body font-light text-white last:border-0"
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <CounterpartyAvatar avatarUrl={tx.avatarUrl} />
                  <span className="truncate text-callout font-light text-white">{tx.name}</span>
                </div>

                <span className="shrink-0 pl-2 text-right text-callout font-light tracking-normal text-white">
                  {getCurrencySymbol(tx.currency || "INR")} {tx.amount.toLocaleString("en-IN")}
                </span>
              </StaggerItem>
            ))}

            {isSuccess && transactions.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="text-white/30"
                  >
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                </div>
                <p className="text-white/40 text-body">No transactions found</p>
                <p className="text-white/20 text-caption mt-1">
                  Transactions will appear here when payments are received
                </p>
              </div>
            )}
          </StaggeredList>
        )}

        <div ref={sentinelRef} className="h-1" aria-hidden />
        {isFetchingNextPage && <p className="py-4 text-center text-caption text-white/40">Loading more…</p>}
      </div>
    </DashboardFullScreenPanel>
  );
}
