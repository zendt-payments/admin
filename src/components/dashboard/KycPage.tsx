import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import Toast, { type ToastTone, getToastAutoDismissMs } from "../Toast";
import OtpVerifyModal from "../shared/OtpVerifyModal";
import PhoneInput, { DASHBOARD_PHONE_INPUT_PROPS } from "../shared/PhoneInput";
import { DASHBOARD_INPUT_FIELD_10 } from "../shared/ClientSearchPicker";
import { dataService } from "../../services/dataService";
import { getKycToastFromError } from "../../lib/kycErrors";
import { getProfileSaveErrorToast } from "../../lib/profileContactMessages";
import ProofSubmissionStep from "./ProofSubmissionStep";
import { DashboardPageTitle, DashboardSectionTitle } from "./DashboardTitles";
import { normalizeIndianPhoneE164 } from "../../lib/indianPhone";
import { useAppResumeTick } from "../../hooks/useAppResumeTick";
import { useKycStatusQuery, type KycStatusData } from "../../hooks/useKycStatus";
import {
  DASH_QUERY_STALE,
  dqk,
  invalidateKycStatus,
  invalidateBankAccounts,
} from "../../lib/dashboardQueries";

type KycStep = {
  title: string;
  detail: string;
};

const DEFAULT_STEPS: KycStep[] = [
  { title: "PAN verification", detail: "Verify your PAN number and date of birth." },
  {
    title: "Bank account verification",
    detail: "Available after PAN verification — verify mobile, then add account number and IFSC.",
  },
  {
    title: "Professional verification",
    detail: "Upload freelance proof after steps 1 and 2.",
  },
];

function freelancerProofDetail(s: KycStatusData): string {
  if (!s.pan_verified || !isBankStepComplete(s)) {
    return "Finish steps 1 and 2 first.";
  }
  const ps = s.proof_status || "none";
  if (ps === "approved") return "Verified";
  if (ps === "submitted") return "Under review";
  if (ps === "rejected") {
    const r = (s.proof_rejection_reason || "").trim();
    return r ? `Rejected: ${r}` : "Rejected — upload again.";
  }
  return "Upload freelance proof.";
}

/** Bank + Zwitch sub-account must both succeed; `failed`/`pending` blocks step 2 (legacy: `idle` still counts as OK). */
function isBankStepComplete(s: KycStatusData): boolean {
  if (!s.bank_verified) return false;
  const st = (s.zwitch_setup_status || "idle").toLowerCase();
  if (st === "failed" || st === "pending") return false;
  return true;
}

function buildSteps(s: KycStatusData): KycStep[] {
  const bankDetail = (() => {
    if (isBankStepComplete(s)) return "Verified";
    if (!s.pan_verified) {
      return "Complete PAN verification in Step 1 first — then verify your bank details here.";
    }
    return "Verify your mobile, account number, and IFSC.";
  })();
  return [
    {
      title: "PAN verification",
      detail: s.pan_verified ? "Verified" : "Verify your PAN number and date of birth.",
    },
    {
      title: "Bank account verification",
      detail: bankDetail,
    },
    { title: "Professional verification", detail: freelancerProofDetail(s) },
  ];
}

/** Mirrors backend KYC DOB rules (Zwitch does not verify DOB vs PAN). */
function validatePanDobClient(dob: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob.trim());
  if (!m) return "Choose a valid date of birth.";
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const dobDate = new Date(Date.UTC(y, mo - 1, d));
  if (dobDate.getUTCFullYear() !== y || dobDate.getUTCMonth() !== mo - 1 || dobDate.getUTCDate() !== d) {
    return "Invalid date of birth.";
  }
  const now = new Date();
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (dobDate > today) return "Date of birth cannot be in the future.";
  const maxAge = 120;
  const oldestOk = new Date(today);
  oldestOk.setUTCFullYear(oldestOk.getUTCFullYear() - maxAge);
  if (dobDate < oldestOk) return "Date of birth is not valid.";
  const minAge = 18;
  const youngestOk = new Date(today);
  youngestOk.setUTCFullYear(youngestOk.getUTCFullYear() - minAge);
  if (dobDate > youngestOk) return `You must be at least ${minAge} years old.`;
  return null;
}

