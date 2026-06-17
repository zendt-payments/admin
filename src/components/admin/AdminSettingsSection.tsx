import { useEffect, useState, type FormEvent } from "react";
import { dataService } from "../../services/dataService";
import { changePassword, isPasswordStrongEnough } from "../../services/auth";
import { useAppToast } from "../../context/ToastContext";
import { DashboardSectionTitle } from "../dashboard/DashboardTitles";
import PasswordInput from "../shared/PasswordInput";
import { isApiError } from "../../lib/apiError";
import { AdminProfileSkeleton } from "../shared/skeletons/DashboardSkeletons";

export default function AdminSettingsSection() {
  const { showError, showSuccess } = useAppToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [nextPw, setNextPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);

  const refresh = () => {
    setLoading(true);
    dataService
      .getAdminMe()
      .then((me) => {
        setEmail(me.email || "");
        setFullName(me.full_name || "");
        setPhone(me.phone || "");
        setAvatarUrl(me.avatar_url || "");
      })
      .catch((e) => showError(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await dataService.patchAdminMe({
        full_name: fullName.trim(),
        phone: phone.trim(),
      });
      setFullName(updated.full_name || "");
      setPhone(updated.phone || "");
      setAvatarUrl(updated.avatar_url || "");
      showSuccess("Profile saved.");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not save profile");
    } finally {
      setSaving(false);
    }
  };

  const mimeForFile = (file: File): boolean => {
    const allowed = ["image/jpeg", "image/png", "image/heic", "image/heif"];
    if (allowed.includes(file.type)) return true;
    const name = file.name.toLowerCase();
    return /\.(jpe?g|png|hei[cf])$/i.test(name);
  };

  const onAvatarPick = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!mimeForFile(file)) {
      showError("Use JPEG, PNG, or HEIC/HEIF.");
      return;
    }
    setAvatarBusy(true);
    try {
      const out = await dataService.uploadAdminAvatar(file);
      setAvatarUrl(out.avatar_url || "");
      showSuccess("Photo updated.");
    } catch (err) {
      const msg = isApiError(err)
        ? err.message
        : err instanceof Error
          ? err.message
          : "Avatar upload failed";
      showError(msg);
    } finally {
      setAvatarBusy(false);
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!currentPw || !nextPw) {
      showError("Fill all password fields.");
      return;
    }
    if (!isPasswordStrongEnough(nextPw)) {
      showError("New password needs 8+ chars with upper, lower, number, and symbol.");
      return;
    }
    if (nextPw !== confirmPw) {
      showError("New passwords do not match.");
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(currentPw, nextPw);
      showSuccess("Password updated.");
      setCurrentPw("");
      setNextPw("");
      setConfirmPw("");
    } catch (err) {
      showError(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setPwLoading(false);
    }
  };

  if (loading) {
    return <AdminProfileSkeleton />;
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#1E1E1E] p-5">
        <DashboardSectionTitle as="h2">Profile</DashboardSectionTitle>
        <div className="flex items-start gap-4">
          <div className="h-20 w-20 rounded-full overflow-hidden bg-white/10 border border-white/15 shrink-0">
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-caption text-white/40">
                No photo
              </div>
            )}
          </div>
          <div className="space-y-2">
            <label className="block">
              <span className="text-caption uppercase tracking-wide text-white/45">Profile photo</span>
              <input
                type="file"
                accept="image/jpeg,image/png,image/heic,image/heif,.jpg,.jpeg,.png,.heic,.heif"
                disabled={avatarBusy}
                onChange={(ev) => onAvatarPick(ev.target.files)}
                className="mt-1 block w-full text-caption text-white/70 file:mr-2 file:rounded-full file:border-0 file:bg-white/15 file:px-3 file:py-1.5 file:text-caption file:text-white"
              />
            </label>
            {avatarBusy && <p className="text-caption text-white/45">Uploading…</p>}
          </div>
        </div>

        <form onSubmit={saveProfile} className="space-y-3 max-w-md">
          <div>
            <label className="text-caption uppercase tracking-wide text-white/45">Email</label>
            <input
              readOnly
              value={email}
              className="mt-1 w-full rounded-xl bg-[#141414] border border-white/10 px-4 py-2.5 text-body text-white/55 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="text-caption uppercase tracking-wide text-white/45">User name</label>
            <input
              value={fullName}
              onChange={(ev) => setFullName(ev.target.value)}
              className="mt-1 w-full rounded-xl bg-[#141414] border border-white/10 px-4 py-2.5 text-body text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
              placeholder="Your name"
            />
          </div>
          <div>
            <label className="text-caption uppercase tracking-wide text-white/45">Phone</label>
            <input
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              className="mt-1 w-full rounded-xl bg-[#141414] border border-white/10 px-4 py-2.5 text-body text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
              placeholder="Optional"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-white text-black px-6 py-2.5 text-body font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </form>
      </section>

      <section className="space-y-4 rounded-2xl border border-white/10 bg-[#1E1E1E] p-5">
        <DashboardSectionTitle as="h2">Security</DashboardSectionTitle>
        <p className="text-caption text-white/45 leading-snug">
          Change your Cognito password. You will stay signed in on this device.
        </p>
        <form onSubmit={submitPassword} className="space-y-3 max-w-md">
          <PasswordInput
            value={currentPw}
            onChange={(ev) => setCurrentPw(ev.target.value)}
            placeholder="Current password"
            autoComplete="current-password"
            className="w-full rounded-xl bg-[#141414] border border-white/10 px-4 py-2.5 text-body text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
          />
          <PasswordInput
            value={nextPw}
            onChange={(ev) => setNextPw(ev.target.value)}
            placeholder="New password"
            autoComplete="new-password"
            className="w-full rounded-xl bg-[#141414] border border-white/10 px-4 py-2.5 text-body text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
          />
          <PasswordInput
            value={confirmPw}
            onChange={(ev) => setConfirmPw(ev.target.value)}
            placeholder="Confirm new password"
            autoComplete="new-password"
            className="w-full rounded-xl bg-[#141414] border border-white/10 px-4 py-2.5 text-body text-white placeholder:text-white/35 focus:outline-none focus:border-white/25"
          />
          <button
            type="submit"
            disabled={pwLoading}
            className="rounded-full border border-white/20 px-6 py-2.5 text-body font-medium text-white hover:bg-white/10 disabled:opacity-50"
          >
            {pwLoading ? "Updating…" : "Update password"}
          </button>
        </form>
      </section>
    </div>
  );
}
