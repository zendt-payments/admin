/** E.164 without + for wa.me (e.g. 917356004147) */
const DEFAULT_SUPPORT_WA = "917356004147";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

let cachedWaMeDigits: string | null = null;
let fetchPromise: Promise<string> | null = null;

function envSupportDigits(): string {
  const v = import.meta.env.VITE_WHATSAPP_SUPPORT_E164 as string | undefined;
  const raw = (v && v.trim()) || DEFAULT_SUPPORT_WA;
  return raw.replace(/^\+/, "").replace(/\D/g, "") || DEFAULT_SUPPORT_WA;
}

/** Load business number from backend (Interakt-configured) with env fallback. */
async function loadWhatsAppSupportDigits(): Promise<string> {
  if (cachedWaMeDigits) return cachedWaMeDigits;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const res = await fetch(`${API_URL}/public/whatsapp-support`);
      if (res.ok) {
        const data = (await res.json()) as { business_phone_wa_me?: string | null };
        const fromApi = data.business_phone_wa_me?.replace(/\D/g, "");
        if (fromApi) {
          cachedWaMeDigits = fromApi;
          return cachedWaMeDigits;
        }
      }
    } catch {
      /* use env/default */
    }
    cachedWaMeDigits = envSupportDigits();
    return cachedWaMeDigits;
  })();

  return fetchPromise;
}

function supportDigitsSync(): string {
  return cachedWaMeDigits || envSupportDigits();
}

function getWhatsAppSupportUrl(prefill: string): string {
  const digits = supportDigitsSync();
  const text = encodeURIComponent(prefill.trim());
  return `https://wa.me/${digits}?text=${text}`;
}

export function openWhatsAppSupport(prefill: string): void {
  void loadWhatsAppSupportDigits().finally(() => {
    window.open(getWhatsAppSupportUrl(prefill), "_blank", "noopener,noreferrer");
  });
}

export const whatsappSupportCopy = {
  general: "Hi Zendt Support, I need help with...",
  paymentFailed: (id: string) => `Hi Zendt Support, my payment [ID: ${id}] has failed. Please help.`,
  kycStuck: "Hi Zendt Support, my KYC is stuck. Please help.",
  transaction: (ref: string) => `Hi Zendt Support, regarding transaction [ref: ${ref}] — please help.`,
};
