import { useEffect, useState, useCallback } from "react";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import ListRowsSkeleton from "../shared/skeletons/ListRowsSkeleton";
import { Search, ExternalLink, FileText } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-blue-500/15 text-blue-400",
  paid: "bg-emerald-500/15 text-emerald-400",
  completed: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
  expired: "bg-white/10 text-white/40",
  inactive: "bg-white/10 text-white/40",
};

function fmt(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export default function AdminPaymentLinksSection() {
  const { showError } = useAppToast();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const LIMIT = 25;

  useEffect(() => {
    const t = window.setTimeout(() => { setSearchDebounced(search.trim()); setPage(1); }, 400);
    return () => window.clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = searchDebounced;
      if (q && q.includes("@")) {
        const userResult = await dataService.getAdminDataCollection({ collection: "users", page: 1, limit: 1, q, searchField: "email" });
        if (userResult.items?.length > 0) q = String(userResult.items[0].cognito_id || "");
        else { setItems([]); setTotal(0); setLoading(false); return; }
      }
      const r = await dataService.getAdminDataCollection({ collection: "paymentlinks", page, limit: LIMIT, q: q || undefined });
      setItems(r.items || []); setTotal(r.pagination?.total ?? 0);
    } catch (e) { showError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, searchDebounced, showError]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-4">
      <DashboardSectionTitle as="h2">Payment Links <span className="text-white/40 font-normal text-base">({total})</span></DashboardSectionTitle>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email, link ID, reference…"
          className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 pl-9 pr-4 py-3 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/25" />
      </div>

      <div className="flex gap-4">
        {/* Table */}
        <div className={`rounded-2xl bg-[#1E1E1E] border border-white/10 overflow-hidden ${detail ? "flex-1" : "w-full"}`}>
          {loading ? <div className="p-4"><ListRowsSkeleton rows={8} /></div> : items.length === 0 ? (
            <div className="p-8 text-center text-body text-white/50">No payment links found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-[14px]">
                <thead className="bg-black/30 text-white/50 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 font-medium">Link ID</th>
                    <th className="px-4 py-3 font-medium">User</th>
                    <th className="px-4 py-3 font-medium">Customer</th>
                    <th className="px-4 py-3 font-medium">Amount</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Invoice #</th>
                    <th className="px-4 py-3 font-medium">Created</th>
                    <th className="px-4 py-3 font-medium"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((link, i) => (
                    <tr key={String(link._id || i)} className={`hover:bg-white/[0.03] cursor-pointer ${detail?._id === link._id ? "bg-white/[0.06]" : ""}`}
                      onClick={async () => {
                      setDetail(link);
                      setInvoiceUrl(null);
                      const invKey = link.invoice_number
                            ? `invoices/${link.invoice_number}.pdf`
                            : link.invoice_attachment ? String(link.invoice_attachment) : null;
                      if (invKey) {
                        try {
                          const r = await dataService.getAdminSignedUrl(invKey);
                          setInvoiceUrl(r.url);
                        } catch { /* ignore */ }
                      }
                    }}>
                      <td className="px-4 py-3 font-mono text-caption text-white/60 max-w-[140px] truncate">{String(link.display_id || link._id || "—")}</td>
                      <td className="px-4 py-3 text-white/70 max-w-[160px] truncate">{String(link.user_email || "—")}</td>
                      <td className="px-4 py-3 text-white/60 max-w-[140px] truncate">{String(link.customer_name || link.customer_email || "—")}</td>
                      <td className="px-4 py-3 text-white font-medium whitespace-nowrap">₹{Number(link.amount || 0).toLocaleString("en-IN")}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-caption capitalize ${STATUS_COLORS[String(link.status || "").toLowerCase()] || "bg-white/10 text-white/50"}`}>
                          {String(link.status || "—")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-white/50">{String(link.invoice_number || "—")}</td>
                      <td className="px-4 py-3 text-white/50 whitespace-nowrap">{fmt(link.createdAt as string)}</td>
                      <td className="px-4 py-3">
                        {(link.invoice_number || link.invoice_attachment) ? (
                          <FileText className="w-4 h-4 text-emerald-400/70" title="Has invoice" />
                        ) : link.payment_url ? (
                          <a href={String(link.payment_url)} target="_blank" rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-white/30 hover:text-white/50">
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Detail panel */}
        {detail && (
          <div className="w-80 shrink-0 rounded-2xl bg-[#1E1E1E] border border-white/10 p-4 space-y-3 overflow-y-auto max-h-[75vh]">
            <div className="flex items-center justify-between">
              <p className="text-caption text-white/40 uppercase tracking-wide">Link Detail</p>
              <button type="button" onClick={() => setDetail(null)} className="text-white/40 hover:text-white text-caption">✕</button>
            </div>
            <div className="space-y-2 text-caption">
              <DetailRow label="Link ID" value={String(detail.display_id || detail._id || "")} mono />
              <DetailRow label="User" value={String(detail.user_email || "")} />
              <DetailRow label="Customer" value={String(detail.customer_name || "")} />
              <DetailRow label="Customer Email" value={String(detail.customer_email || "")} />
              <DetailRow label="Amount" value={`₹${Number(detail.amount || 0).toLocaleString("en-IN")}`} />
              <DetailRow label="Currency" value={String(detail.currency || "INR")} />
              <DetailRow label="Status" value={String(detail.status || "")} />
              <DetailRow label="Payment Status" value={String(detail.zwitch_payment_status || "")} />
              <DetailRow label="Description" value={String(detail.description || "")} />
              <DetailRow label="Invoice #" value={String(detail.invoice_number || "")} />
              <DetailRow label="Zwitch Link ID" value={String(detail.zwitch_link_id || "")} mono />
              <DetailRow label="Zwitch MTX" value={String(detail.zwitch_mtx || "")} mono />
              <DetailRow label="Created" value={fmt(detail.createdAt as string)} />
              <DetailRow label="Updated" value={fmt(detail.updatedAt as string)} />
              {invoiceUrl && (
                <a href={invoiceUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-[13px] text-emerald-400 hover:text-emerald-300 mt-2 w-full justify-center">
                  <FileText className="w-4 h-4" /> View Invoice PDF
                </a>
              )}
              {!invoiceUrl && (detail.invoice_number || detail.invoice_attachment) && (
                <p className="text-[12px] text-white/30 mt-2">Loading invoice…</p>
              )}
              {detail.payment_url && (
                <a href={String(detail.payment_url)} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[13px] text-white/50 hover:text-white/70 mt-1">
                  <ExternalLink className="w-3.5 h-3.5" /> Payment link
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-caption text-white/50">
        <span>Page {page} of {totalPages} · {total} total</span>
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10 disabled:opacity-30">Previous</button>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10 disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (!value || value === "undefined" || value === "null") return null;
  return (
    <div>
      <span className="text-white/40">{label}</span>
      <p className={`text-white/80 break-all ${mono ? "font-mono" : ""}`}>{value}</p>
    </div>
  );
}
