/**
 * Rates: open.er-api.com INR/latest (~165 ISO codes, daily publish).
 * Day change: prior calendar-day snapshot (localStorage) + Frankfurter ECB yesterday as bootstrap.
 *
 * `rates[c]` from open.er = units of **c** per 1 INR → `inrPerUnit = 1 / rates[c]`.
 * `changeVsPriorDaily` = today's `inrPerUnit` minus yesterday's (INR per 1 unit of **c**).
 */

const OPEN_ER_ORIGIN = (import.meta.env.VITE_OPEN_EXCHANGE_ORIGIN || "https://open.er-api.com").replace(
  /\/$/,
  ""
);

/** ECB day-over-day bootstrap — Frankfurter moved to api.frankfurter.dev/v1 (app domain 301s). */
const FRANKFURTER_ORIGIN = (
  import.meta.env.VITE_FRANKFURTER_ORIGIN || "https://api.frankfurter.dev/v1"
).replace(/\/$/, "");

const DAILY_LS_PREFIX = "zendt_fx_daily_";
const DAILY_RETENTION_DAYS = 8;

function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function yesterdayUtcDateKey(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return utcDateKey(d);
}

function readDailyInrPerUnit(dateKey: string): Record<string, number> | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(`${DAILY_LS_PREFIX}${dateKey}`);
    if (!raw) return null;
    const o = JSON.parse(raw) as Record<string, number>;
    return o && typeof o === "object" ? o : null;
  } catch {
    return null;
  }
}

function writeDailyInrPerUnit(dateKey: string, rates: Record<string, number>): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(`${DAILY_LS_PREFIX}${dateKey}`, JSON.stringify(rates));
    pruneOldDailySnapshots(dateKey);
  } catch {
    /* quota / private mode */
  }
}

function pruneOldDailySnapshots(currentKey: string): void {
  if (typeof localStorage === "undefined") return;
  const current = new Date(`${currentKey}T12:00:00Z`).getTime();
  const cutoff = current - DAILY_RETENTION_DAYS * 86_400_000;
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (!key?.startsWith(DAILY_LS_PREFIX)) continue;
    const datePart = key.slice(DAILY_LS_PREFIX.length);
    const t = new Date(`${datePart}T12:00:00Z`).getTime();
    if (!Number.isNaN(t) && t < cutoff) localStorage.removeItem(key);
  }
}

function ratesToInrPerUnitMap(rates: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [rawCode, perInr] of Object.entries(rates)) {
    const code = rawCode.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(code) || code === "INR") continue;
    if (typeof perInr !== "number" || !Number.isFinite(perInr) || perInr <= 0) continue;
    out[code] = 1 / perInr;
  }
  return out;
}

/** ECB historical (limited ISO set) — used when we have no prior-day local snapshot yet. */
async function fetchFrankfurterYesterdayInrPerUnit(): Promise<Record<string, number>> {
  const date = yesterdayUtcDateKey();
  try {
    const res = await fetch(`${FRANKFURTER_ORIGIN}/${date}?from=INR`);
    if (!res.ok) return {};
    const data = (await res.json()) as { rates?: Record<string, number> };
    return data.rates && typeof data.rates === "object" ? ratesToInrPerUnitMap(data.rates) : {};
  } catch {
    return {};
  }
}

export type InrFxQuote = {
  code: string;
  /** INR equivalent of **1** unit of `code`. */
  inrPerUnit: number;
  /** INR change vs prior calendar day (yesterday close → today). */
  changeVsPriorDaily?: number;
};

export type ExchangeRatesVsInrResult = {
  date: string;
  publishUnix: number | null;
  quotes: InrFxQuote[];
};

/** Every convertible currency returned for base INR except INR itself (3-letter ISO-style codes only). */
export async function fetchAllInrAgainst(): Promise<ExchangeRatesVsInrResult> {
  const [openRes, frankfurtYesterday] = await Promise.all([
    fetch(`${OPEN_ER_ORIGIN}/v6/latest/INR`),
    fetchFrankfurterYesterdayInrPerUnit(),
  ]);

  if (!openRes.ok) {
    throw new Error(`Exchange rates unavailable (${openRes.status})`);
  }

  const data = (await openRes.json()) as {
    result?: string;
    rates?: Record<string, number>;
    time_last_update_utc?: string;
    time_last_update_unix?: number;
  };

  if (data.result !== "success" || !data.rates || typeof data.rates !== "object") {
    throw new Error("Unexpected exchange rates response.");
  }

  let dateLabel = "";
  if (typeof data.time_last_update_utc === "string") {
    const d = new Date(data.time_last_update_utc);
    if (!Number.isNaN(d.getTime())) {
      dateLabel = d.toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    }
  }

  const publishUnix =
    typeof data.time_last_update_unix === "number" && Number.isFinite(data.time_last_update_unix)
      ? data.time_last_update_unix
      : null;

  const todayInrPerUnit = ratesToInrPerUnitMap(data.rates);
  const yesterdayKey = yesterdayUtcDateKey();
  const storedYesterday = readDailyInrPerUnit(yesterdayKey);

  const quotes: InrFxQuote[] = Object.entries(todayInrPerUnit)
    .map(([code, inrPerUnit]) => {
      const prev =
        typeof storedYesterday?.[code] === "number"
          ? storedYesterday[code]
          : typeof frankfurtYesterday[code] === "number"
            ? frankfurtYesterday[code]
            : undefined;

      if (typeof prev !== "number" || !Number.isFinite(prev)) {
        return { code, inrPerUnit };
      }

      const changeVsPriorDaily = inrPerUnit - prev;
      return { code, inrPerUnit, changeVsPriorDaily };
    })
    .sort((a, b) => a.code.localeCompare(b.code));

  writeDailyInrPerUnit(utcDateKey(), todayInrPerUnit);

  return { date: dateLabel, publishUnix, quotes };
}
