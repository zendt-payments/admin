import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueries, useQuery } from "@tanstack/react-query";
import GradientBlob from "../icons/GradientBlob";
import ExchangeRateCard, { FX_CARD_HEIGHT_PX, FX_CARD_WIDTH_PX } from "./ExchangeRateCard";
import ExpandToggleButton from "./ExpandToggleButton";
import TransactionStatusCard from "./TransactionStatusCard";
import LastSuccessfulCreditCard from "./LastSuccessfulCreditCard";
import { dataService } from "../../services/dataService";
import { getPersistent, removePersistent } from "../../lib/storage";
import { useDashboardSettings } from "../../hooks/useDashboardSettings";
import { getCurrencySymbol } from "../../constants/invoiceCurrencies";
import { DASH_QUERY_STALE, activityRefetchInterval, dqk } from "../../lib/dashboardQueries";
import { useSocketConnected } from "../../context/SocketProvider";
import ListRowsSkeleton from "./ListRowsSkeleton";
import ZendtCardPreview from "./ZendtCardPreview";
import { Shimmer } from "../motion";
import { formatPersonName } from "../../lib/formatPersonName";
import { DashboardPageTitle } from "./DashboardTitles";
import { CounterpartyAvatar } from "./CounterpartyAvatar";

type Transaction = {
  id: number | string;
  name: string;
  amount: number;
  type?: string;
  currency?: string;
  date?: string;
  avatarUrl?: string;
};

