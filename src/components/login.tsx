import { useState, useEffect, useCallback } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import AuthBackground from "./AuthBackground";
import {
  loginWithApple,
  loginWithGoogle,
  isAppleSignInOffered,
  requestLogin,
  getCognitoGroups,
  isAdminFromGroups,
  tryLoginWithBiometric,
} from "../services/auth";
import {
  getBiometricLoginButtonLabel,
  hasStoredBiometricCredentials,
  isBiometricHardwareAvailable,
  saveBiometricCredentials,
} from "../services/biometricAuth";
import { dataService } from "../services/dataService";
import { ensureFreelancerAccountProvisioned } from "../services/accountProvisioning";
import { dqk } from "../lib/dashboardQueries";
import { queryClient } from "../lib/queryClient";
import { useAuth } from "../context/AuthContext";
import { motion, type Variants } from "motion/react";
import { useReducedMotionCtx, PressableButton, MotionSheet } from "./motion";
import { useAppToast } from "../context/ToastContext";
import AuthPageShell from "./auth/AuthPageShell";
import AuthScreenHeading from "./auth/AuthScreenHeading";
import { dashboardSectionTitleClass } from "./dashboard/DashboardTitles";
import PasswordInput from "./shared/PasswordInput";

/** Session flag set only when Google/Apple sign-in creates a new Cognito user (`isNewUser`). */
const SESSION_REDIRECT_KYC_AFTER_SOCIAL = "zendt_social_signup_requires_kyc";

