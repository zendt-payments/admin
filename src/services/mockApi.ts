/**
 * In-memory backend mock for VITE_TEST_MODE builds.
 *
 * Routes are matched on method + path (the same paths dataService.ts requests).
 * Mutations update module-local state so the UI feels alive within a session.
 * Reload resets everything — that's intentional for QA builds.
 */

import fakeData from "../fake-data.json";
import {
  TEST_EMAIL,
  setTestSession,
  TEST_AUTH_ID_TOKEN,
  TEST_AUTH_ACCESS_TOKEN,
  TEST_AUTH_REFRESH_TOKEN,
} from "./testMode";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

/** Default 0; set VITE_MOCK_LATENCY_MS (e.g. 120) for artificial network-style delay in test builds. */
function mockLatencyMs(): number {
  const raw = import.meta.env.VITE_MOCK_LATENCY_MS;
  if (raw !== undefined && String(raw).trim() !== "") {
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.min(n, 60_000) : 0;
  }
  return 0;
}

const FAKE_LATENCY_MS = mockLatencyMs();

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function genId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function parseMockCursor(cursor: string | null) {
  const s = String(cursor || "").trim();
  if (!s) return null;
  const pipe = s.lastIndexOf("|");
  if (pipe <= 0) return null;
  const at = new Date(s.slice(0, pipe));
  const id = s.slice(pipe + 1);
  if (Number.isNaN(at.getTime()) || !id) return null;
  return { at, id };
}

function paginateMockList<T extends Record<string, unknown>>(
  list: T[],
  query: URLSearchParams,
  dateField: "createdAt" | "updatedAt" = "createdAt"
) {
  const limit = Math.min(50, Math.max(1, parseInt(query.get("limit") || "20", 10) || 20));
  const parsed = parseMockCursor(query.get("cursor"));
  let sorted = [...list].sort((a, b) => {
    const at = new Date(String(a[dateField] || a.createdAt || 0)).getTime();
    const bt = new Date(String(b[dateField] || b.createdAt || 0)).getTime();
    if (bt !== at) return bt - at;
    return String(b._id).localeCompare(String(a._id));
  });
  if (parsed) {
    sorted = sorted.filter((row) => {
      const t = new Date(String(row[dateField] || row.createdAt || 0)).getTime();
      const id = String(row._id);
      if (t < parsed.at.getTime()) return true;
      if (t === parsed.at.getTime() && id < parsed.id) return true;
      return false;
    });
  }
  const hasMore = sorted.length > limit;
  const slice = sorted.slice(0, limit);
  const last = slice[slice.length - 1];
  const nextCursor =
    hasMore && last
      ? `${new Date(String(last[dateField] || last.createdAt || 0)).toISOString()}|${last._id}`
      : null;
  return { items: slice, pagination: { limit, hasMore, nextCursor } };
}

/** Static fallback when no real file can be extracted (e.g. server-side render). */
const PLACEHOLDER_IMG = "/avatar-placeholder.svg";

/**
 * Test-mode upload echo: when the caller posts a real `File` via FormData
 * (avatar / business logo / experience-project image / generic upload), we
 * hand back a blob URL so the UI actually shows the user's own picture
 * instead of a generic placeholder. Falls back to the static SVG when no
 * file is present (defensive — e.g. in non-DOM envs).
 *
 * NOTE: blob URLs leak memory until revoked. Setters that replace an
 * existing blob URL must call `revokeIfBlob(prev)` first.
 */
function blobUrlFromFormData(body: unknown, fieldName: string): string {
  if (typeof FormData !== "undefined" && body instanceof FormData) {
    const f = body.get(fieldName);
    if (f instanceof File && typeof URL !== "undefined" && URL.createObjectURL) {
      try {
        return URL.createObjectURL(f);
      } catch {
        // Some headless / SSR environments lack URL.createObjectURL — fall through.
      }
    }
  }
  return PLACEHOLDER_IMG;
}

function revokeIfBlob(url: unknown): void {
  if (
    typeof url === "string" &&
    url.startsWith("blob:") &&
    typeof URL !== "undefined" &&
    URL.revokeObjectURL
  ) {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore — best-effort cleanup
    }
  }
}

// --- Seed user (returned by GET /users/me) ---
const me: Record<string, unknown> = {
  cognito_id: "test-user-1",
  full_name: "Arjun Sharma",
  email: "test@zendt.app",
  phone: "+919876543210",
  phone_verified: true,
  profile_image: "",
  address: {
    line1: "12, Gandhi Nagar",
    city: "New Delhi",
    postal: "110001",
    state_code: "DL",
    country: "India",
  },
  brand_name: "Zendt Test Studio",
  business_email: "hello@zendt-test.app",
  business_email_verified: true,
  business_phone: "+91 98765 43210",
  business_phone_verified: true,
  website: "zendt-test.app",
  business_logo: "",
  business_address: {
    line1: "12, Gandhi Nagar",
    city: "New Delhi",
    postal: "110001",
    country: "India",
  },
  experience_projects: [],
  banks: [
    {
      id: "bank-default",
      verified: true,
      account_number: "0918299474321",
      account_last4: "4321",
      ifsc: "SBIN0001234",
      account_active: true,
      account_default: true,
    },
  ],
  bank_account_number: "0918299474321",
  bank_account_last4: "4321",
  bank_ifsc: "SBIN0001234",
  bank_verified: true,
  bank_account_active: true,
  bank_account_default: true,
  interests: {
    cards_launch_notify: false,
    cards_launch_notify_at: null as string | null,
  },
};

