import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { NavLink, useLocation } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { motion, LayoutGroup } from "motion/react";
import NavigationBar from "./layout/NavigationBar";
import DashboardOutletShell from "./layout/DashboardOutletShell";
import CoreFeaturesModal from "./dashboard/CoreFeaturesModal";
import { invalidatePaymentLinkQueries } from "../lib/dashboardQueries";
import { AnimatedOutlet, type OutletMode, useReducedMotionCtx } from "./motion";
import Toast, { getToastAutoDismissMs } from "./Toast";

/** Summary (`/dashboard/home`) owns the same query keys via `useQueries` — skip duplicate prefetch there. */
function isDashboardHomePath(pathname: string): boolean {
  return pathname === "/dashboard/home" || pathname === "/dashboard";
}

const CHUNK_PREFETCH_ANDROID_CORE = [
  () => import("./dashboard/CardManagementPage"),
  () => import("./dashboard/SpendingDetailsPage"),
  () => import("./dashboard/ProfileHub"),
  () => import("./dashboard/Transactions"),
  () => import("./dashboard/PaymentStatusPage"),
] as const;

const CHUNK_PREFETCH_FULL = [
  ...CHUNK_PREFETCH_ANDROID_CORE,
  () => import("./dashboard/SpendingDetailsPage"),
  () => import("./dashboard/ReferralPage"),
  () => import("./dashboard/InvoiceOptionsPage"),
  () => import("./dashboard/InvoiceListPage"),
  () => import("./dashboard/InvoicePage"),
  () => import("./dashboard/PaymentLinksPage"),
  () => import("./dashboard/PaymentLinkCreatePage"),
  () => import("./dashboard/ClientsPage"),
  () => import("./dashboard/SettingsPage"),
  () => import("./dashboard/KycEntry"),
] as const;

/**
 * After the dashboard becomes interactive, quietly prefetch lazy chunks.
 * Android: only core tab routes in one idle slot (skip heavy invoice/KYC/payment flows).
 * Web / iOS: full list. Staggered second idle on Android for secondary routes (no heavy chunks).
 */
function prefetchDashboardChunks() {
  const ric =
    typeof window !== "undefined"
      ? (window.requestIdleCallback as ((cb: () => void, opts?: { timeout: number }) => number) | undefined)
      : undefined;
  const idle = ric ?? ((cb: () => void) => setTimeout(cb, 300));

  const runImports = (mods: ReadonlyArray<() => Promise<unknown>>) => {
    for (const m of mods) void m();
  };

  if (Capacitor.getPlatform() === "android") {
    const secondary: Array<() => Promise<unknown>> = [
      () => import("./dashboard/SpendingDetailsPage"),
      () => import("./dashboard/ReferralPage"),
      () => import("./dashboard/InvoiceOptionsPage"),
      () => import("./dashboard/InvoiceListPage"),
      () => import("./dashboard/PaymentLinksPage"),
      () => import("./dashboard/ClientsPage"),
      () => import("./dashboard/SettingsPage"),
    ];
    idle(() => {
      runImports(CHUNK_PREFETCH_ANDROID_CORE);
      // Defer secondary parses so tab transitions / springs aren’t competing immediately
      window.setTimeout(() => {
        idle(() => runImports(secondary));
      }, 1_200);
    });
  } else {
    idle(() => runImports(CHUNK_PREFETCH_FULL));
  }
}

const SHEET_PATHS = [
  "/dashboard/invoice",
  "/dashboard/kyc",
  "/dashboard/payment-links/new",
  "/dashboard/add-client",
  "/dashboard/update-client",
];

function modeForPath(pathname: string): OutletMode {
  if (SHEET_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return "sheet";
  }
  return "slide";
}

type TabDefinition = {
  to: string;
  label: string;
  icon: string;
  iconHighlighted: string;
  isAction?: boolean;
};

const tabs: TabDefinition[] = [
  {
    to: "home",
    label: "Dashboard",
    icon: "/dashboard.png",
    iconHighlighted: "/dashboard-highlighted.png",
  },
  {
    to: "card-management",
    label: "Cards",
    icon: "/card.png",
    iconHighlighted: "/card-highlighted.png",
  },
  {
    to: "quick-actions",
    label: "Pay",
    icon: "/virtual.png",
    iconHighlighted: "/virtual-highlighted.png",
    isAction: true,
  },
  {
    to: "monthly-spend",
    label: "Monthly spend",
    icon: "/explore.png",
    iconHighlighted: "/explore-highlighted.png",
  },
  {
    to: "profile",
    label: "Profile",
    icon: "/profile.png",
    iconHighlighted: "/profile-highlighted.png",
  },
];

