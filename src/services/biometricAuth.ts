import { Capacitor } from "@capacitor/core";
import { BiometryType, NativeBiometric } from "@capgo/capacitor-native-biometric";
import {
  clearWebBiometricCredentials,
  hasWebBiometricCredentials,
  isWebBiometricAvailable,
  saveWebBiometricCredentials,
  verifyWebBiometricAndGetCredentials,
} from "./webBiometricAuth";

/** Keychain / Keystore namespace for Cognito refresh token storage (see Capgo docs). */
const BIOMETRIC_CREDENTIAL_SERVER = "zendt.cognito.auth";

export type BiometricUnlockResult =
  | { ok: true; username: string; refreshToken: string }
  | { ok: false; reason: "cancelled" | "unavailable" | "no_credentials" | "error"; message?: string };

/** Auth methods in priority order: face → fingerprint → device PIN/passcode. */
export type BiometricAuthTier = "face" | "fingerprint" | "pin";

const VERIFY_PROMPT = {
  reason: "Sign in to Zendt",
  title: "Biometric sign-in",
  subtitle: "Confirm it’s you",
} as const;

function isUserCancelled(message: string): boolean {
  return /cancel|cancelled|USER_CANCEL|code 16|1001|fall.?back/i.test(message);
}

/** Try next tier when this method is not on the device or not enrolled. */
function shouldAttemptNextTier(message: string): boolean {
  if (isUserCancelled(message)) return false;
  return /not available|not enrolled|BIOMETRICS_NOT|unavailable|no biometric|HW_NOT|HW_UNAVAILABLE|biometry not available|error code 3|code 3\b/i.test(
    message
  );
}

function androidHasFaceSensor(type: BiometryType): boolean {
  return (
    type === BiometryType.FACE_AUTHENTICATION ||
    type === BiometryType.FACE_ID ||
    type === BiometryType.MULTIPLE
  );
}

function androidHasFingerprintSensor(type: BiometryType): boolean {
  return (
    type === BiometryType.FINGERPRINT || type === BiometryType.TOUCH_ID || type === BiometryType.MULTIPLE
  );
}

/**
 * Ordered tiers to attempt. Face first, then fingerprint, then PIN (iOS only).
 * On a given device usually only one biometric tier applies; Android may try face then fingerprint if face is not enrolled.
 */
export async function getNativeBiometricAuthTiers(): Promise<BiometricAuthTier[]> {
  const platform = Capacitor.getPlatform();
  const bioOnly = await NativeBiometric.isAvailable({ useFallback: false });
  const withDeviceAuth = await NativeBiometric.isAvailable({ useFallback: true });

  const tiers: BiometricAuthTier[] = [];

  if (platform === "android") {
    const type = bioOnly.biometryType;
    if (androidHasFaceSensor(type)) tiers.push("face");
    if (androidHasFingerprintSensor(type)) tiers.push("fingerprint");
    return [...new Set(tiers)];
  }

  if (platform === "ios") {
    if (bioOnly.strongBiometryIsAvailable) {
      if (bioOnly.biometryType === BiometryType.TOUCH_ID) tiers.push("fingerprint");
      else tiers.push("face");
    } else if (withDeviceAuth.isAvailable && withDeviceAuth.deviceIsSecure) {
      tiers.push("pin");
    }
    return tiers;
  }

  if (bioOnly.strongBiometryIsAvailable) {
    tiers.push(bioOnly.biometryType === BiometryType.TOUCH_ID ? "fingerprint" : "face");
  }
  return tiers;
}

/** Label for the login button from the highest-priority available method. */
export async function getBiometricLoginButtonLabel(): Promise<string> {
  if (!Capacitor.isNativePlatform()) return "Use biometrics";
  const tiers = await getNativeBiometricAuthTiers();
  const primary = tiers[0];
  if (primary === "face") return "Use Face ID";
  if (primary === "fingerprint") return "Use fingerprint";
  if (primary === "pin") return "Use device passcode";
  const withDevice = await NativeBiometric.isAvailable({ useFallback: true });
  if (withDevice.isAvailable && withDevice.deviceIsSecure) return "Use device passcode";
  return "Use Face ID / Biometrics";
}

