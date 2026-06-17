import { beforeEach, describe, expect, it } from "vitest";
import {
  mockApi,
  resetReferralMockForTesting,
  seedReferralMockWithEarnings,
} from "../../src/services/mockApi";
import { buildReferralShareMessage } from "../../src/utils/referralShare";

type ReferralStats = {
  code: string;
  total_referrals: number;
  completed_referrals: number;
  total_earnings: number;
  available_earnings: number;
  reward_per_referral: number;
  pending_withdrawal: { amount: number; upi_id: string } | null;
  referrals: Array<{ name: string; email: string; status: string; reward: number; date: string }>;
  pagination?: { hasMore: boolean; nextCursor: string | null; limit: number };
};

describe("Refer & Earn smoke (mock API)", () => {
  beforeEach(() => {
    resetReferralMockForTesting();
  });

  describe("code and stats", () => {
    it("returns a referral code", async () => {
      const res = await mockApi<{ code: string }>("GET", "/referral/code");
      expect(res.code).toBe("ZENDT-TEST-2025");
    });

    it("returns stats with withdrawable balance and referral rows", async () => {
      const stats = await mockApi<ReferralStats>("GET", "/referral/stats?limit=20");

      expect(stats.code).toBe("ZENDT-TEST-2025");
      expect(stats.reward_per_referral).toBe(75);
      expect(stats.total_referrals).toBe(3);
      expect(stats.completed_referrals).toBe(2);
      expect(stats.available_earnings).toBe(150);
      expect(stats.total_earnings).toBe(150);
      expect(stats.pending_withdrawal).toBeNull();
      expect(stats.referrals).toHaveLength(3);
      expect(stats.referrals.some((r) => r.status === "rewarded")).toBe(true);
      expect(stats.referrals.some((r) => r.status === "pending")).toBe(true);
    });

    it("paginates referral list", async () => {
      const page1 = await mockApi<ReferralStats>("GET", "/referral/stats?limit=1");
      expect(page1.referrals).toHaveLength(1);
      expect(page1.pagination?.hasMore).toBe(true);
      expect(page1.pagination?.nextCursor).toBeTruthy();

      const cursor = page1.pagination!.nextCursor!;
      const page2 = await mockApi<ReferralStats>(
        "GET",
        `/referral/stats?limit=1&cursor=${encodeURIComponent(cursor)}`
      );
      expect(page2.referrals).toHaveLength(1);
      expect(page2.referrals[0].email).not.toBe(page1.referrals[0].email);
    });
  });

  describe("apply referral code", () => {
    it("accepts a referral code at signup/dashboard", async () => {
      const res = await mockApi<{ message: string }>("POST", "/referral/apply", {
        code: "ZENDT-TEST-2025",
      });
      expect(res.message).toMatch(/applied successfully/i);
    });
  });

  describe("share message", () => {
    it("builds a share message with code and no URLs", () => {
      const msg = buildReferralShareMessage("zendt-test-2025", 75);
      expect(msg).toContain("ZENDT-TEST-2025");
      expect(msg).toContain("₹75");
      expect(msg).not.toContain("http");
    });
  });

  describe("withdraw", () => {
    it("rejects invalid UPI ID", async () => {
      const res = await mockApi<{ error?: string }>("POST", "/referral/withdraw", { upi_id: "not-a-vpa" });
      expect(res.error).toMatch(/valid UPI/i);
    });

    it("rejects withdraw when balance is zero", async () => {
      seedReferralMockWithEarnings(0);
      const res = await mockApi<{ error?: string }>("POST", "/referral/withdraw", { upi_id: "user@paytm" });
      expect(res.error).toMatch(/no referral balance/i);
    });

    it("withdraws full balance and sets pending withdrawal", async () => {
      const result = await mockApi<{
        success: boolean;
        amount: number;
        status: string;
        withdrawal_id?: string;
      }>("POST", "/referral/withdraw", { upi_id: "testuser@paytm" });

      expect(result.success).toBe(true);
      expect(result.amount).toBe(150);
      expect(result.status).toBe("pending");
      expect(result.withdrawal_id).toBeTruthy();

      const stats = await mockApi<ReferralStats>("GET", "/referral/stats");
      expect(stats.available_earnings).toBe(0);
      expect(stats.total_earnings).toBe(0);
      expect(stats.pending_withdrawal?.amount).toBe(150);
      expect(stats.pending_withdrawal?.upi_id).toBe("testuser@paytm");
    });

    it("blocks a second withdraw while one is pending", async () => {
      await mockApi("POST", "/referral/withdraw", { upi_id: "first@paytm" });

      const second = await mockApi<{ error?: string }>("POST", "/referral/withdraw", {
        upi_id: "second@paytm",
      });
      expect(second.error).toMatch(/pending/i);
    });
  });

  describe("admin payout flow", () => {
    it("lists pending withdrawal, loads detail, and marks paid", async () => {
      const withdraw = await mockApi<{ withdrawal_id: string }>("POST", "/referral/withdraw", {
        upi_id: "admin-test@paytm",
      });
      const id = withdraw.withdrawal_id!;

      const list = await mockApi<{ items: Array<{ id: string; status: string }> }>(
        "GET",
        "/admin/referral-withdrawals?status=pending&limit=20&page=1"
      );
      expect(list.items.some((row) => row.id === id && row.status === "pending")).toBe(true);

      const detail = await mockApi<{ id: string; status: string; upi_id: string }>(
        "GET",
        `/admin/referral-withdrawals/${encodeURIComponent(id)}`
      );
      expect(detail.id).toBe(id);
      expect(detail.status).toBe("pending");
      expect(detail.upi_id).toBe("admin-test@paytm");

      const paid = await mockApi<{ success: boolean; status: string }>(
        "POST",
        `/admin/referral-withdrawals/${encodeURIComponent(id)}/mark-paid`,
        { admin_notes: "Paid via UPI" }
      );
      expect(paid.success).toBe(true);
      expect(paid.status).toBe("paid");

      const stats = await mockApi<ReferralStats>("GET", "/referral/stats");
      expect(stats.pending_withdrawal).toBeNull();

      const after = await mockApi<{ status: string; paid_at: string | null }>(
        "GET",
        `/admin/referral-withdrawals/${encodeURIComponent(id)}`
      );
      expect(after.status).toBe("paid");
      expect(after.paid_at).toBeTruthy();
    });
  });
});