// --- KYC (fully approved — returning user, first payment already completed) ---
const kycStatus = {
  pan_verified: true,
  bank_verified: true,
  phone_verified: true,
  phone: "+919876543210",
  kyc_status: "approved",
  account_status: "active",
  proof_option: "A",
  proof_status: "approved",
  proof_locked: true,
  proof_submitted_at: "2025-01-10T10:00:00.000Z",
  proof_rejection_reason: "",
  proof_notes: "",
  zwitch_setup_status: "succeeded",
  zwitch_sub_account_id: "test-sub-account",
  zwitch_setup_last_error: "",
  zwitch_setup_last_error_at: null,
};

// --- Settings ---
let settings: Record<string, boolean> = {
  whatsapp_notifications: true,
};

// --- Transactions (raw shape that dataService.getTransactions normalizes) ---
type RawTransaction = {
  _id: string;
  source: string;
  reference: string;
  amount: number;
  type: "credit" | "debit";
  currency: string;
  status?: "pending" | "completed" | "failed";
  zwitch_status_raw?: string;
  createdAt: string;
  updatedAt?: string;
};

const firstLinkCreatedAt = new Date(Date.now() - 16 * 24 * 3600 * 1000).toISOString();
const firstPaymentAt = new Date(Date.now() - 14 * 24 * 3600 * 1000).toISOString();

/** One completed credit from the user's first payment link. */
const transactions: RawTransaction[] = [
  {
    _id: "txn-1",
    source: "Ananya Rao",
    reference: "REF-1001",
    amount: 450,
    type: "credit",
    currency: "USD",
    status: "completed",
    zwitch_status_raw: "captured",
    createdAt: firstPaymentAt,
    updatedAt: firstPaymentAt,
  },
];

// --- Clients ---
type RawClient = {
  _id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  country: string;
  purpose_code: string;
  company: string;
  company_website: string;
};

const seedClients = (
  fakeData as {
    invoiceClients: Array<{ id: number; name: string; email: string; phone: string; address: string }>;
  }
).invoiceClients;

const clients: RawClient[] = seedClients.map((c) => ({
  _id: `client-${c.id}`,
  name: c.name,
  email: c.email,
  phone: c.phone,
  address: c.address,
  country: "United States",
  purpose_code: "Consulting",
  company: c.name,
  company_website: "",
}));

// --- Invoices ---
type RawInvoice = {
  _id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  currency: string;
  total: number;
  status: string;
  payment_mode: string;
  payment_link?: string;
  invoice_pdf_url: string;
  createdAt: string;
};

const invoices: RawInvoice[] = [
  {
    _id: "inv-1",
    invoice_number: "INV-0001",
    client_name: "Ananya Rao",
    client_email: "ananya@example.com",
    currency: "USD",
    total: 450,
    status: "paid",
    payment_mode: "online",
    payment_link: "https://example.test/pay/REF-1001",
    invoice_pdf_url: "",
    createdAt: firstLinkCreatedAt,
  },
];

let invoiceCounter = 1;

// --- Payment links (raw shape that dataService normalizes) ---
type RawPaymentLink = {
  _id: string;
  zwitch_link_id: string;
  zwitch_mtx?: string;
  zwitch_payment_status?: string;
  zwitch_status_raw?: string;
  last_webhook_at?: string;
  description?: string;
  amount: number;
  currency: string;
  status: string;
  payment_url: string;
  customer_name: string;
  customer_email: string;
  createdAt: string;
};

const paymentLinks: RawPaymentLink[] = [
  {
    _id: "PLNK-1001",
    zwitch_link_id: "REF-1001",
    zwitch_mtx: "pl_mock_PLNK-1001",
    zwitch_payment_status: "completed",
    zwitch_status_raw: "captured",
    last_webhook_at: firstPaymentAt,
    description: "Website design — Ananya Rao",
    amount: 450,
    currency: "USD",
    status: "paid",
    payment_url: "http://localhost:5173/pay?payment_token=REF-1001",
    customer_name: "Ananya Rao",
    customer_email: "ananya@example.com",
    createdAt: firstLinkCreatedAt,
  },
];