export default function KycPage() {
  const resumeTick = useAppResumeTick();
  const queryClient = useQueryClient();
  const { data: kycFull, isPending: loadingSteps, isError } = useKycStatusQuery();
  const [steps, setSteps] = useState<KycStep[]>(DEFAULT_STEPS);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);

  const [pan, setPan] = useState("");
  const [dob, setDob] = useState("");
  const dobRef = useRef<HTMLInputElement>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankPhone, setBankPhone] = useState("");

  const [phoneOtpOpen, setPhoneOtpOpen] = useState(false);
  const [phoneVerifySaving, setPhoneVerifySaving] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ message: string; sub: string; tone?: ToastTone }>({
    message: "",
    sub: "",
  });

  const toast = (message: string, sub: string, tone?: ToastTone) => {
    setToastMsg({ message, sub, tone });
    setShowToast(true);
    setTimeout(() => setShowToast(false), getToastAutoDismissMs({ tone, message }));
  };

  const refreshKyc = useCallback(async () => {
    await invalidateKycStatus(queryClient);
  }, [queryClient]);

  useEffect(() => {
    if (kycFull) {
      setSteps(buildSteps(kycFull));
      return;
    }
    if (isError) {
      toast("KYC status unavailable", "Could not load verification status. Try again.");
      setSteps(DEFAULT_STEPS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast is stable enough for error surface
  }, [kycFull, isError]);

  useEffect(() => {
    if (resumeTick === 0) return;
    void invalidateKycStatus(queryClient);
  }, [resumeTick, queryClient]);

  useEffect(() => {
    if (expandedStep !== 1) return;
    let cancelled = false;
    const fromKyc = kycFull?.phone?.trim() || "";
    queryClient
      .fetchQuery({
        queryKey: dqk.profileSettings,
        queryFn: () => dataService.getProfileSettings(),
        staleTime: DASH_QUERY_STALE.profileSettings,
      })
      .then((s) => {
        if (cancelled) return;
        setBankPhone((p) => {
          if (p.trim()) return p;
          if (fromKyc) return fromKyc;
          const raw = (s.initialProfileData.phone || "").trim();
          if (!raw) return "";
          return normalizeIndianPhoneE164(raw) || raw;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [expandedStep, kycFull?.phone, queryClient]);

  useEffect(() => {
    if (kycFull != null && expandedStep === 1 && !kycFull.pan_verified) {
      setExpandedStep(null);
    }
  }, [kycFull, expandedStep]);

  const isVerified = (detail: string) => detail === "Verified";

  const handlePanVerify = async () => {
    const panTrim = pan.trim();
    if (!panTrim) {
      toast("Validation failed", "Wrong PAN number");
      return;
    }
    if (!dob) {
      toast("Validation failed", "Choose your date of birth.");
      return;
    }
    const dobIssue = validatePanDobClient(dob);
    if (dobIssue) {
      toast("Validation failed", dobIssue);
      return;
    }
    setSubmitting(true);
    try {
      await dataService.verifyPAN(pan.toUpperCase(), dob);
      toast("PAN Verified", "Your PAN has been verified successfully.");
      setExpandedStep(null);
      await refreshKyc();
    } catch (err: unknown) {
      const { title, sub } = getKycToastFromError(err);
      toast(title, sub);
    } finally {
      setSubmitting(false);
    }
  };

  const bankPhoneVerified =
    kycFull?.phone_verified === true &&
    normalizeIndianPhoneE164(bankPhone) === String(kycFull?.phone || "").trim();

  const handleStartPhoneVerify = async () => {
    const e164 = normalizeIndianPhoneE164(bankPhone);
    if (!e164) {
      toast("Invalid phone", "Enter a valid Indian mobile number.");
      return;
    }
    setPhoneVerifySaving(true);
    try {
      await dataService.updateProfile({ phone: e164 });
      setBankPhone(e164);
      setPhoneOtpOpen(true);
    } catch (err: unknown) {
      const { title, sub, tone } = getProfileSaveErrorToast(err);
      toast(title, sub, tone);
      const fromKyc = kycFull?.phone?.trim() || "";
      setBankPhone(fromKyc ? normalizeIndianPhoneE164(fromKyc) || fromKyc : "");
    } finally {
      setPhoneVerifySaving(false);
    }
  };

  const handleBankVerify = async () => {
    if (!normalizeIndianPhoneE164(bankPhone)) {
      toast("Mobile number required", "Enter a valid Indian mobile number.");
      return;
    }
    if (!bankPhoneVerified) {
      toast("Tap Verify on your mobile number", "");
      return;
    }
    if (!accountNumber.trim() || accountNumber.replace(/\s/g, "").length < 5) {
      toast("Account number required", "Enter your bank account number (at least 5 digits).");
      return;
    }
    const trimmedIfsc = ifsc.replace(/\s/g, "").toUpperCase();
    if (trimmedIfsc.length !== 11) {
      toast("IFSC required", "Enter an 11-character IFSC code.");
      return;
    }

    setSubmitting(true);
    try {
      await dataService.verifyBank({
        account_number: accountNumber.trim(),
        ifsc: trimmedIfsc,
        phone: normalizeIndianPhoneE164(bankPhone) || bankPhone.trim(),
      });
      toast("Bank Verified", "Your bank account has been verified.");
      setExpandedStep(null);
      await Promise.all([refreshKyc(), invalidateBankAccounts(queryClient)]);
    } catch (err: unknown) {
      const { title, sub } = getKycToastFromError(err);
      toast(title, sub);
    } finally {
      setSubmitting(false);
    }
  };

  const proofStatus = kycFull?.proof_status || "none";
  const proofLocked = kycFull?.proof_locked === true;
  /** Step 3 upload UI only after PAN + bank + Zwitch setup are OK */
  const showProofStep = kycFull?.pan_verified === true && kycFull != null && isBankStepComplete(kycFull);

  /** Step 3 row label (top-right): show In progress when proof is under review */
  const proofStepStatusLabel = (): { text: string; className: string } => {
    if (!showProofStep) return { text: "Pending", className: "" };
    if (proofStatus === "approved") return { text: "Completed", className: "text-emerald-400" };
    if (proofStatus === "submitted") return { text: "In progress", className: "text-amber-400" };
    if (proofStatus === "rejected") return { text: "Rejected", className: "text-red-400" };
    return { text: "Pending", className: "" };
  };

  useEffect(() => {
    if (proofStatus === "rejected" && showProofStep) {
      setExpandedStep(2);
    }
  }, [proofStatus, showProofStep]);

  return (
    <PageContainer className="text-white space-y-6">
      <Toast
        message={toastMsg.message}
        subMessage={toastMsg.sub}
        visible={showToast}
        tone={toastMsg.tone}
        onDismiss={() => setShowToast(false)}
        icon={
          toastMsg.tone === "error" ? undefined : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              fill="none"
              stroke="grey"
              strokeWidth="2"
            >
              <circle cx="9" cy="9" r="8" />
              <path d="m7 9 2 2 4-4" />
            </svg>
          )
        }
      />

      <OtpVerifyModal
        isOpen={phoneOtpOpen}
        onClose={() => setPhoneOtpOpen(false)}
        onVerified={() => {
          void refreshKyc();
        }}
        type="phone"
        target={bankPhone}
      />

      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
        <GradientBlob
          className="absolute opacity-60 blur-2xl -z-10"
          style={{ right: "82px", top: "-50px", width: "321px", height: "262px", zIndex: "0" }}
        />
        <div className="flex justify-between w-full z-1">
          <BackButton />
        </div>
      </div>

      <section className="relative rounded-t-3xl bg-[#141414] h-full shadow-[0_35px_65px_rgba(4,4,7,0.55)] p-6 space-y-6">
        <header className="space-y-2">
          <DashboardPageTitle as="h2">Verification / KYC</DashboardPageTitle>
          <p className="text-body text-white/70">
            Complete the following steps so we can keep payment links and settlements working without
            interruption.
          </p>
        </header>

        {!loadingSteps &&
          kycFull?.pan_verified &&
          kycFull?.bank_verified &&
          kycFull?.zwitch_setup_status === "failed" && (
            <div className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-body text-amber-100/95">
              <p className="font-medium text-amber-200">Payment provider setup</p>
              <p className="mt-1 text-white/70 leading-relaxed">
                Your PAN and bank are verified in our system, but Zwitch sub-account setup failed (for
                example the account may already exist on Zwitch while your profile was reset). Fix the
                configuration or sync with Zwitch support, then complete Step 2 again. See backend README
                for{" "}
                <span className="font-mono text-caption text-white/85">ZWITCH_SKIP_SUB_ACCOUNT_SETUP</span>{" "}
                and API paths.
              </p>
              {kycFull.zwitch_setup_last_error ? (
                <p className="mt-2 text-caption text-white/45 font-mono break-all leading-snug">
                  {kycFull.zwitch_setup_last_error}
                </p>
              ) : null}
            </div>
          )}

        {loadingSteps ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-3xl bg-[#1E1E1E] p-4 animate-pulse">
                <div className="h-4 w-20 bg-white/10 rounded mb-3" />
                <div className="h-6 w-56 bg-white/10 rounded mb-2" />
                <div className="h-4 w-72 bg-white/5 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {steps.map((step, index) => {
              const verified = isVerified(step.detail);
              const isExpanded = expandedStep === index;
              const isProofStep = index === 2;
              const proofLabel = isProofStep ? proofStepStatusLabel() : null;
              const statusLabel =
                isProofStep && proofLabel
                  ? proofLabel
                  : {
                      text: verified ? "Completed" : "Pending",
                      className: verified ? "text-emerald-400" : "",
                    };

              return (
                <div key={step.title} className="rounded-3xl bg-[#1E1E1E] p-4">
                  <div className="flex items-center justify-between text-body text-white/70">
                    <span>Step {index + 1}</span>
                    <span className={statusLabel.className}>{statusLabel.text}</span>
                  </div>
                  <DashboardSectionTitle as="h3" className="mt-2">
                    {step.title}
                  </DashboardSectionTitle>
                  {!(isProofStep && isExpanded && showProofStep) && (
                    <p className="text-body text-white/70">{step.detail}</p>
                  )}

                  {!verified && index === 0 && (
                    <button
                      type="button"
                      onClick={() => setExpandedStep(isExpanded ? null : index)}
                      className="mt-3 text-body text-emerald-300 hover:text-emerald-200"
                    >
                      {isExpanded ? "Cancel" : "Verify now"}
                    </button>
                  )}

                  {!verified && index === 1 && kycFull?.pan_verified === true && (
                    <button
                      type="button"
                      onClick={() => setExpandedStep(isExpanded ? null : index)}
                      className="mt-3 text-body text-emerald-300 hover:text-emerald-200"
                    >
                      {isExpanded ? "Cancel" : "Verify now"}
                    </button>
                  )}

                  {!verified &&
                    isProofStep &&
                    showProofStep &&
                    proofStatus !== "submitted" &&
                    proofStatus !== "approved" && (
                      <button
                        type="button"
                        onClick={() => setExpandedStep(isExpanded ? null : index)}
                        className="mt-3 text-body text-emerald-300 hover:text-emerald-200"
                      >
                        {isExpanded
                          ? "Cancel"
                          : proofStatus === "rejected"
                            ? "Upload again"
                            : "Add documents"}
                      </button>
                    )}

                  {isExpanded && index === 0 && (
                    <div className="mt-4 space-y-3">
                      <label className="flex flex-col gap-2 text-caption text-white/70">
                        PAN Number
                        <input
                          value={pan}
                          onChange={(e) => setPan(e.target.value)}
                          placeholder="PAN number"
                          maxLength={10}
                          className="zendt-input-surface-kyc text-body uppercase"
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-caption text-white/70">
                        Date of birth
                        <input
                          ref={dobRef}
                          type="date"
                          value={dob}
                          onChange={(e) => setDob(e.target.value)}
                          onClick={() => dobRef.current?.showPicker?.()}
                          className="zendt-input-surface-kyc text-body cursor-pointer [color-scheme:dark]"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handlePanVerify}
                        disabled={submitting}
                        className="rounded-[11px] bg-white/10 px-5 py-2.5 text-body text-white hover:bg-white/20 disabled:opacity-40"
                      >
                        {submitting ? "Verifying..." : "Verify PAN"}
                      </button>
                    </div>
                  )}

                  {isExpanded && index === 1 && kycFull?.pan_verified === true && (
                    <div className="mt-4 space-y-4">
                      <label className="flex flex-col gap-2 text-caption text-white/70">
                        <div className="flex items-center justify-between gap-2">
                          <span>Phone</span>
                          {bankPhoneVerified ? (
                            <span className="shrink-0 flex items-center gap-1 text-caption text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
                              <svg
                                xmlns="http://www.w3.org/2000/svg"
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="3"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Verified
                            </span>
                          ) : normalizeIndianPhoneE164(bankPhone) ? (
                            <button
                              type="button"
                              onClick={() => void handleStartPhoneVerify()}
                              disabled={phoneVerifySaving}
                              className="shrink-0 text-caption text-blue-400 bg-blue-400/10 px-2.5 py-0.5 rounded-full hover:bg-blue-400/20 transition-colors disabled:opacity-40"
                            >
                              {phoneVerifySaving ? "Saving..." : "Verify"}
                            </button>
                          ) : null}
                        </div>
                        <PhoneInput
                          {...DASHBOARD_PHONE_INPUT_PROPS}
                          value={bankPhone}
                          onChange={setBankPhone}
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-caption text-white/70">
                        Account number
                        <input
                          value={accountNumber}
                          onChange={(e) => setAccountNumber(e.target.value)}
                          placeholder="e.g. 1234567890123"
                          className={DASHBOARD_INPUT_FIELD_10}
                        />
                      </label>
                      <label className="flex flex-col gap-2 text-caption text-white/70">
                        IFSC code
                        <input
                          value={ifsc}
                          onChange={(e) => setIfsc(e.target.value)}
                          placeholder="e.g. SBIN0001234"
                          maxLength={11}
                          className={`${DASHBOARD_INPUT_FIELD_10} uppercase`}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleBankVerify}
                        disabled={submitting}
                        className="rounded-[11px] bg-white/10 px-5 py-2.5 text-body text-white hover:bg-white/20 disabled:opacity-40"
                      >
                        {submitting ? "Verifying..." : "Verify Bank"}
                      </button>
                    </div>
                  )}

                  {isProofStep && showProofStep && (isExpanded || proofStatus === "submitted") && (
                    <ProofSubmissionStep
                      proofStatus={proofStatus}
                      proofLocked={proofLocked}
                      rejectionReason={kycFull?.proof_rejection_reason}
                      onSuccess={refreshKyc}
                      toast={toast}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </PageContainer>
  );
}
