import { useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAvatar } from "../../context/AvatarContext";
import { DEFAULT_AVATAR_RADIUS_CLASS, DEFAULT_AVATAR_URL, isDefaultAvatar } from "../../constants/avatar";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import EditableDetailsCard from "./EditableDetailsCard";
import PageContainer from "./PageContainer";
import CropModal from "./CropModal";
import Toast, { getToastAutoDismissMs } from "../Toast";
import { dataService } from "../../services/dataService";
import { DASH_QUERY_STALE, dqk, invalidateProfileSettings } from "../../lib/dashboardQueries";
import { getProfileSaveErrorToast } from "../../lib/profileContactMessages";
import { normalizeIndianPhoneE164, profilePhonePutPayload } from "../../lib/indianPhone";
import { ProfileSettingsSkeleton } from "../shared/skeletons/DashboardSkeletons";

type Field = {
  label: string;
  key: string;
  type?: string;
  verifiable?: boolean;
  verifyType?: string;
};

type ProfileSettings = {
  initialAddress: Record<string, string>;
  addressFields: Field[];
  brandFields: Field[];
  initialProfileData: Record<string, string>;
  verificationStatus: Record<string, boolean>;
  hasProfileImage: boolean;
};

export default function ProfileSettingsPage() {
  const queryClient = useQueryClient();
  const { avatarSrc, setAvatarSrc } = useAvatar();
  const { data, isPending } = useQuery({
    queryKey: dqk.profileSettings,
    queryFn: async () => (await dataService.getProfileSettings()) as ProfileSettings,
    staleTime: DASH_QUERY_STALE.profileSettings,
  });
  const [uploading, setUploading] = useState(false);
  const [removingAvatar, setRemovingAvatar] = useState(false);
  const [hasProfileImage, setHasProfileImage] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [saveToast, setSaveToast] = useState<{
    message: string;
    sub?: string;
    tone: "error";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showSaveErrorToast = (err: unknown) => {
    const { title, sub, tone } = getProfileSaveErrorToast(err);
    setSaveToast({ message: title, sub, tone });
    setTimeout(() => setSaveToast(null), getToastAutoDismissMs({ tone, message: title }));
  };

  useEffect(() => {
    if (data?.hasProfileImage != null) setHasProfileImage(data.hasProfileImage);
  }, [data?.hasProfileImage]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setCropSrc(reader.result as string);
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleCropDone = async (blob: Blob) => {
    setCropSrc(null);
    try {
      setUploading(true);
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const result = await dataService.uploadAvatar(file);
      setAvatarSrc(result.profile_image);
      setHasProfileImage(true);
      await invalidateProfileSettings(queryClient);
    } catch (err) {
      console.error("Avatar upload failed:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!hasProfileImage || removingAvatar || uploading) return;
    setRemovingAvatar(true);
    try {
      await dataService.deleteAvatar();
      setAvatarSrc(DEFAULT_AVATAR_URL);
      setHasProfileImage(false);
      await invalidateProfileSettings(queryClient);
    } catch (err) {
      console.error("Remove avatar failed:", err);
    } finally {
      setRemovingAvatar(false);
    }
  };

  if (isPending || !data) {
    return <ProfileSettingsSkeleton />;
  }

  const { initialAddress, addressFields, brandFields, initialProfileData, verificationStatus } = data;

  const showDefaultShape = isDefaultAvatar(avatarSrc);

  const handleProfileSave = async (values: Record<string, string>) => {
    try {
      const payload: Record<string, unknown> = { full_name: values.name };
      const phone = profilePhonePutPayload(values.phone ?? "");
      const initialPhone =
        profilePhonePutPayload(initialProfileData.phone ?? "") ??
        normalizeIndianPhoneE164(initialProfileData.phone ?? "");
      if (phone !== undefined && phone !== initialPhone) {
        payload.phone = phone;
      }
      await dataService.updateProfile(payload);
      await queryClient.refetchQueries({ queryKey: dqk.profileSettings });
    } catch (err) {
      console.error(err);
      showSaveErrorToast(err);
      throw err;
    }
  };

  const handleAddressSave = async (values: Record<string, string>) => {
    try {
      await dataService.updateProfile({ address: values });
      await queryClient.refetchQueries({ queryKey: dqk.profileSettings });
    } catch (err) {
      console.error(err);
      showSaveErrorToast(err);
      throw err;
    }
  };

  return (
    <PageContainer className="text-white mb-4">
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

      <div className="mx-auto w-full max-w-[480px] pb-25">
        <div className="rounded-t-3xl bg-[#141414] p-5 z-1 relative overflow-hidden">
          {/* Profile Photo - Centered */}
          <div className="relative mb-6 flex justify-center">
            <div className="relative">
              <div
                className={[
                  "h-[120px] w-[120px] overflow-hidden bg-[#141414]/60",
                  DEFAULT_AVATAR_RADIUS_CLASS,
                ].join(" ")}
              >
                <img
                  src={avatarSrc}
                  alt="Profile"
                  className={
                    showDefaultShape ? "h-full w-full object-contain" : "h-full w-full object-cover"
                  }
                />
                {(uploading || removingAvatar) && (
                  <div
                    className={[
                      "absolute inset-0 flex items-center justify-center bg-black/50",
                      DEFAULT_AVATAR_RADIUS_CLASS,
                    ].join(" ")}
                  >
                    <span className="text-caption text-white">
                      {removingAvatar ? "Removing…" : "Uploading…"}
                    </span>
                  </div>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleFileSelect}
              />
              {hasProfileImage && (
                <button
                  type="button"
                  className="absolute bottom-0 left-0 p-2.5 bg-[#2E2E2E] text-white border border-white/10 rounded-full shadow-lg hover:bg-red-950/80 hover:border-red-400/30 transition-colors disabled:opacity-50"
                  aria-label="Remove profile picture"
                  onClick={handleRemoveAvatar}
                  disabled={uploading || removingAvatar}
                >
                  <Trash2 size={12} className="text-white" strokeWidth={2} />
                </button>
              )}
              <button
                type="button"
                className="absolute bottom-0 right-0 p-2.5 bg-[#2E2E2E] text-white border border-white/10 rounded-full shadow-lg hover:bg-[#3E3E3E] transition-colors"
                aria-label="Edit profile picture"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || removingAvatar}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 16 16"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="text-white"
                >
                  <path
                    d="M11.3333 2.00004C11.5084 1.82494 11.7163 1.68605 11.9451 1.59129C12.1739 1.49653 12.4191 1.44775 12.6667 1.44775C12.9142 1.44775 13.1594 1.49653 13.3882 1.59129C13.617 1.68605 13.8249 1.82494 14 2.00004C14.1751 2.17513 14.314 2.383 14.4088 2.61182C14.5035 2.84064 14.5523 3.08586 14.5523 3.33337C14.5523 3.58088 14.5035 3.8261 14.4088 4.05493C14.314 4.28375 14.1751 4.49161 14 4.66671L5.00001 13.6667L1.33334 14.6667L2.33334 11L11.3333 2.00004Z"
                    stroke="currentColor"
                    strokeWidth="1.33333"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Editable Cards */}
          <EditableDetailsCard
            title="Basic"
            fields={brandFields}
            initialValues={initialProfileData}
            verificationStatus={verificationStatus}
            onSave={handleProfileSave}
            stayEditingOnSaveError
            onVerified={() => {
              void invalidateProfileSettings(queryClient);
            }}
          />
          <EditableDetailsCard
            title="Address"
            fields={addressFields}
            initialValues={initialAddress}
            onSave={handleAddressSave}
          />
        </div>
      </div>

      {cropSrc && (
        <CropModal imageSrc={cropSrc} onCancel={() => setCropSrc(null)} onCropDone={handleCropDone} />
      )}
      <Toast
        message={saveToast?.message || ""}
        subMessage={saveToast?.sub}
        visible={!!saveToast}
        tone={saveToast?.tone ?? "error"}
        onDismiss={() => setSaveToast(null)}
      />
    </PageContainer>
  );
}
