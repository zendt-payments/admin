import { useState, useEffect, useCallback, useRef } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthBackground from "./AuthBackground";
import {
  requestSignup,
  normalizeAuthEmail,
  requestLogin,
  confirmSignup,
  resendSignupCode,
  assertBackendReachable,
  isPasswordStrongEnough,
  fetchSignupEmailStatus,
  precheckSignupEmailAvailable,
  SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE,
  SIGNUP_REPAIR_LOGIN_FAILED_MESSAGE,
} from "../services/auth";
import { useAuth } from "../context/AuthContext";
import { useAppToast } from "../context/ToastContext";
import { ensureFreelancerAccountProvisioned } from "../services/accountProvisioning";
import { setPersistent, getPersistent, removePersistent } from "../lib/storage";
import { motion, type Variants } from "motion/react";
import { useReducedMotionCtx } from "./motion";
import AuthPageShell from "./auth/AuthPageShell";
import AuthScreenHeading from "./auth/AuthScreenHeading";
import PasswordInput from "./shared/PasswordInput";
import AcceptanceCheckbox from "./shared/AcceptanceCheckbox";

type SignupPhase = "form" | "verify";

const OTP_RESEND_COOLDOWN_MS = 2 * 60 * 1000;

function resendCooldownStorageKey(email: string): string {
  return `signup_otp_resend_until_${email.trim().toLowerCase()}`;
}

/** Persist cooldown end and return the same end timestamp (ms). */
async function startResendCooldown(email: string): Promise<number> {
  const end = Date.now() + OTP_RESEND_COOLDOWN_MS;
  await setPersistent(resendCooldownStorageKey(email), String(end));
  return end;
}

async function loadResendCooldownEnd(email: string): Promise<number | null> {
  const raw = await getPersistent(resendCooldownStorageKey(email));
  if (raw == null) return null;
  const n = parseInt(raw, 10);
  if (!Number.isFinite(n)) return null;
  return n;
}

