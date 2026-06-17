import { base64UrlToBuffer, bufferToBase64Url } from "../lib/webAuthnBuffer";
import { getPersistent, removePersistent, setPersistent } from "../lib/storage/persistentStorage";

const WEB_BIOMETRIC_STORAGE_KEY = "zendt.web.biometric.v1";

type WebBiometricStore = {
  username: string;
  refreshToken: string;
  credentialId: string;
};

export type WebBiometricUnlockResult =
  | { ok: true; username: string; refreshToken: string }
  | { ok: false; reason: "cancelled" | "unavailable" | "no_credentials" | "error"; message?: string };

function readStore(raw: string | null): WebBiometricStore | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as WebBiometricStore;
    if (!parsed.username || !parsed.refreshToken || !parsed.credentialId) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Platform authenticator (Touch ID, Face ID, Windows Hello) in a secure browser context. */
export async function isWebBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!window.isSecureContext) return false;
  if (!window.PublicKeyCredential) return false;

  try {
    if (PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable) {
      return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    }
    return true;
  } catch {
    return false;
  }
}

export async function hasWebBiometricCredentials(): Promise<boolean> {
  const store = readStore(await getPersistent(WEB_BIOMETRIC_STORAGE_KEY));
  return store != null;
}

export async function saveWebBiometricCredentials(username: string, refreshToken: string): Promise<void> {
  if (!(await isWebBiometricAvailable())) {
    throw new Error("Biometrics are not available in this browser.");
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const trimmedUsername = username.trim();

  const credential = (await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Zendt", id: window.location.hostname },
      user: {
        id: userId,
        name: trimmedUsername,
        displayName: trimmedUsername,
      },
      pubKeyCredParams: [
        { alg: -7, type: "public-key" },
        { alg: -257, type: "public-key" },
      ],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error("Biometric setup was cancelled.");
  }

  const payload: WebBiometricStore = {
    username: trimmedUsername,
    refreshToken,
    credentialId: bufferToBase64Url(credential.rawId),
  };

  await setPersistent(WEB_BIOMETRIC_STORAGE_KEY, JSON.stringify(payload));
}

export async function clearWebBiometricCredentials(): Promise<void> {
  await removePersistent(WEB_BIOMETRIC_STORAGE_KEY);
}

export async function verifyWebBiometricAndGetCredentials(): Promise<WebBiometricUnlockResult> {
  if (!(await isWebBiometricAvailable())) {
    return { ok: false, reason: "unavailable" };
  }

  const store = readStore(await getPersistent(WEB_BIOMETRIC_STORAGE_KEY));
  if (!store) {
    return { ok: false, reason: "no_credentials" };
  }

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: window.location.hostname,
        allowCredentials: [
          {
            id: base64UrlToBuffer(store.credentialId),
            type: "public-key",
            transports: ["internal"],
          },
        ],
        userVerification: "required",
        timeout: 60_000,
      },
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return { ok: false, reason: "cancelled" };
    }

    return {
      ok: true,
      username: store.username,
      refreshToken: store.refreshToken,
    };
  } catch (e: unknown) {
    if (e instanceof DOMException && e.name === "NotAllowedError") {
      return { ok: false, reason: "cancelled", message: e.message };
    }
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: "error", message: msg };
  }
}
