import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import Signup from "./Signup";
import { dataService } from "../services/dataService";

const mockRequestSignup = vi.fn();
const mockAssertBackendReachable = vi.fn();
const mockShowError = vi.fn();
const mockEnsureFreelancerAccountProvisioned = vi.fn();

const mockConfirmSignup = vi.fn();
const mockRequestLogin = vi.fn();
const mockFetchSignupEmailStatus = vi.fn();
const mockPrecheckSignupEmailAvailable = vi.fn();

vi.mock("../services/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../services/auth")>();
  return {
    ...actual,
    requestSignup: (...args: unknown[]) => mockRequestSignup(...args),
    assertBackendReachable: () => mockAssertBackendReachable(),
    confirmSignup: (...args: unknown[]) => mockConfirmSignup(...args),
    resendSignupCode: vi.fn(),
    requestLogin: (...args: unknown[]) => mockRequestLogin(...args),
    fetchSignupEmailStatus: (...args: unknown[]) => mockFetchSignupEmailStatus(...args),
    precheckSignupEmailAvailable: (...args: unknown[]) => mockPrecheckSignupEmailAvailable(...args),
  };
});

vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn() }),
}));

vi.mock("../context/ToastContext", () => ({
  useAppToast: () => ({ showError: mockShowError, showToast: vi.fn() }),
}));

vi.mock("../services/accountProvisioning", () => ({
  ensureFreelancerAccountProvisioned: (...args: unknown[]) =>
    mockEnsureFreelancerAccountProvisioned(...args),
}));

vi.mock("../services/dataService", () => ({
  dataService: {
    registerSignupPassword: vi.fn(() => Promise.resolve()),
    signupComplete: vi.fn(() => Promise.resolve()),
  },
}));

vi.mock("../lib/storage", () => ({
  setPersistent: vi.fn(() => Promise.resolve()),
  getPersistent: vi.fn(() => Promise.resolve(null)),
  removePersistent: vi.fn(() => Promise.resolve()),
}));

