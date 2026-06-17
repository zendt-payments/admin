const NGROK_SKIP_HEADER = "ngrok-skip-browser-warning";

/** True when VITE_API_URL points at an ngrok tunnel (free tier serves an HTML interstitial without this header). */
export function isNgrokApiUrl(url?: string): boolean {
  const base = (url ?? import.meta.env.VITE_API_URL ?? "").toLowerCase();
  return base.includes("ngrok-free.app") || base.includes("ngrok-free.dev") || base.includes(".ngrok.io");
}

export function mergeApiHeaders(init?: HeadersInit): Headers {
  const headers = new Headers(init);
  if (isNgrokApiUrl()) {
    headers.set(NGROK_SKIP_HEADER, "true");
  }
  return headers;
}

/** fetch wrapper — adds ngrok skip header when the API base is an ngrok URL. */
export function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, {
    ...init,
    headers: mergeApiHeaders(init?.headers),
  });
}