function sortMockPaymentLinks(list: RawPaymentLink[]) {
  return [...list].sort((a, b) => {
    const aw = a.last_webhook_at ? new Date(a.last_webhook_at).getTime() : 0;
    const bw = b.last_webhook_at ? new Date(b.last_webhook_at).getTime() : 0;
    if (bw !== aw) return bw - aw;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

function filterMockPaymentLinks(list: RawPaymentLink[], query: URLSearchParams): RawPaymentLink[] {
  let result = [...list];
  const tab = String(query.get("tab") || "").toLowerCase();
  if (tab === "unpaid") {
    result = result.filter(
      (l) => l.status === "active" && (!l.zwitch_payment_status || l.zwitch_payment_status === "none")
    );
  } else if (tab === "pending") {
    result = result.filter((l) => l.zwitch_payment_status === "pending");
  } else if (tab === "paid") {
    result = result.filter((l) => l.status === "paid" || l.zwitch_payment_status === "completed");
  } else if (tab === "failed") {
    result = result.filter((l) => l.zwitch_payment_status === "failed");
  } else if (tab === "inactive") {
    result = result.filter((l) => l.status === "cancelled" || l.status === "expired");
  }

  const statusQ = String(query.get("status") || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (statusQ.length > 0) {
    result = result.filter((l) => statusQ.includes(String(l.status).toLowerCase()));
  }

  const dur = String(query.get("duration") || query.get("dur") || "");
  if (dur && dur !== "All time") {
    const today = new Date();
    let cutoff: Date | null = null;
    if (dur === "This month") cutoff = new Date(today.getFullYear(), today.getMonth(), 1);
    else if (dur === "This year") cutoff = new Date(today.getFullYear(), 0, 1);
    else if (dur === "Past 1 year") {
      cutoff = new Date(today);
      cutoff.setFullYear(today.getFullYear() - 1);
    } else {
      const daysMap: Record<string, number> = { "Past 7 days": 7, "Past 30 days": 30, "Past 90 days": 90 };
      const days = daysMap[dur];
      if (days) {
        cutoff = new Date(today);
        cutoff.setDate(today.getDate() - days);
      }
    }
    if (cutoff) {
      result = result.filter((l) => new Date(l.createdAt) >= cutoff);
    }
  }

  const linkId = String(query.get("search_link_id") || query.get("link_id") || "").trim();
  if (linkId) result = result.filter((l) => String(l._id).includes(linkId));

  const ref = String(query.get("search_ref") || query.get("ref_id") || "").trim();
  if (ref) {
    const q = ref.toLowerCase();
    result = result.filter(
      (l) =>
        String(l.zwitch_link_id || "")
          .toLowerCase()
          .includes(q) ||
        String(l.zwitch_mtx || "")
          .toLowerCase()
          .includes(q) ||
        String(l.description || "")
          .toLowerCase()
          .includes(q)
    );
  }

  const contact = String(query.get("search_contact") || query.get("contact") || "").trim();
  if (contact) {
    const q = contact.toLowerCase();
    result = result.filter((l) =>
      String(l.customer_name || "")
        .toLowerCase()
        .includes(q)
    );
  }

  const email = String(query.get("search_email") || query.get("email") || "").trim();
  if (email) {
    const q = email.toLowerCase();
    result = result.filter((l) =>
      String(l.customer_email || "")
        .toLowerCase()
        .includes(q)
    );
  }

  const sort = String(query.get("sort") || "activity").toLowerCase();
  if (sort === "oldest") {
    result.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  } else if (sort === "amount_desc") {
    result.sort((a, b) => b.amount - a.amount);
  } else if (sort === "newest") {
    result.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } else {
    result = sortMockPaymentLinks(result);
  }

  return result;
}

function mockPaymentLinkTabCounts(list: RawPaymentLink[]) {
  const tabs = ["all", "open", "unpaid", "pending", "paid", "failed", "inactive"] as const;
  const counts: Record<string, number> = {};
  for (const tab of tabs) {
    if (tab === "open") {
      counts.open = list.filter((l) => l.status === "active").length;
      continue;
    }
    const q = new URLSearchParams();
    if (tab !== "all") q.set("tab", tab);
    counts[tab] = filterMockPaymentLinks(list, q).length;
  }
  return counts;
}

// --- Referral (withdrawable balance available) ---
const REFERRAL_MOCK_DEFAULTS = {
  code: "ZENDT-TEST-2025",
  total_referrals: 3,
  completed_referrals: 2,
  total_earnings: 150,
  available_earnings: 150,
  pending_withdrawal: null as {
    id: string;
    amount: number;
    upi_id: string;
    created_at: string;
  } | null,
  withdrawals: [] as Array<{
    id: string;
    user_id: string;
    user_name: string;
    user_email: string;
    amount: number;
    upi_id: string;
    status: string;
    created_at: string;
    paid_at: string | null;
    paid_by: string;
    admin_notes: string;
    updated_at: string;
  }>,
  reward_per_referral: 75,
  referrals: [
    {
      name: "Riya Mehta",
      email: "riya@example.com",
      status: "rewarded",
      reward: 75,
      date: new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString(),
    },
    {
      name: "Karan Kapoor",
      email: "karan@example.com",
      status: "rewarded",
      reward: 75,
      date: new Date(Date.now() - 15 * 24 * 3600 * 1000).toISOString(),
    },
    {
      name: "Pooja Iyer",
      email: "pooja@example.com",
      status: "pending",
      reward: 0,
      date: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    },
  ],
};

const referral = { ...REFERRAL_MOCK_DEFAULTS, withdrawals: [...REFERRAL_MOCK_DEFAULTS.withdrawals] };

/** Reset in-memory referral mock (vitest / manual QA within one session). */
export function resetReferralMockForTesting(): void {
  Object.assign(referral, {
    ...REFERRAL_MOCK_DEFAULTS,
    withdrawals: [],
    pending_withdrawal: null,
  });
}

/** Seed higher referral balance for withdraw smoke tests. */
export function seedReferralMockWithEarnings(amount = 1500): void {
  referral.available_earnings = amount;
  referral.total_earnings = amount;
  referral.completed_referrals = 2;
  referral.total_referrals = 2;
}

// ----------------- Router -----------------

function paginate<T>(arr: T[], page: number, limit: number) {
  const start = (page - 1) * limit;
  const items = arr.slice(start, start + limit);
  return {
    items,
    pagination: { page, limit, total: arr.length, totalPages: Math.ceil(arr.length / limit) || 1 },
  };
}

function notFound(): never {
  throw new Error("Not found");
}

async function route(method: Method, path: string, body: unknown): Promise<unknown> {
  // Strip query string for matching, but parse useful params
  const [bare, qs] = path.split("?");
  const query = new URLSearchParams(qs || "");

  if (method === "POST" && bare === "/auth/social-login") {
    setTestSession(true);
    return {
      token: TEST_AUTH_ID_TOKEN,
      accessToken: TEST_AUTH_ACCESS_TOKEN,
      refreshToken: TEST_AUTH_REFRESH_TOKEN,
      username: TEST_EMAIL,
      isNewUser: false,
    };
  }
  // --- /users/me ---
  if (method === "GET" && bare === "/users/me") return { ...me };
  if (method === "PUT" && bare === "/users/me") {
    const patch = body as Record<string, unknown>;
    if (patch.phone != null) {
      const digits = String(patch.phone).replace(/\D/g, "");
      const last = digits.length >= 10 ? digits.slice(-10) : digits;
      const nextPhone = /^[6-9]\d{9}$/.test(last) ? `+91${last}` : String(patch.phone).trim();
      const prevDigits = String(me.phone ?? "").replace(/\D/g, "");
      const prevLast = prevDigits.length >= 10 ? prevDigits.slice(-10) : prevDigits;
      const prevPhone = /^[6-9]\d{9}$/.test(prevLast) ? `+91${prevLast}` : String(me.phone ?? "").trim();
      if (nextPhone !== prevPhone) {
        me.phone_verified = false;
        me.phone = nextPhone;
      }
      delete patch.phone;
    }
    if (patch.business_phone != null) {
      const digits = String(patch.business_phone).replace(/\D/g, "");
      const last = digits.length >= 10 ? digits.slice(-10) : digits;
      const nextPhone = /^[6-9]\d{9}$/.test(last) ? `+91${last}` : String(patch.business_phone).trim();
      const prevDigits = String(me.business_phone ?? "").replace(/\D/g, "");
      const prevLast = prevDigits.length >= 10 ? prevDigits.slice(-10) : prevDigits;
      const prevPhone = /^[6-9]\d{9}$/.test(prevLast)
        ? `+91${prevLast}`
        : String(me.business_phone ?? "").trim();
      if (nextPhone !== prevPhone) {
        me.business_phone_verified = false;
        me.business_phone = nextPhone;
      }
      delete patch.business_phone;
    }
    Object.assign(me, patch);
    return { success: true, user: { ...me } };
  }
  if (method === "PUT" && bare === "/users/me/bank-account") {
    const b = (body || {}) as {
      bank_id?: string;
      bank_account_active?: boolean;
      bank_account_default?: boolean;
    };
    const banks = me.banks as Array<Record<string, unknown>>;
    if (b.bank_id) {
      banks.forEach((bk) => {
        if (bk.id === b.bank_id) {
          if (typeof b.bank_account_active === "boolean") bk.account_active = b.bank_account_active;
          if (b.bank_account_default === true) {
            banks.forEach((other) => (other.account_default = other.id === b.bank_id));
          }
        }
      });
    }
    return { success: true };
  }

  if (method === "POST" && bare === "/users/me/send-otp") return { success: true };
  if (method === "POST" && bare === "/users/me/verify-otp") {
    const b = (body || {}) as { type?: string };
    if (b.type === "phone") me.phone_verified = true;
    if (b.type === "business_phone") me.business_phone_verified = true;
    if (b.type === "business_email") me.business_email_verified = true;
    return { success: true };
  }

  // --- KYC ---
  if (method === "GET" && bare === "/kyc/status") {
    return {
      ...kycStatus,
      phone_verified: !!me.phone_verified,
      phone: typeof me.phone === "string" ? me.phone : "",
    };
  }
  if (method === "POST" && bare === "/kyc/pan") {
    // Simulate the "PAN already registered to another account" path so the
    // duplicate-PAN UX can be tested in test mode. Any PAN in this list
    // pretends another user has it.
    const TAKEN_PANS_FOR_TEST = ["AAAAA1234A", "TAKEN12345"];
    const submitted = String(((body as Record<string, unknown>) || {}).pan || "").toUpperCase();
    if (TAKEN_PANS_FOR_TEST.includes(submitted)) {
      throw Object.assign(
        new Error("This PAN is already linked to another account. Please use your own PAN."),
        { code: "PAN_ALREADY_REGISTERED", status: 409 }
      );
    }
    return { success: true };
  }
  if (method === "POST" && bare === "/kyc/bank") return { success: true };
  if (method === "POST" && bare === "/kyc/proof/upload") {
    const file = (body as FormData | undefined)?.get?.("file");
    const original = file instanceof File ? file.name : "test-document.pdf";
    return {
      key: `test-uploads/${genId("file")}-${original}`,
      url: blobUrlFromFormData(body, "file"),
      original_name: original,
    };
  }
  if (method === "POST" && bare === "/kyc/proof/submit") {
    const submittedAt = new Date().toISOString();
    kycStatus.proof_status = "submitted";
    kycStatus.proof_locked = true;
    kycStatus.account_status = "pending_review";
    kycStatus.kyc_status = "proof_submitted";
    kycStatus.proof_rejection_reason = "";
    kycStatus.proof_submitted_at = submittedAt;
    const payload = (body || {}) as { option?: string; notes?: string };
    if (payload.option) kycStatus.proof_option = payload.option;
    if (typeof payload.notes === "string") kycStatus.proof_notes = payload.notes;
    return { success: true };
  }

  // --- Settings ---
  if (method === "GET" && bare === "/users/me/settings") return { ...settings };
  if (method === "PUT" && bare === "/users/me/settings") {
    settings = { ...settings, ...((body as Record<string, boolean>) || {}) };
    return { success: true };
  }

  // --- Transactions (ledger) ---
  const mockCompletedCredits = () =>
    transactions
      .filter((t) => t.type === "credit" && t.status === "completed")
      .sort((a, b) => {
        const at = new Date(a.updatedAt || a.createdAt).getTime();
        const bt = new Date(b.updatedAt || b.createdAt).getTime();
        return bt - at;
      });

  if (method === "GET" && bare === "/transactions/latest-completed") {
    const latest = mockCompletedCredits();
    return { transaction: latest[0] ?? null };
  }

  if (method === "GET" && bare === "/transactions/latest") {
    return { transaction: transactions[0] ?? null };
  }

  if (method === "GET" && bare === "/transactions/summary") {
    const period = String(query.get("period") || "all").toLowerCase();
    let list = mockCompletedCredits();
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeek = new Date(startOfDay);
    const dow = startOfWeek.getUTCDay();
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const since =
      period === "today"
        ? startOfDay
        : period === "week"
          ? startOfWeek
          : period === "month"
            ? startOfMonth
            : period === "year"
              ? startOfYear
              : null;
    if (since) {
      list = list.filter((t) => new Date(String(t.updatedAt || t.createdAt)) >= since);
    }
    const total = list.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    return {
      period,
      total,
      currency: list[0]?.currency || "INR",
      count: list.length,
    };
  }

  if (method === "GET" && bare === "/transactions/spending-summary") {
    const now = new Date();
    const year = parseInt(String(query.get("year") || now.getUTCFullYear()), 10);
    const month = parseInt(String(query.get("month") ?? now.getUTCMonth()), 10);
    const rows = mockCompletedCredits().filter((t) => {
      const d = new Date(String(t.updatedAt || t.createdAt));
      return d.getUTCFullYear() === year && d.getUTCMonth() === month;
    });
    const total = rows.reduce((s, t) => s + (Number(t.amount) || 0), 0);
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const bucketDays = [1, 5, 10, 15, 20, 25, daysInMonth];
    const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
    const chart_points: Array<{ day: number; amount: number; label: string }> = [];
    let cumulative = 0;
    let prevBd = 1;
    for (const bd of bucketDays) {
      const bucketAmount = rows
        .filter((t) => {
          const day = new Date(String(t.updatedAt || t.createdAt)).getUTCDate();
          return day >= prevBd && day <= bd;
        })
        .reduce((s, t) => s + (Number(t.amount) || 0), 0);
      cumulative += bucketAmount;
      chart_points.push({ day: bd, amount: cumulative, label: `${monthLabel} ${bd}` });
      prevBd = bd + 1;
    }
    const totals = new Map<string, { name: string; total: number; currency: string }>();
    for (const t of rows) {
      const name = String(t.source || "Unknown").trim() || "Unknown";
      const prev = totals.get(name);
      if (prev) prev.total += Number(t.amount) || 0;
      else totals.set(name, { name, total: Number(t.amount) || 0, currency: String(t.currency || "INR") });
    }
    const top_spenders = Array.from(totals.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
    return { year, month, total, chart_points, top_spenders };
  }

  if (method === "GET" && bare === "/transactions") {
    const statusQ = String(query.get("status") || "").toLowerCase();
    let list = transactions as Array<Record<string, unknown>>;
    if (statusQ === "completed") {
      list = mockCompletedCredits() as Array<Record<string, unknown>>;
    }
    const period = String(query.get("period") || "all").toLowerCase();
    const sort = String(query.get("sort") || "time").toLowerCase();
    const now = new Date();
    const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const startOfWeek = new Date(startOfDay);
    const dow = startOfWeek.getUTCDay();
    startOfWeek.setUTCDate(startOfWeek.getUTCDate() - (dow === 0 ? 6 : dow - 1));
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startOfYear = new Date(Date.UTC(now.getUTCFullYear(), 0, 1));
    const since =
      period === "today"
        ? startOfDay
        : period === "week"
          ? startOfWeek
          : period === "month"
            ? startOfMonth
            : period === "year"
              ? startOfYear
              : null;
    if (since) {
      list = list.filter((t) => new Date(String(t.updatedAt || t.createdAt)) >= since);
    }
    if (sort === "amount_desc") {
      list = [...list].sort((a, b) => Number(b.amount) - Number(a.amount));
    } else if (sort === "amount_asc") {
      list = [...list].sort((a, b) => Number(a.amount) - Number(b.amount));
    }
    const { items, pagination } = paginateMockList(list, query, "updatedAt");
    return { transactions: items, pagination };
  }

  // --- Clients ---
  if (method === "GET" && bare === "/clients") {
    const search = String(query.get("search") || "")
      .trim()
      .toLowerCase();
    let list = clients as Array<Record<string, unknown>>;
    if (search) {
      list = list.filter((c) => {
        const name = String(c.name || "").toLowerCase();
        const email = String(c.email || "").toLowerCase();
        const phone = String(c.phone || "").toLowerCase();
        return name.includes(search) || email.includes(search) || phone.includes(search);
      });
    }
    const { items, pagination } = paginateMockList(list, query, "createdAt");
    return { clients: items, pagination };
  }
  if (method === "POST" && bare === "/clients") {
    const b = (body || {}) as Partial<RawClient>;
    const created: RawClient = {
      _id: genId("client"),
      name: b.name || "",
      email: b.email || "",
      phone: b.phone || "",
      address: b.address || "",
      country: b.country || "India",
      purpose_code: b.purpose_code || "",
      company: b.company || "",
      company_website: b.company_website || "",
    };
    clients.unshift(created);
    return { success: true, client: created };
  }
  if (method === "PUT" && bare.startsWith("/clients/")) {
    const id = bare.split("/")[2];
    const idx = clients.findIndex((c) => c._id === id);
    if (idx >= 0) clients[idx] = { ...clients[idx], ...((body as Partial<RawClient>) || {}) };
    return { success: true };
  }
  if (method === "DELETE" && bare.startsWith("/clients/")) {
    const id = bare.split("/")[2];
    const idx = clients.findIndex((c) => c._id === id);
    if (idx >= 0) clients.splice(idx, 1);
    return { success: true };
  }

  // --- Invoices ---
  if (method === "GET" && bare === "/invoices") {
    const { items, pagination } = paginateMockList(
      invoices as Array<Record<string, unknown>>,
      query,
      "createdAt"
    );
    return { invoices: items, pagination };
  }
  if (method === "GET" && bare === "/invoices/next-number") {
    const next = `INV-${String(++invoiceCounter).padStart(4, "0")}`;
    return { invoice_number: next };
  }
  if (method === "POST" && bare === "/invoices") {
    const b = (body || {}) as Partial<RawInvoice> & Record<string, unknown>;
    const created: RawInvoice = {
      _id: genId("inv"),
      invoice_number: (b.invoice_number as string) || `INV-${String(++invoiceCounter).padStart(4, "0")}`,
      client_name: (b.client_name as string) || "Test Client",
      client_email: (b.client_email as string) || "",
      currency: (b.currency as string) || "INR",
      total: (b.total as number) || 0,
      status: "sent",
      payment_mode: (b.payment_mode as string) || "payment_link",
      payment_link: (b.payment_link as string) || `https://example.test/pay/${genId("p")}`,
      invoice_pdf_url: "",
      createdAt: new Date().toISOString(),
    };
    invoices.unshift(created);
    return created;
  }
  if (method === "GET" && bare.startsWith("/invoices/") && bare.endsWith("/pdf")) {
    return { url: null, source: "test", downloadPath: bare };
  }
  if (method === "GET" && bare.startsWith("/invoices/")) {
    const id = bare.split("/")[2];
    const inv = invoices.find((i) => i._id === id);
    return inv ? { ...inv } : notFound();
  }
  if (method === "PUT" && /^\/invoices\/[^/]+\/cancel$/.test(bare)) {
    const id = bare.split("/")[2];
    const inv = invoices.find((i) => i._id === id);
    if (inv) inv.status = "cancelled";
    return { success: true };
  }

  // --- Payment links ---
  if (method === "GET" && bare === "/payment-links/summary") {
    return { counts: mockPaymentLinkTabCounts(paymentLinks) };
  }

  if (method === "GET" && bare === "/payment-links/latest") {
    const sorted = sortMockPaymentLinks(paymentLinks);
    return { link: sorted[0] ?? null };
  }

  if (method === "GET" && bare === "/payment-links") {
    const filtered = filterMockPaymentLinks(paymentLinks, query) as Array<Record<string, unknown>>;
    const { items, pagination } = paginateMockList(filtered, query, "createdAt");
    return { links: items, pagination };
  }
  if (method === "POST" && bare === "/payment-links") {
    const b = (body || {}) as Partial<RawPaymentLink> & Record<string, unknown>;
    const zwitchLinkId = `REF-${Math.floor(Math.random() * 9000 + 1000)}`;
    const created: RawPaymentLink = {
      _id: genId("plnk"),
      zwitch_link_id: zwitchLinkId,
      amount: (b.amount as number) || 0,
      currency: (b.currency as string) || "INR",
      status: "active",
      payment_url: `http://localhost:5173/pay?payment_token=${encodeURIComponent(zwitchLinkId)}`,
      customer_name: (b.customer_name as string) || "Test Customer",
      customer_email: (b.customer_email as string) || "",
      createdAt: new Date().toISOString(),
    };
    paymentLinks.unshift(created);
    return created;
  }
  if (method === "DELETE" && bare.startsWith("/payment-links/")) {
    const id = bare.split("/")[2];
    const link = paymentLinks.find((p) => p._id === id);
    if (link) link.status = "cancelled";
    return { success: true };
  }

  // --- Uploads ---
  if (method === "POST" && bare === "/uploads") {
    return {
      url: blobUrlFromFormData(body, "file"),
      key: `test-uploads/${genId("file")}`,
    };
  }

  // --- Avatar ---
  if (method === "POST" && bare === "/users/me/avatar") {
    revokeIfBlob(me.profile_image);
    me.profile_image = blobUrlFromFormData(body, "avatar");
    return { success: true, profile_image: me.profile_image as string };
  }
  if (method === "DELETE" && bare === "/users/me/avatar") {
    revokeIfBlob(me.profile_image);
    me.profile_image = "";
    return { success: true, profile_image: "" };
  }

  // --- Business logo ---
  if (method === "POST" && bare === "/users/me/business-logo") {
    revokeIfBlob(me.business_logo);
    me.business_logo = blobUrlFromFormData(body, "logo");
    return { success: true, business_logo: me.business_logo as string };
  }
  if (method === "DELETE" && bare === "/users/me/business-logo") {
    revokeIfBlob(me.business_logo);
    me.business_logo = "";
    return { success: true, business_logo: "" };
  }

  // --- Experience projects ---
  if (method === "POST" && bare === "/users/me/experience-projects") {
    const b = (body || {}) as { project_name?: string; domain?: string; description?: string };
    const project = {
      id: genId("proj"),
      project_name: b.project_name || "",
      domain: b.domain || "",
      description: b.description || "",
      images: [] as string[],
      image_keys: [] as string[],
    };
    (me.experience_projects as Array<unknown>).push(project);
    return { success: true, project };
  }
  if (method === "PATCH" && bare.startsWith("/users/me/experience-projects/")) {
    return { success: true, project: { ...((body as Record<string, unknown>) || {}) } };
  }
  if (method === "POST" && /\/users\/me\/experience-projects\/[^/]+\/images$/.test(bare)) {
    const key = `test-uploads/${genId("img")}.png`;
    return {
      success: true,
      key,
      image: blobUrlFromFormData(body, "image"),
    };
  }
  if (method === "DELETE" && /\/users\/me\/experience-projects\/[^/]+\/images$/.test(bare)) {
    return { success: true };
  }
  if (method === "DELETE" && bare.startsWith("/users/me/experience-projects/")) {
    return { success: true };
  }

  // --- Referral ---
  if (method === "GET" && bare === "/referral/code") return { code: referral.code };
  if (method === "GET" && bare === "/referral/stats") {
    const all: Array<Record<string, unknown>> = (referral.referrals as Array<Record<string, unknown>>).map(
      (r, i) => ({
        ...r,
        _id: `ref-${i}`,
        createdAt: r.date,
      })
    );
    const { items, pagination } = paginateMockList(all, query, "createdAt");
    return {
      ...referral,
      available_earnings: referral.available_earnings,
      pending_withdrawal: referral.pending_withdrawal,
      withdrawals: referral.withdrawals,
      referrals: items.map((r) => ({
        name: r.name,
        email: r.email,
        status: r.status,
        reward: r.reward,
        date: r.date,
      })),
      pagination,
    };
  }
  if (method === "POST" && bare === "/referral/apply") return { message: "Referral applied successfully" };
  if (method === "POST" && bare === "/referral/withdraw") {
    const payload = (body || {}) as { upi_id?: string };
    const upi = String(payload.upi_id || "")
      .trim()
      .toLowerCase();
    if (!upi.includes("@")) return { error: "Enter a valid UPI ID (e.g. name@bank)" };
    if (referral.pending_withdrawal) return { error: "You already have a pending withdrawal request" };
    if (referral.available_earnings <= 0) return { error: "No referral balance available to withdraw" };
    const amount = referral.available_earnings;
    referral.available_earnings = 0;
    referral.total_earnings = 0;
    const withdrawal = {
      id: `wd-${Date.now()}`,
      user_id: String(me.cognito_id || "test-user"),
      user_name: String(me.full_name || "Test User"),
      user_email: String(me.email || TEST_EMAIL),
      amount,
      upi_id: upi,
      status: "pending",
      created_at: new Date().toISOString(),
      paid_at: null as string | null,
      paid_by: "",
      admin_notes: "",
      updated_at: new Date().toISOString(),
    };
    referral.pending_withdrawal = {
      id: withdrawal.id,
      amount,
      upi_id: upi,
      created_at: withdrawal.created_at,
    };
    referral.withdrawals = [withdrawal, ...referral.withdrawals].slice(0, 5);
    return { success: true, withdrawal_id: withdrawal.id, amount, status: "pending" };
  }

  // --- Signup completion ---
  if (method === "POST" && bare === "/users/signup-complete") return { success: true };
  if (method === "POST" && bare === "/users/me/social-auth-password") return { success: true };

  // --- Soft opt-ins for upcoming products (e.g. cards) ---
  // Mirrors the backend's `LAUNCH_NOTIFY_FEATURES` map so test mode behaves
  // identically to prod for opt-in / re-tap flows.
  type LaunchInterests = Record<string, boolean | string | null>;
  const LAUNCH_NOTIFY_FEATURES: Record<string, { flag: string; ts: string }> = {
    "/users/me/interests/cards-launch": {
      flag: "cards_launch_notify",
      ts: "cards_launch_notify_at",
    },
  };
  if (method === "POST" && LAUNCH_NOTIFY_FEATURES[bare]) {
    const { flag, ts } = LAUNCH_NOTIFY_FEATURES[bare];
    const interests = ((me.interests as LaunchInterests | undefined) || {}) as LaunchInterests;
    const alreadyOptedIn = !!interests[flag];
    interests[flag] = true;
    if (!alreadyOptedIn) interests[ts] = new Date().toISOString();
    me.interests = interests;
    return { success: true, alreadyOptedIn };
  }

  // --- Admin (requires Cognito ZendtAdmins) ---
  if (method === "POST" && bare === "/auth/precheck-signup-email") return { available: true };
  if (method === "POST" && bare === "/auth/precheck-admin-registration-secret") {
    return { ok: true };
  }
  if (method === "POST" && bare === "/auth/complete-admin-registration") {
    return { ok: true, already_admin: false };
  }
  if (method === "POST" && bare === "/admin/me/avatar-upload") {
    return {
      ok: true,
      avatar_url: PLACEHOLDER_IMG,
      avatar_s3_key: "admin-avatars/test-admin/mock.jpg",
    };
  }
  if (method === "GET" && bare === "/admin/me") {
    return {
      cognito_id: "test-admin",
      email: "admin@test.zendt",
      full_name: "Test Admin",
      phone: "",
      avatar_url: "",
      avatar_s3_key: "",
    };
  }
  if (method === "PATCH" && bare === "/admin/me") {
    const b = (body as Record<string, string>) || {};
    return {
      cognito_id: "test-admin",
      email: "admin@test.zendt",
      full_name: b.full_name ?? "Test Admin",
      phone: b.phone ?? "",
      avatar_url: "",
      avatar_s3_key: "",
    };
  }
  if (method === "POST" && bare === "/admin/me/avatar-upload-url") {
    return { key: "admin-avatars/test/key.jpg", upload_url: "https://example.invalid/upload" };
  }
  if (method === "POST" && bare === "/admin/me/avatar") {
    return { ok: true, avatar_url: "", avatar_s3_key: "admin-avatars/test/key.jpg" };
  }
  if (method === "GET" && bare === "/admin/data/summary") {
    return {
      counts: {
        users: 0,
        clients: 0,
        invoices: 0,
        transactions: 0,
        referrals: 0,
        referral_withdrawals: 0,
        paymentlinks: 0,
        otps: 0,
        admins: 1,
      },
    };
  }
  if (method === "GET" && bare.startsWith("/admin/data/") && bare !== "/admin/data/summary") {
    const slug = bare.slice("/admin/data/".length);
    const page = Number(query.get("page") || "1");
    const rawLimit = Number(query.get("limit") || "25");
    const limit = [25, 50, 100].includes(rawLimit) ? rawLimit : 25;
    return {
      collection: slug,
      items: [],
      pagination: { page, limit, total: 0 },
      meta: {
        searchFields: ["email", "full_name", "cognito_id", "_id"],
        sortFields: ["createdAt", "updatedAt", "full_name"],
        defaultSort: { field: "updatedAt", dir: "desc" as const },
      },
    };
  }

  // --- Admin (test user is not admin) ---
  if (method === "GET" && bare === "/admin/pending-proofs") {
    const page = Number(query.get("page") || "1");
    const limit = Number(query.get("limit") || "20");
    const pending =
      kycStatus.proof_status === "submitted"
        ? [
            {
              cognito_id: String(me.cognito_id),
              full_name: String(me.full_name || "Test User"),
              email: String(me.email || TEST_EMAIL),
              proof_submitted_at: kycStatus.proof_submitted_at || new Date().toISOString(),
              proof_option: kycStatus.proof_option || "A",
              file_count: 1,
            },
          ]
        : [];
    const { items, pagination } = paginate(pending, page, limit);
    return { items, pagination: { ...pagination, total: pending.length } };
  }
  if (method === "GET" && bare.startsWith("/admin/users/")) return {};
  if (method === "POST" && /\/admin\/users\/[^/]+\/deactivate$/.test(bare)) return { success: true };
  if (method === "POST" && /\/admin\/users\/[^/]+\/approve$/.test(bare)) return { success: true };
  if (method === "POST" && /\/admin\/users\/([^/]+)\/reject$/.test(bare)) {
    const cognitoId = bare.match(/\/admin\/users\/([^/]+)\/reject$/)?.[1];
    const reason = String(((body as { reason?: string }) || {}).reason || "").trim();
    if (cognitoId === me.cognito_id) {
      kycStatus.proof_status = "rejected";
      kycStatus.proof_locked = false;
      kycStatus.proof_rejection_reason = reason || "Documents need correction.";
      kycStatus.account_status = "rejected";
      kycStatus.kyc_status = "proof_rejected";
      kycStatus.proof_submitted_at = "";
      kycStatus.proof_notes = "";
      kycStatus.proof_option = "";
    }
    return { success: true };
  }
  if (method === "GET" && bare === "/admin/referral-withdrawals") {
    const page = Number(query.get("page") || "1");
    const limit = Number(query.get("limit") || "20");
    const status = String(query.get("status") || "pending");
    let rows = referral.withdrawals;
    if (status !== "all") rows = rows.filter((w) => w.status === status);
    const { items, pagination } = paginate(rows, page, limit);
    return { items, pagination: { ...pagination, total: rows.length } };
  }
  if (method === "GET" && bare.startsWith("/admin/referral-withdrawals/")) {
    const id = decodeURIComponent(bare.slice("/admin/referral-withdrawals/".length));
    const row = referral.withdrawals.find((w) => w.id === id);
    return row || { error: "Withdrawal not found" };
  }
  if (method === "POST" && /\/admin\/referral-withdrawals\/([^/]+)\/mark-paid$/.test(bare)) {
    const id = bare.match(/\/admin\/referral-withdrawals\/([^/]+)\/mark-paid$/)?.[1];
    const row = referral.withdrawals.find((w) => w.id === id);
    if (!row) return { error: "Withdrawal not found" };
    if (row.status === "paid") {
      return { success: true, already_paid: true, id: row.id, status: "paid", paid_at: row.paid_at };
    }
    row.status = "paid";
    row.paid_at = new Date().toISOString();
    row.paid_by = "mock-admin";
    row.updated_at = row.paid_at;
    if (referral.pending_withdrawal?.id === row.id) referral.pending_withdrawal = null;
    return { success: true, id: row.id, status: "paid", paid_at: row.paid_at };
  }

  // --- Default fallthrough ---
  if (method === "GET") return [];
  return { success: true };
}

export async function mockApi<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (FAKE_LATENCY_MS > 0) await wait(FAKE_LATENCY_MS);
  const result = await route(method.toUpperCase() as Method, path, body);
  return result as T;
}