vi.mock("./AuthBackground", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock("./motion", () => ({
  useReducedMotionCtx: () => true,
}));

function renderSignup() {
  return render(
    <MemoryRouter>
      <Signup />
    </MemoryRouter>
  );
}

function fillSignupForm(email: string, password = "ValidPass1!") {
  fireEvent.change(screen.getByPlaceholderText("First name"), { target: { value: "Jane" } });
  fireEvent.change(screen.getByPlaceholderText("Last name"), { target: { value: "Doe" } });
  fireEvent.change(screen.getByPlaceholderText("E-mail"), { target: { value: email } });
  fireEvent.change(screen.getByPlaceholderText("Password"), { target: { value: password } });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("Signup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAssertBackendReachable.mockResolvedValue(undefined);
    mockConfirmSignup.mockResolvedValue({ success: true });
    mockRequestLogin.mockResolvedValue({
      refreshToken: "rt",
      username: "new@example.com",
    });
    mockEnsureFreelancerAccountProvisioned.mockResolvedValue(undefined);
    mockFetchSignupEmailStatus.mockResolvedValue({ available: true });
    mockPrecheckSignupEmailAvailable.mockResolvedValue(undefined);
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
  });

  it("shows password policy error on the form without calling Cognito", async () => {
    renderSignup();
    fillSignupForm("jane@example.com", "weak");
    fireEvent.click(screen.getByRole("button", { name: /signup/i }));

    expect(mockShowError).toHaveBeenCalledWith(
      "Password must be at least 8 characters and include upper, lower, number, and a symbol."
    );
    expect(mockRequestSignup).not.toHaveBeenCalled();
  });

  it("stays on the signup form when email already exists", async () => {
    const { SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE } = await import("../services/auth");
    mockRequestSignup.mockRejectedValue(new Error(SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE));

    renderSignup();
    fillSignupForm("existing@example.com");
    fireEvent.click(screen.getByRole("button", { name: /signup/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE);
    });
    expect(mockRequestSignup).toHaveBeenCalledWith(
      expect.objectContaining({ email: "existing@example.com" })
    );
    expect(screen.getByPlaceholderText("First name")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Enter 6-digit email code")).not.toBeInTheDocument();
  });

  it("moves to verify only for a new signup", async () => {
    mockRequestSignup.mockResolvedValue({
      success: true,
      email: "new@example.com",
      needsConfirmation: true,
    });

    renderSignup();
    fillSignupForm("new@example.com");
    fireEvent.click(screen.getByRole("button", { name: /signup/i }));

    expect(await screen.findByPlaceholderText("Enter 6-digit email code")).toBeInTheDocument();
    expect(dataService.registerSignupPassword).not.toHaveBeenCalled();
    expect(mockFetchSignupEmailStatus).toHaveBeenCalledWith("new@example.com");
  });

  it("skips OTP and provisions when Cognito is confirmed but MongoDB profile is missing", async () => {
    mockFetchSignupEmailStatus.mockResolvedValue({ available: true, repair: true });

    renderSignup();
    fillSignupForm("repair@example.com");
    fireEvent.click(screen.getByRole("button", { name: /signup/i }));

    await waitFor(() => {
      expect(mockEnsureFreelancerAccountProvisioned).toHaveBeenCalledWith({
        password: "ValidPass1!",
      });
    });
    expect(mockRequestSignup).not.toHaveBeenCalled();
    expect(screen.queryByPlaceholderText("Enter 6-digit email code")).not.toBeInTheDocument();
  });

  it("skips OTP confirmation on verify when repair is eligible", async () => {
    mockFetchSignupEmailStatus
      .mockResolvedValueOnce({ available: true })
      .mockResolvedValue({ available: true, repair: true });
    mockRequestSignup.mockResolvedValue({
      success: true,
      email: "repair@example.com",
      needsConfirmation: true,
    });
    mockConfirmSignup.mockRejectedValue(new Error("Invalid code provided. Please request a code again."));

    renderSignup();
    fillSignupForm("repair@example.com");
    fireEvent.click(screen.getByRole("button", { name: /signup/i }));
    await screen.findByPlaceholderText("Enter 6-digit email code");

    fireEvent.change(screen.getByPlaceholderText("Enter 6-digit email code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockEnsureFreelancerAccountProvisioned).toHaveBeenCalledWith({
        password: "ValidPass1!",
      });
    });
    expect(mockConfirmSignup).not.toHaveBeenCalled();
  });

  it("checks email availability on the signup form before Cognito signUp", async () => {
    mockRequestSignup.mockResolvedValue({
      success: true,
      email: "new@example.com",
      needsConfirmation: true,
    });

    renderSignup();
    fillSignupForm("new@example.com");
    fireEvent.click(screen.getByRole("button", { name: /signup/i }));

    await waitFor(() => {
      expect(mockFetchSignupEmailStatus).toHaveBeenCalledWith("new@example.com");
    });
    expect(mockRequestSignup).toHaveBeenCalled();
  });

  it("shows email already taken when the backend reports a registered account", async () => {
    const { SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE } = await import("../services/auth");
    mockFetchSignupEmailStatus.mockResolvedValue({ available: false, registered: true });

    renderSignup();
    fillSignupForm("existing@example.com");
    fireEvent.click(screen.getByRole("button", { name: /signup/i }));

    await waitFor(() => {
      expect(mockShowError).toHaveBeenCalledWith(SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE);
    });
    expect(mockRequestSignup).not.toHaveBeenCalled();
  });

  it("provisions MongoDB after OTP verification for a confirmed Cognito user", async () => {
    mockRequestSignup.mockResolvedValue({
      success: true,
      email: "new@example.com",
      needsConfirmation: true,
    });

    renderSignup();
    fillSignupForm("new@example.com");
    fireEvent.click(screen.getByRole("button", { name: /signup/i }));
    await screen.findByPlaceholderText("Enter 6-digit email code");

    fireEvent.change(screen.getByPlaceholderText("Enter 6-digit email code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /verify/i }));

    await waitFor(() => {
      expect(mockEnsureFreelancerAccountProvisioned).toHaveBeenCalledTimes(1);
    });
    expect(mockEnsureFreelancerAccountProvisioned).toHaveBeenCalledWith({ password: "ValidPass1!" });
    expect(dataService.registerSignupPassword).not.toHaveBeenCalled();
  });
});
