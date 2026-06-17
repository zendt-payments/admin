import { useEffect, useState, useCallback, type ReactNode } from "react";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import ListRowsSkeleton from "../shared/skeletons/ListRowsSkeleton";
import { X, Search, ChevronDown, ChevronUp } from "lucide-react";

type RiskLevel = "low" | "medium" | "high" | null;

type UserRow = {
  cognito_id: string;
  full_name: string;
  email: string;
  phone?: string;
  account_status: string;
  admin_risk_tag?: RiskLevel;
  createdAt?: string;
  zwitch?: { sub_account_id?: string };
  sub_account_id?: string;
};

type KycDocs = {
  submitted: boolean;
  submitted_at?: string;
  pan_card_url?: string | null;
  aadhaar_front_url?: string | null;
};

const RISK_COLORS: Record<string, string> = {
  low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400",
  pending_kyc: "bg-white/10 text-white/50",
  pending_proof: "bg-amber-500/15 text-amber-400",
  pending_review: "bg-blue-500/15 text-blue-400",
  rejected: "bg-red-500/15 text-red-400",
  deactivated: "bg-red-900/30 text-red-300",
};

function fmt(v: unknown) {
  if (!v) return "—";
  const s = String(v);
  try { return new Date(s).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }); } catch { return s; }
}
function fmtDate(v: unknown) {
  if (!v) return "—";
  try { return new Date(String(v)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }); } catch { return String(v); }
}
function str(v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

export default function AdminUsersSection() {
  const { showError, showSuccess } = useAppToast();
  const [items, setItems] = useState<UserRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [modalUser, setModalUser] = useState<Record<string, unknown> | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [kycDocs, setKycDocs] = useState<KycDocs | null>(null);
  const [notesList, setNotesList] = useState<Array<{text:string;author:string;created_at:string}>>([]);
  const [newNote, setNewNote] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [riskUpdating, setRiskUpdating] = useState<string | null>(null);
  const [rawExpanded, setRawExpanded] = useState(false);

  const LIMIT = 25;

  useEffect(() => {
    const t = window.setTimeout(() => { setSearchDebounced(search.trim()); setPage(1); }, 350);
    return () => window.clearTimeout(t);
  }, [search]);

  const loadUsers = useCallback(() => {
    setLoading(true);
    dataService.getAdminDataCollection({ collection: "users", page, limit: LIMIT, q: searchDebounced || undefined })
      .then((r) => { setItems((r.items || []) as UserRow[]); setTotal(r.pagination?.total ?? 0); })
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load users"))
      .finally(() => setLoading(false));
  }, [page, searchDebounced, showError]);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const openModal = async (cognitoId: string) => {
    setModalLoading(true);
    setModalUser(null);
    setKycDocs(null);
    setNewNote("");
    setRawExpanded(false);
    try {
      const [user, docs] = await Promise.allSettled([
        dataService.getAdminUser(cognitoId),
        dataService.getAdminKycDocuments(cognitoId),
      ]);
      if (user.status === "fulfilled") {
        setModalUser(user.value);
        setNotesList(Array.isArray(user.value.admin_notes) ? user.value.admin_notes as Array<{text:string;author:string;created_at:string}> : []);
      } else {
        showError("Failed to load user");
      }
      if (docs.status === "fulfilled") setKycDocs(docs.value);
    } finally {
      setModalLoading(false);
    }
  };

  const closeModal = () => { setModalUser(null); setKycDocs(null); setModalLoading(false); };

  const addNote = async () => {
    if (!modalUser || !newNote.trim()) return;
    setNotesSaving(true);
    try {
      const result = await dataService.addAdminUserNote(modalUser.cognito_id as string, newNote.trim());
      setNotesList(result.notes);
      setNewNote("");
      showSuccess("Note added");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to add note");
    } finally { setNotesSaving(false); }
  };

  const deleteNote = async (index: number) => {
    if (!modalUser) return;
    try {
      const result = await dataService.deleteAdminUserNote(modalUser.cognito_id as string, index);
      setNotesList(result.notes);
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to delete note");
    }
  };

  const setRisk = async (cognitoId: string, risk: RiskLevel) => {
    setRiskUpdating(cognitoId);
    try {
      await dataService.setAdminUserRisk(cognitoId, risk);
      setItems((prev) => prev.map((u) => u.cognito_id === cognitoId ? { ...u, admin_risk_tag: risk } : u));
      if (modalUser?.cognito_id === cognitoId) setModalUser({ ...modalUser, admin_risk_tag: risk });
      showSuccess("Risk tag updated");
    } catch (e) {
      showError(e instanceof Error ? e.message : "Failed to update risk tag");
    } finally { setRiskUpdating(null); }
  };

  const u = modalUser as Record<string, unknown>;
  const kyc = (u?.kyc as Record<string, unknown>) || {};
  const pan = (kyc.pan as Record<string, unknown>) || {};
  const banks = (kyc.banks as Array<Record<string, unknown>>) || [];
  const business = (u?.business as Record<string, unknown>) || {};
  const address = (u?.address as Record<string, unknown>) || {};
  const proof = (u?.proof as Record<string, unknown>) || {};
  const proofFiles = (proof.files as Array<Record<string, unknown>>) || [];
  const zwitch = (u?.zwitch as Record<string, unknown>) || {};
  const referral = (u?.referral as Record<string, unknown>) || {};

  const filtered = statusFilter === "all" ? items : items.filter((u) => u.account_status === statusFilter);
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const statuses = ["all", "active", "pending_kyc", "pending_proof", "pending_review", "rejected", "deactivated"];

  return (
    <>
      <div className="space-y-4">
        <DashboardSectionTitle as="h2">Users <span className="text-white/40 font-normal text-base">({total})</span></DashboardSectionTitle>

        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or email…"
              className="w-full rounded-xl bg-[#1E1E1E] border border-white/10 pl-9 pr-4 py-2.5 text-body text-white placeholder:text-white/35 focus:outline-none focus:border-white/25" />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {statuses.map((s) => (
              <button key={s} type="button" onClick={() => setStatusFilter(s)}
                className={`rounded-full px-3 py-1.5 text-[13px] capitalize transition ${statusFilter === s ? "bg-white text-black" : "bg-white/10 text-white/60 hover:bg-white/15"}`}>
                {s === "all" ? "All" : s.replace(/_/g, " ")}
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-[#1E1E1E] border border-white/10 overflow-hidden">
          {loading ? <div className="p-4"><ListRowsSkeleton rows={8} /></div>
            : filtered.length === 0 ? <div className="p-8 text-center text-body text-white/50">No users found.</div>
            : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-caption">
                  <thead className="bg-black/30 text-white/50 uppercase tracking-wide">
                    <tr>
                      <th className="px-4 py-3 font-medium">Name</th>
                      <th className="px-4 py-3 font-medium">Email</th>
                      <th className="px-4 py-3 font-medium">Phone</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Risk</th>
                      <th className="px-4 py-3 font-medium">Sub Account</th>
                      <th className="px-4 py-3 font-medium">Signup</th>
                      <th className="px-4 py-3 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {filtered.map((user) => (
                      <tr key={user.cognito_id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white font-medium whitespace-nowrap">{user.full_name || "—"}</td>
                        <td className="px-4 py-3 text-white/70 max-w-[200px] truncate">{user.email}</td>
                        <td className="px-4 py-3 text-white/60 whitespace-nowrap">{user.phone || "—"}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-caption ${STATUS_COLORS[user.account_status] || "bg-white/10 text-white/50"}`}>
                            {user.account_status?.replace(/_/g, " ") || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select value={user.admin_risk_tag || ""} disabled={riskUpdating === user.cognito_id}
                            onChange={(e) => setRisk(user.cognito_id, (e.target.value || null) as RiskLevel)}
                            className={`rounded-lg border px-2 py-1 text-caption bg-transparent focus:outline-none cursor-pointer disabled:opacity-50 ${user.admin_risk_tag ? RISK_COLORS[user.admin_risk_tag] : "border-white/15 text-white/40"}`}>
                            <option value="">No tag</option>
                            <option value="low">Low</option>
                            <option value="medium">Medium</option>
                            <option value="high">High</option>
                          </select>
                        </td>
                        <td className="px-4 py-3 font-mono text-caption text-emerald-400/80 whitespace-nowrap">
                          {(user.zwitch as Record<string, unknown>)?.sub_account_id as string || user.sub_account_id || "—"}
                        </td>
                        <td className="px-4 py-3 text-white/50 whitespace-nowrap">{fmtDate(user.createdAt)}</td>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => openModal(user.cognito_id)}
                            className="rounded-full bg-white/10 hover:bg-white/15 px-3 py-1 text-caption text-white/80 transition whitespace-nowrap">
                            View more
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>

        <div className="flex items-center gap-3 text-caption text-white/50">
          <span>Page {page} of {totalPages} · {total} users</span>
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10 disabled:opacity-30">Previous</button>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-full border border-white/15 px-3 py-1 hover:bg-white/10 disabled:opacity-30">Next</button>
        </div>
      </div>

      {/* Modal */}
      {(modalUser !== null || modalLoading) && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-start justify-center p-4 overflow-hidden">
          <div className="w-full max-w-[96vw] h-[92vh] rounded-2xl bg-[#1A1A1A] border border-white/10 flex flex-col overflow-hidden mt-6">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                {modalUser?.profile_image && (
                  <img src={String(modalUser.profile_image)} alt="" className="w-9 h-9 rounded-full object-cover border border-white/10" />
                )}
                <div>
                  <p className="text-body font-semibold text-white">{str(modalUser?.full_name)}</p>
                  <p className="text-caption text-white/50">{str(modalUser?.email)}</p>
                </div>
                {modalUser?.admin_risk_tag && (
                  <span className={`px-2 py-0.5 rounded-full text-caption border capitalize ${RISK_COLORS[String(modalUser.admin_risk_tag)]}`}>
                    {String(modalUser.admin_risk_tag)} risk
                  </span>
                )}
              </div>
              <button type="button" onClick={closeModal} className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/15 flex items-center justify-center">
                <X className="w-4 h-4 text-white" />
              </button>
            </div>

            {modalLoading ? <div className="p-6"><ListRowsSkeleton rows={8} /></div> : modalUser && (
              <div className="flex flex-1 overflow-hidden">

                {/* Left — scrollable */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* Risk tag */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-caption text-white/40 uppercase tracking-wide mr-1">Risk</span>
                    {(["low", "medium", "high"] as const).map((r) => (
                      <button key={r} type="button"
                        onClick={() => setRisk(modalUser.cognito_id as string, modalUser.admin_risk_tag === r ? null : r)}
                        disabled={riskUpdating === (modalUser.cognito_id as string)}
                        className={`rounded-full border px-3 py-1 text-[13px] capitalize transition disabled:opacity-50 ${modalUser.admin_risk_tag === r ? RISK_COLORS[r] : "border-white/15 text-white/40 hover:border-white/30"}`}>
                        {r}
                      </button>
                    ))}
                  </div>

                  {/* Personal */}
                  <Section title="Personal">
                    <Row label="Cognito ID" value={str(u.cognito_id)} mono />
                    <Row label="Full name" value={str(u.full_name)} />
                    <Row label="Email" value={str(u.email)} />
                    <Row label="Phone" value={str(u.phone)} />
                    <Row label="Display ID" value={str(u.display_id)} />
                    <Row label="Signup date" value={fmt(u.createdAt)} />
                    <Row label="First payment" value={fmt(u.first_payment_at)} />
                    <Row label="Approved date" value={fmt(u.approved_at)} />
                    <Row label="Approved by" value={str(u.approved_by)} />
                    <Row label="Last updated" value={fmt(u.updatedAt)} />
                  </Section>

                  {/* Address */}
                  {(address.line1 || address.city) && (
                    <Section title="Address">
                      <Row label="Line 1" value={str(address.line1)} />
                      <Row label="City" value={str(address.city)} />
                      <Row label="Postal" value={str(address.postal)} />
                      <Row label="State" value={str(address.state_code)} />
                      <Row label="Country" value={str(address.country)} />
                    </Section>
                  )}

                  {/* Account & KYC Status */}
                  <Section title="Account">
                    <Row label="Account status" value={str(u.account_status)} />
                    <Row label="KYC status" value={str(u.kyc_status)} />
                    <Row label="Phone verified" value={str(u.phone_verified)} />
                  </Section>

                  {/* PAN */}
                  <Section title="PAN Verification">
                    <Row label="Verified" value={str(pan.verified)} />
                    <Row label="PAN number" value={str(pan.number)} />
                    <Row label="Name on PAN" value={str(pan.name)} />
                    <Row label="Date of birth" value={str(pan.dob)} />
                    <Row label="Verification ID" value={str(pan.verification_id)} mono />
                  </Section>

                  {/* Bank accounts */}
                  {banks.length > 0 && (
                    <Section title={`Bank Account${banks.length > 1 ? "s" : ""}`}>
                      {banks.map((bank, i) => (
                        <div key={i} className={i > 0 ? "border-t border-white/10 pt-1" : ""}>
                          <Row label="Account no." value={str(bank.account_number || `****${bank.account_last4}`)} />
                          <Row label="IFSC" value={str(bank.ifsc)} mono />
                          <Row label="Verified" value={str(bank.verified)} />
                          <Row label="Active" value={str(bank.account_active)} />
                          <Row label="Default" value={str(bank.account_default)} />
                          <Row label="Verification ID" value={str(bank.verification_id)} mono />
                        </div>
                      ))}
                    </Section>
                  )}

                  {/* Business */}
                  {(business.brand_name || business.email) && (
                    <Section title="Business Profile">
                      <Row label="Brand name" value={str(business.brand_name)} />
                      <Row label="Business email" value={str(business.email)} />
                      <Row label="Business phone" value={str(business.phone)} />
                      <Row label="Email verified" value={str(business.email_verified)} />
                      <Row label="Phone verified" value={str(business.phone_verified)} />
                      {(business.address as Record<string,unknown>)?.line1 && (
                        <Row label="Business address" value={[
                          (business.address as Record<string,unknown>).line1,
                          (business.address as Record<string,unknown>).city,
                          (business.address as Record<string,unknown>).postal,
                          (business.address as Record<string,unknown>).country,
                        ].filter(Boolean).join(", ")} />
                      )}
                      {(business.social_profiles as Array<Record<string,unknown>>)?.[0]?.website && (
                        <Row label="Website" value={str((business.social_profiles as Array<Record<string,unknown>>)[0].website)} />
                      )}
                      {business.about && (
                        <div className="px-4 py-2">
                          <span className="text-caption text-white/40 w-32 inline-block align-top">About</span>
                          <span className="text-caption text-white/70 inline-block max-w-xs break-words">{str(business.about).substring(0,200)}{String(business.about || "").length > 200 ? "…" : ""}</span>
                        </div>
                      )}
                      {business.logo && <Row label="Logo (S3 key)" value={str(business.logo)} mono />}
                      {(business.experience_projects as Array<Record<string,unknown>>)?.length > 0 && (
                        <div className="px-4 py-2 space-y-1">
                          <span className="text-caption text-white/40">Experience projects</span>
                          {(business.experience_projects as Array<Record<string,unknown>>).map((p, i) => (
                            <div key={i} className="ml-4 text-caption text-white/70">
                              <span className="text-white/80 font-medium">{str(p.project_name)}</span>
                              {" · "}{str(p.domain)}{" · "}<span className="text-white/50">{str(p.description).substring(0,80)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Section>
                  )}

                  {/* Proof documents */}
                  <Section title="Freelancer Proof">
                    <Row label="Option" value={str(proof.option)} />
                    <Row label="Status" value={str(proof.status)} />
                    <Row label="Submitted" value={fmt(proof.submitted_at)} />
                    <Row label="Locked" value={str(proof.locked)} />
                    {str(proof.rejection_reason) !== "—" && <Row label="Rejection reason" value={str(proof.rejection_reason)} />}
                    {str(proof.notes) !== "—" && <Row label="Notes" value={str(proof.notes)} />}
                    {proofFiles.length > 0 && (
                      <div className="px-4 py-2.5">
                        <span className="text-caption text-white/45 w-36 inline-block">Files</span>
                        <div className="inline-flex flex-col gap-1 mt-1">
                          {proofFiles.map((f, i) => (
                            f.view_url ? (
                              <a key={i} href={String(f.view_url)} target="_blank" rel="noopener noreferrer"
                                className="text-caption text-emerald-400 hover:underline">
                                {str(f.original_name || f.kind)}
                              </a>
                            ) : (
                              <span key={i} className="text-caption text-white/50">{str(f.original_name || f.kind)}</span>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </Section>

                  {/* KYC Upload Documents */}
                  <Section title="KYC Documents (ID Verification)">
                    {!kycDocs || !kycDocs.submitted ? (
                      <div className="px-4 py-3 text-caption text-white/40">No documents uploaded yet via KYC link.</div>
                    ) : (
                      <>
                        <Row label="Submitted" value={fmt(kycDocs.submitted_at)} />
                        <div className="px-4 py-3 grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <p className="text-caption text-white/45">PAN Card</p>
                            {kycDocs.pan_card_url ? (
                              <a href={kycDocs.pan_card_url} target="_blank" rel="noopener noreferrer"
                                className="block rounded-xl overflow-hidden border border-white/10 hover:border-white/25 transition">
                                {/\.(jpe?g|png|heic|webp)/i.test(kycDocs.pan_card_url) ? (
                                  <img src={kycDocs.pan_card_url} alt="PAN Card" className="w-full h-28 object-cover" />
                                ) : (
                                  <div className="w-full h-28 bg-white/5 flex items-center justify-center text-caption text-emerald-400">View PDF ↗</div>
                                )}
                              </a>
                            ) : <div className="w-full h-28 rounded-xl bg-white/5 flex items-center justify-center text-caption text-white/30">Not uploaded</div>}
                          </div>
                          <div className="space-y-1.5">
                            <p className="text-caption text-white/45">Aadhaar Front</p>
                            {kycDocs.aadhaar_front_url ? (
                              <a href={kycDocs.aadhaar_front_url} target="_blank" rel="noopener noreferrer"
                                className="block rounded-xl overflow-hidden border border-white/10 hover:border-white/25 transition">
                                {/\.(jpe?g|png|heic|webp)/i.test(kycDocs.aadhaar_front_url) ? (
                                  <img src={kycDocs.aadhaar_front_url} alt="Aadhaar" className="w-full h-28 object-cover" />
                                ) : (
                                  <div className="w-full h-28 bg-white/5 flex items-center justify-center text-caption text-emerald-400">View PDF ↗</div>
                                )}
                              </a>
                            ) : <div className="w-full h-28 rounded-xl bg-white/5 flex items-center justify-center text-caption text-white/30">Not uploaded</div>}
                          </div>
                        </div>
                      </>
                    )}
                  </Section>

                  {/* Payment infrastructure */}
                  <Section title="Payment Infrastructure">
                    <Row label="Sub Account ID" value={str(zwitch.sub_account_id)} mono />
                    <Row label="Setup status" value={str(zwitch.setup_status)} />
                    {str(zwitch.setup_last_error) !== "—" && <Row label="Last error" value={str(zwitch.setup_last_error)} />}
                  </Section>

                  {/* Referral */}
                  <Section title="Referral">
                    <Row label="Referral code" value={str(referral.code)} mono />
                    <Row label="Referred by" value={str(referral.referred_by)} />
                    <Row label="Earnings" value={referral.earnings ? `₹${Number(referral.earnings).toLocaleString("en-IN")}` : "₹0"} />
                    <Row label="Rewards paid" value={str(referral.rewards_paid_count)} />
                  </Section>

                  {/* Raw JSON collapsible */}
                  <div className="rounded-xl border border-white/8 overflow-hidden">
                    <button type="button" onClick={() => setRawExpanded((e) => !e)}
                      className="w-full flex items-center justify-between px-4 py-3 text-caption text-white/40 hover:text-white/60 transition">
                      <span className="uppercase tracking-wide font-medium">Raw document</span>
                      {rawExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                    {rawExpanded && (
                      <pre className="text-caption text-white/60 bg-black/30 px-4 pb-4 overflow-x-auto whitespace-pre-wrap break-all max-h-96">
                        {JSON.stringify(modalUser, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>

                {/* Right — fixed notes */}
                <div className="w-80 shrink-0 border-l border-white/10 flex flex-col overflow-hidden">
                  {/* Quick info */}
                  <div className="px-4 py-3 border-b border-white/10 space-y-1.5 shrink-0">
                    <p className="text-[12px] text-white/40 uppercase tracking-wide font-medium">Quick Info</p>
                    <p className="text-[13px] text-white/50">Signup <span className="text-white/70">{fmtDate(modalUser.createdAt)}</span></p>
                    <p className="text-[13px] text-white/50">Status <span className="text-white/70">{str(modalUser.account_status).replace(/_/g," ")}</span></p>
                    <p className="text-[13px] text-white/50">Risk{" "}
                      <span className={`font-medium capitalize ${modalUser.admin_risk_tag ? RISK_COLORS[String(modalUser.admin_risk_tag)].split(" ")[1] : "text-white/40"}`}>
                        {str(modalUser.admin_risk_tag)}
                      </span>
                    </p>
                    <p className="text-[13px] text-white/50">Sub Acc <span className="font-mono text-emerald-400/70 text-[12px]">{str(zwitch.sub_account_id)}</span></p>
                  </div>

                  {/* Notes */}
                  <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 pt-3 pb-1 shrink-0">
                      <p className="text-[12px] text-white/40 uppercase tracking-wide font-medium">Admin Notes</p>
                      <p className="text-[11px] text-white/25 mt-0.5">Internal only — not visible to user</p>
                    </div>

                    {/* Notes list */}
                    <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2">
                      {notesList.length === 0 && <p className="text-[13px] text-white/25 py-4">No notes yet</p>}
                      {notesList.map((note, i) => (
                        <div key={i} className="rounded-lg bg-[#111] border border-white/8 p-2.5 ">
                          <p className="text-[13px] text-white/80 leading-relaxed">{note.text}</p>
                          <div className="flex items-center justify-between mt-1.5">
                            <p className="text-[11px] text-white/30">
                              {note.author} · {note.created_at ? new Date(note.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : ""}
                            </p>

                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Add note */}
                    <div className="px-4 py-3 border-t border-white/10 shrink-0 space-y-2">
                      <textarea value={newNote} onChange={(e) => setNewNote(e.target.value)} rows={2}
                        placeholder="Add a note…"
                        className="w-full rounded-lg bg-[#111] border border-white/10 px-3 py-2 text-[13px] text-white placeholder:text-white/25 focus:outline-none focus:border-white/20 resize-none" />
                      <button type="button" onClick={addNote} disabled={notesSaving || !newNote.trim()}
                        className="w-full rounded-full bg-white text-black px-4 py-2 text-[13px] font-medium disabled:opacity-40">
                        {notesSaving ? "Adding…" : "Add note"}
                      </button>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-caption text-white/35 uppercase tracking-wide font-medium px-1">{title}</p>
      <div className="rounded-xl bg-[#111] border border-white/8 divide-y divide-white/5">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start gap-4 px-4 py-2">
      <span className="text-caption text-white/40 w-32 shrink-0">{label}</span>
      <span className={`text-caption text-white/80 break-all min-w-0 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}
