import { useState, type FormEvent, type ReactNode } from "react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { changePassword, isPasswordStrongEnough } from "../../services/auth";
import PressableButton from "../motion/PressableButton";
import PasswordInput from "../shared/PasswordInput";
import { DASHBOARD_INPUT_FIELD_10 } from "../shared/ClientSearchPicker";
import { useAppToast } from "../../context/ToastContext";
import { DashboardPageTitle } from "./DashboardTitles";

function LabeledInput({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-caption text-white/70">
      <span>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

export default function ChangePasswordPage() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { showError, showSuccess } = useAppToast();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!current || !next) {
      showError("Fill all fields.");
      return;
    }
    if (!isPasswordStrongEnough(next)) {
      showError("New password needs 8+ chars with upper, lower, number, and symbol.");
      return;
    }
    if (next !== confirm) {
      showError("New passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      await changePassword(current, next);
      showSuccess("Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer className="zendt-dashboard-clash text-white space-y-6">
      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
        <GradientBlob
          className="absolute opacity-60 blur-2xl -z-10"
          style={{
            right: "82px",
            top: "-50px",
            width: "321px",
            height: "262px",
            zIndex: "0",
          }}
        />
        <div className="flex justify-between w-full z-1">
          <BackButton />
        </div>
      </div>

      <div className="relative z-2 space-y-6 rounded-t-3xl bg-[#141414] p-6 pb-20 pb-safe-nav flex-1">
        <header className="space-y-1">
          <DashboardPageTitle>Change password</DashboardPageTitle>
          <p className="text-body text-white/70 font-light">
            Enter your current password, then choose a new one.
          </p>
        </header>

        <form onSubmit={submit} className="space-y-6">
          <LabeledInput label="Current password" required>
            <PasswordInput
              value={current}
              onChange={(ev) => setCurrent(ev.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
              className={DASHBOARD_INPUT_FIELD_10}
            />
          </LabeledInput>
          <LabeledInput label="New password" required>
            <PasswordInput
              value={next}
              onChange={(ev) => setNext(ev.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
              className={DASHBOARD_INPUT_FIELD_10}
            />
          </LabeledInput>
          <LabeledInput label="Confirm new password" required>
            <PasswordInput
              value={confirm}
              onChange={(ev) => setConfirm(ev.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
              className={DASHBOARD_INPUT_FIELD_10}
            />
          </LabeledInput>
          <div className="flex justify-end pb-12">
            <PressableButton
              type="submit"
              disabled={loading}
              className="rounded-[10px] border border-white/10 bg-white/10 px-6 py-3 text-body text-white min-h-[46px] hover:bg-white/20 disabled:opacity-40 box-border shrink-0 whitespace-nowrap"
            >
              {loading ? "Updating…" : "Update password"}
            </PressableButton>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}
