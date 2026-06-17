import fakeData from "../fake-data.json";
import { fetchAllInrAgainst } from "./exchangeRates";
import { ApiError } from "../lib/apiError";
import { normalizeTransactionStatus } from "../lib/transactionStatus";
import { formatPaymentReceivedAt } from "../lib/formatPaymentReceived";
import { indianStateLabel } from "../lib/indianStates";
import { bankAccountStatus, bankNameFromIfsc } from "../lib/ifscBankName";
import { apiFetch } from "../lib/apiFetch";
import { getAuthTokenAsync } from "./auth";
import { TEST_MODE } from "./testMode";
import { mockApi } from "./mockApi";
import { DEFAULT_LIST_PAGE_SIZE, type CursorPagination } from "../lib/pagination";
import { queryClient } from "../lib/queryClient";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function fetchInvoicePdfBlobRequest(id: string): Promise<Blob> {
  if (TEST_MODE) {
    const text =
      `Zendt test invoice ${id}\n\n` +
      `This is a placeholder PDF generated in test mode.\n` +
      `No backend was contacted.\n`;
    return new Blob([text], { type: "application/pdf" });
  }
  const token = await getAuthTokenAsync();
  const res = await apiFetch(`${API_URL}/invoices/${id}/pdf/download`, {
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error || `Download failed: ${res.status}`);
  }
  return res.blob();
}

/** Experience / portfolio projects under Business (GET /users/me). */
export type ExperienceProjectApi = {
  id: string;
  project_name: string;
  domain: string;
  description: string;
  images: string[];
  /** S3 keys (same order as images) — required for delete image API */
  image_keys: string[];
};

function normalizeExperienceProjects(raw: unknown): ExperienceProjectApi[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = p as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      project_name: String(o.project_name ?? ""),
      domain: String(o.domain ?? ""),
      description: String(o.description ?? ""),
      images: Array.isArray(o.images) ? (o.images as string[]) : [],
      image_keys: Array.isArray(o.image_keys) ? (o.image_keys as string[]) : [],
    };
  });
}

async function apiRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (TEST_MODE) return mockApi<T>(method, path, body);

  const token = await getAuthTokenAsync();
  const headers: Record<string, string> = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const options: RequestInit = { method, headers };

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    options.body = body;
  }

  let res: Response;
  try {
    res = await apiFetch(`${API_URL}${path}`, options);
  } catch (e) {
    if (e instanceof TypeError) {
      throw new ApiError(
        "Cannot reach the Zendt server. Ensure the backend and ngrok tunnel are running on your computer, then try again.",
        { code: "NETWORK_ERROR" }
      );
    }
    throw e;
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const parsed = err as { error?: string; code?: string };
    const msg = parsed.error || `Request failed: ${res.status}`;
    const code = typeof parsed.code === "string" ? parsed.code : undefined;
    throw new ApiError(msg, { code, status: res.status });
  }
  return res.json();
}

async function mutatingRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const result = await apiRequest<T>(method, path, body);
  if (shouldInvalidateUserMeCache(method, path)) {
    invalidateUserMeCache();
  }
  return result;
}

/** In-flight GET dedupe + short TTL cache for GET /users/me (many mappers share one payload). */
const inFlightGet = new Map<string, Promise<unknown>>();
const USER_ME_CACHE_MS = 60_000;
let userMeCached: { expiresAt: number; data: Record<string, unknown> } | null = null;

/** Clear after profile mutations so the next read reflects server state. */
export function invalidateUserMeCache(): void {
  userMeCached = null;
  inFlightGet.delete("/users/me");
  void queryClient.invalidateQueries({ queryKey: ["profileSettings"] });
  void queryClient.invalidateQueries({ queryKey: ["invoiceBillFrom"] });
  void queryClient.invalidateQueries({ queryKey: ["bankAccounts"] });
}

function shouldInvalidateUserMeCache(method: string, path: string): boolean {
  if (method === "GET") return false;
  return path === "/users/me" || path.startsWith("/users/me/");
}

async function fetchUserMeRaw(): Promise<Record<string, unknown>> {
  const now = Date.now();
  if (userMeCached && now < userMeCached.expiresAt) {
    return userMeCached.data;
  }

  const existing = inFlightGet.get("/users/me");
  if (existing) return existing as Promise<Record<string, unknown>>;

  const pending = apiRequest<Record<string, unknown>>("GET", "/users/me")
    .then((data) => {
      userMeCached = { expiresAt: Date.now() + USER_ME_CACHE_MS, data };
      return data;
    })
    .finally(() => {
      if (inFlightGet.get("/users/me") === pending) inFlightGet.delete("/users/me");
    });
  inFlightGet.set("/users/me", pending);
  return pending;
}

