import { useEffect, useState, useCallback } from "react";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import ListRowsSkeleton from "../shared/skeletons/ListRowsSkeleton";
import { Search } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-emerald-500/15 text-emerald-400",
  pending: "bg-amber-500/15 text-amber-400",
  failed: "bg-red-500/15 text-red-400",
  processing: "bg-blue-500/15 text-blue-400",
};

function fmt(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function fmtAmount(amount: unknown, currency: unknown) {
  const sym = String(currency || "INR") === "INR" ? "₹" : String(currency || "") + " ";
  return `${sym}${Number(amount || 0).toLocaleString("en-IN")}`;
}

export default function AdminTransactionsSection() {
  const { showError } = useAppToast();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchedEmail, setSearchedEmail] = useState<string | null>(null);

  const LIMIT = 25;

  useEffect(() => {
    const t = window.setTimeout(() => { setSearchDebounced(search.trim()); setPage(1); }, 400);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [statusFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    setSearchedEmail(null);
    try {
      let q = searchDebounced;

      // If query looks like an email, find the user first, then search by their cognito_id
      if (q && q.includes("@")) {
        const userResult = await dataService.getAdminDataCollection({
          collection: "users",
          page: 1,
          limit: 1,
          q,
          searchField: "email",
        });
        if (userResult.items?.length > 0) {
          const userId = String(userResult.items[0].cognito_id || "");
          setSearchedEmail(String(userResult.items[0].email || q));
          q = userId; // search transactions by cognito_id
        } else {
          // No user found with that email
          setSearchedEmail(q);
          setItems([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      const r = await dataService.getAdminDataCollection({
        collection: "transactions",
        page,
        limit: LIMIT,
        q: q || undefined,
      });
      let rows = r.items || [];
      if (statusFilter !== "all") rows = rows.filter((t) => String(t.status || "").toLowerCase() === statusFilter);
      setItems(rows);
      setTotal(r.pagination?.total ?? 0);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to load transactions");
    } finally {
      setLoading(false);
    }
  }, [page, searchDebounced, statusFilter, showError]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const statuses = ["all", "completed", "pending", "processing", "failed"];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DashboardSectionTitle as="h2">Transactions <span className="text-white/40 font-normal text-base">({total})</span></DashboardSectionTitle>
      </div>

      {/* Search + filter */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email, user ID, reference…"
            className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 pl-9 pr-4 py-3 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {statuses.map((s) => (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-caption capitalize transition ${statusFilter === s ? "bg-white text-black" : "bg-white/10 text-white/60 hover:bg-white/15"}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {searchedEmail && (
        <p className="text-caption text-white/50">
          Showing transactions for <span className="text-white/80 font-medium">{searchedEmail}</span>
        </p>
      )}

      {/* Table */}
      <div className="rounded-2xl bg-[#1E1E1E] border border-white/10 overflow-hidden">
        {loading ? (
          <div className="p-4"><ListRowsSkeleton rows={8} /></div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-body text-white/50">
            {searchDebounced ? `No transactions found for "${searchDebounced}"` : "No transactions yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-[14px]">
              <thead className="bg-black/30 text-white/50 uppercase tracking-wide text-[13px]">
                <tr>
                  <th className="px-4 py-3 font-medium">Transaction ID</th>
                  <th className="px-4 py-3 font-medium">User Email</th>
                  <th className="px-4 py-3 font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Reference</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {items.map((tx, i) => (
                  <tr key={String(tx._id || i)} className="hover:bg-white/[0.03]">
                    <td className="px-4 py-3 font-mono text-caption text-white/60 max-w-[160px] truncate">
                      {String(tx._id || "—")}
                    </td>
                    <td className="px-4 py-3 text-white/70 max-w-[180px] truncate">{String(tx.user_email || "—")}</td>
                    <td className="px-4 py-3 text-white font-medium whitespace-nowrap">
                      {fmtAmount(tx.amount, tx.currency)}
                    </td>
                    <td className="px-4 py-3 text-white/60 capitalize">{String(tx.type || "—")}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-caption capitalize ${STATUS_COLORS[String(tx.status || "").toLowerCase()] || "bg-white/10 text-white/50"}`}>
                        {String(tx.status || "—")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white/50 max-w-[140px] truncate">{String(tx.reference || "—")}</td>
                    <td className="px-4 py-3 text-white/50 whitespace-nowrap">{fmt(tx.createdAt as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center gap-3 text-caption text-white/50">
        <span>Page {page} of {totalPages} · {total} total</span>
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}
          className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10 disabled:opacity-30">Previous</button>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}
          className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10 disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}
