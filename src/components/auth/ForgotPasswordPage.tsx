import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthBackground from "../AuthBackground";
import { confirmForgotPassword, forgotPassword, isPasswordStrongEnough } from "../../services/auth";
import { TEST_MODE } from "../../services/testMode";
import AuthPageShell from "./AuthPageShell";
import AuthScreenHeading from "./AuthScreenHeading";
import { useAppToast } from "../../context/ToastContext";
import { motion, type Variants } from "motion/react";
import { useReducedMotionCtx } from "../motion";
import PasswordInput from "../shared/PasswordInput";

/** Step 1: request code. Step 2: code + new password. Test mode accepts code `123456`. */
export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useAppToast();

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

  const requestSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      showError("Please enter your email.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      showSuccess("Check your email for the verification code.");
      setStep(2);
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not send code.");
    } finally {
      setLoading(false);
    }
  };

  const confirmSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const em = email.trim();
    if (!code.trim()) {
      showError("Enter the verification code.");
      return;
    }
    if (!isPasswordStrongEnough(newPassword)) {
      showError("Password needs 8+ chars with upper, lower, number, and symbol.");
      return;
    }
    if (newPassword !== confirm) {
      showError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await confirmForgotPassword(em, code.trim(), newPassword);
      showSuccess("Password updated — you can sign in now.");
      navigate("/login", { replace: true });
    } catch (err) {
      showError(err instanceof Error ? err.message : "Reset failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground showNavigation={false}>
      <AuthPageShell>
        <div className="w-full max-w-sm mx-auto flex flex-col">
          <motion.div
            key={step}
            className="w-full"
            variants={fieldContainer}
            initial="hidden"
            animate="show"
          >
            <motion.div key={`head-${step}`} variants={fieldItem}>
              <AuthScreenHeading title={step === 1 ? "Recover your password" : "Set a new password"} />
            </motion.div>

            {step === 1 && (
              <form onSubmit={requestSubmit} className="space-y-6 mb-4">
                <motion.div variants={fieldItem}>
                  <input
                    type="email"
                    value={email}
                    onChange={(ev) => setEmail(ev.target.value)}
                    placeholder="Email"
                    className="zendt-input-auth mt-2"
                    autoComplete="email"
                  />
                </motion.div>
                <motion.div variants={fieldItem}>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={reduced || loading ? undefined : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 600, damping: 30 }}
                    className="w-full rounded-full bg-white text-black py-3 text-body font-medium disabled:opacity-50"
                  >
                    {loading ? "Sending…" : "Send code"}
                  </motion.button>
                </motion.div>
              </form>
            )}

            {step === 2 && (
              <form onSubmit={confirmSubmit} className="space-y-6 mb-4">
                {TEST_MODE && (
                  <motion.p
                    variants={fieldItem}
                    className="text-caption text-amber-200/90 text-center rounded-lg bg-white/10 px-2 py-1"
                  >
                    Test mode: use code <strong className="font-mono">123456</strong>
                  </motion.p>
                )}
                <motion.div variants={fieldItem}>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={code}
                    onChange={(ev) => setCode(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="6-digit code"
                    className="zendt-input-auth mt-2"
                    autoComplete="one-time-code"
                  />
                </motion.div>
                <motion.div variants={fieldItem}>
                  <PasswordInput
                    value={newPassword}
                    onChange={(ev) => setNewPassword(ev.target.value)}
                    placeholder="New password"
                    className="zendt-input-auth"
                    autoComplete="new-password"
                  />
                </motion.div>
                <motion.div variants={fieldItem}>
                  <PasswordInput
                    value={confirm}
                    onChange={(ev) => setConfirm(ev.target.value)}
                    placeholder="Confirm new password"
                    className="zendt-input-auth"
                    autoComplete="new-password"
                  />
                </motion.div>
                <motion.div variants={fieldItem}>
                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileTap={reduced || loading ? undefined : { scale: 0.98 }}
                    transition={{ type: "spring", stiffness: 600, damping: 30 }}
                    className="w-full rounded-full bg-white text-black py-3 text-body font-medium disabled:opacity-50"
                  >
                    {loading ? "Saving…" : "Update password"}
                  </motion.button>
                </motion.div>
                <motion.div variants={fieldItem}>
                  <button
                    type="button"
                    className="w-full text-caption text-white/50 py-2"
                    onClick={() => {
                      setStep(1);
                      setCode("");
                      setNewPassword("");
                      setConfirm("");
                    }}
                  >
                    Use a different email
                  </button>
                </motion.div>
              </form>
            )}

            <motion.div variants={fieldItem} className="text-center pt-4">
              <Link to="/login" className="text-caption text-white/55 underline">
                Back to login
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </AuthPageShell>
    </AuthBackground>
  );
}
