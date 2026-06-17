import { useEffect, useState, useCallback, type ReactNode } from "react";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import ListRowsSkeleton from "../shared/skeletons/ListRowsSkeleton";
import { Search, X } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-emerald-500/15 text-emerald-400",
  sent: "bg-blue-500/15 text-blue-400",
  draft: "bg-white/10 text-white/50",
  overdue: "bg-red-500/15 text-red-400",
  cancelled: "bg-red-900/20 text-red-300",
};

function fmt(v: unknown) {
  if (!v) return "—";
  try { return new Date(String(v)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return String(v); }
}
function str(v: unknown): string {
  if (v == null || v === "") return "—";
  return String(v);
}

export default function AdminInvoicesSection() {
  const { showError } = useAppToast();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
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
      const r = await dataService.getAdminDataCollection({ collection: "invoices", page, limit: LIMIT, q: q || undefined });
      setItems(r.items || []); setTotal(r.pagination?.total ?? 0);
    } catch (e) { showError(e instanceof Error ? e.message : "Failed to load"); }
    finally { setLoading(false); }
  }, [page, searchDebounced, showError]);

  useEffect(() => { load(); }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="space-y-5">
      <DashboardSectionTitle as="h2">Invoices <span className="text-white/40 font-normal text-lg">({total})</span></DashboardSectionTitle>

      <div className="relative max-w-md">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by invoice no, email, client…"
          className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 pl-11 pr-4 py-3 text-[15px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/25" />
      </div>

      <div className="flex gap-4">
        <div className={`rounded-2xl bg-[#1E1E1E] border border-white/10 overflow-hidden ${detail ? "flex-1" : "w-full"}`}>
          {loading ? <div className="p-5"><ListRowsSkeleton rows={8} /></div> : items.length === 0 ? (
            <div className="p-10 text-center text-[15px] text-white/50">No invoices found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left">
                <thead className="bg-black/30 text-white/50 uppercase tracking-wide text-[13px]">
                  <tr>
                    <th className="px-5 py-3.5 font-medium">Invoice #</th>
                    <th className="px-5 py-3.5 font-medium">User</th>
                    <th className="px-5 py-3.5 font-medium">Client</th>
                    <th className="px-5 py-3.5 font-medium">Total</th>
                    <th className="px-5 py-3.5 font-medium">Status</th>
                    <th className="px-5 py-3.5 font-medium">Due Date</th>
                    <th className="px-5 py-3.5 font-medium">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {items.map((inv, i) => (
                    <tr key={String(inv._id || i)} className={`hover:bg-white/[0.03] cursor-pointer ${detail?._id === inv._id ? "bg-white/[0.06]" : ""}`}
                      onClick={async () => {
                      setDetail(inv);
                      setPdfUrl(null);
                      const pdfKey = inv.invoice_pdf_url || (inv.invoice_number ? `invoices/${inv.invoice_number}.pdf` : null);
                      if (pdfKey) {
                        try { const r = await dataService.getAdminSignedUrl(String(pdfKey)); setPdfUrl(r.url); } catch {}
                      }
                    }}>
                      <td className="px-5 py-3.5 font-mono text-[14px] text-white/90 font-medium">{str(inv.invoice_number)}</td>
                      <td className="px-5 py-3.5 text-[14px] text-white/70 max-w-[200px] truncate">{str(inv.user_email)}</td>
                      <td className="px-5 py-3.5 text-[14px] text-white/60 max-w-[160px] truncate">{str(inv.client_name)}</td>
                      <td className="px-5 py-3.5 text-[15px] text-white font-semibold whitespace-nowrap">
                        {inv.currency && inv.currency !== "INR" ? `${inv.currency} ` : "₹"}{Number(inv.total || 0).toLocaleString("en-IN")}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`px-2.5 py-1 rounded-full text-[13px] font-medium capitalize ${STATUS_COLORS[String(inv.status || "").toLowerCase()] || "bg-white/10 text-white/50"}`}>
                          {str(inv.status)}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[14px] text-white/50 whitespace-nowrap">{fmt(inv.due_date)}</td>
                      <td className="px-5 py-3.5 text-[14px] text-white/50 whitespace-nowrap">{fmt(inv.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {detail && (
          <div className="w-96 shrink-0 rounded-2xl bg-[#1E1E1E] border border-white/10 overflow-hidden flex flex-col max-h-[80vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
              <p className="text-[14px] text-white/50 uppercase tracking-wide font-medium">Invoice Detail</p>
              <button type="button" onClick={() => setDetail(null)} className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center">
                <X className="w-4 h-4 text-white/60" />
              </button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4 text-[14px]">
              <DGroup>
                <DRow label="Invoice #" value={str(detail.invoice_number)} mono />
                <DRow label="User" value={str(detail.user_email)} />
                <DRow label="Client" value={str(detail.client_name)} />
                <DRow label="Client Email" value={str(detail.client_email)} />
                <DRow label="Status" value={str(detail.status)} />
              </DGroup>

              <DGroup title="Bill From">
                <DRow label="Name" value={str((detail.bill_from as Record<string,unknown>)?.name)} />
                <DRow label="Email" value={str((detail.bill_from as Record<string,unknown>)?.email)} />
                <DRow label="Phone" value={str((detail.bill_from as Record<string,unknown>)?.phone)} />
                <DRow label="Address" value={str((detail.bill_from as Record<string,unknown>)?.address)} />
              </DGroup>

              <DGroup title="Bill To">
                <DRow label="Name" value={str((detail.bill_to as Record<string,unknown>)?.name)} />
                <DRow label="Email" value={str((detail.bill_to as Record<string,unknown>)?.email)} />
                <DRow label="Address" value={str((detail.bill_to as Record<string,unknown>)?.address)} />
              </DGroup>

              <DGroup title="Line Items">
                {Array.isArray(detail.items) && (detail.items as Array<Record<string,unknown>>).length > 0 ? (
                  (detail.items as Array<Record<string,unknown>>).map((item, idx) => (
                    <div key={idx} className="py-1.5 border-b border-white/5 last:border-0">
                      <p className="text-white/80 font-medium">{str(item.description)}</p>
                      <p className="text-white/50 text-[13px]">{Number(item.quantity || 0)} × ₹{Number(item.rate || 0).toLocaleString("en-IN")} = <span className="text-white/70">₹{Number(item.amount || 0).toLocaleString("en-IN")}</span></p>
                    </div>
                  ))
                ) : <p className="text-white/40">No line items</p>}
              </DGroup>

              <DGroup title="Totals">
                <DRow label="Subtotal" value={`₹${Number(detail.subtotal || 0).toLocaleString("en-IN")}`} />
                {Number(detail.tax || 0) > 0 && <DRow label="Tax" value={`₹${Number(detail.tax || 0).toLocaleString("en-IN")}`} />}
                {Number(detail.discount || 0) > 0 && <DRow label="Discount" value={`₹${Number(detail.discount || 0).toLocaleString("en-IN")}`} />}
                <div className="flex justify-between pt-1 border-t border-white/10">
                  <span className="text-white/50 font-medium">Total</span>
                  <span className="text-white font-semibold text-[15px]">₹{Number(detail.total || 0).toLocaleString("en-IN")}</span>
                </div>
              </DGroup>

              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2.5 text-[13px] text-emerald-400 hover:text-emerald-300 w-full justify-center font-medium">
                  View Invoice PDF
                </a>
              )}

              <DGroup title="Dates">
                <DRow label="Due Date" value={fmt(detail.due_date)} />
                <DRow label="Created" value={fmt(detail.createdAt)} />
                <DRow label="Updated" value={fmt(detail.updatedAt)} />
              </DGroup>

              {detail.notes && (
                <DGroup title="Notes">
                  <p className="text-white/70 text-[13px]">{str(detail.notes)}</p>
                </DGroup>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 text-[14px] text-white/50">
        <span>Page {page} of {totalPages} · {total} total</span>
        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10 disabled:opacity-30">Previous</button>
        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-white/15 px-4 py-1.5 hover:bg-white/10 disabled:opacity-30">Next</button>
      </div>
    </div>
  );
}

function DGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      {title && <p className="text-[12px] text-white/35 uppercase tracking-wide font-medium">{title}</p>}
      <div className="rounded-xl bg-[#111] border border-white/8 p-3 space-y-1.5">{children}</div>
    </div>
  );
}

function DRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  if (value === "—") return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-white/40 shrink-0">{label}</span>
      <span className={`text-white/80 text-right break-all ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
