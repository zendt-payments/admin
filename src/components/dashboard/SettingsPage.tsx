import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { dataService } from "../../services/dataService";
import { useDashboardSettings } from "../../hooks/useDashboardSettings";
import { useAppResumeTick } from "../../hooks/useAppResumeTick";
import { DashboardPageTitle, DashboardSectionTitle } from "./DashboardTitles";
import { ToggleListSkeleton } from "../shared/skeletons/DashboardSkeletons";
import { DASH_QUERY_STALE, dqk } from "../../lib/dashboardQueries";

const settingsRowClass =
  "flex items-start justify-between gap-4 rounded-[16px] border border-white/5 bg-[#1E1E1E] px-4 py-3";

export default function SettingsPage() {
  const resumeTick = useAppResumeTick();
  const queryClient = useQueryClient();
  const { settings, toggleSection } = useDashboardSettings();
  const [preferences, setPreferences] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (resumeTick === 0) return;
    void queryClient.invalidateQueries({ queryKey: dqk.settingsToggles });
  }, [resumeTick, queryClient]);

  const { data: toggleSettings = [], isPending: loading } = useQuery({
    queryKey: dqk.settingsToggles,
    queryFn: () => dataService.getSettingsToggles(),
    staleTime: DASH_QUERY_STALE.settingsToggles,
  });

  useEffect(() => {
    if (!toggleSettings.length) return;
    setPreferences(
      toggleSettings.reduce<Record<string, boolean>>((acc, setting) => {
        acc[setting.key] = setting.value ?? true;
        return acc;
      }, {})
    );
  }, [toggleSettings]);

  const handleToggle = (key: string) => {
    const newValue = !preferences[key];
    setPreferences((prev) => ({ ...prev, [key]: newValue }));
    dataService.updateSettings({ [key]: newValue }).catch(console.error);
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

      <section className="relative z-1 rounded-t-3xl bg-[#141414] shadow-[0_35px_65px_rgba(4,4,7,0.55)] p-6 pb-24 pb-safe-nav space-y-10 flex-1">
        <header className="space-y-1">
          <DashboardPageTitle as="h2">Settings</DashboardPageTitle>
          <p className="text-body text-white/70">Control notifications and preferences for your account.</p>
        </header>

        <div className="space-y-5">
          {loading && <ToggleListSkeleton rows={1} />}
          {!loading &&
            toggleSettings.map(({ key, label, description }) => (
              <div key={key} className={settingsRowClass}>
                <div className="min-w-0 flex-1">
                  <p className="text-callout font-medium">{label}</p>
                  <p className="text-body text-white/70">{description}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(key)}
                  className={[
                    "relative h-8 w-14 shrink-0 rounded-full transition",
                    preferences[key] ? "bg-emerald-400/70" : "bg-white/20",
                  ].join(" ")}
                  aria-pressed={preferences[key]}
                >
                  <span
                    className={[
                      "absolute top-1 h-6 w-6 rounded-full bg-white transition-all",
                      preferences[key] ? "right-1" : "left-1",
                    ].join(" ")}
                  />
                </button>
              </div>
            ))}
        </div>

        <div className="space-y-4">
          <DashboardSectionTitle as="h2">Account</DashboardSectionTitle>
          <Link
            to="/dashboard/change-password"
            className={`${settingsRowClass} hover:border-white/10 hover:bg-[#242424] transition`}
          >
            <div className="min-w-0 flex-1">
              <p className="text-callout font-medium">Change password</p>
              <p className="text-body text-white/70">Update your sign-in password.</p>
            </div>
            <ChevronRight className="h-5 w-5 shrink-0 self-center text-white/40" strokeWidth={2} />
          </Link>
        </div>

        <div className="space-y-5">
          <header className="space-y-1">
            <DashboardSectionTitle as="h2">Dashboard visibility</DashboardSectionTitle>
            <p className="text-body text-white/70">Customize what you see on your dashboard.</p>
          </header>

          {[
            {
              key: "transactions",
              label: "Show Transactions",
              description: "Display your recent transaction history.",
            },
            {
              key: "wallets",
              label: "Show exchange rates",
              description:
                "Show live INR reference quotes for currencies you track (open exchange-rate API feed).",
            },
          ].map(({ key, label, description }) => (
            <div key={key} className={settingsRowClass}>
              <div className="min-w-0 flex-1">
                <p className="text-callout font-medium">{label}</p>
                <p className="text-body text-white/70">{description}</p>
              </div>
              <button
                type="button"
                onClick={() => toggleSection(key as keyof typeof settings)}
                className={[
                  "relative h-8 w-14 shrink-0 rounded-full transition",
                  settings[key as keyof typeof settings] ? "bg-emerald-400/70" : "bg-white/20",
                ].join(" ")}
                aria-pressed={settings[key as keyof typeof settings]}
              >
                <span
                  className={[
                    "absolute top-1 h-6 w-6 rounded-full bg-white transition-all",
                    settings[key as keyof typeof settings] ? "right-1" : "left-1",
                  ].join(" ")}
                />
              </button>
            </div>
          ))}
        </div>
      </section>
    </PageContainer>
  );
}
