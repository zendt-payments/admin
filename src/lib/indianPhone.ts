/**
 * Mirror backend `normalizeIndianPhone` — Indian mobile to E.164 (+91XXXXXXXXXX).
 */
export function normalizeIndianPhoneE164(input: string): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  let s = raw.replace(/[\s\-().]/g, "");
  if (s.startsWith("+")) s = s.slice(1);
  if (s.startsWith("0") && s.length === 11) s = s.slice(1);
  if (s.startsWith("91") && s.length === 12) {
    const rest = s.slice(2);
    if (/^[6-9]\d{9}$/.test(rest)) return `+91${rest}`;
  }
  if (s.length === 10 && /^[6-9]\d{9}$/.test(s)) return `+91${s}`;
  if (s.length === 12 && s.startsWith("91") && /^[6-9]\d{9}$/.test(s.slice(2))) return `+${s}`;
  return "";
}

/**
 * For PUT /users/me `phone` / `business_phone`: send a canonical number only when valid.
 * Empty or partial values (e.g. dial code only from PhoneInput) → `undefined` so other fields
 * can save without triggering "Invalid phone number" on the server.
 */
export function profilePhonePutPayload(raw: string): string | undefined {
  const canon = normalizeIndianPhoneE164(raw);
  return canon || undefined;
}