function get<T>(path: string): Promise<T> {
  if (path === "/users/me") {
    return fetchUserMeRaw() as Promise<T>;
  }
  return apiRequest<T>("GET", path);
}

function post<T>(path: string, body?: unknown) {
  return mutatingRequest<T>("POST", path, body);
}
function put<T>(path: string, body?: unknown) {
  return mutatingRequest<T>("PUT", path, body);
}
function patch<T>(path: string, body?: unknown) {
  return mutatingRequest<T>("PATCH", path, body);
}
function del<T>(path: string) {
  return mutatingRequest<T>("DELETE", path);
}

function delWithBody<T>(path: string, body: unknown) {
  return mutatingRequest<T>("DELETE", path, body);
}

export const dataService = {
  // --- Static (no backend needed) ---
  getPricingPlans: () => Promise.resolve(fakeData.plans),
  getFaqs: () => Promise.resolve(fakeData.faqs),
  getTermsParagraphs: () => Promise.resolve(fakeData.termsParagraphs),
  getProfileHubItems: () => Promise.resolve(fakeData.profileHubItems),
  getPaymentSections: () => Promise.resolve(fakeData.paymentSections),
  getCards: () => Promise.resolve(fakeData.cards),

  // --- User profile (GET /users/me) ---
  getBusinessProfile: () =>
    get<Record<string, unknown>>("/users/me").then((u) => ({
      addressFields: [
        { label: "Address line 1", key: "line1" },
        { label: "City / Town", key: "city" },
        { label: "Postal / Zip", key: "postal" },
        { label: "Country", key: "country", type: "country" },
      ],
      initialAddress: (() => {
        const a = {
          line1: "",
          city: "",
          postal: "",
          country: "",
          ...((u.business_address as Record<string, string>) || {}),
        };
        if (!a.country) a.country = "India";
        return a;
      })(),
      brandFields: [
        { label: "Brand name", key: "brandName" },
        { label: "Email", key: "email", verifiable: true, verifyType: "business_email" },
        {
          label: "Mobile Number",
          key: "phone",
          type: "tel",
          verifiable: true,
          verifyType: "business_phone",
        },
        { label: "Website", key: "website" },
      ],
      initialBrandData: {
        brandName: (u.brand_name as string) || "",
        email: (u.business_email as string) || "",
        phone: (u.business_phone as string) || "",
        website: (u.website as string) || "",
      },
      verificationStatus: {
        email: !!u.business_email_verified,
        phone: !!u.business_phone_verified,
      },
      businessLogoUrl: (u.business_logo as string) || "",
      experience_projects: normalizeExperienceProjects(u.experience_projects),
    })),

  getBusinessProfileView: () => get<Record<string, unknown>>("/users/me"),

  getProfileSettings: () =>
    get<Record<string, unknown>>("/users/me").then((u) => ({
      addressFields: [
        { label: "Address line 1", key: "line1" },
        { label: "City / Town", key: "city" },
        { label: "Postal / Zip", key: "postal" },
        { label: "State", key: "state_code", type: "indian_state" },
        { label: "Country", key: "country", type: "country" },
      ],
      initialAddress: (() => {
        const a = {
          line1: "",
          city: "",
          postal: "",
          state_code: "",
          country: "",
          ...((u.address as Record<string, string>) || {}),
        };
        if (!a.country) a.country = "India";
        return a;
      })(),
      brandFields: [
        { label: "Name", key: "name" },
        { label: "Email", key: "email", verifiable: true },
        { label: "Phone", key: "phone", type: "tel", verifiable: true, verifyType: "phone" },
      ],
      initialProfileData: {
        name: (u.full_name as string) || "",
        email: (u.email as string) || "",
        phone: (u.phone as string) || "",
      },
      verificationStatus: {
        email: true,
        phone: !!u.phone_verified,
      },
      customerId: (u.display_id as string) || "",
      hasProfileImage: Boolean((u.profile_image as string) || ""),
      profileImageUrl: (u.profile_image as string) || "",
      // Surface bank state so callers (e.g. Cards teaser) don't need a second /users/me call.
      bankSummary: (() => {
        const banks =
          (u.banks as
            | Array<{ verified?: boolean; account_default?: boolean; account_last4?: string }>
            | undefined) || [];
        const verified = banks.filter((b) => b.verified);
        const defaultBank = verified.find((b) => b.account_default) || verified[0];
        const last4 =
          defaultBank?.account_last4 || (u.bank_verified ? (u.bank_account_last4 as string) : "") || "";
        return {
          bankVerified: !!u.bank_verified,
          bankLast4: last4 && last4.length === 4 ? last4 : "XXXX",
        };
      })(),
    })),

  getInvoiceBillFrom: () =>
    get<Record<string, unknown>>("/users/me").then((u) => {
      const addr = (u.address as Record<string, string>) || {};
      const stateLine = indianStateLabel(addr.state_code || "") || addr.state_code || "";
      const personalAddress = [addr.line1, addr.city, addr.postal, stateLine, addr.country]
        .filter(Boolean)
        .join(", ");

      const bAddr = (u.business_address as Record<string, string>) || {};
      const brandAddress = [bAddr.line1, bAddr.city, bAddr.postal, bAddr.country]
        .filter(Boolean)
        .join(", ");

      return {
        personal: {
          name: (u.full_name as string) || "",
          email: (u.email as string) || "",
          phone: (u.phone as string) || "",
          address: personalAddress,
        },
        brand: {
          name: (u.brand_name as string) || "",
          email: (u.business_email as string) || "",
          phone: (u.phone as string) || "",
          address: brandAddress,
        },
      };
    }),

  getBankAccounts: () =>
    get<{
      bank_account_number?: string;
      bank_account_last4: string;
      bank_ifsc: string;
      bank_verified: boolean;
      bank_account_active?: boolean;
      bank_account_default?: boolean;
      banks?: Array<{
        id: string;
        verified: boolean;
        account_number?: string;
        account_last4: string;
        ifsc: string;
        account_active?: boolean;
        account_default?: boolean;
      }>;
    }>("/users/me").then((u) => {
      const mapRow = (b: {
        id: string;
        verified: boolean;
        account_number?: string;
        account_last4: string;
        ifsc: string;
        account_active?: boolean;
        account_default?: boolean;
      }) => {
        const ifsc = (b.ifsc || "").toUpperCase();
        const last4 = b.account_last4 || "0000";
        const full = (b.account_number || "").replace(/\s/g, "");
        return {
          id: b.id,
          bankName: bankNameFromIfsc(ifsc),
          currency: "INR",
          accountNumber: full || `****${last4}`,
          accountNumberMasked: `****${last4}`,
          status: bankAccountStatus(b.verified, b.account_active),
          isDefault: !!b.account_default,
          flag: "/india.png",
          logo: "/sbi.png",
          ifsc,
        };
      };

      if (u.banks && u.banks.length > 0) {
        return u.banks.map(mapRow);
      }

      const ifsc = (u.bank_ifsc || "").toUpperCase();
      const last4 = u.bank_account_last4 || "0000";
      const full = (u.bank_account_number || "").replace(/\s/g, "");
      return [
        {
          id: "default",
          bankName: bankNameFromIfsc(ifsc),
          currency: "INR",
          accountNumber: full || `****${last4}`,
          accountNumberMasked: `****${last4}`,
          status: bankAccountStatus(!!u.bank_verified, u.bank_account_active),
          isDefault: u.bank_account_default ?? true,
          flag: "/india.png",
          logo: "/sbi.png",
          ifsc,
        },
      ];
    }),
  updateBankAccount: (data: {
    bank_id?: string;
    bank_account_active?: boolean;
    bank_account_default?: boolean;
  }) => put("/users/me/bank-account", data),
  updateProfile: (data: Record<string, unknown>) => put("/users/me", data),

  // --- OTP Verification ---
  sendOtp: (type: string) => post("/users/me/send-otp", { type }),
  verifyOtp: (type: string, code: string) => post("/users/me/verify-otp", { type, code }),

  // --- Settings ---
  getSettingsToggles: () =>
    get<Record<string, boolean>>("/users/me/settings").then((s) => [
      {
        key: "whatsapp_notifications",
        label: "WhatsApp updates",
        description: "Receive payment confirmations and account updates on WhatsApp.",
        value: s.whatsapp_notifications ?? true,
      },
    ]),
  updateSettings: (data: Record<string, boolean>) => put("/users/me/settings", data),

  // --- KYC ---
  getKycStatus: () =>
    get<{
      pan_verified: boolean;
      bank_verified: boolean;
      phone_verified?: boolean;
      phone?: string;
      kyc_status: string;
      account_status: string;
      proof_option?: string;
      proof_status: string;
      proof_locked?: boolean;
      proof_submitted_at?: string | null;
      proof_rejection_reason?: string;
      proof_notes?: string;
      zwitch_setup_status?: string;
      zwitch_sub_account_id?: string;
      zwitch_setup_last_error?: string;
      zwitch_setup_last_error_at?: string | null;
    }>("/kyc/status"),
  getKycSteps: () =>
    dataService.getKycStatus().then((s) => {
      const bankOk = (() => {
        if (!s.bank_verified) return false;
        const st = (s.zwitch_setup_status || "idle").toLowerCase();
        if (st === "failed" || st === "pending") return false;
        return true;
      })();
      const proofDetail = (() => {
        if (!s.pan_verified || !bankOk) {
          return "Complete Step 1 and Step 2 first. Then upload documents for Option A (1 file) or Option B (2 files), and submit for review.";
        }
        const ps = s.proof_status || "none";
        if (ps === "approved") return "Verified";
        if (ps === "submitted") return "Under review — we will notify you when verification completes.";
        if (ps === "rejected") {
          const r = (s.proof_rejection_reason || "").trim();
          return r ? `Rejected — ${r}` : "Rejected — please upload new documents.";
        }
        return "Upload documents for Option A (1 file) or Option B (2 files), then submit for review.";
      })();
      return [
        {
          title: "PAN verification",
          detail: s.pan_verified ? "Verified" : "Verify your PAN number and date of birth.",
        },
        {
          title: "Bank account verification",
          detail: bankOk
            ? "Verified"
            : !s.pan_verified
              ? "Complete PAN verification first — then verify mobile and bank details."
              : "Verify your mobile, account number, and IFSC.",
        },
        { title: "Freelancer proof", detail: proofDetail },
      ];
    }),
  verifyPAN: (pan: string, dob: string) => post("/kyc/pan", { pan, dob }),
  verifyBank: (body: { account_number: string; ifsc: string; phone: string }) => post("/kyc/bank", body),
  uploadProofFile: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return apiRequest<{ key: string; url: string; original_name: string }>("POST", "/kyc/proof/upload", fd);
  },
  submitProof: (body: {
    option: "A" | "B";
    files: Array<{ kind?: string; s3_key: string; original_name?: string }>;
    notes?: string;
  }) => post<{ success: boolean }>("/kyc/proof/submit", body),

  // --- Admin (requires Cognito ZendtAdmins) ---
  getAdminPendingProofs: (page = 1, limit = 20) =>
    get<{
      items: Array<{
        cognito_id: string;
        full_name: string;
        email: string;
        proof_submitted_at: string;
        proof_option: string;
        file_count: number;
      }>;
      pagination: { page: number; limit: number; total: number };
    }>(`/admin/pending-proofs?page=${page}&limit=${limit}`),
  getAdminUser: (cognitoId: string) => get<Record<string, unknown>>(`/admin/users/${cognitoId}`),
  deactivateAdminUser: (cognitoId: string) =>
    post<{ success: boolean }>(`/admin/users/${cognitoId}/deactivate`, {}),
  approveAdminUser: (cognitoId: string) =>
    post<{ success: boolean; provision?: unknown }>(`/admin/users/${cognitoId}/approve`, {}),
  rejectAdminUser: (cognitoId: string, reason: string) =>
    post<{ success: boolean }>(`/admin/users/${cognitoId}/reject`, { reason }),
  generateAdminKycLink: (cognitoId: string) =>
  post<{ success: boolean; link: string; expires: string }>(`/admin/users/${cognitoId}/kyc-link`, {}),
  getAdminKycDocuments: (cognitoId: string) =>
  get<{
    submitted: boolean;
    submitted_at?: string;
    pan_card_url?: string | null;
    aadhaar_front_url?: string | null;
  }>(`/admin/users/${cognitoId}/kyc-documents`),

  setAdminUserRisk: (cognitoId: string, risk: "low" | "medium" | "high" | null) =>
  patch<{ success: boolean; admin_risk_tag: string | null }>(`/admin/users/${cognitoId}/risk`, { risk }),
