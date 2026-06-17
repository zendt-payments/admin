import { describe, it, expect } from "vitest";
import { ApiError, isApiError } from "../../src/lib/apiError";

describe("ApiError", () => {
  it("carries code and status", () => {
    const err = new ApiError("bad", { code: "E1", status: 422 });
    expect(err.message).toBe("bad");
    expect(err.code).toBe("E1");
    expect(err.status).toBe(422);
    expect(isApiError(err)).toBe(true);
  });

  it("isApiError is false for generic Error", () => {
    expect(isApiError(new Error("x"))).toBe(false);
  });
});
