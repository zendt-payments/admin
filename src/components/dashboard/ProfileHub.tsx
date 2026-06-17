import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import GradientBlob from "../icons/GradientBlob";
import { useAvatar } from "../../context/AvatarContext";
import { useAuth } from "../../context/AuthContext";
import BackButton from "./BackButton";
import PageContainer from "./PageContainer";
import { DEFAULT_AVATAR_RADIUS_CLASS, isDefaultAvatar } from "../../constants/avatar";
import { dataService } from "../../services/dataService";
import { isAdmin } from "../../services/auth";
import { DASH_QUERY_STALE, dqk } from "../../lib/dashboardQueries";
import { MenuLinksSkeleton } from "../shared/skeletons/DashboardSkeletons";
import { Shimmer } from "../motion";

// Import PNG icons
import settingsIcon from "../../assets/icons/settings.png";
import businessProfileIcon from "../../assets/icons/business-profile.png";
import bankAccountsIcon from "../../assets/icons/bank-accounts.png";
import verificationIcon from "../../assets/icons/verification.png";
import pricingIcon from "../../assets/icons/pricing.png";
import helpIcon from "../../assets/icons/help.png";
import logoutIcon from "../../assets/icons/logout.png";

/** Feather Icons “gift” (MIT), inlined so it always renders (mobile / Capacitor / no broken asset URL). */
function ProfileHubGiftIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden
    >
      <g stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 12 20 22 4 22 4 12" />
        <rect x="2" y="7" width="20" height="5" />
        <line x1="12" y1="22" x2="12" y2="7" />
        <path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z" />
        <path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z" />
      </g>
    </svg>
  );
}

const iconMap: Record<string, string> = {
  Settings: settingsIcon,
  Briefcase: businessProfileIcon,
  Building2: bankAccountsIcon,
  ClipboardCheck: verificationIcon,
  Tag: pricingIcon,
  LifeBuoy: helpIcon,
};

const profileMenuItemClass =
  "flex items-center gap-3 text-callout font-light tracking-wide text-white hover:text-white/80";

type ProfileItem = {
  label: string;
  to: string;
  icon: string;
  showArrow?: boolean;
};

export default function ProfileHub() {
  const { avatarSrc } = useAvatar();
  const showDefaultShape = isDefaultAvatar(avatarSrc);
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [showAdmin, setShowAdmin] = useState(false);

  const hubQ = useQuery<ProfileItem[]>({
    queryKey: ["profileHubMenu"],
    queryFn: () => dataService.getProfileHubItems(),
    staleTime: 10 * 60_000,
  });

  const profileQ = useQuery({
    queryKey: dqk.profileSettings,
    queryFn: () => dataService.getProfileSettings(),
    staleTime: DASH_QUERY_STALE.profileSettings,
  });

  useEffect(() => {
    void isAdmin().then(setShowAdmin);
  }, []);

  const loading = hubQ.isPending || profileQ.isPending;
  const profileLoading = profileQ.isPending;
  const items = hubQ.data ?? [];
  const profileData = profileQ.data as
    | { initialProfileData?: { name: string; email: string }; customerId?: string }
    | undefined;
  const profile = profileData?.initialProfileData;
  const customerId = profileData?.customerId || "";

  return (
    <PageContainer className="text-white">
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

      <div className="mx-auto w-full max-w-[480px]">
        <div className="rounded-t-3xl bg-[#141414] p-5 z-1 relative overflow-hidden">
          {/* Profile Header */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <div
                className={[
                  "h-[110px] w-[110px] overflow-hidden bg-[#141414]/60",
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
              </div>
              <div className="absolute left-1/2 top-[110px] h-[calc(100%-110px)] w-px -translate-x-1/2 bg-white/15" />
            </div>

            <div className="flex-1 pt-1 space-y-2">
              {profileLoading ? (
                <div className="space-y-2">
                  <Shimmer className="h-5 w-36" bg="bg-white/10" rounded="rounded-lg" />
                  <Shimmer className="h-3 w-48" bg="bg-white/5" rounded="rounded-lg" />
                  <Shimmer className="h-3 w-32" bg="bg-white/5" rounded="rounded-lg" />
                </div>
              ) : (
                <>
                  <h2 className="text-callout font-light tracking-[0.01em]">{profile?.name || "—"}</h2>
                  <div className="space-y-1 text-caption text-white/60 leading-relaxed">
                    <p>
                      <span className="text-white/75">E-mail :</span> {profile?.email || "—"}
                    </p>
                    <p>
                      <span className="text-white/75">Customer id :</span> {customerId || "—"}
                    </p>
                  </div>
                </>
              )}
              <Link
                to="/dashboard/profile-settings"
                className="inline-flex items-center gap-1.5 text-body text-white"
              >
                Profile settings
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="8"
                  height="20"
                  viewBox="0 0 9 21"
                  fill="none"
                >
                  <path
                    d="M0.5 20.5L6.96447 14.0355C8.91709 12.0829 8.91709 8.91709 6.96447 6.96447L0.499999 0.5"
                    stroke="white"
                    strokeLinecap="round"
                  ></path>
                </svg>
              </Link>
            </div>
          </div>

          {/* Options List */}
          <div className="mt-8 flex flex-col gap-4">
            {loading ? (
              <MenuLinksSkeleton rows={5} />
            ) : (
              <>
                {showAdmin && (
                  <Link to="/admin" className={profileMenuItemClass}>
                    <img src={settingsIcon} alt="Admin" className="h-5 w-5 object-contain opacity-70" />
                    <span className="flex-1">Admin</span>
                  </Link>
                )}
                {items.flatMap(({ label, to, icon, showArrow }) => {
                  const iconSrc = iconMap[icon];
                  const row = (
                    <Link key={label} to={to} className={profileMenuItemClass}>
                      {iconSrc && (
                        <img src={iconSrc} alt="" className="h-5 w-5 object-contain opacity-70" />
                      )}
                      <span className="flex-1">{label}</span>
                      {showArrow && (
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="8"
                          height="20"
                          viewBox="0 0 9 21"
                          fill="none"
                        >
                          <path
                            d="M0.5 20.5L6.96447 14.0355C8.91709 12.0829 8.91709 8.91709 6.96447 6.96447L0.499999 0.5"
                            stroke="white"
                            strokeLinecap="round"
                          ></path>
                        </svg>
                      )}
                    </Link>
                  );
                  if (label === "Verification / KYC") {
                    return [
                      row,
                      <Link key="refer-earn" to="/dashboard/referral" className={profileMenuItemClass}>
                        <ProfileHubGiftIcon className="h-5 w-5 shrink-0 opacity-10 text-white" />
                        <span className="flex-1">Refer & earn</span>
                      </Link>,
                    ];
                  }
                  return [row];
                })}
              </>
            )}

            {/* Logout Button (Smaller) */}
            <button
              onClick={async () => {
                await logout();
                navigate("/");
              }}
              className={`${profileMenuItemClass} hover:text-red-300`}
            >
              <img src={logoutIcon} alt="Logout" className="h-5 w-5 object-contain opacity-70" />
              <span>Log out</span>
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
