import { useEffect, useState } from "react";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import ListRowsSkeleton from "../shared/skeletons/ListRowsSkeleton";
import { FormCardsSkeleton } from "../shared/skeletons/DashboardSkeletons";

type PendingItem = {
  cognito_id: string;
  full_name: string;
  email: string;
  proof_submitted_at: string;
  proof_option: string;
  file_count: number;
};

type KycDocs = {
  submitted: boolean;
  submitted_at?: string;
  pan_card_url?: string | null;
  aadhaar_front_url?: string | null;
};

export default function AdminApprovalsSection() {
  const { showError, showSuccess } = useAppToast();
  const [items, setItems] = useState<PendingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // KYC link + docs state
  const [kycLinkLoading, setKycLinkLoading] = useState(false);
  const [kycDocs, setKycDocs] = useState<KycDocs | null>(null);
  const [kycDocsLoading, setKycDocsLoading] = useState(false);

  const loadList = () => {
    setLoading(true);
    dataService
      .getAdminPendingProofs(page)
      .then((r) => {
        setItems(r.items || []);
        setTotal(r.pagination?.total ?? 0);
      })
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  const selectUser = (id: string) => {
    setDetailLoading(true);
    setDetail(null);
    setKycDocs(null);
    dataService
      .getAdminUser(id)
      .then((user) => {
        setDetail(user);
        // Load KYC docs in parallel
        setKycDocsLoading(true);
        dataService
          .getAdminKycDocuments(id)
          .then(setKycDocs)
          .catch(() => setKycDocs(null))
          .finally(() => setKycDocsLoading(false));
      })
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load user"))
      .finally(() => setDetailLoading(false));
  };

  const generateKycLink = async () => {
    const id = detail?.cognito_id as string | undefined;
    if (!id) return;
    setKycLinkLoading(true);
    try {
      const result = await dataService.generateAdminKycLink(id);
      await navigator.clipboard.writeText(result.link);
      showSuccess("KYC link copied to clipboard", "Send it to the user via WhatsApp");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to generate link");
    } finally {
      setKycLinkLoading(false);
    }
  };

  const approve = async () => {
    const id = detail?.cognito_id as string | undefined;
    if (!id) return;
    setActionLoading(true);
    try {
      await dataService.approveAdminUser(id);
      setDetail(null);
      setKycDocs(null);
      loadList();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Approve failed");
    } finally {
      setActionLoading(false);
    }
  };

  const deactivate = async () => {
    const id = detail?.cognito_id as string | undefined;
    if (!id) return;
    if (
      !window.confirm(
        "Deactivate this freelancer account? They will be signed out and blocked from using the API until re-enabled manually in the database."
      )
    ) {
      return;
    }
    setActionLoading(true);
    try {
      await dataService.deactivateAdminUser(id);
      setDetail(null);
      setKycDocs(null);
      loadList();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Deactivate failed");
    } finally {
      setActionLoading(false);
    }
  };

  const reject = async () => {
    const id = detail?.cognito_id as string | undefined;
    if (!id || !rejectReason.trim()) return;
    setActionLoading(true);
    try {
      await dataService.rejectAdminUser(id, rejectReason.trim());
      setRejectOpen(false);
      setRejectReason("");
      setDetail(null);
      setKycDocs(null);
      loadList();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Reject failed");
    } finally {
      setActionLoading(false);
    }
  };

  const files =
    ((detail?.proof as Record<string, unknown>)?.files as Array<{
      view_url?: string | null;
      original_name?: string;
      kind?: string;
      s3_key?: string;
    }>) || (detail?.proof_files as Array<{
      view_url?: string | null;
      original_name?: string;
      kind?: string;
      s3_key?: string;
    }>) || [];

  return (
    <>
      <div className="grid lg:grid-cols-2 gap-4">
        {/* Left — queue list */}
        <section className="rounded-2xl bg-[#1E1E1E] border border-white/10 p-4 space-y-3">
          <DashboardSectionTitle as="h2">Freelancer proof queue</DashboardSectionTitle>
          <p className="text-caption text-white/45 leading-snug">
            Review step 3 proof submissions. Approve activates the account after provisioning checks.
          </p>
          {loading ? (
            <ListRowsSkeleton rows={4} />
          ) : items.length === 0 ? (
            <p className="text-body text-white/50">No pending submissions.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((u) => (
                <li key={u.cognito_id}>
                  <button
                    type="button"
                    onClick={() => selectUser(u.cognito_id)}
                    className={`w-full text-left rounded-xl px-3 py-2 text-body transition ${
                      detail?.cognito_id === u.cognito_id ? "bg-white/15" : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    <div className="font-medium">{u.full_name || u.email || u.cognito_id}</div>
                    <div className="text-caption text-white/50 truncate">{u.email}</div>
                    <div className="text-caption text-white/40 mt-1">
                      Option {u.proof_option} · {u.file_count} file(s) ·{" "}
                      {u.proof_submitted_at ? new Date(u.proof_submitted_at).toLocaleString() : ""}
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

        {/* Right — detail panel */}
        <section className="rounded-2xl bg-[#1E1E1E] border border-white/10 p-4 space-y-4 min-h-[280px]">
          <DashboardSectionTitle as="h2">Submission detail</DashboardSectionTitle>
          {!detail && !detailLoading && <p className="text-body text-white/50">Select a row to review.</p>}
          {detailLoading && <FormCardsSkeleton cards={1} />}
          {detail && (
            <>
              {/* User info */}
              <div className="text-body space-y-1.5">
                <p className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/50">Name:</span>
                  <span>{String(detail.full_name || "")}</span>
                  {detail.full_name ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(String(detail.full_name));
                        showSuccess("Name copied");
                      }}
                      className="text-caption text-white/40 hover:text-white/80 underline-offset-2 hover:underline"
                    >
                      Copy
                    </button>
                  ) : null}
                </p>
                <p className="flex items-center gap-2 flex-wrap">
                  <span className="text-white/50">Email:</span>
                  <span>{String(detail.email || "")}</span>
                  {detail.email ? (
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(String(detail.email));
                        showSuccess("Email copied");
                      }}
                      className="text-caption text-white/40 hover:text-white/80 underline-offset-2 hover:underline"
                    >
                      Copy
                    </button>
                  ) : null}
                </p>
                <p>
                  <span className="text-white/50">Status:</span>{" "}
                  <span className="text-white/80">{String(detail.kyc_status || "")}</span>
                </p>
                {detail.sub_account_id ? (
                  <p className="flex items-center gap-2 flex-wrap">
                    <span className="text-white/50">Sub Account:</span>
                    <span className="font-mono text-caption text-emerald-400">
                      {String(detail.sub_account_id)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        void navigator.clipboard.writeText(String(detail.sub_account_id));
                        showSuccess("Sub Account ID copied");
                      }}
                      className="text-caption text-white/40 hover:text-white/80 underline-offset-2 hover:underline"
                    >
                      Copy
                    </button>
                  </p>
                ) : null}
                <p>
                  <span className="text-white/50">Option:</span> {String(detail.proof_option || "")}
                </p>
                {detail.proof_notes ? (
                  <p>
                    <span className="text-white/50">Notes:</span> {String(detail.proof_notes)}
                  </p>
                ) : null}
              </div>

              {/* Proof files */}
              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-caption text-white/50 uppercase tracking-wide">Proof documents</p>
                  <ul className="space-y-2">
                    {files.map((f, i) => (
                      <li key={i} className="text-body">
                        {f.view_url ? (
                          <a
                            href={f.view_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-400 hover:underline"
                          >
                            {f.original_name || f.kind || `File ${i + 1}`}
                          </a>
                        ) : (
                          <span className="text-white/60">{f.original_name || f.s3_key || "File"}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* KYC Documents section */}
              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between">
                  <p className="text-caption text-white/50 uppercase tracking-wide">KYC documents</p>
                  <button
                    type="button"
                    onClick={() => void generateKycLink()}
                    disabled={kycLinkLoading}
                    className="rounded-full bg-white/10 hover:bg-white/15 px-3 py-1.5 text-caption text-white/80 disabled:opacity-40 transition"
                  >
                    {kycLinkLoading ? "Generating…" : "Generate & copy link"}
                  </button>
                </div>

                {kycDocsLoading && <p className="text-caption text-white/40">Loading documents…</p>}

                {!kycDocsLoading && kycDocs && !kycDocs.submitted && (
                  <p className="text-caption text-white/40">
                    No KYC documents uploaded yet. Generate a link and send it to the user.
                  </p>
                )}

                {!kycDocsLoading && kycDocs?.submitted && (
                  <div className="space-y-3">
                    {kycDocs.submitted_at && (
                      <p className="text-caption text-white/40">
                        Submitted {new Date(kycDocs.submitted_at).toLocaleString()}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {/* PAN Card */}
                      <div className="space-y-1.5">
                        <p className="text-caption text-white/50">PAN Card</p>
                        {kycDocs.pan_card_url ? (
                          <a
                            href={kycDocs.pan_card_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl overflow-hidden border border-white/10 hover:border-white/25 transition"
                          >
                            {/\.(jpe?g|png|heic|webp)(\?|$)/i.test(kycDocs.pan_card_url) ? (
                              <img
                                src={kycDocs.pan_card_url}
                                alt="PAN Card"
                                className="w-full h-24 object-cover"
                              />
                            ) : (
                              <div className="w-full h-24 bg-white/5 flex items-center justify-center text-caption text-emerald-400">
                                View PDF ↗
                              </div>
                            )}
                          </a>
                        ) : (
                          <div className="w-full h-24 rounded-xl bg-white/5 flex items-center justify-center text-caption text-white/30">
                            Not uploaded
                          </div>
                        )}
                      </div>

                      {/* Aadhaar Front */}
                      <div className="space-y-1.5">
                        <p className="text-caption text-white/50">Aadhaar Front</p>
                        {kycDocs.aadhaar_front_url ? (
                          <a
                            href={kycDocs.aadhaar_front_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl overflow-hidden border border-white/10 hover:border-white/25 transition"
                          >
                            {/\.(jpe?g|png|heic|webp)(\?|$)/i.test(kycDocs.aadhaar_front_url) ? (
                              <img
                                src={kycDocs.aadhaar_front_url}
                                alt="Aadhaar Front"
                                className="w-full h-24 object-cover"
                              />
                            ) : (
                              <div className="w-full h-24 bg-white/5 flex items-center justify-center text-caption text-emerald-400">
                                View PDF ↗
                              </div>
                            )}
                          </a>
                        ) : (
                          <div className="w-full h-24 rounded-xl bg-white/5 flex items-center justify-center text-caption text-white/30">
                            Not uploaded
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  onClick={approve}
                  disabled={actionLoading}
                  className="rounded-full bg-emerald-600 px-5 py-2 text-body font-medium text-white disabled:opacity-40"
                >
                  {actionLoading ? "Working…" : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={() => void deactivate()}
                  disabled={actionLoading}
                  className="rounded-full bg-amber-900/90 px-5 py-2 text-body font-medium text-white disabled:opacity-40"
                >
                  Deactivate account
                </button>
                <button
                  type="button"
                  onClick={() => setRejectOpen(true)}
                  disabled={actionLoading}
                  className="rounded-full bg-red-900/80 px-5 py-2 text-body font-medium text-white disabled:opacity-40"
                >
                  Reject
                </button>
              </div>
            </>
          )}
        </section>
      </div>

      {/* Reject modal */}
      {rejectOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-md rounded-2xl bg-[#1E1E1E] border border-white/10 p-5 space-y-3">
            <p className="text-body font-medium">Reject submission</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={4}
              placeholder="Reason for rejection (shown to the freelancer)"
              className="w-full rounded-xl bg-[#2E2E2E] px-4 py-3 text-body text-white placeholder:text-white/40 focus:outline-none resize-none border border-white/10"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRejectOpen(false)}
                className="px-3 py-2 text-body text-white/70 hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={reject}
                disabled={!rejectReason.trim() || actionLoading}
                className="rounded-full bg-red-800 px-4 py-2 text-body text-white disabled:opacity-40"
              >
                Send rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