async function verifyNativeTier(tier: BiometricAuthTier): Promise<void> {
  const platform = Capacitor.getPlatform();

  if (tier === "face") {
    if (platform === "android") {
      await NativeBiometric.verifyIdentity({
        ...VERIFY_PROMPT,
        allowedBiometryTypes: [BiometryType.FACE_AUTHENTICATION, BiometryType.FACE_ID],
      });
      return;
    }
    await NativeBiometric.verifyIdentity({ ...VERIFY_PROMPT, useFallback: false });
    return;
  }

  if (tier === "fingerprint") {
    if (platform === "android") {
      await NativeBiometric.verifyIdentity({
        ...VERIFY_PROMPT,
        allowedBiometryTypes: [BiometryType.FINGERPRINT],
      });
      return;
    }
    await NativeBiometric.verifyIdentity({ ...VERIFY_PROMPT, useFallback: false });
    return;
  }

  if (tier === "pin") {
    if (platform === "android") {
      throw new Error(
        "Device PIN unlock is not supported in the Android app. Enroll fingerprint or face, or use password."
      );
    }
    await NativeBiometric.verifyIdentity({ ...VERIFY_PROMPT, useFallback: true });
  }
}

/** Biometric hardware available (face, fingerprint, or iOS device passcode). */
export async function isBiometricHardwareAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const tiers = await getNativeBiometricAuthTiers();
      if (tiers.length > 0) return true;
      if (Capacitor.getPlatform() === "ios") {
        const relaxed = await NativeBiometric.isAvailable({ useFallback: true });
        return relaxed.isAvailable && relaxed.deviceIsSecure;
      }
      return false;
    } catch {
      return false;
    }
  }
  return isWebBiometricAvailable();
}

export async function hasStoredBiometricCredentials(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) {
    try {
      const r = await NativeBiometric.isCredentialsSaved({ server: BIOMETRIC_CREDENTIAL_SERVER });
      return r.isSaved;
    } catch {
      return false;
    }
  }
  return hasWebBiometricCredentials();
}

/**
 * Stores Cognito refresh token behind biometrics.
 * Call only after explicit user opt-in following password login.
 */
export async function saveBiometricCredentials(username: string, refreshToken: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await NativeBiometric.setCredentials({
      username: username.trim(),
      password: refreshToken,
      server: BIOMETRIC_CREDENTIAL_SERVER,
    });
    return;
  }
  await saveWebBiometricCredentials(username, refreshToken);
}

export async function clearBiometricCredentials(): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    try {
      await NativeBiometric.deleteCredentials({ server: BIOMETRIC_CREDENTIAL_SERVER });
    } catch {
      /* already removed */
    }
    return;
  }
  await clearWebBiometricCredentials();
}

/**
 * Prompts biometrics (face → fingerprint → PIN), then reads stored username + refresh token.
 */
export async function verifyBiometricAndGetCredentials(): Promise<BiometricUnlockResult> {
  if (!Capacitor.isNativePlatform()) {
    return verifyWebBiometricAndGetCredentials();
  }

  const tiers = await getNativeBiometricAuthTiers();
  if (tiers.length === 0) {
    const platform = Capacitor.getPlatform();
    return {
      ok: false,
      reason: "unavailable",
      message:
        platform === "ios"
          ? "Set up Face ID, Touch ID, or a device passcode in Settings, or use password sign-in."
          : "Set up fingerprint or face unlock in Settings, or use password sign-in.",
    };
  }

  const saved = await NativeBiometric.isCredentialsSaved({ server: BIOMETRIC_CREDENTIAL_SERVER });
  if (!saved.isSaved) {
    return { ok: false, reason: "no_credentials" };
  }

  let lastError = "Biometric sign-in failed.";

  for (let i = 0; i < tiers.length; i++) {
    const tier = tiers[i];
    try {
      await verifyNativeTier(tier);
      const creds = await NativeBiometric.getCredentials({ server: BIOMETRIC_CREDENTIAL_SERVER });
      return {
        ok: true,
        username: creds.username,
        refreshToken: creds.password,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      lastError = msg;
      if (isUserCancelled(msg)) {
        return { ok: false, reason: "cancelled", message: msg };
      }
      const hasNext = i < tiers.length - 1;
      if (hasNext && shouldAttemptNextTier(msg)) {
        continue;
      }
      break;
    }
  }

  return { ok: false, reason: "error", message: lastError };
}
