import { useCallback, useEffect, useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import EditableDetailsCard from "./EditableDetailsCard";
import { DashboardSectionTitle } from "./DashboardTitles";
import Toast, { getToastAutoDismissMs } from "../Toast";
import { dataService, type ExperienceProjectApi } from "../../services/dataService";
import { getProfileSaveErrorToast } from "../../lib/profileContactMessages";
import { normalizeIndianPhoneE164, profilePhonePutPayload } from "../../lib/indianPhone";
import { BusinessProfileSkeleton } from "../shared/skeletons/DashboardSkeletons";

type Field = {
  label: string;
  key: string;
  type?: string;
  verifiable?: boolean;
  verifyType?: string;
};

type BusinessProfile = {
  addressFields: Field[];
  initialAddress: Record<string, string>;
  brandFields: Field[];
  initialBrandData: Record<string, string>;
  verificationStatus: Record<string, boolean>;
  businessLogoUrl: string;
  experience_projects: ExperienceProjectApi[];
};

export default function BusinessProfileEditPage() {
  const [data, setData] = useState<BusinessProfile | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [logoUrl, setLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
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
    const fetchData = async () => {
      const result = await dataService.getBusinessProfile();
      const bp = result as BusinessProfile & { experience_projects?: ExperienceProjectApi[] };
      setData({ ...bp, experience_projects: bp.experience_projects || [] });
      setLogoUrl(bp.businessLogoUrl || "");
      setLoadKey((k) => k + 1);
    };
    fetchData().catch(console.error);
  }, []);

  const refreshProfile = useCallback(async () => {
    const result = await dataService.getBusinessProfile();
    const bp = result as BusinessProfile & { experience_projects?: ExperienceProjectApi[] };
    setData({ ...bp, experience_projects: bp.experience_projects || [] });
    setLogoUrl(bp.businessLogoUrl || "");
    setLoadKey((k) => k + 1);
  }, []);

  if (!data) {
    return <BusinessProfileSkeleton />;
  }

  const { addressFields, initialAddress, brandFields, initialBrandData, verificationStatus } = data;

  const handleBrandSave = async (values: Record<string, string>) => {
    try {
      const payload: Record<string, unknown> = {
        brand_name: values.brandName,
        business_email: values.email,
        website: values.website,
      };
      const businessPhone = profilePhonePutPayload(values.phone ?? "");
      const initialBusinessPhone =
        profilePhonePutPayload(initialBrandData.phone ?? "") ??
        normalizeIndianPhoneE164(initialBrandData.phone ?? "");
      if (businessPhone !== undefined && businessPhone !== initialBusinessPhone) {
        payload.business_phone = businessPhone;
      }
      await dataService.updateProfile(payload);
      await refreshProfile();
    } catch (err) {
      console.error(err);
      showSaveErrorToast(err);
      throw err;
    }
  };

  const handleAddressSave = async (values: Record<string, string>) => {
    try {
      await dataService.updateProfile({ business_address: values });
      await refreshProfile();
    } catch (err) {
      console.error(err);
      showSaveErrorToast(err);
      throw err;
    }
  };

  const onPickLogo = () => fileInputRef.current?.click();

  const onLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await dataService.uploadBusinessLogo(file);
      if (res.business_logo) setLogoUrl(res.business_logo);
      await refreshProfile();
    } catch (err) {
      console.error(err);
    } finally {
      setUploadingLogo(false);
    }
  };

  const onRemoveLogo = async () => {
    if (!logoUrl || removingLogo) return;
    setRemovingLogo(true);
    try {
      await dataService.deleteBusinessLogo();
      setLogoUrl("");
      await refreshProfile();
    } catch (err) {
      console.error(err);
    } finally {
      setRemovingLogo(false);
    }
  };

  return (
    <PageContainer className="text-white space-y-6">
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
      <div className="p-6 bg-[#141414] rounded-t-3xl">
        <h1 className="text-title font-semibold">Edit business details</h1>
        <p className="text-white/70 text-caption pb-6">Update your brand, logo, and address.</p>

        <section className="rounded-[24px] mb-4 bg-[#1E1E1E] text-white p-6 space-y-4">
          <DashboardSectionTitle className="text-white/80">Business logo</DashboardSectionTitle>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-[112px] w-[112px] shrink-0 items-center justify-center rounded-[20px] bg-white/5 p-3 ring-1 ring-inset ring-white/5">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain object-center" />
              ) : (
                <span className="text-caption text-white/40 text-center px-2">No logo</span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={onLogoChange}
              />
              <button
                type="button"
                onClick={onPickLogo}
                disabled={uploadingLogo || removingLogo}
                className="rounded-[10px] bg-white/10 px-4 py-2 text-body text-white hover:bg-white/20 disabled:opacity-50"
              >
                {uploadingLogo ? "Uploading…" : "Upload logo"}
              </button>
              {logoUrl ? (
                <button
                  type="button"
                  onClick={onRemoveLogo}
                  disabled={uploadingLogo || removingLogo}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-white/15 text-white/55 hover:text-red-400 hover:border-red-400/40 hover:bg-red-500/10 disabled:opacity-50"
                  aria-label="Remove logo"
                >
                  <Trash2 size={18} strokeWidth={2} />
                </button>
              ) : null}
            </div>
          </div>
        </section>

        <EditableDetailsCard
          key={`brand-${loadKey}`}
          title="Brand details"
          fields={brandFields}
          initialValues={initialBrandData}
          verificationStatus={verificationStatus}
          onSave={handleBrandSave}
          onVerified={refreshProfile}
        />
        <EditableDetailsCard
          key={`addr-${loadKey}`}
          title="Business address"
          fields={addressFields}
          initialValues={initialAddress}
          onSave={handleAddressSave}
        />
      </div>
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
