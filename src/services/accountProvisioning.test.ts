import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "../lib/apiError";

const mockGetCognitoGroups = vi.fn();
const mockIsAdminFromGroups = vi.fn();
const mockLogout = vi.fn();
const mockGetProfileSettings = vi.fn();
const mockSignupComplete = vi.fn();
const mockInvalidateUserMeCache = vi.fn();

vi.mock("./auth", () => ({
  getCognitoGroups: () => mockGetCognitoGroups(),
  isAdminFromGroups: (groups: string[]) => mockIsAdminFromGroups(groups),
  logout: () => mockLogout(),
}));

vi.mock("./dataService", () => ({
  dataService: {
    getProfileSettings: () => mockGetProfileSettings(),
    signupComplete: (password?: string) => mockSignupComplete(password),
  },
  invalidateUserMeCache: () => mockInvalidateUserMeCache(),
}));

describe("ensureFreelancerAccountProvisioned", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCognitoGroups.mockResolvedValue([]);
    mockIsAdminFromGroups.mockReturnValue(false);
    mockLogout.mockResolvedValue(undefined);
    mockSignupComplete.mockResolvedValue({ success: true });
  });

  it("skips provisioning for admin groups", async () => {
    mockIsAdminFromGroups.mockReturnValue(true);
    const { ensureFreelancerAccountProvisioned } = await import("./accountProvisioning");
    await ensureFreelancerAccountProvisioned();
    expect(mockGetProfileSettings).not.toHaveBeenCalled();
    expect(mockSignupComplete).not.toHaveBeenCalled();
  });

  it("loads profile and sends welcome email when the MongoDB row already exists", async () => {
    mockGetProfileSettings.mockResolvedValue({});
    const { ensureFreelancerAccountProvisioned } = await import("./accountProvisioning");
    await ensureFreelancerAccountProvisioned({ password: "ValidPass1!" });
    expect(mockSignupComplete).toHaveBeenCalledWith("ValidPass1!");
  });

  it("retries profile load after auth middleware creates the user", async () => {
    mockGetProfileSettings
      .mockRejectedValueOnce(new ApiError("Not found", { status: 404, code: "USER_NOT_FOUND" }))
      .mockResolvedValueOnce({ full_name: "Jane Doe" });

    const { ensureFreelancerAccountProvisioned } = await import("./accountProvisioning");
    await ensureFreelancerAccountProvisioned();

    expect(mockInvalidateUserMeCache).toHaveBeenCalled();
    expect(mockGetProfileSettings).toHaveBeenCalledTimes(2);
    expect(mockSignupComplete).toHaveBeenCalledWith(undefined);
    expect(mockLogout).not.toHaveBeenCalled();
  });

  it("logs out when profile load still fails after retry", async () => {
    mockGetProfileSettings.mockRejectedValue(
      new ApiError("Not found", { status: 404, code: "USER_NOT_FOUND" })
    );

    const { ensureFreelancerAccountProvisioned } = await import("./accountProvisioning");
    await expect(ensureFreelancerAccountProvisioned()).rejects.toThrow(
      "We couldn't finish setting up your account"
    );
    expect(mockSignupComplete).not.toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalled();
  });
});
