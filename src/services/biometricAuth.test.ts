import { describe, it, expect, vi, beforeEach } from "vitest";
import { Capacitor } from "@capacitor/core";
import { BiometryType, NativeBiometric } from "@capgo/capacitor-native-biometric";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(() => true),
    getPlatform: vi.fn(() => "ios"),
  },
}));

vi.mock("@capgo/capacitor-native-biometric", () => ({
  BiometryType: {
    NONE: 0,
    TOUCH_ID: 1,
    FACE_ID: 2,
    FINGERPRINT: 3,
    FACE_AUTHENTICATION: 4,
    MULTIPLE: 6,
    DEVICE_CREDENTIAL: 7,
  },
  NativeBiometric: {
    isAvailable: vi.fn(),
    isCredentialsSaved: vi.fn(),
    verifyIdentity: vi.fn(),
    getCredentials: vi.fn(),
  },
}));

vi.mock("./webBiometricAuth", () => ({
  isWebBiometricAvailable: vi.fn(() => false),
  hasWebBiometricCredentials: vi.fn(() => false),
  verifyWebBiometricAndGetCredentials: vi.fn(),
  saveWebBiometricCredentials: vi.fn(),
  clearWebBiometricCredentials: vi.fn(),
}));

describe("getNativeBiometricAuthTiers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("prefers face on iOS with Face ID", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");
    vi.mocked(NativeBiometric.isAvailable).mockImplementation(async (opts) => {
      if (opts?.useFallback) {
        return {
          isAvailable: true,
          biometryType: BiometryType.FACE_ID,
          deviceIsSecure: true,
          strongBiometryIsAvailable: true,
          authenticationStrength: 1,
        };
      }
      return {
        isAvailable: true,
        biometryType: BiometryType.FACE_ID,
        deviceIsSecure: true,
        strongBiometryIsAvailable: true,
        authenticationStrength: 1,
      };
    });

    const { getNativeBiometricAuthTiers } = await import("./biometricAuth");
    await expect(getNativeBiometricAuthTiers()).resolves.toEqual(["face"]);
  });

  it("uses fingerprint on iOS with Touch ID", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");
    vi.mocked(NativeBiometric.isAvailable).mockResolvedValue({
      isAvailable: true,
      biometryType: BiometryType.TOUCH_ID,
      deviceIsSecure: true,
      strongBiometryIsAvailable: true,
      authenticationStrength: 1,
    });

    const { getNativeBiometricAuthTiers } = await import("./biometricAuth");
    await expect(getNativeBiometricAuthTiers()).resolves.toEqual(["fingerprint"]);
  });

  it("uses PIN on iOS when no biometrics enrolled", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("ios");
    vi.mocked(NativeBiometric.isAvailable).mockImplementation(async (opts) => {
      if (opts?.useFallback) {
        return {
          isAvailable: true,
          biometryType: BiometryType.NONE,
          deviceIsSecure: true,
          strongBiometryIsAvailable: false,
          authenticationStrength: 2,
        };
      }
      return {
        isAvailable: false,
        biometryType: BiometryType.NONE,
        deviceIsSecure: true,
        strongBiometryIsAvailable: false,
        authenticationStrength: 0,
      };
    });

    const { getNativeBiometricAuthTiers } = await import("./biometricAuth");
    await expect(getNativeBiometricAuthTiers()).resolves.toEqual(["pin"]);
  });

  it("orders face before fingerprint on Android when both exist", async () => {
    vi.mocked(Capacitor.getPlatform).mockReturnValue("android");
    vi.mocked(NativeBiometric.isAvailable).mockResolvedValue({
      isAvailable: true,
      biometryType: BiometryType.MULTIPLE,
      deviceIsSecure: true,
      strongBiometryIsAvailable: true,
      authenticationStrength: 1,
    });

    const { getNativeBiometricAuthTiers } = await import("./biometricAuth");
    await expect(getNativeBiometricAuthTiers()).resolves.toEqual(["face", "fingerprint"]);
  });
});
