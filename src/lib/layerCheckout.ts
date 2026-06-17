export type LayerCheckoutResponse = {
  status: string;
  payment_token_id?: string;
  payment_id?: string | null;
};

export type LayerCheckoutError = {
  message?: string;
  code?: string;
};

export type LayerTheme = {
  logo?: string;
  color?: string;
  error_color?: string;
};

declare global {
  interface Window {
    Layer?: {
      checkout: (
        opts: {
          token: string;
          payment_token?: string;
          accesskey: string;
          access_key?: string;
          theme?: LayerTheme;
        },
        onResponse: (response: LayerCheckoutResponse) => void,
        onError?: (err: LayerCheckoutError) => void
      ) => void;
    };
  }
}

const loadedScriptUrls = new Set<string>();

function waitForLayer(timeoutMs = 12_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const poll = () => {
      if (typeof window.Layer?.checkout === "function") {
        resolve();
        return;
      }
      if (Date.now() - started > timeoutMs) {
        reject(new Error("Payment checkout failed to initialize."));
        return;
      }
      window.setTimeout(poll, 50);
    };
    poll();
  });
}

/** Load Zwitch Layer.js once (sandbox or production script URL from backend). */
export async function loadLayerScript(scriptUrl: string): Promise<void> {
  if (typeof window.Layer?.checkout === "function") return;

  const existing = document.querySelector<HTMLScriptElement>(`script[src="${scriptUrl}"]`);
  if (existing) {
    await waitForLayer();
    return;
  }

  if (!loadedScriptUrls.has(scriptUrl)) {
    loadedScriptUrls.add(scriptUrl);
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.id = "context";
      script.type = "text/javascript";
      script.src = scriptUrl;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Zwitch payment checkout."));
      document.head.appendChild(script);
    });
  }

  await waitForLayer();
}

export function openLayerCheckout(opts: {
  paymentToken: string;
  accessKey: string;
  theme?: LayerTheme;
  onResponse: (response: LayerCheckoutResponse) => void;
  onError?: (err: LayerCheckoutError) => void;
}): void {
  const layer = window.Layer;
  if (!layer?.checkout) {
    opts.onError?.({ message: "Payment checkout is not available." });
    return;
  }

  layer.checkout(
    {
      token: opts.paymentToken,
      payment_token: opts.paymentToken,
      accesskey: opts.accessKey,
      access_key: opts.accessKey,
      theme: opts.theme,
    },
    opts.onResponse,
    opts.onError
  );
}

export function isLayerPaidStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "captured" || s === "paid" || s === "success" || s === "successful";
}

export function isLayerFailedStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "failed" || s === "failure";
}

export function isLayerCancelledStatus(status: string): boolean {
  const s = status.toLowerCase();
  return s === "cancelled" || s === "canceled";
}
