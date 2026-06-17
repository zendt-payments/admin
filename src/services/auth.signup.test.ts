import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSignUp = vi.fn();
const mockResendConfirmationCode = vi.fn();
const mockConfirmRegistration = vi.fn();

vi.mock("./testMode", () => ({
  TEST_MODE: false,
  TEST_EMAIL: "test@zendt.test",
  TEST_PASSWORD: "TestPass1!",
  hasTestSession: vi.fn(() => false),
  setTestSession: vi.fn(),
  TEST_AUTH_ID_TOKEN: "test-id",
  TEST_AUTH_REFRESH_TOKEN: "test-refresh",
}));

vi.mock("amazon-cognito-identity-js", () => {
  class CognitoUserAttribute {
    attrs: { Name: string; Value: string };
    constructor(attrs: { Name: string; Value: string }) {
      this.attrs = attrs;
    }
  }
  class CognitoUser {
    Username: string;
    constructor(opts: { Username: string }) {
      this.Username = opts.Username;
    }
    resendConfirmationCode = mockResendConfirmationCode;
    confirmRegistration = mockConfirmRegistration;
  }
  class CognitoUserPool {
    signUp = mockSignUp;
  }
  return {
    CognitoUserPool,
    CognitoUser,
    CognitoUserAttribute,
    CognitoRefreshToken: class {},
    CognitoIdToken: class {},
    CognitoAccessToken: class {},
    CognitoUserSession: class {},
    AuthenticationDetails: class {},
  };
});

const signupPayload = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  password: "SecurePass1!",
};

describe("requestSignup duplicate email", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "test-pool");
    vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client");
    mockResendConfirmationCode.mockImplementation((cb: (err: null) => void) => cb(null));
  });

  it("rejects AliasExistsException the same as UsernameExistsException (reject mode)", async () => {
    mockSignUp.mockImplementation(
      (_u: string, _p: string, _a: unknown[], _l: unknown[], cb: (err: Error) => void) => {
        const err = new Error("Email already exists") as Error & { code: string; name: string };
        err.code = "AliasExistsException";
        err.name = "AliasExistsException";
        cb(err);
      }
    );

    const { requestSignup, SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE } = await import("./auth");
    await expect(requestSignup(signupPayload, { onDuplicateEmail: "reject" })).rejects.toThrow(
      SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE
    );
    expect(mockResendConfirmationCode).not.toHaveBeenCalled();
  });

  it("rejects on signup form without resending verification (reject mode)", async () => {
    mockSignUp.mockImplementation(
      (_u: string, _p: string, _a: unknown[], _l: unknown[], cb: (err: Error) => void) => {
        const err = new Error("User already exists") as Error & { code: string; name: string };
        err.code = "UsernameExistsException";
        err.name = "UsernameExistsException";
        cb(err);
      }
    );

    const { requestSignup, SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE } = await import("./auth");
    await expect(requestSignup(signupPayload, { onDuplicateEmail: "reject" })).rejects.toThrow(
      SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE
    );
    expect(mockResendConfirmationCode).not.toHaveBeenCalled();
  });

  it("resends OTP and resolves for duplicate when onDuplicateEmail is resend (admin flow)", async () => {
    mockSignUp.mockImplementation(
      (_u: string, _p: string, _a: unknown[], _l: unknown[], cb: (err: Error) => void) => {
        const err = new Error("User already exists") as Error & { code: string; name: string };
        err.code = "UsernameExistsException";
        err.name = "UsernameExistsException";
        cb(err);
      }
    );
    mockResendConfirmationCode.mockImplementation((cb: (err: null) => void) => cb(null));

    const { requestSignup } = await import("./auth");
    await expect(requestSignup(signupPayload)).resolves.toMatchObject({
      needsConfirmation: true,
      resentExisting: true,
      email: "jane@example.com",
    });
  });

  it("resolves with needsConfirmation for a new signup", async () => {
    mockSignUp.mockImplementation(
      (
        _u: string,
        _p: string,
        _a: unknown[],
        _l: unknown[],
        cb: (err: null, result: { user: { getUsername: () => string }; userConfirmed: boolean }) => void
      ) => {
        cb(null, {
          user: { getUsername: () => "jane@example.com" },
          userConfirmed: false,
        });
      }
    );

    const { requestSignup } = await import("./auth");
    await expect(requestSignup(signupPayload, { onDuplicateEmail: "reject" })).resolves.toMatchObject({
      needsConfirmation: true,
      email: "jane@example.com",
    });
    expect(mockResendConfirmationCode).not.toHaveBeenCalled();
  });

  it("treats an already-confirmed duplicate email as ready to finish signup", async () => {
    mockSignUp.mockImplementation(
      (_u: string, _p: string, _a: unknown[], _l: unknown[], cb: (err: Error) => void) => {
        const err = new Error("User already exists") as Error & { code: string; name: string };
        err.code = "UsernameExistsException";
        err.name = "UsernameExistsException";
        cb(err);
      }
    );
    mockResendConfirmationCode.mockImplementation((cb: (err: Error) => void) => {
      const err = new Error("Current status is CONFIRMED") as Error & { code: string };
      err.code = "InvalidParameterException";
      cb(err);
    });

    const { requestSignup } = await import("./auth");
    await expect(requestSignup(signupPayload)).resolves.toMatchObject({
      needsConfirmation: false,
      alreadyConfirmed: true,
      email: "jane@example.com",
    });
  });

  it("surfaces Cognito password policy errors without redirecting", async () => {
    mockSignUp.mockImplementation(
      (_u: string, _p: string, _a: unknown[], _l: unknown[], cb: (err: Error) => void) => {
        const err = new Error("Password did not conform with policy") as Error & { code: string };
        err.code = "InvalidPasswordException";
        cb(err);
      }
    );

    const { requestSignup } = await import("./auth");
    await expect(requestSignup(signupPayload, { onDuplicateEmail: "reject" })).rejects.toThrow(
      /Password did not conform/
    );
  });
});

describe("confirmSignup", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("VITE_COGNITO_USER_POOL_ID", "test-pool");
    vi.stubEnv("VITE_COGNITO_CLIENT_ID", "test-client");
  });

  it("succeeds when Cognito reports the user is already confirmed", async () => {
    mockConfirmRegistration.mockImplementation(
      (_code: string, _force: boolean, cb: (err: Error) => void) => {
        const err = new Error("User cannot be confirmed. Current status is CONFIRMED") as Error & {
          code: string;
        };
        err.code = "NotAuthorizedException";
        cb(err);
      }
    );

    const { confirmSignup } = await import("./auth");
    await expect(confirmSignup("jane@example.com", "123456")).resolves.toEqual({
      success: true,
      alreadyConfirmed: true,
    });
  });
});

describe("isPasswordStrongEnough", () => {
  it("requires length, cases, digit, and symbol", async () => {
    const { isPasswordStrongEnough } = await import("./auth");
    expect(isPasswordStrongEnough("short1!")).toBe(false);
    expect(isPasswordStrongEnough("alllowercase1!")).toBe(false);
    expect(isPasswordStrongEnough("ALLUPPERCASE1!")).toBe(false);
    expect(isPasswordStrongEnough("NoDigitsHere!")).toBe(false);
    expect(isPasswordStrongEnough("NoSymbol123")).toBe(false);
    expect(isPasswordStrongEnough("ValidPass1!")).toBe(true);
  });
});
