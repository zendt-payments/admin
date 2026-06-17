import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { TEST_MODE } from "../services/testMode";
import { apiFetch } from "../lib/apiFetch";
import StandalonePage from "./layout/StandalonePage";
import {
  isLayerCancelledStatus,
  isLayerFailedStatus,
  isLayerPaidStatus,
  loadLayerScript,
  openLayerCheckout,
  type LayerCheckoutError,
  type LayerCheckoutResponse,
} from "../lib/layerCheckout";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:4000").replace(/\/$/, "");

/** Zendt brand colors for Zwitch Layer theme (hex only per Zwitch docs). */
const LAYER_THEME_COLOR = "#7C5CFC";
const LAYER_THEME_ERROR_COLOR = "#ff2b2b";
/** Public, CDN-hosted logo so Zwitch's servers can fetch it (must be a reachable absolute URL). */
const LAYER_THEME_LOGO_URL = "https://zendt-logo.s3.ap-south-1.amazonaws.com/logo/logo.png";

type PayConfig = {
  accessKey: string;
  layerScriptUrl: string;
  sandbox?: boolean;
  layer_mode?: "embed" | "hosted";
  layer_source_url?: string;
  error?: string;
};

type PayStatus = {
  status: string;
  pg_error_message?: string | null;
};

type CheckoutPhase = "loading" | "opening" | "open" | "success" | "failed" | "cancelled" | "error";

async function fetchPayConfig(): Promise<PayConfig> {
  const res = await apiFetch(`${API_URL}/public/pay-config`);
  const body = (await res.json().catch(() => ({}))) as PayConfig;
  if (!res.ok) {
    throw new Error(body.error || "Payment gateway is not configured.");
  }
  if (!body.accessKey || !body.layerScriptUrl) {
    throw new Error("Payment gateway is not configured.");
  }
  return body;
}

async function fetchHostedCheckoutUrl(paymentToken: string): Promise<string | null> {
  const res = await apiFetch(
    `${API_URL}/public/pay-redirect?payment_token=${encodeURIComponent(paymentToken)}`
  );
  const body = (await res.json().catch(() => ({}))) as { url?: string; mode?: string; error?: string };
  if (!res.ok || !body.url) return null;
  if (body.mode === "hosted") return body.url;
  return null;
}

async function verifyPaymentStatus(paymentToken: string): Promise<PayStatus | null> {
  const res = await apiFetch(
    `${API_URL}/public/pay-status?payment_token=${encodeURIComponent(paymentToken)}`
  );
  const body = (await res.json().catch(() => ({}))) as PayStatus & { error?: string };
  if (!res.ok) return null;
  return body;
}

function integrationErrorMessage(err: LayerCheckoutError, layerSourceUrl?: string): string {
  const msg = (err.message || err.code || "").toLowerCase();
  if (msg.includes("unauthorized") || msg.includes("access")) {
    const origin = layerSourceUrl || window.location.origin;
    return `Checkout could not open. Ask Zwitch/Open to whitelist ${origin} in PG domain settings, then try again.`;
  }
  return err.message || err.code || "Checkout failed to open.";
}

/**
 * Customer payment page — standard Zwitch Layer.js checkout (UPI, cards, netbanking, wallets).
 */
