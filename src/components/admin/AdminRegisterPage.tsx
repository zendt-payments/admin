import { useEffect, useState, useCallback, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthBackground from "../AuthBackground";
import AuthScreenHeading from "../auth/AuthScreenHeading";
import {
  requestSignup,
  requestLogin,
  confirmSignup,
  resendSignupCode,
  assertBackendReachable,
  getCurrentUser,
  getAuthTokenAsync,
  ADMIN_SIGNUP_EMAIL_ALREADY_USED_MESSAGE,
  SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE,
  precheckAdminRegistrationSecret,
} from "../../services/auth";
import { useAuth } from "../../context/AuthContext";
import { dataService } from "../../services/dataService";
import { motion } from "motion/react";
import { useReducedMotionCtx } from "../motion";
import { isApiError } from "../../lib/apiError";
import { useAppToast } from "../../context/ToastContext";
import PasswordInput from "../shared/PasswordInput";

const ADMIN_SIGNUP_VERIFIED_EMAIL_MESSAGES = [
  ADMIN_SIGNUP_EMAIL_ALREADY_USED_MESSAGE,
  SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE,
  "This email is already verified. Please sign in.",
];

type Phase = "form" | "verify" | "signed_in_finish";

const OTP_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

export default function AdminRegisterPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuth();
  const [searchParams] = useSearchParams();
  const keyPrefill = searchParams.get("key")?.trim() || "";
  const pendingFinish = searchParams.get("pending") === "1";

  const [phase, setPhase] = useState<Phase>("form");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [userName, setUserName] = useState("");
  const [registrationSecret, setRegistrationSecret] = useState(keyPrefill);
  const [verifyCode, setVerifyCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldownEndMs, setCooldownEndMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const { showError, showToast } = useAppToast();

  useEffect(() => {
    if (keyPrefill) setRegistrationSecret(keyPrefill);
  }, [keyPrefill]);

  useEffect(() => {
    if (authLoading || !pendingFinish || !isAuthenticated) return;
    setPhase("signed_in_finish");
  }, [authLoading, pendingFinish, isAuthenticated]);

  useEffect(() => {
    if (phase !== "signed_in_finish" || email.trim()) return;
    try {
      const u = getCurrentUser();
      const name = u?.getUsername?.();
      if (typeof name === "string" && name.trim()) setEmail(name.trim());
    } catch {
      /* ignore */
    }
  }, [phase, email]);

  const updateRemainingFromEnd = useCallback((endMs: number | null) => {
    if (endMs == null || endMs <= Date.now()) {
      setRemainingSeconds(0);
      return;
    }
    setRemainingSeconds(Math.max(0, Math.ceil((endMs - Date.now()) / 1000)));
  }, []);

  useEffect(() => {
    if (phase !== "verify" || cooldownEndMs == null) return;
    const tick = () => updateRemainingFromEnd(cooldownEndMs);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, cooldownEndMs, updateRemainingFromEnd]);

  const reduced = useReducedMotionCtx();

  const mapFinalizeError = (err: unknown) => {
    if (isApiError(err)) {
      if (err.code === "INVALID_REGISTRATION_SECRET") {
        showError("That registration key does not match ADMIN_REGISTRATION_SECRET on the server.");
      } else if (err.code === "EMAIL_NOT_VERIFIED") {
        showError("Cognito still shows email unverified. Try verifying again or sign out and back in.");
      } else if (err.status === 503) {
        showError("Server admin registration is not configured (missing ADMIN_REGISTRATION_SECRET).");
      } else if (err.code === "COGNITO_GROUP_ASSIGN_FAILED" || err.status === 502) {
        showError(
          err.message ||
            "AWS could not add you to the admin group. Create the Cognito group (e.g. ZendtAdmins) and IAM AdminAddUserToGroup permission."
        );
      } else if (err.code === "ADMIN_EMAIL_IN_USE") {
        showError(ADMIN_SIGNUP_EMAIL_ALREADY_USED_MESSAGE);
      } else if (err.code === "ADMIN_ALREADY_REGISTERED") {
        navigate("/admin", { replace: true });
        return;
      } else {
        showError(err.message || "Could not finish admin registration.");
      }
    } else {
      showError(err instanceof Error ? err.message : "Could not finish admin registration.");
    }
  };

  const finalizeAdminAccess = async () => {
    await assertBackendReachable();
    const token = await getAuthTokenAsync();
    if (!token) {
      await requestLogin({ email: email.trim(), password });
      await login();
    }
    await dataService.completeAdminRegistration({
      registration_secret: registrationSecret.trim(),
      ...(userName.trim() ? { display_name: userName.trim() } : {}),
    });
    await requestLogin({ email: email.trim(), password });
    await login();
    navigate("/admin", { replace: true });
  };

  const handleSignup = async (e: FormEvent) => {
    e.preventDefault();
    if (!registrationSecret.trim()) {
      showError("Enter your team's registration key.");
      return;
    }
    if (!email.trim() || !password) {
      showError("Enter email and password.");
      return;
    }
    const local = email.trim().split("@")[0] || "Admin";
    setLoading(true);
    try {
      await assertBackendReachable();
      await precheckAdminRegistrationSecret(registrationSecret.trim());
      const res = await requestSignup({
        firstName: userName.trim() || local,
        lastName: "Admin",
        email: email.trim(),
        password,
      });
      if (res.needsConfirmation) {
        const end = Date.now() + OTP_RESEND_COOLDOWN_MS;
        setCooldownEndMs(end);
        updateRemainingFromEnd(end);
        if (res.resentExisting) {
          showToast({
            message: "Check your email for a verification code — continue where you left off.",
            tone: "info",
          });
        }
        setPhase("verify");
      } else {
        await requestLogin({ email: email.trim(), password });
        await login();
        try {
          await finalizeAdminAccess();
        } catch (err) {
          mapFinalizeError(err);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message === "INVALID_REGISTRATION_SECRET") {
        showError("That registration key does not match ADMIN_REGISTRATION_SECRET on the server.");
      } else if (err instanceof Error && err.message === "ADMIN_REGISTRATION_NOT_CONFIGURED") {
        showError("Server admin registration is not configured (missing ADMIN_REGISTRATION_SECRET).");
      } else if (
        err instanceof Error &&
        ADMIN_SIGNUP_VERIFIED_EMAIL_MESSAGES.some((m) => m === err.message)
      ) {
        showError(ADMIN_SIGNUP_EMAIL_ALREADY_USED_MESSAGE);
      } else {
        showError(err instanceof Error ? err.message : "Signup failed.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: FormEvent) => {
    e.preventDefault();
    if (!verifyCode.trim()) {
      showError("Enter the verification code from your email.");
      return;
    }
    setLoading(true);
    try {
      await assertBackendReachable();
      await confirmSignup(email.trim(), verifyCode.trim());
      await requestLogin({ email: email.trim(), password });
      await login();
      try {
        await finalizeAdminAccess();
      } catch (err) {
        mapFinalizeError(err);
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignedInFinish = async (e: FormEvent) => {
    e.preventDefault();
    if (!registrationSecret.trim()) {
      showError("Enter your team's registration key.");
      return;
    }
    if (!password) {
      showError("Enter your password so we can refresh your session after admin access is granted.");
      return;
    }
    setLoading(true);
    try {
      await finalizeAdminAccess();
    } catch (err) {
      mapFinalizeError(err);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (remainingSeconds > 0 || resending) return;
    setResending(true);
    try {
      await resendSignupCode(email.trim());
      const end = Date.now() + OTP_RESEND_COOLDOWN_MS;
      setCooldownEndMs(end);
      updateRemainingFromEnd(end);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not resend code.");
    } finally {
      setResending(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#141414] flex flex-col items-center justify-center gap-4 px-4 pt-safe pb-safe">
        <img src="/z-logo-nobg.png" alt="Zendt" className="h-14 w-14 object-contain opacity-90" />
        <div className="h-8 w-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const heading =
    phase === "form"
      ? { eyebrow: "Zendt admin", title: "Create admin account" }
      : phase === "verify"
        ? { eyebrow: "Verify email", title: "Enter the code we sent" }
        : { eyebrow: "Zendt admin", title: "Finish admin access" };

  const intro =
    phase === "verify"
      ? "We emailed you a code. Enter it to verify — we finish admin setup and open your dashboard."
      : phase === "signed_in_finish"
        ? "You're signed in but admin access isn't active yet. Enter your registration key and password to finish."
        : null;

  return (
    <AuthBackground showNavigation={false} showBrandLogo>
      <div className="flex min-h-screen w-full items-end justify-center px-5 pt-safe pb-[calc(4rem+var(--zendt-safe-bottom))] overflow-y-auto no-scrollbar">
        <motion.div
          key={phase}
          className="w-full max-w-sm mx-auto pb-8"
          initial={reduced ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduced ? 0 : 0.25 }}
        >
          <AuthScreenHeading eyebrow={heading.eyebrow} title={heading.title} />

          {intro != null && <p className="text-caption text-white/50 mt-3 mb-6 leading-relaxed">{intro}</p>}

          {phase === "form" && (
            <form onSubmit={handleSignup} className="space-y-4">
              <input
                placeholder="User name (optional)"
                value={userName}
                onChange={(ev) => setUserName(ev.target.value)}
                autoComplete="name"
                className="zendt-input-auth"
              />
              <input
                placeholder="Work email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                autoComplete="email"
                className="zendt-input-auth"
              />
              <PasswordInput
                placeholder="Password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                autoComplete="new-password"
                className="zendt-input-auth"
              />
              <PasswordInput
                placeholder="Registration key"
                autoComplete="off"
                value={registrationSecret}
                onChange={(ev) => setRegistrationSecret(ev.target.value)}
                className="zendt-input-auth"
              />
              <p className="text-caption text-white/40 px-1">
                Matches <code className="text-white/55">ADMIN_REGISTRATION_SECRET</code> on the server. You
                won&apos;t enter this again after email verification.
              </p>
              <button
                type="submit"
                disabled={loading || !registrationSecret.trim()}
                className="w-full rounded-full bg-white text-black py-3 text-body font-medium disabled:opacity-50"
              >
                {loading ? "Please wait…" : "Continue to email verification"}
              </button>
              <p className="text-center text-caption text-white/45 pt-2">
                Already have an account?{" "}
                <Link to="/login" className="text-white underline-offset-2 hover:underline">
                  Sign in
                </Link>
              </p>
            </form>
          )}

          {phase === "verify" && (
            <form onSubmit={handleVerify} className="space-y-4">
              <input
                placeholder="6-digit code"
                inputMode="numeric"
                value={verifyCode}
                onChange={(ev) => setVerifyCode(ev.target.value)}
                className="zendt-input-auth tracking-widest text-center"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-full bg-white text-black py-3 text-body font-medium disabled:opacity-50"
              >
                {loading ? "Opening dashboard…" : "Verify & open dashboard"}
              </button>
              <div className="flex justify-between text-caption text-white/45 px-1">
                <button
                  type="button"
                  disabled={remainingSeconds > 0 || resending}
                  onClick={handleResend}
                  className="disabled:opacity-40 hover:text-white"
                >
                  {remainingSeconds > 0
                    ? `Resend in ${remainingSeconds}s`
                    : resending
                      ? "Sending…"
                      : "Resend code"}
                </button>
                <button type="button" onClick={() => setPhase("form")} className="hover:text-white">
                  Edit details
                </button>
              </div>
            </form>
          )}

          {phase === "signed_in_finish" && (
            <form onSubmit={handleSignedInFinish} className="space-y-4">
              <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/5 px-3 py-3 text-caption text-emerald-100/90 leading-relaxed space-y-2">
                <p>
                  We&apos;ll add this account to <strong className="text-emerald-200">ZendtAdmins</strong>{" "}
                  and open the admin dashboard.
                </p>
                <p className="text-white/50">
                  Not an admin?{" "}
                  <Link to="/login" className="text-emerald-300 underline-offset-2 hover:underline">
                    Use the freelancer sign-in
                  </Link>
                </p>
              </div>
              <input
                placeholder="Work email"
                type="email"
                readOnly
                value={email}
                autoComplete="username"
                className="zendt-input-auth opacity-70 cursor-not-allowed"
              />
              <PasswordInput
                placeholder="Registration key"
                autoComplete="off"
                value={registrationSecret}
                onChange={(ev) => setRegistrationSecret(ev.target.value)}
                className="zendt-input-auth"
              />
              <PasswordInput
                placeholder="Password"
                value={password}
                onChange={(ev) => setPassword(ev.target.value)}
                autoComplete="current-password"
                className="zendt-input-auth"
              />
              <p className="text-caption text-white/40 px-1">
                Key matches <code className="text-white/55">ADMIN_REGISTRATION_SECRET</code> on the server.
              </p>
              <button
                type="submit"
                disabled={loading || !registrationSecret.trim() || !password}
                className="w-full rounded-full bg-emerald-600 text-white py-3 text-body font-medium disabled:opacity-40"
              >
                {loading ? "Opening dashboard…" : "Open admin dashboard"}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AuthBackground>
  );
}