function DashboardDesktopNav() {
  return (
    <nav className="flex items-center gap-1">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.isAction ? "#" : `/dashboard/${tab.to}`}
          className="relative flex items-center gap-2 rounded-[20px] px-3 py-2 text-body text-slate-300 focus-visible:outline-none"
        >
          <img src={tab.icon} className="relative h-5 w-5 object-contain" />
          <span className="relative">{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function DashboardMobileNav({ onActionClick }: { onActionClick: (tab: TabDefinition) => void }) {
  const reduced = useReducedMotionCtx();

  return (
    <>
      {/* Full-width background container starting from top of nav bar */}
      <div className="fixed bottom-0 left-0 right-0 h-[calc(94px+var(--zendt-safe-bottom))] bg-[#141414] z-30 md:hidden" />

      <div className="fixed bottom-safe-6 left-1/2 z-40 -translate-x-1/2 md:hidden">
        <LayoutGroup id="mobileNav">
          <div
            className="pointer-events-auto flex justify-between items-center px-6 bg-[#1F1F1F] rounded-full font-normal whitespace-nowrap shadow-[0_24px_45px_rgba(6,6,9,0.4)]"
            style={{
              width: "374px",
              height: "70px",
              borderRadius: "66px",
            }}
          >
            {tabs.map((tab) => {
              if (tab.isAction) {
                return (
                  <motion.button
                    key={tab.to}
                    onClick={() => onActionClick(tab)}
                    whileTap={reduced ? undefined : { scale: 0.92 }}
                    transition={{ type: "spring", stiffness: 600, damping: 30 }}
                    className="relative inline-flex h-[44px] w-[44px] items-center justify-center rounded-full border border-transparent p-2 text-slate-500 focus-visible:outline-none"
                  >
                    <img src={tab.icon} className="h-7 w-7 object-contain" />
                  </motion.button>
                );
              }

              return (
                <NavLink
                  key={tab.to}
                  to={`/dashboard/${tab.to}`}
                  className="relative inline-flex items-center justify-center rounded-full border border-transparent p-2 focus-visible:outline-none"
                >
                  {({ isActive }) => (
                    <motion.img
                      src={isActive ? tab.iconHighlighted : tab.icon}
                      alt=""
                      className={`relative h-7 w-7 object-contain transition-opacity duration-200 ${
                        isActive ? "opacity-100" : "opacity-40"
                      }`}
                      whileTap={reduced ? undefined : { scale: 0.85 }}
                      transition={{ type: "spring", stiffness: 600, damping: 30 }}
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        </LayoutGroup>
      </div>
    </>
  );
}

export default function Dashboard() {
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const location = useLocation();
  const prevPathRef = useRef(location.pathname);

  useEffect(() => {
    const prev = prevPathRef.current;
    prevPathRef.current = location.pathname;

    if (
      isDashboardHomePath(location.pathname) &&
      !isDashboardHomePath(prev) &&
      prev.startsWith("/dashboard")
    ) {
      void invalidatePaymentLinkQueries(queryClient);
    }
    prefetchDashboardChunks();
  }, [queryClient, location.pathname]);

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0);
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
    const root = document.getElementById("root");
    if (root) root.scrollTop = 0;
  }, [location.pathname]);
  const [isCoreFeaturesModalOpen, setIsCoreFeaturesModalOpen] = useState(false);

  // 🔹 Initialize from navigation state ONCE (no effect needed for this)
  const navigationState = location.state as { showKycToast?: boolean } | null;
  const [showKycToast, setShowKycToast] = useState(!!navigationState?.showKycToast);

  // Auto-hide after warning duration (45s) unless dismissed earlier
  useEffect(() => {
    if (!showKycToast) return;

    const timer = setTimeout(
      () => setShowKycToast(false),
      getToastAutoDismissMs({ tone: "warning", message: "Complete your KYC" })
    );

    return () => clearTimeout(timer);
  }, [showKycToast]);

  const showNavigationBar =
    location.pathname.startsWith("/dashboard/home") || location.pathname === "/dashboard";

  return (
    <div
      ref={scrollRef}
      className="min-h-screen w-full bg-[#141414] text-white overflow-y-scroll no-scrollbar"
    >
      <Toast
        visible={showKycToast}
        message="Complete your KYC"
        subMessage="Please complete your KYC to unlock all features."
        tone="warning"
        onDismiss={() => setShowKycToast(false)}
      />

      {showNavigationBar && (
        <div className="mx-auto w-full max-w-4xl px-4 pt-safe-nav">
          <NavigationBar className="w-full" centerContent={<DashboardDesktopNav />} />
        </div>
      )}

      <div className="relative flex min-h-screen flex-col w-full items-center">
        <DashboardMobileNav
          onActionClick={(tab) => {
            if (tab.to === "quick-actions") {
              setIsCoreFeaturesModalOpen((prev) => !prev);
            }
          }}
        />
        <DashboardOutletShell>
          <AnimatedOutlet modeFor={modeForPath} />
        </DashboardOutletShell>
      </div>

      <CoreFeaturesModal
        isOpen={isCoreFeaturesModalOpen}
        onClose={() => setIsCoreFeaturesModalOpen(false)}
      />
    </div>
  );
}
