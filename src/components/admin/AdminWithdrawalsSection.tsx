import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import ListRowsSkeleton from "../shared/skeletons/ListRowsSkeleton";

type WithdrawalItem = {
  id: string;
  user_id: string;
  user_name: string;
  user_email: string;
  amount: number;
  upi_id: string;
  status: string;
  paid_at: string | null;
  paid_by: string;
  admin_notes: string;
  created_at: string;
  updated_at: string;
};

type StatusFilter = "pending" | "paid" | "all";

export default function AdminWithdrawalsSection() {
  const { showError, showSuccess } = useAppToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const [items, setItems] = useState<WithdrawalItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<WithdrawalItem | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  const loadList = () => {
    setLoading(true);
    dataService
      .getAdminReferralWithdrawals({ page, limit: 20, status: statusFilter })
      .then((r) => {
        setItems(r.items || []);
        setTotal(r.pagination?.total ?? 0);
      })
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload when page or filter changes
  }, [page, statusFilter]);

  useEffect(() => {
    const id = searchParams.get("id");
    if (!id) return;
    setDetailLoading(true);
    dataService
      .getAdminReferralWithdrawal(id)
      .then((row) => {
        setDetail(row);
        setAdminNotes(row.admin_notes || "");
      })
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load withdrawal"))
      .finally(() => setDetailLoading(false));
  }, [searchParams, showError]);

  const selectItem = (row: WithdrawalItem) => {
    setDetail(row);
    setAdminNotes(row.admin_notes || "");
    setSearchParams({ tab: "withdrawals", id: row.id }, { replace: true });
  };

  const markPaid = async () => {
    if (!detail) return;
    if (
      !window.confirm(
        `Mark ₹${detail.amount.toLocaleString("en-IN")} paid to ${detail.upi_id}? Confirm only after UPI transfer is complete.`
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await dataService.markReferralWithdrawalPaid(detail.id, adminNotes.trim() || undefined);
      showSuccess("Marked as paid", "Withdrawal status updated");
      setDetail(null);
      setAdminNotes("");
      setSearchParams({ tab: "withdrawals" }, { replace: true });
      loadList();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const statusBadge = (status: string) =>
    status === "paid" ? (
      <span className="text-caption px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">Paid</span>
    ) : (
      <span className="text-caption px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300">Pending</span>
    );

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <section className="rounded-2xl bg-[#1E1E1E] border border-white/10 p-4 space-y-3">
        <DashboardSectionTitle as="h2">Referral withdrawals</DashboardSectionTitle>
        <p className="text-caption text-white/45 leading-snug">
          Review UPI payout requests. Pay manually, then mark as paid.
        </p>

        <div className="flex gap-2">
          {(["pending", "paid", "all"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setPage(1);
                setStatusFilter(s);
              }}
              className={`rounded-full px-3 py-1 text-caption capitalize transition ${
                statusFilter === s ? "bg-white text-black" : "bg-white/10 text-white/70 hover:bg-white/15"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {loading ? (
          <ListRowsSkeleton rows={4} />
        ) : items.length === 0 ? (
          <p className="text-body text-white/50">No withdrawal requests.</p>
        ) : (
          <ul className="space-y-2">
            {items.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => selectItem(row)}
                  className={`w-full text-left rounded-xl px-3 py-2 text-body transition ${
                    detail?.id === row.id ? "bg-white/15" : "bg-white/5 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{row.user_name || row.user_email}</span>
                    {statusBadge(row.status)}
                  </div>
                  <div className="text-caption text-white/50 truncate">{row.user_email}</div>
                  <div className="text-caption text-white/40 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>₹{row.amount.toLocaleString("en-IN")}</span>
                    <span className="truncate">{row.upi_id}</span>
                    <span>{row.created_at ? new Date(row.created_at).toLocaleString() : ""}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}

        {total > 20 && (
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="text-caption text-white/60 hover:text-white disabled:opacity-30"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={page * 20 >= total}
              onClick={() => setPage((p) => p + 1)}
              className="text-caption text-white/60 hover:text-white disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-[#1E1E1E] border border-white/10 p-4 space-y-4 min-h-[280px]">
        <DashboardSectionTitle as="h2">Withdrawal detail</DashboardSectionTitle>
        {!detail && !detailLoading && <p className="text-body text-white/50">Select a row to review.</p>}
        {detailLoading && <ListRowsSkeleton rows={3} />}
        {detail && !detailLoading && (
          <>
            <div className="text-body space-y-1.5">
              <p>
                <span className="text-white/50">Name:</span> {detail.user_name || "—"}
              </p>
              <p>
                <span className="text-white/50">Email:</span> {detail.user_email || "—"}
              </p>
              <p>
                <span className="text-white/50">User ID:</span> {detail.user_id}
              </p>
              <p>
                <span className="text-white/50">Amount:</span> ₹{detail.amount.toLocaleString("en-IN")}
              </p>
              <p>
                <span className="text-white/50">UPI ID:</span> {detail.upi_id}
              </p>
              <p>
                <span className="text-white/50">Status:</span> {detail.status}
              </p>
              <p>
                <span className="text-white/50">Requested:</span>{" "}
                {detail.created_at ? new Date(detail.created_at).toLocaleString() : "—"}
              </p>
              {detail.paid_at ? (
                <p>
                  <span className="text-white/50">Paid:</span> {new Date(detail.paid_at).toLocaleString()}
                </p>
              ) : null}
            </div>

            <label className="block space-y-2">
              <span className="text-caption text-white/50 uppercase tracking-wide">
                Admin notes (optional)
              </span>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                disabled={detail.status === "paid"}
                placeholder="Internal note or UPI reference"
                className="w-full rounded-xl bg-[#2E2E2E] px-4 py-3 text-body text-white placeholder:text-white/40 focus:outline-none resize-none border border-white/10 disabled:opacity-60"
              />
            </label>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                type="button"
                onClick={() => void markPaid()}
                disabled={actionLoading || detail.status === "paid"}
                className="rounded-full bg-emerald-600 px-5 py-2 text-body font-medium text-white disabled:opacity-40"
              >
                {actionLoading ? "Working…" : detail.status === "paid" ? "Already paid" : "Mark as paid"}
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
