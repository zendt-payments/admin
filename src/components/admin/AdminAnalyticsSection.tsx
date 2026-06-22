import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import { FormCardsSkeleton } from "../shared/skeletons/DashboardSkeletons";

type Range = 7 | 30 | 90;
type TopPeriod = "month" | "all";
type Compare = "calendar" | "rolling";

type Kpi = { value: number; change_pct?: number };

type AnalyticsResponse = {
  kpis: {
    total_signups: Kpi;
    active_users: Kpi;
    gmv_this_period: Kpi;
    gmv_total: Kpi;
  };
  user_growth: Array<{ date: string; signups: number }>;
  gmv_series: Array<{ date: string; amount: number }>;
  kyc_funnel: {
    signed_up: number;
    kyc_started: number;
    proof_submitted: number;
    active: number;
  };
  top_users: Array<{
    cognito_id: string;
    full_name: string;
    email: string;
    gmv: number;
    txn_count: number;
  }>;
  conversion: {
    signups_with_first_txn: number;
    total_signups: number;
    pct: number;
  };
  meta: { range: number; topPeriod: string; compare: string };
};

function formatInr(n: number): string {
  if (!Number.isFinite(n)) return "₹0";
  const abs = Math.abs(n);
  if (abs >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function formatCount(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n.toLocaleString("en-IN");
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", { month: "short", day: "numeric" });
}

function PillGroup<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-full bg-white/5 border border-white/10 p-1">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-caption rounded-full transition ${
            value === o.value ? "bg-white text-black" : "text-white/65 hover:text-white"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function KpiCard({
  label,
  value,
  changePct,
}: {
  label: string;
  value: string;
  changePct?: number;
}) {
  const showChange = typeof changePct === "number";
  const positive = showChange && changePct! >= 0;
  const capped = showChange && Math.abs(changePct!) > 500;
  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 px-5 py-4">
      <div className="text-caption text-white/55">{label}</div>
      <div className="text-2xl font-medium text-white mt-2">{value}</div>
      {showChange && (
        <div
          className={`mt-2 inline-flex items-center gap-1 text-caption ${
            positive ? "text-emerald-400" : "text-red-400"
          }`}
        >
          {positive ? (
            <TrendingUp className="w-3.5 h-3.5" />
          ) : (
            <TrendingDown className="w-3.5 h-3.5" />
          )}
          {capped ? (
            <span>New</span>
          ) : (
            <>
              {positive ? "+" : ""}
              {changePct!.toFixed(1)}%
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminAnalyticsSection() {
  const { showError } = useAppToast();
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [range, setRange] = useState<Range>(30);
  const [topPeriod, setTopPeriod] = useState<TopPeriod>("month");
  const [compare, setCompare] = useState<Compare>("calendar");

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    dataService
      .getAdminAnalyticsOverview({ range, topPeriod, compare })
      .then(setData)
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load analytics"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, topPeriod, compare]);

  const funnelMax = useMemo(() => {
    if (!data) return 1;
    return Math.max(1, data.kyc_funnel.signed_up);
  }, [data]);

  if (loading && !data) {
    return (
      <section className="space-y-4">
        <DashboardSectionTitle>Analytics</DashboardSectionTitle>
        <FormCardsSkeleton />
      </section>
    );
  }

  if (!data) return null;

  const funnelStages = [
    { key: "signed_up", label: "Signed Up", value: data.kyc_funnel.signed_up },
    { key: "kyc_started", label: "KYC Started", value: data.kyc_funnel.kyc_started },
    { key: "proof_submitted", label: "Proof Submitted", value: data.kyc_funnel.proof_submitted },
    { key: "active", label: "Active", value: data.kyc_funnel.active },
  ];

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardSectionTitle>Analytics</DashboardSectionTitle>
        <div className="flex flex-wrap items-center gap-2">
          <PillGroup<Range>
            value={range}
            onChange={setRange}
            options={[
              { value: 7, label: "7d" },
              { value: 30, label: "30d" },
              { value: 90, label: "90d" },
            ]}
          />
          <PillGroup<Compare>
            value={compare}
            onChange={setCompare}
            options={[
              { value: "calendar", label: "vs Last Month" },
              { value: "rolling", label: "vs 30d Ago" },
            ]}
          />
          <button
            type="button"
            onClick={() => load(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1 text-caption text-white/55 hover:text-white px-2 py-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          label="Total Signups"
          value={formatCount(data.kpis.total_signups.value)}
          changePct={data.kpis.total_signups.change_pct}
        />
        <KpiCard
          label="Active Users"
          value={formatCount(data.kpis.active_users.value)}
          changePct={data.kpis.active_users.change_pct}
        />
        <KpiCard
          label={compare === "calendar" ? "GMV This Month" : "GMV Last 30d"}
          value={formatInr(data.kpis.gmv_this_period.value)}
          changePct={data.kpis.gmv_this_period.change_pct}
        />
        <KpiCard label="Total GMV" value={formatInr(data.kpis.gmv_total.value)} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-body text-white/85 font-medium">User Growth</div>
            <div className="text-caption text-white/45">Last {range} days</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.user_growth} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="userGrowthGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E5E7EB" />
                    <stop offset="100%" stopColor="#9CA3AF" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(label) => formatShortDate(String(label))}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "#1A1A1A",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "#fff",
                  }}
                  labelFormatter={(label) => formatShortDate(String(label))}
                />
                <Line
                  type="monotone"
                  dataKey="signups"
                  stroke="url(#userGrowthGradient)"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 5, fill: "#E5E7EB" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="text-body text-white/85 font-medium">GMV by Day</div>
            <div className="text-caption text-white/45">Last {range} days</div>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.gmv_series} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="gmvBarGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E5E7EB" />
                    <stop offset="100%" stopColor="#9CA3AF" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="date"
                  stroke="rgba(255,255,255,0.5)"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(label) => formatShortDate(String(label))}
                  interval="preserveStartEnd"
                />
                <YAxis stroke="rgba(255,255,255,0.5)" tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "#1A1A1A",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 8,
                    color: "#fff",
                  }}
                  labelFormatter={(label) => formatShortDate(String(label))}
                  formatter={(v) => formatInr(Number(v))}
                />
                <Bar dataKey="amount" fill="url(#gmvBarGradient)" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* KYC Funnel */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-body text-white/85 font-medium">KYC Funnel</div>
          <div className="text-caption text-white/45">All users</div>
        </div>
        <div className="space-y-3">
          {funnelStages.map((s, i) => {
            const pctOfTop = (s.value / funnelMax) * 100;
            const prev = i > 0 ? funnelStages[i - 1].value : null;
            const dropPct = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 1000) / 10 : null;
            return (
              <div key={s.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-caption text-white/75">{s.label}</span>
                  <div className="flex items-center gap-3">
                    {dropPct !== null && (
                      <span className="text-caption text-red-400/80">
                        -{dropPct.toFixed(1)}%
                      </span>
                    )}
                    <span className="text-caption text-white font-medium">{formatCount(s.value)}</span>
                  </div>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full transition-all"
                    style={{
                      width: `${pctOfTop}%`,
                      background: "linear-gradient(180deg, #E5E7EB 0%, #9CA3AF 100%)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Conversion */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="text-caption text-white/55">Conversion to first transaction</div>
        <div className="mt-2 flex items-baseline gap-3">
          <div className="text-3xl font-medium text-white">{data.conversion.pct.toFixed(1)}%</div>
          <div className="text-caption text-white/55">
            {formatCount(data.conversion.signups_with_first_txn)} of{" "}
            {formatCount(data.conversion.total_signups)} signups made a transaction
          </div>
        </div>
      </div>

      {/* Top Users */}
      <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="text-body text-white/85 font-medium">Top Users by GMV</div>
          <PillGroup<TopPeriod>
            value={topPeriod}
            onChange={setTopPeriod}
            options={[
              { value: "month", label: "This Month" },
              { value: "all", label: "All Time" },
            ]}
          />
        </div>
        {data.top_users.length === 0 ? (
          <div className="text-caption text-white/45 py-4">No transactions yet for this period.</div>
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full">
              <thead>
                <tr className="text-left text-caption text-white/45 border-b border-white/10">
                  <th className="py-2 pl-1 pr-3 font-normal w-10">#</th>
                  <th className="py-2 pr-3 font-normal">User</th>
                  <th className="py-2 pr-3 font-normal hidden sm:table-cell">Email</th>
                  <th className="py-2 pr-3 font-normal text-right">Txns</th>
                  <th className="py-2 pr-1 font-normal text-right">GMV</th>
                </tr>
              </thead>
              <tbody>
                {data.top_users.map((u, i) => (
                  <tr key={u.cognito_id} className="border-b border-white/5 last:border-0">
                    <td className="py-2.5 pl-1 pr-3 text-caption text-white/55">{i + 1}</td>
                    <td className="py-2.5 pr-3 text-body text-white">{u.full_name || "Unknown"}</td>
                    <td className="py-2.5 pr-3 text-caption text-white/55 hidden sm:table-cell truncate max-w-xs">
                      {u.email}
                    </td>
                    <td className="py-2.5 pr-3 text-caption text-white/75 text-right">
                      {formatCount(u.txn_count)}
                    </td>
                    <td className="py-2.5 pr-1 text-body text-white text-right font-medium">
                      {formatInr(u.gmv)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}