function formatMmSs(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Keeps user on verify step after refresh so OTP cooldown (persistent) still applies. */
const VERIFY_EMAIL_SESSION_KEY = "signup_verify_pending_email";

function readStoredVerifyEmail(): string {
  try {
    return sessionStorage.getItem(VERIFY_EMAIL_SESSION_KEY)?.trim() || "";
  } catch {
    return "";
  }
}

function setVerifySessionEmail(emailAddr: string): void {
  try {
    sessionStorage.setItem(VERIFY_EMAIL_SESSION_KEY, emailAddr.trim());
  } catch {
    /* ignore */
  }
}

function clearVerifySessionEmail(): void {
  try {
    sessionStorage.removeItem(VERIFY_EMAIL_SESSION_KEY);
  } catch {
    /* ignore */
  }
}

export default function Signup() {
  const storedVerifyEmail = readStoredVerifyEmail();
  const [searchParams] = useSearchParams();
  const urlRef = searchParams.get("ref") || "";
  const isReferred = !!urlRef;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState(storedVerifyEmail);
  const [password, setPassword] = useState("");
  const [referralCode, setReferralCode] = useState(urlRef);
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [phase, setPhase] = useState<SignupPhase>(storedVerifyEmail ? "verify" : "form");
  const [loading, setLoading] = useState(false);
  const { showError, showToast } = useAppToast();
  const [verifyCode, setVerifyCode] = useState("");
  const [resending, setResending] = useState(false);
  const [cooldownEndMs, setCooldownEndMs] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [cooldownHydrated, setCooldownHydrated] = useState(() => !storedVerifyEmail);
  const navigate = useNavigate();
  const { login } = useAuth();
  const signupInFlightRef = useRef(false);
  const verifyInFlightRef = useRef(false);

  const finishConfirmedSignup = useCallback(
    async (emailAddr: string, signupPassword: string) => {
      await precheckSignupEmailAvailable(emailAddr);
      try {
        await requestLogin({ email: emailAddr, password: signupPassword });
      } catch (loginErr) {
        const msg = loginErr instanceof Error ? loginErr.message : "";
        if (/invalid email or password/i.test(msg)) {
          throw new Error(SIGNUP_REPAIR_LOGIN_FAILED_MESSAGE);
        }
        throw loginErr;
      }
      await login();
      await ensureFreelancerAccountProvisioned({ password: signupPassword });
      navigate("/dashboard/kyc", { replace: true });
    },
    [login, navigate]
  );

  const tryRepairSignup = useCallback(
    async (emailAddr: string, signupPassword: string | undefined): Promise<boolean> => {
      const status = await fetchSignupEmailStatus(emailAddr);
      if (!status.repair) return false;
      if (!signupPassword?.trim()) {
        showError(SIGNUP_REPAIR_LOGIN_FAILED_MESSAGE);
        navigate("/login", { replace: true });
        return true;
      }
      await removePersistent(resendCooldownStorageKey(emailAddr));
      clearVerifySessionEmail();
      await finishConfirmedSignup(emailAddr, signupPassword);
      return true;
    },
    [finishConfirmedSignup, navigate, showError]
  );

  const updateRemainingFromEnd = useCallback((endMs: number | null) => {
    if (endMs == null || endMs <= Date.now()) {
      setRemainingSeconds(0);
      return;
    }
    setRemainingSeconds(Math.max(0, Math.ceil((endMs - Date.now()) / 1000)));
  }, []);

  useEffect(() => {
    if (phase !== "verify" || !email.trim()) {
      setCooldownHydrated(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const end = await loadResendCooldownEnd(email);
      if (cancelled) return;
      if (end != null && end > Date.now()) {
        setCooldownEndMs(end);
        updateRemainingFromEnd(end);
      } else {
        setCooldownEndMs(null);
        setRemainingSeconds(0);
      }
      setCooldownHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [phase, email, updateRemainingFromEnd]);

  useEffect(() => {
    if (phase !== "verify" || cooldownEndMs == null) return;

    const tick = () => updateRemainingFromEnd(cooldownEndMs);
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [phase, cooldownEndMs, updateRemainingFromEnd]);

  const handleSignup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!firstName || !lastName || !email || !password) {
      showError("Fill out all fields to continue.");
      return;
    }
    if (!policyAccepted) {
      showError("Please accept the Terms of Service, Privacy Policy, and Refund Policy to continue.");
      return;
    }
    if (!isPasswordStrongEnough(password)) {
      showError("Password must be at least 8 characters and include upper, lower, number, and a symbol.");
      return;
    }

    if (signupInFlightRef.current) return;

    try {
      signupInFlightRef.current = true;
      setLoading(true);
      await assertBackendReachable();
      const normalizedEmail = normalizeAuthEmail(email);
      const emailStatus = await fetchSignupEmailStatus(normalizedEmail);
      if (!emailStatus.available && emailStatus.registered) {
        throw new Error(SIGNUP_EMAIL_ALREADY_EXISTS_MESSAGE);
      }
      if (emailStatus.repair && password) {
        if (referralCode.trim()) {
          await setPersistent("pending_referral_code", referralCode.trim().toUpperCase());
        }
        await finishConfirmedSignup(normalizedEmail, password);
        return;
      }
      const response = await requestSignup({
        firstName,
        lastName,
        email: normalizedEmail,
        password,
      });
      if (referralCode.trim()) {
        await setPersistent("pending_referral_code", referralCode.trim().toUpperCase());
      }
      if (response.needsConfirmation) {
        if (response.resentExisting) {
          showToast({
            message: "Check your email for a verification code — continue where you left off.",
            tone: "info",
          });
        }
        const end = await startResendCooldown(normalizedEmail);
        setCooldownEndMs(end);
        updateRemainingFromEnd(end);
        setCooldownHydrated(true);
        setEmail(normalizedEmail);
        setVerifySessionEmail(normalizedEmail);
        setPhase("verify");
      } else if (password) {
        await finishConfirmedSignup(normalizedEmail, password);
      } else {
        navigate("/login");
      }
    } catch (err) {
      showError(err instanceof Error ? err.message : "Signup failed.");
    } finally {
      signupInFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleVerify = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verifyCode.trim()) {
      showError("Enter the verification code.");
      return;
    }
    if (verifyInFlightRef.current) return;

    try {
      verifyInFlightRef.current = true;
      setLoading(true);
      await assertBackendReachable();
      if (await tryRepairSignup(email, password)) return;
      await confirmSignup(email, verifyCode);
      await removePersistent(resendCooldownStorageKey(email));
      clearVerifySessionEmail();
      if (password) {
        await finishConfirmedSignup(email, password);
      } else {
        navigate("/login");
      }
    } catch (err) {
      try {
        if (await tryRepairSignup(email, password)) return;
      } catch (repairErr) {
        showError(repairErr instanceof Error ? repairErr.message : "Verification failed.");
        return;
      }
      showError(err instanceof Error ? err.message : "Verification failed.");
    } finally {
      verifyInFlightRef.current = false;
      setLoading(false);
    }
  };

  const resendDisabled = !cooldownHydrated || remainingSeconds > 0 || resending || loading;

  const reduced = useReducedMotionCtx();
  const fieldContainer: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: reduced ? 0 : 0.07, delayChildren: 0.05 } },
  };
  const fieldItem: Variants = reduced
    ? { hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.18 } } }
    : {
        hidden: { opacity: 0, y: 12 },
        show: {
          opacity: 1,
          y: 0,
          transition: { type: "spring", stiffness: 380, damping: 30 },
        },
      };

  return (
    <AuthBackground showNavigation={false}>
      <AuthPageShell>
        <motion.div
          key={phase}
          className="w-full max-w-sm mx-auto"
          variants={fieldContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fieldItem}>
            <AuthScreenHeading title={phase === "form" ? "Create your account" : "Confirm it's you"} />
          </motion.div>

          {isReferred && phase === "form" && (
            <motion.div variants={fieldItem}>
              <div className="mb-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-4 py-3 text-center">
                <p className="text-caption text-emerald-300">
                  You were referred! Your referral benefit unlocks after you complete KYC.
                </p>
              </div>
            </motion.div>
          )}

          {phase === "form" ? (
            <form onSubmit={handleSignup} className="space-y-6 mb-4">
              <motion.div variants={fieldItem}>
                <input
                  placeholder="First name"
                  value={firstName}
                  onChange={(event) => setFirstName(event.target.value)}
                  autoComplete="given-name"
                  className="zendt-input-auth mt-2"
                />
              </motion.div>
              <motion.div variants={fieldItem}>
                <input
                  placeholder="Last name"
                  value={lastName}
                  onChange={(event) => setLastName(event.target.value)}
                  autoComplete="family-name"
                  className="zendt-input-auth"
                />
              </motion.div>
              <motion.div variants={fieldItem}>
                <input
                  placeholder="E-mail"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  className="zendt-input-auth"
                />
              </motion.div>
              <motion.div variants={fieldItem}>
                <PasswordInput
                  placeholder="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  className="zendt-input-auth"
                />
              </motion.div>
              <motion.div variants={fieldItem}>
                <input
                  placeholder="Referral code (optional)"
                  value={referralCode}
                  onChange={(event) => setReferralCode(event.target.value)}
                  autoComplete="off"
                  className="zendt-input-auth text-white/70 placeholder:text-white/30"
                />
              </motion.div>

              <motion.div variants={fieldItem} className="flex items-start gap-3">
                <AcceptanceCheckbox
                  id="policy-acceptance"
                  checked={policyAccepted}
                  onChange={setPolicyAccepted}
                />
                <label
                  htmlFor="policy-acceptance"
                  className="text-caption text-white/70 leading-relaxed cursor-pointer"
                >
                  I agree to Zendt&apos;s{" "}
                  <a
                    href="https://www.zendtpayments.com/terms-and-conditions"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white/80 transition-colors"
                  >
                    Terms of Service
                  </a>{" "}
                  ,{" "}
                  <a
                    href="https://www.zendtpayments.com/privacy-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white/80 transition-colors"
                  >
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a
                    href="https://www.zendtpayments.com/refund-policy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-400 hover:text-white/80 transition-colors"
                  >
                    Refund Policy
                  </a>
                </label>
              </motion.div>

              <motion.div variants={fieldItem} className="flex justify-between items-center">
                <motion.button
                  type="submit"
                  disabled={loading}
                  whileTap={reduced ? undefined : { scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 600, damping: 30 }}
                  className="flex items-center justify-between bg-[#141414] text-white border border-gray-600 rounded-full py-0.5 pl-2 pr-0.5 w-24 disabled:opacity-50"
                >
                  <span className="text-body">{loading ? "..." : "Signup"}</span>
                  <span className="w-7 h-7 bg-gray-300 text-black rounded-full flex items-center justify-center text-body">
                    ➜
                  </span>
                </motion.button>

                <div className="text-right flex items-center gap-1 text-caption text-white">
                  Already have account?{" "}
                  <Link to="/login" className="text-gray-400 underline">
                    Login
                  </Link>
                </div>
              </motion.div>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-6 mb-4">
              <motion.div variants={fieldItem}>
                <input
                  value={verifyCode}
                  onChange={(event) => setVerifyCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Enter 6-digit email code"
                  autoComplete="one-time-code"
                  className="zendt-input-auth"
                />
              </motion.div>

              <motion.div variants={fieldItem} className="flex justify-between items-center">
                <motion.button
                  type="submit"
                  disabled={loading || verifyCode.length !== 6}
                  whileTap={reduced ? undefined : { scale: 0.95 }}
                  transition={{ type: "spring", stiffness: 600, damping: 30 }}
                  className="flex items-center justify-between bg-[#141414] text-white border border-gray-600 rounded-full py-0.5 pl-2 pr-0.5 w-32 disabled:opacity-50"
                >
                  <span className="text-body">{loading ? "..." : "Verify"}</span>
                  <span className="w-7 h-7 bg-gray-300 text-black rounded-full flex items-center justify-center text-body">
                    ➜
                  </span>
                </motion.button>
                <button
                  type="button"
                  className="text-caption text-white underline"
                  onClick={() => {
                    setPhase("form");
                    setVerifyCode("");
                    setCooldownEndMs(null);
                    setRemainingSeconds(0);
                    clearVerifySessionEmail();
                  }}
                >
                  Go Back
                </button>
              </motion.div>
              {cooldownHydrated && remainingSeconds > 0 && (
                <motion.p variants={fieldItem} className="text-caption text-center text-white/50">
                  Resend available in {formatMmSs(remainingSeconds)}
                </motion.p>
              )}
              <motion.div variants={fieldItem}>
                <button
                  type="button"
                  disabled={resendDisabled}
                  onClick={async () => {
                    try {
                      setResending(true);
                      await resendSignupCode(email);
                      const end = await startResendCooldown(email);
                      setCooldownEndMs(end);
                      updateRemainingFromEnd(end);
                    } catch (e) {
                      const msg = e instanceof Error ? e.message : "";
                      if (/already verified/i.test(msg)) {
                        if (await tryRepairSignup(email, password)) return;
                      }
                      showError(msg || "Could not resend code.");
                    } finally {
                      setResending(false);
                    }
                  }}
                  className="text-caption text-white/60 hover:text-white underline w-full text-center disabled:opacity-50"
                >
                  {resending ? "Sending…" : "Resend email code"}
                </button>
              </motion.div>
            </form>
          )}
        </motion.div>
      </AuthPageShell>
    </AuthBackground>
  );
}