export default function PayCheckoutPage() {
  const [searchParams] = useSearchParams();
  const paymentToken = searchParams.get("payment_token")?.trim() || searchParams.get("token")?.trim() || "";

  const [phase, setPhase] = useState<CheckoutPhase>("loading");
  const [message, setMessage] = useState("Opening secure checkout…");
  const [layerSourceUrl, setLayerSourceUrl] = useState("");
  const configRef = useRef<PayConfig | null>(null);
  const checkoutStartedRef = useRef(false);

  const handleLayerResponse = useCallback(
    (response: LayerCheckoutResponse) => {
      const status = String(response.status || "").toLowerCase();

      if (isLayerPaidStatus(status)) {
        setPhase("success");
        setMessage("Payment received. Thank you!");
        void (async () => {
          const verified = await verifyPaymentStatus(paymentToken);
          if (verified && !isLayerPaidStatus(verified.status)) {
            setMessage("Payment is being confirmed. You will receive a receipt shortly.");
          }
        })();
        return;
      }

      if (isLayerFailedStatus(status)) {
        setPhase("failed");
        setMessage("Payment failed. You can try again with another payment method.");
        return;
      }

      if (isLayerCancelledStatus(status)) {
        setPhase("cancelled");
        setMessage("Payment cancelled. Tap Pay again when you are ready.");
        return;
      }

      if (status === "created" || status === "pending") {
        setPhase("open");
      }
    },
    [paymentToken]
  );

  const startLayerCheckout = useCallback(async () => {
    if (!paymentToken || TEST_MODE) return;

    setPhase("opening");
    setMessage("Opening secure checkout…");

    try {
      let config = configRef.current;
      if (!config) {
        config = await fetchPayConfig();
        configRef.current = config;
        setLayerSourceUrl(config.layer_source_url || window.location.origin);
      }

      if (config.layer_mode === "hosted") {
        const hostedUrl = await fetchHostedCheckoutUrl(paymentToken);
        if (hostedUrl) {
          window.location.href = hostedUrl;
          return;
        }
      }

      await loadLayerScript(config.layerScriptUrl);

      openLayerCheckout({
        paymentToken,
        accessKey: config.accessKey,
        theme: {
          color: LAYER_THEME_COLOR,
          error_color: LAYER_THEME_ERROR_COLOR,
          logo: LAYER_THEME_LOGO_URL,
        },
        onResponse: handleLayerResponse,
        onError: (err) => {
          setPhase("error");
          setMessage(integrationErrorMessage(err, config?.layer_source_url || window.location.origin));
        },
      });

      setPhase("open");
      setMessage("Complete your payment in the secure checkout window.");
    } catch (e) {
      setPhase("error");
      setMessage(e instanceof Error ? e.message : "Could not open payment checkout.");
    }
  }, [paymentToken, handleLayerResponse]);

  useEffect(() => {
    if (!paymentToken || TEST_MODE || checkoutStartedRef.current) return;
    checkoutStartedRef.current = true;
    void startLayerCheckout();
  }, [paymentToken, startLayerCheckout]);

  if (!paymentToken) {
    return (
      <StandalonePage centered>
        <p className="max-w-sm text-center text-body text-red-400/90">
          This payment link is invalid or incomplete.
        </p>
      </StandalonePage>
    );
  }

  if (TEST_MODE) {
    return (
      <StandalonePage centered>
        <p className="max-w-sm text-center text-body text-white/50">
          Test build — payment checkout is simulated. Use a real build to pay via Zwitch.
        </p>
      </StandalonePage>
    );
  }

  const showRetry = phase === "failed" || phase === "cancelled" || phase === "error" || phase === "open";

  return (
    <StandalonePage centered>
      <div className="w-full max-w-md space-y-5 text-center">
        <div>
          <img src="/z-logo-nobg.png" alt="Zendt" className="mx-auto h-14 w-14 object-contain opacity-90" />
          <p className="mt-4 text-caption uppercase tracking-wide text-white/40">Secure payment</p>
        </div>

        <p
          className={`text-body leading-relaxed ${
            phase === "success"
              ? "text-emerald-400/90"
              : phase === "error" || phase === "failed"
                ? "text-red-400/90"
                : "text-white/55"
          }`}
        >
          {message}
        </p>

        {(phase === "loading" || phase === "opening") && (
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-[#7C5CFC]" />
        )}

        {showRetry ? (
          <button
            type="button"
            onClick={() => {
              checkoutStartedRef.current = false;
              void startLayerCheckout();
            }}
            className="mx-auto block rounded-xl bg-[#7C5CFC] px-6 py-3 text-body font-medium text-white transition hover:bg-[#6b4ee0]"
          >
            {phase === "open" ? "Reopen checkout" : "Pay again"}
          </button>
        ) : null}

        {phase === "error" && layerSourceUrl ? (
          <p className="text-caption leading-relaxed text-white/35">
            Whitelist hint: add <span className="font-mono text-white/50">{layerSourceUrl}</span> in
            Zwitch/Open PG → website/domain settings.
          </p>
        ) : null}

        <p className="text-caption text-white/30">
          Powered by Zwitch · UPI, cards, netbanking &amp; wallets
        </p>
      </div>
    </StandalonePage>
  );
}