function GoogleGMark({ className = "size-[22px] shrink-0" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden>
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.21 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6C44.98 37.98 46.98 31.69 46.98 24.55z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-3.62-13.47-8.47l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function AppleMark({ className = "size-[22px] shrink-0 text-white" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="currentColor">
      <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.06 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
    </svg>
  );
}

function BiometricEyeMark({ className = "size-[22px] shrink-0 text-white" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden fill="none">
      <path
        d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.75" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useAppToast();

  /** When true, skip auto-redirect until user responds to biometric opt-in. */
  const [pendingBiometricSetup, setPendingBiometricSetup] = useState(false);
  const appleSignInOffered = isAppleSignInOffered();
  const [biometricOffer, setBiometricOffer] = useState<{ refreshToken: string; username: string } | null>(
    null
  );
  const [biometricHardwareAvailable, setBiometricHardwareAvailable] = useState(false);
  const [biometricEnrolled, setBiometricEnrolled] = useState(false);
  const [biometricButtonLabel, setBiometricButtonLabel] = useState("Use Face ID / Biometrics");
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  const { login: setAuthLoggedIn, isAuthenticated } = useAuth();

  const refreshBiometricState = useCallback(async () => {
    const [hardware, enrolled, label] = await Promise.all([
      isBiometricHardwareAvailable(),
      hasStoredBiometricCredentials(),
      getBiometricLoginButtonLabel(),
    ]);
    setBiometricHardwareAvailable(hardware);
    setBiometricEnrolled(enrolled);
    setBiometricButtonLabel(label);
  }, []);

  useEffect(() => {
    if (isAuthenticated) return;
    void refreshBiometricState();
  }, [isAuthenticated, refreshBiometricState]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (pendingBiometricSetup) return;

    let cancelled = false;
    (async () => {
      const g = await getCognitoGroups();
      if (cancelled) return;
      if (isAdminFromGroups(g)) {
        sessionStorage.removeItem(SESSION_REDIRECT_KYC_AFTER_SOCIAL);
        navigate("/admin", { replace: true });
        return;
      }

      const needsKycAfterSocial = sessionStorage.getItem(SESSION_REDIRECT_KYC_AFTER_SOCIAL);
      if (needsKycAfterSocial === "1") {
        sessionStorage.removeItem(SESSION_REDIRECT_KYC_AFTER_SOCIAL);
        navigate("/dashboard/kyc", { replace: true });
        return;
      }

      const dest =
        from && typeof from === "string" && from.startsWith("/dashboard") ? from : "/dashboard/home";
      if (dest !== "/dashboard/home") {
        navigate(dest, { replace: true });
        return;
      }
      try {
        const kyc = await dataService.getKycStatus();
        queryClient.setQueryData(dqk.kycStatus, kyc);
        const kycComplete = (kyc.proof_status || "none") === "approved";
        navigate("/dashboard/home", {
          replace: true,
          state: kycComplete ? undefined : { showKycToast: true },
        });
      } catch {
        navigate("/dashboard/home", { replace: true });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate, from, pendingBiometricSetup]);

  async function finalizeLoginSession(
    refreshToken: string,
    username: string,
    opts?: { password?: string }
  ): Promise<void> {
    await ensureFreelancerAccountProvisioned(opts);

    const shouldOfferBiometric =
      (await isBiometricHardwareAvailable()) && !(await hasStoredBiometricCredentials());

    if (shouldOfferBiometric) {
      setBiometricOffer({ refreshToken, username });
      setPendingBiometricSetup(true);
      await setAuthLoggedIn();
      return;
    }
    await setAuthLoggedIn();
  }

  const handleCredentialsSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password.trim()) {
      showError("Please enter both email and password.");
      return;
    }

    try {
      setLoading(true);
      const { refreshToken, username } = await requestLogin({
        email: email.trim(),
        password,
      });

      dataService.storeSocialAuthPassword(password).catch(() => {});
      await finalizeLoginSession(refreshToken, username, { password });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  const finishBiometricOffer = async (enable: boolean) => {
    if (enable && biometricOffer) {
      try {
        await saveBiometricCredentials(biometricOffer.username, biometricOffer.refreshToken);
        setBiometricEnrolled(true);
        void refreshBiometricState();
      } catch (e) {
        console.error("saveBiometricCredentials", e);
      }
    }
    setPendingBiometricSetup(false);
    setBiometricOffer(null);
  };

  const completeSocialLogin = async (provider: "google" | "apple") => {
    setLoading(true);
    try {
      /** Use login-form password only when linking an existing email/password account. */
      const linkPassword = password.trim() ? password : undefined;
      const socialOpts = linkPassword ? { accountPassword: linkPassword } : undefined;
      const out =
        provider === "google" ? await loginWithGoogle(socialOpts) : await loginWithApple(socialOpts);
      if (out.isNewUser) {
        sessionStorage.setItem(SESSION_REDIRECT_KYC_AFTER_SOCIAL, "1");
      }
      await finalizeLoginSession(out.refreshToken, out.username, {
        password: linkPassword,
      });
      if (out.linkedAccount) {
        showSuccess(
          "Sign-in linked",
          "Google or Apple is linked. Your email and password sign-in still works."
        );
      } else if (out.isNewUser) {
        const em = out.username;
        const m = em.includes("@") ? `${em.charAt(0)}***@${em.split("@")[1]}` : em;
        showSuccess("Check your email", `We emailed your Zendt password to ${m}.`);
      }
    } catch (e) {
      sessionStorage.removeItem(SESSION_REDIRECT_KYC_AFTER_SOCIAL);
      const label = provider === "google" ? "Google" : "Apple";
      showError(e instanceof Error ? e.message : `${label} sign-in failed.`);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    void completeSocialLogin("google");
  };

  const handleAppleLogin = () => {
    void completeSocialLogin("apple");
  };

  const handleBiometricLogin = async () => {
    if (!biometricEnrolled) {
      showError("Sign in with your password once, then tap Enable when prompted.");
      return;
    }
    setLoading(true);
    try {
      const result = await tryLoginWithBiometric();
      if (!result.success) {
        if (result.error && result.error !== "cancelled") {
          showError(result.error);
        }
        return;
      }
      await ensureFreelancerAccountProvisioned();
      await setAuthLoggedIn();
    } catch (e) {
      showError(e instanceof Error ? e.message : "Biometric sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

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

  const altSignInButtonClass =
    "h-11 rounded-full border border-white/18 bg-white/[0.06] text-caption text-white font-light hover:bg-white/[0.09] transition-colors disabled:opacity-50 flex items-center justify-center gap-2";

  return (
    <AuthBackground showNavigation={false}>
      <AuthPageShell>
        <motion.div
          className="w-full max-w-sm mx-auto"
          variants={fieldContainer}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={fieldItem}>
            <AuthScreenHeading title="Sign in to Zendt" />
          </motion.div>

          <form onSubmit={handleCredentialsSubmit} className="space-y-6">
            <motion.div variants={fieldItem}>
              <input
                id="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                placeholder="Username"
                autoComplete="email"
                className="zendt-input-auth mt-2"
              />
            </motion.div>

            <motion.div variants={fieldItem}>
              <PasswordInput
                id="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="zendt-input-auth"
              />
            </motion.div>

            <motion.div variants={fieldItem} className="-mt-1 flex justify-end">
              <Link
                to="/forgot-password"
                className="text-caption text-white/45 underline decoration-white/25 underline-offset-4 hover:text-white/75 hover:decoration-white/40 transition-colors"
              >
                Forgot password?
              </Link>
            </motion.div>

            <motion.div variants={fieldItem} className="flex gap-4 items-center justify-between pt-1">
              <motion.button
                type="submit"
                disabled={loading || pendingBiometricSetup}
                whileTap={reduced ? undefined : { scale: 0.95 }}
                transition={{ type: "spring", stiffness: 600, damping: 30 }}
                className="flex items-center justify-between bg-[#141414] text-white border border-gray-600 rounded-full py-0.5 pl-2 pr-0.5 w-24 disabled:opacity-50"
              >
                <span className="text-body">{loading ? "..." : "Login"}</span>
                <span className="w-7 h-7 bg-gray-300 text-black rounded-full flex items-center justify-center text-body">
                  ➜
                </span>
              </motion.button>

              <div className="shrink-0 flex items-center gap-1 text-center sm:text-right text-caption text-white">
                Don't have account?{" "}
                <Link to="/signup" className="text-gray-400 underline">
                  Sign up
                </Link>
              </div>
            </motion.div>
          </form>

          <div
            className="mt-10 mb-2 flex flex-col items-stretch gap-5 border-t border-white/[0.12] pt-10"
            aria-label="Alternative sign-in"
          >
            <p className="text-center text-caption uppercase tracking-[0.28em] text-white/35">
              Or continue with
            </p>
            <div className="flex flex-col w-full gap-3">
              <div className="flex w-full gap-3">
                <PressableButton
                  type="button"
                  disabled={loading || pendingBiometricSetup}
                  onClick={() => void handleGoogleLogin()}
                  className={`flex-1 min-w-0 ${altSignInButtonClass}`}
                >
                  <GoogleGMark className="size-[18px]" />
                  <span className="truncate">Continue with Google</span>
                </PressableButton>
                {appleSignInOffered && (
                  <PressableButton
                    type="button"
                    disabled={loading || pendingBiometricSetup}
                    onClick={() => void handleAppleLogin()}
                    className={`flex-1 min-w-0 ${altSignInButtonClass}`}
                  >
                    <AppleMark className="size-[18px]" />
                    <span className="truncate">Continue with Apple</span>
                  </PressableButton>
                )}
              </div>
              {biometricHardwareAvailable && (
                <PressableButton
                  type="button"
                  disabled={loading || pendingBiometricSetup}
                  onClick={() => void handleBiometricLogin()}
                  className={`w-full ${altSignInButtonClass}`}
                >
                  <BiometricEyeMark className="size-[18px]" />
                  <span className="truncate">{biometricButtonLabel}</span>
                </PressableButton>
              )}
            </div>
          </div>
        </motion.div>
      </AuthPageShell>

      <MotionSheet
        open={pendingBiometricSetup && !!biometricOffer}
        onClose={() => void finishBiometricOffer(false)}
        variant="center"
        backdropClassName="bg-black/55 backdrop-blur-[2px]"
        className="zendt-dashboard-clash"
      >
        <div
          className="p-6 space-y-5"
          role="dialog"
          aria-modal="true"
          aria-labelledby="biometric-offer-title"
        >
          <div className="space-y-2">
            <h3 id="biometric-offer-title" className={dashboardSectionTitleClass}>
              Enable quick sign-in next time?
            </h3>
            <p className="text-body text-white/70">
              Use {biometricButtonLabel.replace(/^Use /i, "")} on this device — no password needed.
            </p>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              className="flex-1 rounded-full border border-white/30 py-2.5 text-caption text-white hover:bg-white/5 transition-colors"
              onClick={() => void finishBiometricOffer(false)}
            >
              Not now
            </button>
            <button
              type="button"
              className="flex-1 rounded-full bg-white py-2.5 text-caption font-medium text-black hover:bg-white/90 transition-colors"
              onClick={() => void finishBiometricOffer(true)}
            >
              Enable
            </button>
          </div>
        </div>
      </MotionSheet>
    </AuthBackground>
  );
}
