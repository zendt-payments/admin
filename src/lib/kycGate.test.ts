import { describe, expect, it } from "vitest";
import { deriveKycGateState } from "./kycGate";

describe("deriveKycGateState", () => {
  it("returns verification_required when status is missing", () => {
    expect(deriveKycGateState(undefined)).toEqual({
      isFullyVerified: false,
      gateState: "verification_required",
    });
  });

  it("returns approved when proof is approved", () => {
    expect(
      deriveKycGateState({
        proof_status: "approved",
        pan_verified: true,
        bank_verified: true,
      } as never)
    ).toEqual({
      isFullyVerified: true,
      gateState: "approved",
    });
  });

  it("returns pending_review when proof is submitted", () => {
    expect(
      deriveKycGateState({
        proof_status: "submitted",
      } as never)
    ).toEqual({
      isFullyVerified: false,
      gateState: "pending_review",
    });
  });
});
