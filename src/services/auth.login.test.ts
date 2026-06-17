import { describe, expect, it } from "vitest";
import { LOGIN_ACCOUNT_NOT_REGISTERED_MESSAGE, mapCognitoLoginError } from "./auth";
import { ApiError, isUnregisteredAccountApiError } from "../lib/apiError";

describe("mapCognitoLoginError", () => {
  it("maps unconfirmed Cognito users to not-registered message", () => {
    const err = mapCognitoLoginError({
      code: "UserNotConfirmedException",
      message: "User is not confirmed.",
    });
    expect(err.message).toBe(LOGIN_ACCOUNT_NOT_REGISTERED_MESSAGE);
  });

  it("maps not-confirmed message text when code is missing", () => {
    const err = mapCognitoLoginError({ message: "User is not confirmed." });
    expect(err.message).toBe(LOGIN_ACCOUNT_NOT_REGISTERED_MESSAGE);
  });

  it("maps invalid credentials to a generic message", () => {
    const err = mapCognitoLoginError({
      code: "NotAuthorizedException",
      message: "Incorrect username or password.",
    });
    expect(err.message).toBe("Invalid email or password.");
  });

  it("passes through other Cognito errors", () => {
    const err = mapCognitoLoginError({
      code: "PasswordResetRequiredException",
      message: "Password reset required.",
    });
    expect(err.message).toBe("Password reset required.");
  });
});

describe("isUnregisteredAccountApiError", () => {
  it("detects missing user by HTTP status", () => {
    expect(isUnregisteredAccountApiError(new ApiError("Not found", { status: 404 }))).toBe(true);
  });

  it("detects missing user by error code", () => {
    expect(
      isUnregisteredAccountApiError(new ApiError("Missing", { code: "USER_NOT_FOUND", status: 400 }))
    ).toBe(true);
  });

  it("ignores unrelated API errors", () => {
    expect(
      isUnregisteredAccountApiError(new ApiError("Deactivated", { code: "ACCOUNT_DEACTIVATED" }))
    ).toBe(false);
  });
});