addAdminUserNote: (cognitoId: string, text: string) =>
  post<{ success: boolean; notes: Array<{ text: string; author: string; created_at: string }> }>(`/admin/users/${cognitoId}/notes`, { text }),
deleteAdminUserNote: (cognitoId: string, index: number) =>
  del<{ success: boolean; notes: Array<{ text: string; author: string; created_at: string }> }>(`/admin/users/${cognitoId}/notes/${index}`),
getAdminSignedUrl: (key: string) =>
  get<{ url: string }>(`/admin/signed-url?key=${encodeURIComponent(key)}`),

  getAdminReferralWithdrawals: (opts?: {
    page?: number;
    limit?: number;
    status?: "pending" | "paid" | "all";
  }) => {
    const page = opts?.page ?? 1;
    const limit = opts?.limit ?? 20;
    const status = opts?.status ?? "pending";
    const params = new URLSearchParams({
      page: String(page),
      limit: String(limit),
      status,
    });
    return get<{
      items: Array<{
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
      }>;
      pagination: { page: number; limit: number; total: number };
    }>(`/admin/referral-withdrawals?${params}`);
  },
  getAdminReferralWithdrawal: (id: string) =>
    get<{
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
    }>(`/admin/referral-withdrawals/${encodeURIComponent(id)}`),
  markReferralWithdrawalPaid: (id: string, adminNotes?: string) =>
    post<{ success: boolean; id: string; status: string; paid_at: string }>(
      `/admin/referral-withdrawals/${encodeURIComponent(id)}/mark-paid`,
      adminNotes ? { admin_notes: adminNotes } : {}
    ),

  completeAdminRegistration: (body: { registration_secret: string; display_name?: string }) =>
    post<{ ok: boolean; already_admin?: boolean }>("/auth/complete-admin-registration", body),

  getAdminMe: () =>
    get<{
      cognito_id: string;
      email: string;
      full_name: string;
      phone: string;
      avatar_url: string;
      avatar_s3_key: string;
    }>("/admin/me"),

  patchAdminMe: (body: { full_name?: string; phone?: string }) =>
    patch<{
      cognito_id: string;
      email: string;
      full_name: string;
      phone: string;
      avatar_url: string;
      avatar_s3_key: string;
    }>("/admin/me", body),

  getAdminAvatarUploadUrl: (content_type: "image/jpeg" | "image/png" | "image/heic" | "image/heif") =>
    post<{ key: string; upload_url: string }>("/admin/me/avatar-upload-url", { content_type }),

  /** Preferred: multipart upload via API (avoids S3 CORS on browser PUT). */
  uploadAdminAvatar: (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    return post<{ ok: boolean; avatar_url: string; avatar_s3_key: string }>(
      "/admin/me/avatar-upload",
      form
    );
  },

  confirmAdminAvatar: (s3_key: string) =>
    post<{ ok: boolean; avatar_url: string; avatar_s3_key: string }>("/admin/me/avatar", { s3_key }),

  getAdminDataSummary: () => get<{ counts: Record<string, number> }>("/admin/data/summary"),

  getAdminDataCollection: (params: {
    collection: string;
    page?: number;
    limit?: number;
    q?: string;
    /** Omit or `__all__` for OR-search across configured fields (+ `_id` when q looks like ObjectId). */
    searchField?: string;
    /** Whitelisted projection path from response `meta.sortFields`. Omit with dir unset for collection default sort. */
    sort?: string;
    dir?: "asc" | "desc";
  }) => {
    const { collection, page = 1, limit = 25, q, searchField, sort, dir } = params;
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (q?.trim()) qs.set("q", q.trim());
    if (searchField && searchField !== "__all__") qs.set("searchField", searchField);
    if (sort?.trim()) {
      qs.set("sort", sort.trim());
      if (dir) qs.set("dir", dir);
    }
    return get<{
      collection: string;
      items: Array<Record<string, unknown>>;
      pagination: { page: number; limit: number; total: number };
      meta?: {
        searchFields: string[];
        sortFields: string[];
        defaultSort: { field: string; dir: "asc" | "desc" };
      };
    }>(`/admin/data/${encodeURIComponent(collection)}?${qs}`);
  },

  /** INR value of **1** unit for every ISO-style code in the open INR/latest feed (`open.er-api.com`, browser CORS‑safe). Not proxied through Zendt API. */
  getExchangeRatesVsInr: () => fetchAllInrAgainst(),

  getTransactionsPage: (opts?: {
    cursor?: string;
    limit?: number;
    status?: "completed";
    refresh?: boolean;
    period?: "all" | "today" | "week" | "month" | "year";
    sort?: "time" | "amount_desc" | "amount_asc";
  }) => {
    const limit = opts?.limit ?? DEFAULT_LIST_PAGE_SIZE;
    const params = new URLSearchParams({ limit: String(limit) });
    if (opts?.cursor) params.set("cursor", opts.cursor);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.refresh) params.set("refresh", "1");
    if (opts?.period && opts.period !== "all") params.set("period", opts.period);
    if (opts?.sort && opts.sort !== "time") params.set("sort", opts.sort);
    return get<{
      transactions: Array<Record<string, unknown>>;
      pagination: CursorPagination;
    }>(`/transactions?${params}`).then((res) => ({
      items: dataService.mapTransactionRows(res.transactions || []),
      pagination: res.pagination,
    }));
  },

  getSpendingSummary: (opts: { year: number; month: number }) => {
    const params = new URLSearchParams({
      year: String(opts.year),
      month: String(opts.month),
    });
    return get<{
      year: number;
      month: number;
      total: number;
      chart_points: Array<{ day: number; amount: number; label: string }>;
      top_spenders: Array<{ name: string; total: number; currency: string }>;
    }>(`/transactions/spending-summary?${params}`);
  },

  getTransactionSummary: (opts?: { period?: "all" | "today" | "week" | "month" | "year" }) => {
    const params = new URLSearchParams();
    if (opts?.period && opts.period !== "all") params.set("period", opts.period);
    return get<{
      period: string;
      total: number;
      currency: string;
      count: number;
    }>(`/transactions/summary?${params}`);
  },

  getLatestTransaction: () =>
    get<{ transaction: Record<string, unknown> | null }>("/transactions/latest").then((res) => {
      const rows = res.transaction ? [res.transaction] : [];
      return dataService.mapTransactionRows(rows)[0] ?? null;
    }),

  /** Latest successful credit from Zwitch webhook (completed pay-in). */
  getLatestCompletedTransaction: () =>
    get<{ transaction: Record<string, unknown> | null }>("/transactions/latest-completed").then((res) => {
      const rows = res.transaction ? [res.transaction] : [];
      return dataService.mapTransactionRows(rows)[0] ?? null;
    }),

  mapTransactionRows(rows: Array<Record<string, unknown>>) {
    return rows.map((t, i) => {
      const createdAt = (t.createdAt as string) || "";
      const updatedAt = (t.updatedAt as string) || "";
      const completedAt = updatedAt || createdAt;
      const statusDate = completedAt
        ? new Date(completedAt).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          })
        : undefined;
      const received = completedAt ? formatPaymentReceivedAt(completedAt) : null;
      const completedAtLabel = received?.combined || undefined;
      const completedDateLine = received?.dateLine || undefined;
      const completedTimeLine = received?.timeLine || undefined;
      return {
        id: (t._id as string) || i + 1,
        name: (t.source as string) || (t.reference as string) || "Transaction",
        reference: String((t.reference as string) || ""),
        amount: (t.amount as number) || 0,
        type: (t.type as string) || "credit",
        currency: (t.currency as string) || "INR",
        status: normalizeTransactionStatus(t.status),
        rawStatus: typeof t.zwitch_status_raw === "string" ? t.zwitch_status_raw : undefined,
        rawDate: createdAt,
        date: createdAt
          ? new Date(createdAt).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })
          : undefined,
        completedAt,
        statusDate,
        completedAtLabel,
        completedDateLine,
        completedTimeLine,
        /** Counterparty avatar when API provides one (optional; P2P / future fields). */
        avatarUrl: [
          t.avatar_url,
          t.avatarUrl,
          t.photo,
          t.avatar,
          t.profile_photo_url,
          t.counterparty_avatar,
        ]
          .find((x): x is string => typeof x === "string" && x.trim().length > 0)
          ?.trim(),
      };
    });
  },

  // --- Clients ---
  mapClientRow: (c: Record<string, unknown>) => ({
    id: (c._id as string) || "",
    name: (c.name as string) || "",
    email: (c.email as string) || "",
    phone: (c.phone as string) || "",
    country: (c.country as string) || "India",
    purpose_code: (c.purpose_code as string) || "",
    address: (c.address as string) || "",
    company: (c.company as string) || "",
    company_website: (c.company_website as string) || "",
  }),

  getClientsPage: (opts?: { cursor?: string; limit?: number; search?: string }) => {
    const limit = opts?.limit ?? DEFAULT_LIST_PAGE_SIZE;
    const params = new URLSearchParams({ limit: String(limit) });
    if (opts?.cursor) params.set("cursor", opts.cursor);
    if (opts?.search?.trim()) params.set("search", opts.search.trim());
    return get<{
      clients: Array<Record<string, unknown>>;
      pagination: CursorPagination;
    }>(`/clients?${params}`).then((res) => ({
      items: (res.clients || []).map((c) => dataService.mapClientRow(c)),
      pagination: res.pagination,
    }));
  },

  addClient: (data: Record<string, unknown>) => post("/clients", data),
  updateClient: (id: string, data: Record<string, unknown>) => put(`/clients/${id}`, data),
  deleteClient: (id: string) => del(`/clients/${id}`),

  // --- Invoices ---
  getInvoicesPage: (opts?: { cursor?: string; limit?: number }) => {
    const limit = opts?.limit ?? DEFAULT_LIST_PAGE_SIZE;
    const params = new URLSearchParams({ limit: String(limit) });
    if (opts?.cursor) params.set("cursor", opts.cursor);
    return get<{
      invoices: Array<Record<string, unknown>>;
      pagination: CursorPagination;
    }>(`/invoices?${params}`).then((res) => ({
      items: res.invoices || [],
      pagination: res.pagination,
    }));
  },

  getInvoice: (id: string) => get(`/invoices/${id}`),
  generateInvoiceNumber: () => get<{ invoice_number: string }>("/invoices/next-number"),
  createInvoice: (data: Record<string, unknown>) => post("/invoices", data),
  cancelInvoice: (id: string) => put(`/invoices/${id}/cancel`),
  /** Signed S3 URL if available; otherwise url is null — use downloadInvoicePdf. */
  getInvoicePdfMeta: (id: string) =>
    get<{ url: string | null; source?: string; downloadPath?: string }>(`/invoices/${id}/pdf`),
  /** Always works: streams generated PDF (auth required). */
  downloadInvoicePdf: async (id: string, filename?: string) => {
    const blob = await fetchInvoicePdfBlobRequest(id);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename || `invoice-${id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },

  // --- Payment Links ---
  mapPaymentLinkRow(l: Record<string, unknown>) {
    const lastWebhook = (l.last_webhook_at as string) || "";
    const createdAt = (l.createdAt as string) || "";
    const createdMs = createdAt ? new Date(createdAt).getTime() : 0;
    const webhookMs = lastWebhook ? new Date(lastWebhook).getTime() : 0;
    const activityMs = Math.max(createdMs, webhookMs);
    const activityAt = activityMs > 0 ? new Date(activityMs).toISOString() : "";
    const statusDate = activityAt
      ? new Date(activityAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
      : undefined;
    return {
      id: l._id != null ? String(l._id) : "",
      displayId: (l.display_id as string) || "",
      referenceId: (l.zwitch_link_id as string) || "",
      zwitchMtx: (l.zwitch_mtx as string) || "",
      amount: (l.amount as number) || 0,
      currency: (l.currency as string) || "INR",
      status: (l.status as string) || "active",
      zwitchPaymentStatus: (l.zwitch_payment_status as string) || "none",
      zwitchStatusRaw: typeof l.zwitch_status_raw === "string" ? l.zwitch_status_raw : undefined,
      description: (l.description as string) || "",
      invoiceNumber: (l.invoice_number as string) || "",
      paymentUrl: (l.payment_url as string) || "",
      createdOn: createdAt ? new Date(createdAt).toISOString().split("T")[0] : "",
      activityAt,
      statusDate,
      customerName: (l.customer_name as string) || "",
      customer: {
        name: (l.customer_name as string) || "",
        email: (l.customer_email as string) || "",
      },
    };
  },

  getPaymentLinksPage: (opts?: {
    cursor?: string;
    limit?: number;
    refresh?: boolean;
    tab?: "all" | "unpaid" | "pending" | "paid" | "failed" | "inactive";
    status?: string;
    sort?: "activity" | "newest" | "oldest" | "amount_desc";
    duration?: string;
    search_link_id?: string;
    search_ref?: string;
    search_contact?: string;
    search_email?: string;
  }) => {
    const limit = opts?.limit ?? DEFAULT_LIST_PAGE_SIZE;
    const params = new URLSearchParams({ limit: String(limit) });
    if (opts?.cursor) params.set("cursor", opts.cursor);
    if (opts?.refresh) params.set("refresh", "1");
    if (opts?.tab && opts.tab !== "all") params.set("tab", opts.tab);
    if (opts?.status) params.set("status", opts.status);
    if (opts?.sort && opts.sort !== "activity") params.set("sort", opts.sort);
    if (opts?.duration) params.set("duration", opts.duration);
    if (opts?.search_link_id) params.set("search_link_id", opts.search_link_id);
    if (opts?.search_ref) params.set("search_ref", opts.search_ref);
    if (opts?.search_contact) params.set("search_contact", opts.search_contact);
    if (opts?.search_email) params.set("search_email", opts.search_email);
    return get<{
      links: Array<Record<string, unknown>>;
      pagination: CursorPagination;
    }>(`/payment-links?${params}`).then((res) => ({
      items: (res.links || []).map((l) => dataService.mapPaymentLinkRow(l)),
      pagination: res.pagination,
    }));
  },

  /** Latest payment-link webhook activity for dashboard status tile. */
  getLatestPaymentLinkActivity: () =>
    get<{ link: Record<string, unknown> | null }>("/payment-links/latest").then((res) => {
      if (!res.link) return null;
      return dataService.mapPaymentLinkRow(res.link);
    }),
  createPaymentLink: (data: Record<string, unknown>) => post("/payment-links", data),
  deletePaymentLink: (id: string) => del(`/payment-links/${id}`),

  // --- Uploads ---
  uploadFile: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return post<{ url: string; key: string }>("/uploads", form);
  },

  // --- Avatar ---
  uploadAvatar: (file: File) => {
    const form = new FormData();
    form.append("avatar", file);
    return post<{ success: boolean; profile_image: string }>("/users/me/avatar", form);
  },
  deleteAvatar: () => del<{ success: boolean; profile_image: string }>("/users/me/avatar"),
  uploadBusinessLogo: (file: File) => {
    const form = new FormData();
    form.append("logo", file);
    return post<{ success: boolean; business_logo: string }>("/users/me/business-logo", form);
  },
  deleteBusinessLogo: () => del<{ success: boolean; business_logo: string }>("/users/me/business-logo"),

  createExperienceProject: (body: { project_name: string; domain: string; description: string }) =>
    post<{
      success: boolean;
      project: {
        id: string;
        project_name: string;
        domain: string;
        description: string;
        image_keys: string[];
      };
    }>("/users/me/experience-projects", body),

  updateExperienceProject: (
    projectId: string,
    body: Partial<{ project_name: string; domain: string; description: string; image_keys: string[] }>
  ) =>
    patch<{ success: boolean; project: Record<string, unknown> }>(
      `/users/me/experience-projects/${encodeURIComponent(projectId)}`,
      body
    ),

  uploadExperienceProjectImage: (projectId: string, file: File) => {
    const form = new FormData();
    form.append("image", file);
    return post<{ success: boolean; key: string; image: string }>(
      `/users/me/experience-projects/${encodeURIComponent(projectId)}/images`,
      form
    );
  },

  deleteExperienceProjectImage: (projectId: string, key: string) =>
    delWithBody<{ success: boolean }>(
      `/users/me/experience-projects/${encodeURIComponent(projectId)}/images`,
      { key }
    ),

  deleteExperienceProject: (projectId: string) =>
    del<{ success: boolean }>(`/users/me/experience-projects/${encodeURIComponent(projectId)}`),

  getProfileImage: () =>
    get<Record<string, unknown>>("/users/me").then((u) => (u.profile_image as string) || ""),

  // --- Referral ---
  getReferralCode: () => get<{ code: string }>("/referral/code").then((r) => r.code),
  getReferralStats: (opts?: { cursor?: string; limit?: number }) => {
    const limit = opts?.limit ?? 20;
    const params = new URLSearchParams({ limit: String(limit) });
    if (opts?.cursor) params.set("cursor", opts.cursor);
    return get<{
      code: string;
      total_referrals: number;
      completed_referrals: number;
      total_earnings: number;
      available_earnings: number;
      pending_withdrawal: {
        id: string;
        amount: number;
        upi_id: string;
        created_at: string;
      } | null;
      withdrawals: Array<{
        id: string;
        amount: number;
        upi_id: string;
        status: string;
        created_at: string;
        paid_at: string | null;
      }>;
      reward_per_referral: number;
      referrals: Array<{ name: string; email: string; status: string; reward: number; date: string }>;
      pagination: CursorPagination;
    }>(`/referral/stats?${params}`);
  },
  requestReferralWithdraw: (body: { upi_id: string }) =>
    post<{ success: boolean; withdrawal_id: string; amount: number; status: string }>(
      "/referral/withdraw",
      body
    ),
  applyReferralCode: (code: string) => post<{ message: string }>("/referral/apply", { code }),

  // --- Signup ---
  /** Public signup — true when Cognito is confirmed and a MongoDB profile already exists. */
  precheckSignupEmail: (email: string) =>
    post<{ available: boolean; registered?: boolean }>("/auth/precheck-signup-email", {
      email: email.trim(),
    }),

  /** @deprecated Prefer signupComplete after Cognito confirm + login; kept for legacy callers. */
  registerSignupPassword: (email: string, password: string) =>
    post<{ success: boolean }>("/auth/register-signup-password", {
      email: email.trim(),
      password,
    }),

  signupComplete: (password?: string) =>
    post<{ success: boolean }>(
      "/users/signup-complete",
      password?.trim() ? { password: password.trim() } : undefined
    ),

  /** After email/password login — enables one-click Google/Apple without re-entering password. */
  storeSocialAuthPassword: (password: string) =>
    post<{ success: boolean }>("/users/me/social-auth-password", { password }),

  /**
   * One-shot fetch for the Cards-coming-soon experience.
   *
   * - `holder` : full name from profile (falls back to "Your name")
   * - `last4`  : last 4 digits of the verified bank account, "XXXX" until KYC bank step is done
   * - `bankVerified` : true once the user has a verified bank account
   * - `alreadyOptedIn` : true if the user has already tapped "Notify me"
   */
  getCardLaunchInfo: () =>
    get<{
      full_name?: string;
      bank_verified?: boolean;
      bank_account_last4?: string;
      banks?: Array<{ verified?: boolean; account_default?: boolean; account_last4?: string }>;
      interests?: { cards_launch_notify?: boolean };
    }>("/users/me").then((u) => {
      const verifiedBanks = (u.banks || []).filter((b) => b.verified);
      const defaultBank = verifiedBanks.find((b) => b.account_default) || verifiedBanks[0];
      const last4 =
        (defaultBank && defaultBank.account_last4) || (u.bank_verified ? u.bank_account_last4 : "") || "";

      return {
        holder: u.full_name || "",
        last4: last4 && last4.length === 4 ? last4 : "XXXX",
        bankVerified: !!u.bank_verified,
        alreadyOptedIn: !!u.interests?.cards_launch_notify,
      };
    }),
  optInCardsLaunch: () =>
    post<{ success: boolean; alreadyOptedIn: boolean }>("/users/me/interests/cards-launch"),
};
