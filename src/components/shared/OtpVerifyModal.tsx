import { useState, useRef, useEffect, useCallback } from "react";
import { dataService } from "../../services/dataService";
import { useAppToast } from "../../context/ToastContext";
import { MotionSheet } from "../motion";

interface OtpVerifyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: () => void;
  type: string;
  target: string;
}

const RESEND_COOLDOWN = 60;

export default function OtpVerifyModal({ isOpen, onClose, onVerified, type, target }: OtpVerifyModalProps) {
  const { showError } = useAppToast();
  const [digits, setDigits] = useState(["", "", "", "", "", ""]);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const resetState = useCallback(() => {
    setDigits(["", "", "", "", "", ""]);
    setSending(false);
    setVerifying(false);
    setSent(false);
    setCooldown(0);
  }, []);

  const sendOtp = useCallback(async () => {
    setSending(true);
    try {
      await dataService.sendOtp(type);
      setSent(true);
      setCooldown(RESEND_COOLDOWN);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send OTP";
      showError(msg);
    } finally {
      setSending(false);
    }
  }, [type, showError]);

  useEffect(() => {
    if (isOpen) {
      resetState();
      sendOtp();
    }
  }, [isOpen, resetState, sendOtp]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  useEffect(() => {
    if (isOpen && sent) {
      inputRefs.current[0]?.focus();
    }
  }, [isOpen, sent]);

  const handleChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const next = [...digits];
    next[index] = value.slice(-1);
    setDigits(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    const next = [...digits];
    for (let i = 0; i < 6; i++) {
      next[i] = pasted[i] || "";
    }
    setDigits(next);
    const focusIdx = Math.min(pasted.length, 5);
    inputRefs.current[focusIdx]?.focus();
  };

  const handleVerify = async () => {
    const code = digits.join("");
    if (code.length !== 6) {
      showError("Please enter the full 6-digit code");
      return;
    }
    setVerifying(true);
    try {
      await dataService.verifyOtp(type, code);
      onVerified();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Verification failed";
      showError(msg);
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = () => {
    if (cooldown > 0 || sending) return;
    setDigits(["", "", "", "", "", ""]);
    sendOtp();
  };

  const masked =
    type === "business_email"
      ? target.replace(/(.{2})(.*)(@.*)/, "$1***$3")
      : target.length > 4
        ? target.slice(0, -4).replace(/./g, "*") + target.slice(-4)
        : target;

  const label = type === "business_email" ? "email" : "phone number";

  return (
    <MotionSheet
      open={isOpen}
      onClose={onClose}
      variant="sheet"
      className="rounded-t-3xl pb-[calc(var(--zendt-safe-bottom)+24px)]"
    >
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <h3 className="text-white text-callout font-semibold">Verify your {label}</h3>
          <p className="text-white/60 text-body">
            {sent
              ? `Enter the 6-digit code sent to ${masked}`
              : sending
                ? "Sending verification code..."
                : "Preparing to send verification code..."}
          </p>
        </div>

        {sent && (
          <>
            <div className="flex justify-center gap-2" onPaste={handlePaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputRefs.current[i] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={d}
                  onChange={(e) => handleChange(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  className="w-11 min-h-[3rem] px-2 py-3 rounded-[10px] bg-[#141414] border border-white/10 text-center text-white text-title font-semibold focus:outline-none focus:border-white/30 transition-colors"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={handleVerify}
              disabled={verifying || digits.join("").length !== 6}
              className="w-full rounded-[10px] bg-white/10 px-4 py-2.5 text-body text-white hover:bg-white/20 transition-colors disabled:opacity-50"
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={cooldown > 0 || sending}
                className="text-caption text-white/50 hover:text-white/80 transition-colors disabled:opacity-40"
              >
                {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
              </button>
            </div>
          </>
        )}
      </div>
    </MotionSheet>
  );
}
