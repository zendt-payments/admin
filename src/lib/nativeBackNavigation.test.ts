import { afterEach, describe, expect, it } from "vitest";
import { getNativeBackAction } from "./nativeBackNavigation";

function mockHistoryIdx(idx: number) {
  window.history.replaceState({ idx }, "");
}

describe("getNativeBackAction", () => {
  afterEach(() => {
    mockHistoryIdx(0);
  });

  it("exits from dashboard home even when history exists", () => {
    mockHistoryIdx(3);
    expect(getNativeBackAction("/dashboard/home")).toBe("exit-app");
    expect(getNativeBackAction("/dashboard")).toBe("exit-app");
  });

  it("goes one step back for nested dashboard routes with history", () => {
    mockHistoryIdx(2);
    expect(getNativeBackAction("/dashboard/pricing")).toBe("history-back");
    expect(getNativeBackAction("/dashboard/help")).toBe("history-back");
    expect(getNativeBackAction("/dashboard/profile-settings")).toBe("history-back");
    expect(getNativeBackAction("/dashboard/payment-links/new")).toBe("history-back");
  });

  it("steps invoice/invoices back one layer to invoice-options via history", () => {
    mockHistoryIdx(2);
    expect(getNativeBackAction("/dashboard/invoices")).toBe("history-back");
    expect(getNativeBackAction("/dashboard/invoice")).toBe("history-back");
  });

  it("always returns invoice-options to dashboard home, regardless of entry point", () => {
    // Reached from profile (deep history) — back must still go to dashboard, not profile.
    mockHistoryIdx(4);
    expect(getNativeBackAction("/dashboard/invoice-options")).toBe("dashboard-home");
    mockHistoryIdx(1);
    expect(getNativeBackAction("/dashboard/invoice-options")).toBe("dashboard-home");
  });

  it("falls back to dashboard home when nested route has no history", () => {
    mockHistoryIdx(0);
    expect(getNativeBackAction("/dashboard/pricing")).toBe("dashboard-home");
    expect(getNativeBackAction("/dashboard/settings")).toBe("dashboard-home");
    expect(getNativeBackAction("/dashboard/invoices")).toBe("dashboard-home");
  });

  it("exits from auth entry paths without history", () => {
    mockHistoryIdx(0);
    expect(getNativeBackAction("/login")).toBe("exit-app");
    expect(getNativeBackAction("/splash")).toBe("exit-app");
  });

  it("uses history-back outside dashboard when possible", () => {
    mockHistoryIdx(1);
    expect(getNativeBackAction("/signup")).toBe("history-back");
  });
});
