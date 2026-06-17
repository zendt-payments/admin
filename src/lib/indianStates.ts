/**
 * Labels for Indian state / UT codes accepted by zendt-backend (see indianStateCodes.js).
 * Value sent to API is always the 2-letter code (uppercase).
 */
export type IndianStateOption = { value: string; label: string };

const RAW: [string, string][] = [
  ["AN", "Andaman and Nicobar Islands"],
  ["AP", "Andhra Pradesh"],
  ["AR", "Arunachal Pradesh"],
  ["AS", "Assam"],
  ["BR", "Bihar"],
  ["CH", "Chandigarh"],
  ["CG", "Chhattisgarh"],
  ["CT", "Chhattisgarh (CT)"],
  ["DN", "Dadra and Nagar Haveli and Daman and Diu"],
  ["DD", "Daman and Diu (legacy code)"],
  ["DL", "Delhi"],
  ["GA", "Goa"],
  ["GJ", "Gujarat"],
  ["HR", "Haryana"],
  ["HP", "Himachal Pradesh"],
  ["JK", "Jammu and Kashmir"],
  ["JH", "Jharkhand"],
  ["KA", "Karnataka"],
  ["KL", "Kerala"],
  ["LA", "Ladakh"],
  ["LD", "Lakshadweep"],
  ["MP", "Madhya Pradesh"],
  ["MH", "Maharashtra"],
  ["MN", "Manipur"],
  ["ML", "Meghalaya"],
  ["MZ", "Mizoram"],
  ["NL", "Nagaland"],
  ["OR", "Odisha"],
  ["PY", "Puducherry"],
  ["PB", "Punjab"],
  ["RJ", "Rajasthan"],
  ["SK", "Sikkim"],
  ["TN", "Tamil Nadu"],
  ["TG", "Telangana (TG)"],
  ["TS", "Telangana (TS)"],
  ["TR", "Tripura"],
  ["UP", "Uttar Pradesh"],
  ["UT", "Uttarakhand"],
  ["UK", "Uttarakhand (UK)"],
  ["WB", "West Bengal"],
];

/** Short display names (read-only profile lines, invoice snippets). */
const NAME_BY_CODE: Record<string, string> = Object.fromEntries(
  RAW.map(([code, name]) => [code.toUpperCase(), name])
);

/** Dropdown: include code in label so users can search by "KA" etc. */
export const INDIAN_STATE_OPTIONS: IndianStateOption[] = RAW.map(([value, name]) => ({
  value,
  label: `${name} (${value})`,
})).sort((a, b) => a.label.localeCompare(b.label, "en"));

/** Display name for a stored code; falls back to the code itself if unknown. */
export function indianStateLabel(code: string | undefined): string {
  const c = (code || "").trim().toUpperCase();
  if (!c) return "";
  return NAME_BY_CODE[c] ?? c;
}
