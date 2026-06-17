import type { dataService } from "../services/dataService";

export type KycStatusData = Awaited<ReturnType<typeof dataService.getKycStatus>>;

/** Product access: PAN + bank + admin-approved proof */
export type FreelancerGateState = "verification_required" | "pending_review" | "approved";

export function deriveKycGateState(status: KycStatusData | undefined): {
  isFullyVerified: boolean;
  gateState: FreelancerGateState;
} {
  if (!status) {
    return { isFullyVerified: false, gateState: "verification_required" };
  }
  const proof = status.proof_status || "none";
  if (proof === "approved") {
    return { isFullyVerified: true, gateState: "approved" };
  }
  if (proof === "submitted") {
    return { isFullyVerified: false, gateState: "pending_review" };
  }
  return { isFullyVerified: false, gateState: "verification_required" };
}
