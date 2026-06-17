import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import ReferralPage from "../../src/components/dashboard/ReferralPage";
import { mockApi, resetReferralMockForTesting } from "../../src/services/mockApi";
import * as dataServiceModule from "../../src/services/dataService";

vi.mock("../../src/hooks/useAppResumeTick", () => ({
  useAppResumeTick: () => 0,
}));

vi.mock("../../src/context/SocketProvider", () => ({
  useSocketConnected: () => false,
}));

vi.mock("../../src/utils/shareText", () => ({
  shareText: vi.fn(async () => ({ used: "native" as const })),
}));

function renderReferralPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <ReferralPage />
      </MemoryRouter>
    </QueryClientProvider>
  );
}

describe("Refer & Earn page smoke", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    resetReferralMockForTesting();
    vi.restoreAllMocks();

    vi.spyOn(dataServiceModule.dataService, "getReferralStats").mockImplementation((opts) => {
      const limit = opts?.limit ?? 20;
      const params = new URLSearchParams({ limit: String(limit) });
      if (opts?.cursor) params.set("cursor", opts.cursor);
      return mockApi("GET", `/referral/stats?${params}`);
    });

    vi.spyOn(dataServiceModule.dataService, "requestReferralWithdraw").mockImplementation((body) =>
      mockApi("POST", "/referral/withdraw", body)
    );

    Object.assign(navigator, {
      clipboard: { writeText: vi.fn() },
    });
  });

  it("renders referral code, stats, list, and enabled withdraw button", async () => {
    renderReferralPage();

    expect(await screen.findByText("Refer & Earn")).toBeInTheDocument();
    expect(await screen.findByText("ZENDT-TEST-2025")).toBeInTheDocument();
    expect(screen.getByText("₹150")).toBeInTheDocument();
    expect(screen.getByText("Riya Mehta")).toBeInTheDocument();
    expect(screen.getByText("Karan Kapoor")).toBeInTheDocument();
    expect(screen.getByText("Pooja Iyer")).toBeInTheDocument();

    const withdrawBtn = screen.getByRole("button", { name: "Withdraw" });
    expect(withdrawBtn).not.toBeDisabled();
  });

  it("opens withdraw modal with terms link and validates acceptance + UPI", async () => {
    renderReferralPage();

    await screen.findByText("ZENDT-TEST-2025");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));

    expect(await screen.findByText("Withdraw referral earnings")).toBeInTheDocument();

    const termsLink = screen.getByRole("link", { name: "Referral Program Terms" });
    expect(termsLink).toHaveAttribute("href", "https://www.zendtpayments.com/referral-policy");

    const upiInput = screen.getByPlaceholderText("yourname@bank");
    fireEvent.change(upiInput, { target: { value: "user@paytm" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Confirmation required")).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText(/I agree to the Referral Program Terms/i));
    fireEvent.change(upiInput, { target: { value: "not-valid" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Invalid UPI ID")).toBeInTheDocument();
  });

  it("submits withdraw when terms accepted and UPI is valid", async () => {
    const withdrawSpy = vi.spyOn(dataServiceModule.dataService, "requestReferralWithdraw");

    renderReferralPage();

    await screen.findByText("ZENDT-TEST-2025");
    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    await screen.findByText("Withdraw referral earnings");

    fireEvent.click(screen.getByLabelText(/I agree to the Referral Program Terms/i));
    fireEvent.change(screen.getByPlaceholderText("yourname@bank"), { target: { value: "Tester@Paytm" } });
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));

    await waitFor(() => {
      expect(withdrawSpy).toHaveBeenCalledWith({ upi_id: "tester@paytm" });
    });

    expect(await screen.findByText("Withdrawal requested")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.queryByText("Withdraw referral earnings")).not.toBeInTheDocument();
    });
  });

  it("copies referral code to clipboard", async () => {
    renderReferralPage();

    await screen.findByText("ZENDT-TEST-2025");
    fireEvent.click(screen.getByRole("button", { name: "Copy referral code" }));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("ZENDT-TEST-2025");
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });
});
