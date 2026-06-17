/**
 * Share message for Refer & Earn — referral code only, no URLs.
 */
export function buildReferralShareMessage(code: string, rewardAmount = 75): string {
  const referralCode = code.trim().toUpperCase();
  if (!referralCode) return "";

  return [
    `Join Zendt and we both earn ₹${rewardAmount}!`,
    "",
    `Referral code: ${referralCode}`,
    "",
    "Download the Zendt app, sign up, and enter this code during registration.",
  ].join("\n");
}
