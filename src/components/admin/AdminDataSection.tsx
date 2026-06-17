import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import ListRowsSkeleton from "../shared/skeletons/ListRowsSkeleton";

const COLLECTION_LABELS: Record<string, string> = {
  clients: "Clients",
  referrals: "Referrals",
  referral_withdrawals: "Referral withdrawals",
  otps: "OTP records",
  admins: "Admins",
};

/** Prefer human-readable columns per collection; fall back to object keys */
const COLUMN_PRIORITY: Record<string, string[]> = {
  clients: ["user_id", "user_email", "name", "email", "company", "createdAt"],
  referrals: [
    "referrer_id",
    "referrer_email",
    "referred_id",
    "referred_user_email",
    "referred_email",
    "status",
    "createdAt",
  ],
  referral_withdrawals: ["user_name", "user_email", "amount", "upi_id", "status", "paid_at", "createdAt"],
  otps: ["user_id", "user_email", "target", "type", "expires_at", "created_at"],
  admins: ["cognito_id", "email", "full_name", "phone", "updatedAt"],
};

const PAGE_SIZES = [25, 50, 100] as const;

function stringifyCell(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return String(v);
    }
  }
  return String(v);
}

export default function AdminDataSection() {
  const { showError } = useAppToast();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [selected, setSelected] = useState<string>("admins");
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [limit, setLimit] = useState<(typeof PAGE_SIZES)[number]>(25);
  const [tableLoading, setTableLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [searchScope, setSearchScope] = useState<string>("__all__");
  const [metaSearchFields, setMetaSearchFields] = useState<string[]>([]);
  const [metaSortFields, setMetaSortFields] = useState<string[]>([]);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [overviewExpanded, setOverviewExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [columnsPickerExpanded, setColumnsPickerExpanded] = useState(false);
  const [hiddenColsByCollection, setHiddenColsByCollection] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 350);
    return () => window.clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setSummaryLoading(true);
    dataService
      .getAdminDataSummary()
      .then((r) => setCounts(r.counts || {}))
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load summary"))
      .finally(() => setSummaryLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setSortColumn(null);
    setSortDir("desc");
    setSearchScope("__all__");
    setMetaSearchFields([]);
    setMetaSortFields([]);
    setColumnsPickerExpanded(false);
  }, [selected]);

  useEffect(() => {
    setPage(1);
  }, [selected, searchDebounced, searchScope, limit, sortColumn, sortDir]);

  useEffect(() => {
    setTableLoading(true);
    dataService
      .getAdminDataCollection({
        collection: selected,
        page,
        limit,
        q: searchDebounced || undefined,
        searchField: searchScope === "__all__" ? undefined : searchScope,
        ...(sortColumn ? { sort: sortColumn, dir: sortDir } : {}),
      })
      .then((r) => {
        setItems(r.items || []);
        setTotal(r.pagination?.total ?? 0);
        if (r.meta) {
          setMetaSearchFields([...new Set(r.meta.searchFields || [])]);
          setMetaSortFields([...new Set(r.meta.sortFields || [])]);
        }
      })
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load table"))
      .finally(() => setTableLoading(false));
  }, [selected, page, limit, searchDebounced, searchScope, sortColumn, sortDir, showError]);

  const columns = useMemo(() => {
    const first = items[0];
    const priority = COLUMN_PRIORITY[selected];
    if (priority?.length) return priority;
    if (!first) return [];
    return Object.keys(first).filter((k) => k !== "__v");
  }, [items, selected]);

  const hiddenForSelected = hiddenColsByCollection[selected] ?? [];
  const hiddenColSet = useMemo(() => new Set(hiddenForSelected), [hiddenForSelected]);

  const visibleColumns = useMemo(
    () => columns.filter((c) => !hiddenColSet.has(c)),
    [columns, hiddenColSet]
  );

  const toggleColumnVisible = (col: string, visible: boolean) => {
    setHiddenColsByCollection((prev) => {
      const hidden = new Set(prev[selected] ?? []);
      if (visible) hidden.delete(col);
      else hidden.add(col);
      const hiddenArr = [...hidden];
      const visibleCount = columns.filter((c) => !hidden.has(c)).length;
      if (visibleCount === 0) return prev;
      return { ...prev, [selected]: hiddenArr };
    });
  };

  const showAllColumnsForCollection = () => {
    setHiddenColsByCollection((prev) => ({ ...prev, [selected]: [] }));
  };

  const collectionKeys = Object.keys(counts)
    .filter((k) => k in COLLECTION_LABELS)
    .sort((a, b) => (COLLECTION_LABELS[a] || a).localeCompare(COLLECTION_LABELS[b] || b));

  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleSortHeader = (col: string) => {
    if (!metaSortFields.includes(col)) return;
    if (sortColumn !== col) {
      setSortColumn(col);
      setSortDir("desc");
    } else {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    }
  };

  return (
    <div className="space-y-6 xl:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <DashboardSectionTitle as="h2">Database overview</DashboardSectionTitle>
          {overviewExpanded ? (
            <p className="text-caption sm:text-body text-white/45 mt-1 max-w-xl lg:max-w-2xl xl:max-w-3xl leading-snug">
              Read-only counts and paginated rows. Sensitive payloads use trimmed projections on the server.
            </p>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-caption text-white/45">
                Collection
                <select
                  value={selected}
                  onChange={(e) => setSelected(e.target.value)}
                  disabled={summaryLoading || collectionKeys.length === 0}
                  className="rounded-lg bg-[#141414] border border-white/10 px-2 py-1.5 sm:py-2 text-body text-white focus:outline-none focus:border-white/25 disabled:opacity-40 normal-case min-w-[160px] sm:min-w-[180px] xl:min-w-[200px]"
                >
                  {collectionKeys.map((key) => (
                    <option key={key} value={key}>
                      {COLLECTION_LABELS[key] || key}
                    </option>
                  ))}
                </select>
              </label>
              {!summaryLoading && collectionKeys.length > 0 ? (
                <span className="text-caption text-white/35">
                  {collectionKeys.length} collection{collectionKeys.length === 1 ? "" : "s"}
                </span>
              ) : null}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => setOverviewExpanded((v) => !v)}
          aria-expanded={overviewExpanded}
          className="shrink-0 inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#1E1E1E] px-3 py-2 sm:px-4 sm:py-2.5 text-caption sm:text-body text-white/70 hover:bg-white/10 hover:text-white hover:border-white/25 transition self-start sm:self-center"
        >
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform duration-200 ${overviewExpanded ? "rotate-180" : ""}`}
            aria-hidden
          />
          {overviewExpanded ? "Hide counts" : "Show counts"}
        </button>
      </div>

      {overviewExpanded &&
        (summaryLoading ? (
          <p className="text-body text-white/50">Loading summary…</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-2 sm:gap-3 xl:gap-4">
            {collectionKeys.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                className={`rounded-xl border px-3 py-3 sm:px-4 sm:py-3.5 text-left transition ${
                  selected === key
                    ? "border-white/25 bg-white/10"
                    : "border-white/10 bg-[#1E1E1E] hover:border-white/20"
                }`}
              >
                <div className="text-caption uppercase tracking-wide text-white/45">
                  {COLLECTION_LABELS[key] || key}
                </div>
                <div className="text-title sm:text-headline font-semibold mt-0.5">{counts[key] ?? 0}</div>
              </button>
            ))}
          </div>
        ))}

      <div className="rounded-2xl border border-white/10 bg-[#1E1E1E] p-4 sm:p-5 lg:p-6 xl:p-8 space-y-3 lg:space-y-4">
        <div className="flex flex-col gap-3 lg:gap-4">
          <div className="flex flex-wrap items-start justify-between gap-2 lg:gap-4">
            <h3 className="text-body lg:text-callout font-medium text-white">
              {COLLECTION_LABELS[selected] || selected}
            </h3>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setFiltersExpanded((v) => !v)}
                aria-expanded={filtersExpanded}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#141414] px-3 py-2 sm:px-4 sm:py-2.5 text-caption sm:text-body text-white/70 hover:bg-white/10 hover:text-white hover:border-white/25 transition"
              >
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${filtersExpanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
                {filtersExpanded ? "Hide filters" : "Show filters"}
              </button>
              <button
                type="button"
                onClick={() => setColumnsPickerExpanded((v) => !v)}
                aria-expanded={columnsPickerExpanded}
                disabled={columns.length === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-[#141414] px-3 py-2 sm:px-4 sm:py-2.5 text-caption sm:text-body text-white/70 hover:bg-white/10 hover:text-white hover:border-white/25 transition disabled:opacity-35 disabled:pointer-events-none"
              >
                <ChevronDown
                  className={`w-4 h-4 shrink-0 transition-transform duration-200 ${columnsPickerExpanded ? "rotate-180" : ""}`}
                  aria-hidden
                />
                Columns
              </button>
            </div>
          </div>

          {filtersExpanded ? (
            <div className="flex flex-col lg:flex-row flex-wrap gap-3 lg:gap-4 xl:gap-6 lg:items-end">
              <label className="flex flex-col gap-1 text-caption uppercase tracking-wide text-white/45 min-w-[140px] flex-1 max-w-xs sm:max-w-sm xl:max-w-md xl:min-w-[14rem]">
                Search
                <input
                  type="search"
                  placeholder="Query…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="rounded-xl bg-[#141414] border border-white/10 px-3 py-2 sm:py-2.5 text-body lg:text-callout text-white placeholder:text-white/35 focus:outline-none focus:border-white/25 normal-case w-full"
                />
              </label>

              <label className="flex flex-col gap-1 text-caption uppercase tracking-wide text-white/45 min-w-[160px] lg:min-w-[180px] xl:min-w-[200px]">
                Search in field
                <select
                  value={searchScope}
                  onChange={(e) => setSearchScope(e.target.value)}
                  className="rounded-xl bg-[#141414] border border-white/10 px-3 py-2 sm:py-2.5 text-body lg:text-callout text-white focus:outline-none focus:border-white/25 normal-case w-full lg:w-auto"
                >
                  <option value="__all__">All fields</option>
                  {metaSearchFields.map((f) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex flex-col gap-1 text-caption uppercase tracking-wide text-white/45 w-full sm:w-[140px] lg:w-[160px] shrink-0">
                Rows per page
                <select
                  value={limit}
                  onChange={(e) => setLimit(Number(e.target.value) as (typeof PAGE_SIZES)[number])}
                  className="rounded-xl bg-[#141414] border border-white/10 px-3 py-2 sm:py-2.5 text-body lg:text-callout text-white focus:outline-none focus:border-white/25 normal-case w-full"
                >
                  {PAGE_SIZES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : (
            <p className="text-caption sm:text-body text-white/45 leading-relaxed xl:max-w-4xl">
              <span className="text-white/30">Search:</span>{" "}
              {searchDebounced ? (
                <span className="text-white/70">&ldquo;{searchDebounced}&rdquo;</span>
              ) : (
                <span className="text-white/35">none</span>
              )}
              <span className="text-white/25 mx-2">·</span>
              <span className="text-white/30">Field:</span>{" "}
              <span className="text-white/65">
                {searchScope === "__all__" ? "All fields" : searchScope}
              </span>
              <span className="text-white/25 mx-2">·</span>
              <span className="text-white/30">Rows/page:</span>{" "}
              <span className="text-white/65">{limit}</span>
            </p>
          )}

          {columnsPickerExpanded && columns.length > 0 ? (
            <div className="rounded-xl border border-white/10 bg-black/25 p-3 sm:p-4 xl:p-5 space-y-2 xl:space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-caption sm:text-caption uppercase tracking-wide text-white/45">
                  Visible columns
                </span>
                <button
                  type="button"
                  onClick={showAllColumnsForCollection}
                  className="text-caption text-emerald-400/90 hover:text-emerald-300 transition"
                >
                  Show all
                </button>
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-2.5 xl:gap-x-8 xl:gap-y-3">
                {columns.map((col) => {
                  const on = !hiddenColSet.has(col);
                  const soleVisible = on && visibleColumns.length === 1;
                  return (
                    <label
                      key={col}
                      className={`inline-flex items-center gap-2 text-caption sm:text-body cursor-pointer select-none ${
                        soleVisible ? "text-white/45" : "text-white/75"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={soleVisible}
                        onChange={(e) => toggleColumnVisible(col, e.target.checked)}
                        className="rounded border-white/25 bg-[#141414] text-emerald-500 focus:ring-emerald-500/40 focus:ring-offset-0 focus:ring-2 disabled:opacity-40"
                      />
                      <span className="font-mono">{col}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        <div className="overflow-x-auto rounded-xl lg:rounded-2xl border border-white/10 xl:border-white/[0.12]">
          {tableLoading ? (
            <div className="p-4">
              <ListRowsSkeleton rows={8} />
            </div>
          ) : items.length === 0 ? (
            <div className="p-8 lg:p-10 text-center text-body lg:text-callout text-white/50">No rows.</div>
          ) : (
            <table className="min-w-full text-left text-caption lg:text-body">
              <thead className="bg-black/30 text-white/55 uppercase tracking-wide">
                <tr>
                  {visibleColumns.map((col) => {
                    const sortable = metaSortFields.includes(col);
                    const active = sortColumn === col;
                    return (
                      <th
                        key={col}
                        className="px-3 py-2 lg:px-4 lg:py-2.5 xl:px-5 font-medium whitespace-nowrap align-middle"
                      >
                        <button
                          type="button"
                          disabled={!sortable}
                          onClick={() => handleSortHeader(col)}
                          className={[
                            "inline-flex items-center gap-1.5 max-w-full text-left rounded-lg px-1 py-0.5 -mx-1 transition-colors",
                            sortable
                              ? "text-white/70 hover:text-white hover:bg-white/10 cursor-pointer"
                              : "text-white/55 cursor-default",
                          ].join(" ")}
                          aria-sort={
                            active
                              ? sortDir === "asc"
                                ? "ascending"
                                : "descending"
                              : sortable
                                ? "none"
                                : undefined
                          }
                        >
                          {sortable ? (
                            <>
                              <ArrowUp
                                className={[
                                  "w-3.5 h-3.5 shrink-0 transition-colors",
                                  active && sortDir === "asc"
                                    ? "text-emerald-400"
                                    : active && sortDir === "desc"
                                      ? "text-white/25"
                                      : "text-white/40",
                                ].join(" ")}
                                aria-hidden
                              />
                              <span className="truncate min-w-0">{col}</span>
                              <ArrowDown
                                className={[
                                  "w-3.5 h-3.5 shrink-0 transition-colors",
                                  active && sortDir === "desc"
                                    ? "text-emerald-400"
                                    : active && sortDir === "asc"
                                      ? "text-white/25"
                                      : "text-white/40",
                                ].join(" ")}
                                aria-hidden
                              />
                            </>
                          ) : (
                            <span className="truncate">{col}</span>
                          )}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {items.map((row, ri) => (
                  <tr key={ri} className="hover:bg-white/[0.04]">
                    {visibleColumns.map((col) => (
                      <td
                        key={col}
                        className="px-3 py-2 lg:px-4 lg:py-2.5 xl:px-5 text-white/85 max-w-[220px] sm:max-w-[280px] lg:max-w-[380px] xl:max-w-[28rem] 2xl:max-w-[32rem] truncate align-top"
                      >
                        {stringifyCell(row[col])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 lg:gap-4 text-caption sm:text-body text-white/55 pt-1">
          <span>
            Page {page} of {totalPages} · {total} rows
          </span>
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-full border border-white/15 px-3 py-1 lg:px-4 lg:py-1.5 hover:bg-white/10 disabled:opacity-30"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-full border border-white/15 px-3 py-1 lg:px-4 lg:py-1.5 hover:bg-white/10 disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}