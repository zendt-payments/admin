import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./testMode", () => ({
  TEST_MODE: false,
  TEST_EMAIL: "test@zendt.test",
  TEST_PASSWORD: "TestPass1!",
  hasTestSession: vi.fn(() => false),
  setTestSession: vi.fn(),
  TEST_AUTH_ID_TOKEN: "test-id",
  TEST_AUTH_REFRESH_TOKEN: "test-refresh",
}));

describe("fetchSignupEmailStatus", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "ap-south-1_TestPool123");
    vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client");
    vi.stubEnv("VITE_API_URL", "https://api.test");
  });

  it("returns repair when Cognito is confirmed without a MongoDB profile", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ available: true, repair: true }),
      }))
    );
    const { fetchSignupEmailStatus } = await import("./auth");
    await expect(fetchSignupEmailStatus("repair@example.com")).resolves.toEqual({
      available: true,
      repair: true,
    });
  });
});

describe("precheckSignupEmailAvailable", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "ap-south-1_TestPool123");
    vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client");
    vi.stubEnv("VITE_API_URL", "https://api.test");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ available: false, registered: true }),
      }))
    );
  });

  it("throws when the email is already registered", async () => {
    const { precheckSignupEmailAvailable, SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE } = await import("./auth");
    await expect(precheckSignupEmailAvailable("taken@example.com")).rejects.toThrow(
      SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE
    );
  });
});
