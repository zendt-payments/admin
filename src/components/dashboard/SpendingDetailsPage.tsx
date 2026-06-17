import { useState, useEffect, useMemo } from "react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { dataService } from "../../services/dataService";
import { useAppResumeTick } from "../../hooks/useAppResumeTick";
import { DashboardPageTitle, DashboardSectionTitle, dashboardEyebrowClass } from "./DashboardTitles";
import { CounterpartyAvatar } from "./CounterpartyAvatar";
import ListRowsSkeleton from "./ListRowsSkeleton";
import { Shimmer } from "../motion";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface SpendPoint {
  day: string;
  amount: number;
  label: string;
}

export default function SpendingDetailsPage() {
  const resumeTick = useAppResumeTick();
  const [activePoint, setActivePoint] = useState<number | null>(null);
  const [animate, setAnimate] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState("This Month");
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof dataService.getSpendingSummary>> | null>(
    null
  );
  const [loadingTx, setLoadingTx] = useState(true);

  const months = ["Last Month", "This Month"];

  const now = new Date();
  const targetMonth = selectedMonth === "This Month" ? now.getMonth() : (now.getMonth() - 1 + 12) % 12;
  const targetYear =
    selectedMonth === "This Month"
      ? now.getFullYear()
      : now.getMonth() === 0
        ? now.getFullYear() - 1
        : now.getFullYear();
  const monthLabel = MONTH_NAMES[targetMonth];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingTx(true);
      try {
        const res = await dataService.getSpendingSummary({ year: targetYear, month: targetMonth });
        if (!cancelled) {
          setSummary(res);
          setLoadingTx(false);
          setTimeout(() => setAnimate(true), 100);
        }
      } catch {
        if (!cancelled) setLoadingTx(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumeTick, targetYear, targetMonth]);

  const spendingData: SpendPoint[] = useMemo(() => {
    if (!summary?.chart_points?.length) return [];
    return summary.chart_points.map((p) => ({
      day: String(p.day),
      amount: p.amount,
      label: p.label,
    }));
  }, [summary]);

  const totalSpent = summary?.total ?? 0;

  const topSpenders = useMemo(() => summary?.top_spenders ?? [], [summary]);

  const width = 340;
  const height = 280;
  const padding = 20;
  const maxAmount = Math.max(...spendingData.map((d) => d.amount), 1);

  const getX = (index: number) => padding + (index / (spendingData.length - 1)) * (width - 2 * padding);
  const getY = (amount: number) => height - padding - (amount / maxAmount) * (height - 2 * padding);

  const pathData = spendingData
    .map((d, i) => `${i === 0 ? "M" : "L"} ${getX(i)} ${getY(d.amount)}`)
    .join(" ");

  const areaPathData =
    spendingData.length > 0
      ? `${pathData} L ${getX(spendingData.length - 1)} ${height} L ${getX(0)} ${height} Z`
      : "";

  return (
    <PageContainer className="text-white space-y-6">
      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header relative">
        <GradientBlob
          className="absolute opacity-60 blur-2xl -z-10"
          style={{ right: "82px", top: "-50px", width: "321px", height: "262px", zIndex: "0" }}
        />
        <div className="flex w-full z-10">
          <BackButton />
        </div>
      </div>

      <div className="pt-6 relative rounded-t-3xl px-4 pb-24 pb-safe-nav bg-[#141414] z-10 flex-1">
        <header className="mb-8 pl-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <p className={`${dashboardEyebrowClass} mb-1`}>Earnings Analysis</p>
          <DashboardPageTitle as="h2">{monthLabel} Earnings</DashboardPageTitle>
          <p className="text-white/50 text-body mt-2">
            Total earned:{" "}
            <span className="text-white font-medium">₹{totalSpent.toLocaleString("en-IN")}</span>
          </p>
        </header>

        <div className="rounded-[32px] bg-[#1E1E1E] p-6 shadow-lg border border-white/5 relative overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-100">
          <DashboardSectionTitle className="mb-4">Overview</DashboardSectionTitle>
          <div className="mb-6 flex gap-2 rounded-[14px] bg-white/5 p-1 w-fit">
            {months.map((month) => (
              <button
                key={month}
                onClick={() => setSelectedMonth(month)}
                className={`px-4 py-1.5 rounded-[10px] text-caption font-medium transition-all duration-200 ${
                  selectedMonth === month ? "bg-white text-black" : "text-white/60 hover:text-white/90"
                }`}
              >
                {month}
              </button>
            ))}
          </div>

          {loadingTx ? (
            <Shimmer className="h-[280px] w-full" bg="bg-white/5" rounded="rounded-2xl" />
          ) : spendingData.length === 0 ? (
            <div className="flex h-[280px] items-center justify-center text-body text-white/40">
              No spending data for {monthLabel}
            </div>
          ) : (
            <div
              className="relative h-[280px] w-full select-none touch-none"
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const index = Math.min(
                  Math.max(
                    Math.round((x - padding) / ((width - 2 * padding) / (spendingData.length - 1))),
                    0
                  ),
                  spendingData.length - 1
                );
                setActivePoint(index);
              }}
              onTouchMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const x = e.touches[0].clientX - rect.left;
                const index = Math.min(
                  Math.max(
                    Math.round((x - padding) / ((width - 2 * padding) / (spendingData.length - 1))),
                    0
                  ),
                  spendingData.length - 1
                );
                setActivePoint(index);
              }}
              onMouseLeave={() => setActivePoint(null)}
              onTouchEnd={() => setTimeout(() => setActivePoint(null), 2000)}
            >
              <svg
                width="100%"
                height="100%"
                viewBox={`0 0 ${width} ${height}`}
                className="overflow-visible"
              >
                <defs>
                  <linearGradient id="gradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fff" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="#fff" stopOpacity="0" />
                  </linearGradient>
                  <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                    <feMerge>
                      <feMergeNode in="coloredBlur" />
                      <feMergeNode in="SourceGraphic" />
                    </feMerge>
                  </filter>
                </defs>

                <path
                  d={areaPathData}
                  fill="url(#gradient)"
                  className={`transition-opacity duration-1000 ${animate ? "opacity-100" : "opacity-0"}`}
                />

                {activePoint !== null && (
                  <line
                    x1={getX(activePoint)}
                    y1={0}
                    x2={getX(activePoint)}
                    y2={height}
                    stroke="white"
                    strokeWidth="1"
                    strokeDasharray="4 4"
                    className="opacity-50"
                  />
                )}

                <path
                  d={pathData}
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  filter="url(#glow)"
                  strokeDasharray="1000"
                  strokeDashoffset={animate ? "0" : "1000"}
                  className="transition-all duration-[2000ms] ease-out"
                />

                {spendingData.map((d, i) => (
                  <g key={i}>
                    <circle
                      cx={getX(i)}
                      cy={getY(d.amount)}
                      r={activePoint === i ? 6 : 0}
                      fill="white"
                      className={`transition-all duration-300 ${animate ? "opacity-100" : "opacity-0"}`}
                      style={{ transitionDelay: `${i * 100}ms` }}
                    />
                  </g>
                ))}
              </svg>

              {activePoint !== null && (
                <div
                  className="absolute bg-white/10 backdrop-blur-md border border-white/20 text-white text-caption font-medium px-3 py-2 rounded-xl shadow-xl transform -translate-x-1/2 -translate-y-full pointer-events-none transition-all duration-100 animate-in fade-in zoom-in-95"
                  style={{
                    left: `${(getX(activePoint) / width) * 100}%`,
                    top: `${(getY(spendingData[activePoint].amount) / height) * 100}%`,
                    marginTop: "-16px",
                  }}
                >
                  <div className="text-caption text-white/60 mb-0.5 uppercase tracking-wider">
                    {spendingData[activePoint].label}
                  </div>
                  <div className="text-title font-light">
                    ₹{spendingData[activePoint].amount.toLocaleString("en-IN")}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 rounded-[32px] bg-[#1E1E1E] p-6 shadow-lg border border-white/5 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          <DashboardSectionTitle className="mb-5">Top clients</DashboardSectionTitle>

          {loadingTx ? (
            <ListRowsSkeleton rows={4} className="py-1" />
          ) : topSpenders.length > 0 ? (
            <ul className="space-y-4">
              {topSpenders.map((spender) => (
                <li
                  key={spender.name}
                  className="flex items-center justify-between gap-3 text-body font-light text-white"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CounterpartyAvatar />
                    <span className="truncate text-callout font-light text-white">{spender.name}</span>
                  </div>
                  <span className="shrink-0 pl-3 text-right text-callout font-light text-white">
                    ₹{spender.total.toLocaleString("en-IN")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body font-light text-white/40">No clients for {monthLabel}</p>
          )}
        </div>

        {!loadingTx && totalSpent === 0 && (
          <div className="mt-8 text-center text-white/40 py-8">
            <p className="text-title">No spending data for {monthLabel}</p>
            <p className="text-body mt-1">Transactions will appear here once recorded</p>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
