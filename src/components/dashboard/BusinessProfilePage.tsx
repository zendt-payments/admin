import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { dataService, type ExperienceProjectApi } from "../../services/dataService";
import ExperienceProjectsSection from "./ExperienceProjectsSection";
import {
  AboutBusinessSection,
  SocialProfilesSection,
  type SocialRow,
} from "./BusinessProfileAboutSocialSections";
import { useAppResumeTick } from "../../hooks/useAppResumeTick";
import { BusinessProfileSkeleton } from "../shared/skeletons/DashboardSkeletons";

function normalizeExperienceProjectsRaw(raw: unknown): ExperienceProjectApi[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((p) => {
    const o = p as Record<string, unknown>;
    return {
      id: String(o.id ?? ""),
      project_name: String(o.project_name ?? ""),
      domain: String(o.domain ?? ""),
      description: String(o.description ?? ""),
      images: Array.isArray(o.images) ? (o.images as string[]) : [],
      image_keys: Array.isArray(o.image_keys) ? (o.image_keys as string[]) : [],
    };
  });
}

function websiteHref(website: string) {
  const t = website.trim();
  if (!t) return "";
  return /^https?:\/\//i.test(t) ? t : `https://${t}`;
}

export default function BusinessProfilePage() {
  const resumeTick = useAppResumeTick();
  const [loading, setLoading] = useState(true);
  const [brandName, setBrandName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [businessAbout, setBusinessAbout] = useState("");
  const [businessLogo, setBusinessLogo] = useState("");
  const [socialProfiles, setSocialProfiles] = useState<SocialRow[]>([]);
  const [experienceProjects, setExperienceProjects] = useState<ExperienceProjectApi[]>([]);

  const loadProfile = useCallback(async () => {
    const u = await dataService.getBusinessProfileView();
    setBrandName((u.brand_name as string) || "");
    setBusinessEmail((u.business_email as string) || "");
    setPhone((u.business_phone as string) || "");
    setWebsite((u.website as string) || "");
    setBusinessAbout((u.business_about as string) || "");
    setBusinessLogo((u.business_logo as string) || "");
    const raw = u.social_profiles;
    const list = Array.isArray(raw)
      ? (raw as Array<{ platform?: string; url?: string }>)
          .filter((s) => s && typeof s.platform === "string" && typeof s.url === "string")
          .map((s) => ({ platform: s.platform!.trim(), url: s.url!.trim() }))
          .filter((s) => s.platform && s.url)
      : [];
    setSocialProfiles(list);
    setExperienceProjects(normalizeExperienceProjectsRaw(u.experience_projects));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadProfile();
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadProfile, resumeTick]);

  const handleAboutSave = async (text: string) => {
    await dataService.updateProfile({ business_about: text });
    setBusinessAbout(text);
  };

  const handleSocialSave = async (rows: SocialRow[]) => {
    await dataService.updateProfile({ social_profiles: rows });
    setSocialProfiles(rows);
  };

  if (loading) {
    return <BusinessProfileSkeleton />;
  }

  const displayName = brandName.trim() || "Your business";
  const href = websiteHref(website);

  return (
    <PageContainer className="text-white space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0 w-full">
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
      </div>
      <div className="pt-6 relative rounded-t-3xl pb-18 px-4 bg-[#141414] z-1 pb-30">
        <div className="flex flex-col gap-8">
          <div className="mx-auto w-full max-w-[480px]">
            <div className="rounded-[28px] bg-[#141414] p-6 relative overflow-hidden">
              <Link
                to="/dashboard/business-profile/edit"
                className="absolute top-4 right-4 inline-flex h-8 w-8 items-center justify-center text-white/60 hover:text-white transition-colors z-20"
              >
                <Pencil size={16} />
              </Link>

              <div className="flex items-start gap-4">
                <div className="relative">
                  <div className="flex h-[129px] w-[129px] items-center justify-center rounded-[28px] bg-white/5 mx-auto overflow-hidden p-3 ring-1 ring-inset ring-white/5">
                    {businessLogo ? (
                      <img
                        src={businessLogo}
                        alt=""
                        className="max-h-full max-w-full object-contain object-center"
                      />
                    ) : (
                      <span className="text-caption text-white/40 text-center px-2">No logo</span>
                    )}
                  </div>
                  <div className="absolute left-1/2 top-[140px] h-[calc(100%-140px)] w-px -translate-x-1/2 bg-white/15" />
                </div>

                <div className="min-w-0 flex-1 pt-2 space-y-3">
                  <h2 className="pr-10 text-title font-light tracking-[0.01em]">{displayName}</h2>
                  <div className="space-y-1 text-caption text-white/60 leading-relaxed">
                    <p className="flex min-w-0 items-center gap-1">
                      <span className="shrink-0 text-white/75">E-mail :</span>
                      <span className="truncate">{businessEmail.trim() ? businessEmail : "—"}</span>
                    </p>
                    <p className="flex min-w-0 items-center gap-1">
                      <span className="shrink-0 text-white/75">Phone :</span>
                      <span className="truncate">{phone.trim() ? phone : "—"}</span>
                    </p>
                    <p className="flex min-w-0 items-center gap-1">
                      <span className="shrink-0 text-white/75">Website :</span>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="truncate text-white/80 underline-offset-2 hover:underline"
                        >
                          {website.trim()}
                        </a>
                      ) : (
                        <span className="truncate">—</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <AboutBusinessSection initialText={businessAbout} onSave={handleAboutSave} />
          <SocialProfilesSection initialRows={socialProfiles} onSave={handleSocialSave} />
          <ExperienceProjectsSection editable projects={experienceProjects} onRefresh={loadProfile} />
        </div>
      </div>
    </PageContainer>
  );
}
