export type PaymentLinkTab = "all" | "unpaid" | "pending" | "paid" | "failed" | "inactive";

export type PaymentLinkListQuery = {
  tab?: PaymentLinkTab;
  /** Comma-separated lifecycle statuses (active, paid, …). */
  status?: string;
  sort?: "activity" | "newest" | "oldest" | "amount_desc";
  duration?: string;
  search_link_id?: string;
  search_ref?: string;
  search_contact?: string;
  search_email?: string;
};

export type TransactionListQuery = {
  period?: "all" | "today" | "week" | "month" | "year";
  sort?: "time" | "amount_desc" | "amount_asc";
};

const MANAGE_STATUS_TO_BACKEND: Record<string, string> = {
  Created: "active",
  "Partially paid": "partially_paid",
  Paid: "paid",
  Cancelled: "cancelled",
  Expired: "expired",
};

const ALL_MANAGE_STATUSES = Object.keys(MANAGE_STATUS_TO_BACKEND);

export function sortLabelToMode(label: string): PaymentLinkListQuery["sort"] {
  if (label === "Oldest first") return "oldest";
  if (label === "Amount high to low") return "amount_desc";
  return "newest";
}

export function transactionSortFromUi(sort: "none" | "high" | "low"): TransactionListQuery["sort"] {
  if (sort === "high") return "amount_desc";
  if (sort === "low") return "amount_asc";
  return "time";
}

/** Map Payment Links manage-page filter state → server query params. */
export function paymentLinksManageParams(opts: {
  statuses: string[];
  dur: string;
  sort: string;
  linkId: string;
  refId: string;
  contact: string;
  email: string;
}): PaymentLinkListQuery {
  const params: PaymentLinkListQuery = {
    sort: sortLabelToMode(opts.sort),
  };

  if (opts.dur && opts.dur !== "All time") {
    params.duration = opts.dur;
  }

  if (opts.linkId.trim()) params.search_link_id = opts.linkId.trim();
  if (opts.refId.trim()) params.search_ref = opts.refId.trim();
  if (opts.contact.trim()) params.search_contact = opts.contact.trim();
  if (opts.email.trim()) params.search_email = opts.email.trim();

  if (opts.statuses.length > 0 && opts.statuses.length < ALL_MANAGE_STATUSES.length) {
    params.status = opts.statuses
      .map((s) => MANAGE_STATUS_TO_BACKEND[s] || s)
      .filter(Boolean)
      .join(",");
  }

  return params;
}