function shuffleWithRandom<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function DashboardSummary() {
  const { settings } = useDashboardSettings();
  const socketConnected = useSocketConnected();
  const activityPoll = activityRefetchInterval(socketConnected);
  const referralHandled = useRef(false);
  const fxScrollRef = useRef<HTMLDivElement | null>(null);
  const [cardsWaitlistJoined, setCardsWaitlistJoined] = useState(false);
  const [cardsWaitlistSubmitting, setCardsWaitlistSubmitting] = useState(false);

  const [canScrollRight, setCanScrollRight] = useState(false);

  const dashboardQs = useQueries({
    queries: [
      {
        queryKey: ["transactions", "preview", "completed"] as const,
        queryFn: () =>
          dataService.getTransactionsPage({
            status: "completed",
            limit: 4,
          }),
        staleTime: DASH_QUERY_STALE.txsList,
        refetchInterval: activityPoll,
        refetchOnWindowFocus: true,
      },
      {
        queryKey: dqk.profileSettings,
        queryFn: () => dataService.getProfileSettings(),
        staleTime: DASH_QUERY_STALE.profileSettings,
      },
    ],
  });

  const loading = dashboardQs.some((q) => q.isPending);

  const txsPage = dashboardQs[0].data as { items: Transaction[] } | undefined;
  const txsPending = dashboardQs[0].isPending;
  const txsSuccess = dashboardQs[0].isSuccess;
  const profileSettings = dashboardQs[1].data as
    | {
        initialProfileData?: { name?: string };
        bankSummary?: { bankLast4?: string };
      }
    | undefined;
  const transactions = useMemo(() => txsPage?.items ?? [], [txsPage]);

  const monthSummaryQuery = useQuery({
    queryKey: ["transactions", "summary", "month"] as const,
    queryFn: () => dataService.getTransactionSummary({ period: "month" }),
    staleTime: DASH_QUERY_STALE.txsList,
    refetchInterval: activityPoll,
    refetchOnWindowFocus: true,
  });

  const latestCompletedQuery = useQuery({
    queryKey: dqk.latestCompletedTransaction,
    queryFn: () => dataService.getLatestCompletedTransaction(),
    staleTime: DASH_QUERY_STALE.txsList,
    refetchInterval: activityPoll,
    refetchOnWindowFocus: true,
  });

  const latestCompleted = latestCompletedQuery.data;

  const latestPaymentLinkQuery = useQuery({
    queryKey: dqk.latestPaymentLink,
    queryFn: () => dataService.getLatestPaymentLinkActivity(),
    staleTime: DASH_QUERY_STALE.txsList,
    refetchInterval: activityPoll,
    refetchOnWindowFocus: true,
  });

  const fxQuery = useQuery({
    queryKey: dqk.exchangeRatesAll,
    queryFn: () => dataService.getExchangeRatesVsInr(),
    staleTime: DASH_QUERY_STALE.exchangeRates,
    enabled: settings.wallets,
  });

  const fxQuotes = useMemo(() => shuffleWithRandom(fxQuery.data?.quotes ?? []), [fxQuery.data?.quotes]);

  const userName = profileSettings?.initialProfileData?.name ?? "";
  const displayName = formatPersonName(userName);

  const cardLast4 = useMemo(() => {
    const last4 = profileSettings?.bankSummary?.bankLast4;
    return last4 && last4.length === 4 ? last4 : "XXXX";
  }, [profileSettings]);

  const qOkTx = dashboardQs[0].isSuccess;
  const qOkProfile = dashboardQs[1].isSuccess;

  useEffect(() => {
    if (!qOkProfile) return;
    let alive = true;
    dataService
      .getCardLaunchInfo()
      .then((info) => {
        if (alive) setCardsWaitlistJoined(info.alreadyOptedIn);
      })
      .catch(() => {
        // Best-effort — waitlist CTA still works without preloaded state.
      });
    return () => {
      alive = false;
    };
  }, [qOkProfile]);

  const handleCardsWaitlistJoin = async () => {
    if (cardsWaitlistSubmitting || cardsWaitlistJoined) return;
    setCardsWaitlistSubmitting(true);
    try {
      await dataService.optInCardsLaunch();
      setCardsWaitlistJoined(true);
    } catch {
      // Leave button enabled so the user can retry.
    } finally {
      setCardsWaitlistSubmitting(false);
    }
  };

  useEffect(() => {
    if (referralHandled.current || !qOkTx || !qOkProfile) {
      return;
    }
    referralHandled.current = true;
    void (async () => {
      const pendingCode = await getPersistent("pending_referral_code");
      if (pendingCode) {
        dataService
          .applyReferralCode(pendingCode)
          .then(() => removePersistent("pending_referral_code"))
          .catch(() => removePersistent("pending_referral_code"));
      }
    })();
  }, [qOkTx, qOkProfile]);

  const total = monthSummaryQuery.data?.total ?? 0;

  const primaryCurrency = useMemo(
    () =>
      (
        monthSummaryQuery.data?.currency ||
        latestCompleted?.currency ||
        transactions[0]?.currency ||
        "INR"
      ).toUpperCase(),
    [monthSummaryQuery.data, latestCompleted, transactions]
  );

  const updateScrollState = () => {
    const el = fxScrollRef.current;
    if (!el) {
      setCanScrollRight(false);
      return;
    }
    setCanScrollRight(
      el.scrollWidth > el.clientWidth && el.scrollLeft < el.scrollWidth - el.clientWidth - 2
    );
  };

  useEffect(() => {
    if (fxQuotes.length > 0 && fxScrollRef.current) {
      fxScrollRef.current.scrollLeft = 0;
    }
    updateScrollState();
  }, [fxQuotes]);

  useEffect(() => {
    const el = fxScrollRef.current;
    if (!el) return undefined;
    el.addEventListener("scroll", updateScrollState);
    window.addEventListener("resize", updateScrollState);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [fxQuotes]);

  const handleFxCarouselNext = () => {
    const container = fxScrollRef.current;
    if (!container) return;
    const card = container.querySelector<HTMLElement>("[data-fx-card]");
    const cardWidth = card?.offsetWidth ?? FX_CARD_WIDTH_PX;
    const gap = 16;
    const maxScrollLeft = container.scrollWidth - container.clientWidth;
    const nextScrollLeft = Math.min(container.scrollLeft + cardWidth + gap, maxScrollLeft);
    container.scrollTo({ left: nextScrollLeft, behavior: "smooth" });
  };

  return (
    <div className="relative mx-auto flex w-full max-w-4xl flex-col gap-16 px-4 pb-safe-tab pt-6 pb-12">
      <header className="text-left">
        {loading ? (
          <div className="space-y-2">
            <Shimmer className="h-9 w-48" rounded="rounded-lg" bg="bg-white/10" />
            <Shimmer className="h-6 w-32" rounded="rounded-lg" bg="bg-white/5" />
          </div>
        ) : (
          <>
            <p className="text-display font-light text-white">
              {displayName ? `Hello, ${displayName}.` : "Hello."}
            </p>
            <p className="text-white/50 font-extralight text-callout">How are you doing?</p>
          </>
        )}
      </header>

      <div className="flex flex-col gap-8">
        {settings.wallets && (
          <section className="space-y-8">
            <div className="flex flex-col gap-1">
              <h2 className="zendt-exchange-rate-heading text-headline font-light tracking-wide text-white">
                Exchange rates
              </h2>
            </div>

            {fxQuery.isPending && (
              <div className="flex gap-4">
                {[0, 1, 2].map((i) => (
                  <Shimmer
                    key={i}
                    className="shrink-0 rounded-[20px]"
                    style={{ width: FX_CARD_WIDTH_PX, height: FX_CARD_HEIGHT_PX }}
                    bg="bg-white/10"
                  />
                ))}
              </div>
            )}

            {fxQuery.isError && !fxQuery.isPending && (
              <div className="rounded-[20px] border border-white/10 bg-[#181818] px-4 py-6 text-center text-body font-light text-white/70">
                <p>Could not load exchange rates.</p>
                <button
                  type="button"
                  className="mt-3 rounded-full bg-white/10 px-4 py-2 text-caption text-white hover:bg-white/15"
                  onClick={() => void fxQuery.refetch()}
                >
                  Retry
                </button>
              </div>
            )}

            {fxQuery.isSuccess && fxQuotes.length === 0 && !fxQuery.isPending && (
              <p className="text-body font-light text-white/50">
                No rates returned for these currencies — try again later.
              </p>
            )}

            {fxQuery.isSuccess && fxQuotes.length > 0 && (
              <div className="flex items-stretch gap-3">
                <div className="flex-1 overflow-hidden">
                  <div
                    ref={fxScrollRef}
                    className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth bg-[#141414] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                  >
                    {fxQuotes.map((quote) => (
                      <div
                        key={quote.code}
                        data-fx-card
                        className="shrink-0 snap-start"
                        style={{ width: FX_CARD_WIDTH_PX }}
                      >
                        <ExchangeRateCard
                          code={quote.code}
                          inrPerUnit={quote.inrPerUnit}
                          changeVsPriorDaily={quote.changeVsPriorDaily}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className={`flex w-[38px] shrink-0 items-center justify-center transition-opacity duration-200 ${canScrollRight ? "opacity-100" : "pointer-events-none opacity-20"}`}
                  style={{ height: FX_CARD_HEIGHT_PX }}
                >
                  <ExpandToggleButton
                    variant="button"
                    className="h-full w-[38px] rounded-[10px] bg-[#181818]"
                    icon={
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="21" fill="none">
                        <path
                          d="M0.5 0.5L7.67158 7.67158C9.23367 9.23367 9.23367 11.7663 7.67157 13.3284L0.5 20.5"
                          stroke="#5B5B5B"
                          strokeLinecap="round"
                        />
                      </svg>
                    }
                    onClick={handleFxCarouselNext}
                  />
                </div>
              </div>
            )}
          </section>
        )}

        <section className="zendt-dashboard-cairo grid grid-cols-2 items-stretch gap-6">
          <LastSuccessfulCreditCard
            completedDateLine={latestCompleted?.completedDateLine}
            completedTimeLine={latestCompleted?.completedTimeLine}
          />

          <TransactionStatusCard link={latestPaymentLinkQuery.data ?? null} />
        </section>

        <div className="flex flex-col gap-8">
          {settings.transactions && (
            <section className="zendt-dashboard-cairo">
              <div className="relative overflow-hidden rounded-[20px] bg-[#161616] p-6 text-left text-white">
                <GradientBlob
                  className="pointer-events-none absolute opacity-30 blur-2xl"
                  style={{
                    right: 0,
                    top: 0,
                    transform: "translate(35%, -55%)",
                    width: "321px",
                    height: "262px",
                  }}
                />
                <header className="mb-6 flex flex-col gap-3">
                  <DashboardPageTitle as="h2">Recent Transactions</DashboardPageTitle>
                  <div className="mt-3 flex items-center justify-between text-caption font-light uppercase tracking-normal text-white/50">
                    <span>This month</span>
                    <span className="text-emerald-400">
                      {getCurrencySymbol(primaryCurrency)} {total.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <hr className="border-t border-white/10" />
                </header>

                {txsPending ? (
                  <ListRowsSkeleton rows={3} className="py-2" />
                ) : transactions.length > 0 ? (
                  <ul className="space-y-4">
                    {transactions.map((tx) => (
                      <li
                        key={tx.id}
                        className="flex items-center justify-between text-body font-light text-white"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <CounterpartyAvatar avatarUrl={tx.avatarUrl} />
                          <span className="truncate text-callout font-light text-white">{tx.name}</span>
                        </div>
                        <span className="shrink-0 pl-3 text-right text-callout font-light text-white">
                          {getCurrencySymbol(tx.currency || "INR")} {tx.amount.toLocaleString("en-IN")}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : txsSuccess ? (
                  <div className="py-8 text-center">
                    <p className="text-body font-light text-white/40">No transactions yet</p>
                  </div>
                ) : null}

                <div className="mt-10 text-center">
                  <Link
                    to="/dashboard/transactions"
                    className="text-body font-light text-white/80 hover:text-white"
                  >
                    View all transactions
                  </Link>
                </div>
              </div>
            </section>
          )}

          <section className="zendt-dashboard-cairo mb-20">
            <div className="rounded-[20px] border border-white/5 bg-[#161616] p-6">
              <header className="mb-5 sm:mb-6">
                <DashboardPageTitle as="h2">Available Cards</DashboardPageTitle>
              </header>
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:gap-5">
                <ZendtCardPreview
                  size="sm"
                  showBadge
                  badgeLabel="Early Access"
                  holder={displayName || "Your name"}
                  last4={cardLast4}
                  className="shrink-0"
                />
                <div className="flex w-full min-w-0 flex-1 flex-col text-center sm:text-left">
                  <p className="mb-1.5 text-callout font-light text-white">Cards by Zendt</p>
                  <p className="text-caption font-light whitespace-normal leading-relaxed text-white/45 sm:text-caption">
                    Premium business cards for India&apos;s modern entrepreneurs.
                  </p>
                  <button
                    type="button"
                    onClick={() => void handleCardsWaitlistJoin()}
                    disabled={cardsWaitlistSubmitting || cardsWaitlistJoined}
                    aria-pressed={cardsWaitlistJoined}
                    className={`mt-3 inline-flex items-center justify-center gap-1.5 text-caption font-light transition-colors sm:justify-start ${
                      cardsWaitlistJoined
                        ? "text-emerald-300"
                        : cardsWaitlistSubmitting
                          ? "cursor-wait text-white/50"
                          : "text-white/70 hover:text-white"
                    }`}
                  >
                    <span>
                      {cardsWaitlistJoined
                        ? "You're on the waitlist"
                        : cardsWaitlistSubmitting
                          ? "Joining…"
                          : "Join the waitlist"}
                    </span>
                    {!cardsWaitlistJoined && !cardsWaitlistSubmitting && (
                      <svg
                        width="12"
                        height="12"
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
                    )}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
