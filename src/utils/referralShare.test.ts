import { describe, it, expect } from "vitest";
import { buildReferralShareMessage } from "./referralShare";

describe("buildReferralShareMessage", () => {
  it("includes referral code and no URLs", () => {
    const msg = buildReferralShareMessage("znd-abc12", 75);
    expect(msg).toContain("Referral code: ZND-ABC12");
    expect(msg).toContain("Download the Zendt app");
    expect(msg).not.toContain("http");
    expect(msg).not.toContain("signup?");
  });
});
