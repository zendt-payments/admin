import { useEffect, useState } from "react";
import { motion } from "motion/react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import Toast, { getToastAutoDismissMs } from "../Toast";
import ZendtCardPreview from "./ZendtCardPreview";
import { dataService } from "../../services/dataService";
import { useAppResumeTick } from "../../hooks/useAppResumeTick";
import { PressableButton, StaggerItem, StaggeredList, useReducedMotionCtx } from "../motion";
import { DashboardPageTitle } from "./DashboardTitles";

type Feature = {
  title: string;
  description: string;
  icon: React.ReactNode;
};

const FEATURES: Feature[] = [
  {
    title: "Instant issuance",
    description: "Spin up physical and virtual cards in seconds — no paperwork.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="2" y="6" width="20" height="13" rx="2.5" />
        <line x1="2" y1="11" x2="22" y2="11" />
        <line x1="6" y1="15" x2="10" y2="15" />
      </svg>
    ),
  },
  {
    title: "Smart limits",
    description: "Set daily, monthly or per-merchant caps on every card.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "Real-time sync",
    description: "Spend updates land in your dashboard the instant they happen.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-3-6.7" />
        <polyline points="21 4 21 10 15 10" />
      </svg>
    ),
  },
  {
    title: "Cashback rewards",
    description: "Earn on every business spend — no hoops, no expiry games.",
    icon: (
      <svg
        width="22"
        height="22"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 12V8H6a2 2 0 0 1-2-2c0-1.1.9-2 2-2h12v4" />
        <path d="M4 6v12c0 1.1.9 2 2 2h14v-4" />
        <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
      </svg>
    ),
  },
];

export default function CardManagementPage() {
  const resumeTick = useAppResumeTick();
  const reduced = useReducedMotionCtx();
  const [holder, setHolder] = useState("Your name");
  const [last4, setLast4] = useState("XXXX");
  const [optedIn, setOptedIn] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
    tone?: "success" | "info" | "error";
  }>({ message: "", visible: false });

  useEffect(() => {
    let alive = true;
    dataService
      .getCardLaunchInfo()
      .then((info) => {
        if (!alive) return;
        if (info.holder) setHolder(info.holder);
        if (info.last4) setLast4(info.last4);
        setOptedIn(info.alreadyOptedIn);
      })
      .catch(() => {
        // Best-effort — placeholder holder/last4/optedIn already cover this case.
      });
    return () => {
      alive = false;
    };
  }, [resumeTick]);

  const showToast = (message: string, tone: "success" | "info" | "error") => {
    setToast({ message, tone, visible: true });
    setTimeout(() => setToast((t) => ({ ...t, visible: false })), getToastAutoDismissMs({ tone }));
  };

  const handleNotify = async () => {
    if (submitting) return;
    if (optedIn) {
      showToast("You're already on the waitlist", "info");
      return;
    }
    setSubmitting(true);
    try {
      const res = await dataService.optInCardsLaunch();
      setOptedIn(true);
      showToast(
        res.alreadyOptedIn
          ? "You're already on the waitlist"
          : "You're on the waitlist — we'll notify you when cards launch.",
        "success"
      );
    } catch {
      showToast("Couldn't save right now. Please try again.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="text-white">
      <Toast
        message={toast.message}
        visible={toast.visible}
        tone={toast.tone || "info"}
        onDismiss={() => setToast((t) => ({ ...t, visible: false }))}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
        <GradientBlob
          className="absolute opacity-60 blur-2xl -z-10"
          style={{
            right: "82px",
            top: "-50px",
            width: "321px",
            height: "262px",
          }}
        />
        <div className="flex justify-between w-full z-1">
          <BackButton />
        </div>
      </div>

      <div className="pt-6 relative rounded-t-3xl px-4 pb-25 bg-[#141414] z-1 flex-1">
        {/* Soft ambient glow behind the card */}
        <GradientBlob
          className="absolute opacity-25 blur-3xl -z-10"
          style={{
            left: "50%",
            top: "120px",
            transform: "translateX(-50%)",
            width: "320px",
            height: "320px",
          }}
        />

        {/* Hero card */}
        <div className="flex flex-col items-center pt-8 pt-safe pb-12 pb-safe-12">
          <ZendtCardPreview size="lg" holder={holder} last4={last4} showBadge badgeLabel="Early Access" />
        </div>

        {/* Headline */}
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.25, duration: 0.4, ease: "easeOut" }}
          className="text-center space-y-3 mb-10 max-w-md mx-auto"
        >
          <DashboardPageTitle>Cards by Zendt</DashboardPageTitle>
          <p className="text-body font-light text-white/55 leading-relaxed">
            Premium business cards built for India's modern entrepreneurs. Track spend, set limits and earn
            rewards — all from one place.
          </p>
        </motion.div>

        {/* Feature grid */}
        <StaggeredList className="grid grid-cols-2 gap-3 max-w-lg mx-auto mb-10">
          {FEATURES.map((feature) => (
            <StaggerItem key={feature.title}>
              <div className="rounded-[20px] bg-[#1A1A1A] border border-white/5 p-4 h-full flex flex-col gap-2.5">
                <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="text-body font-light text-white tracking-wide">{feature.title}</h3>
                  <p className="text-caption font-light text-white/45 leading-snug mt-1">
                    {feature.description}
                  </p>
                </div>
              </div>
            </StaggerItem>
          ))}
        </StaggeredList>

        {/* CTA */}
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: reduced ? 0 : 0.6, duration: 0.4, ease: "easeOut" }}
          className="max-w-sm mx-auto"
        >
          <PressableButton
            type="button"
            onClick={handleNotify}
            aria-pressed={optedIn}
            disabled={submitting || optedIn}
            className={`w-full h-[52px] rounded-[10px] text-body font-light tracking-wide transition-colors ${
              optedIn
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30"
                : submitting
                  ? "bg-white/70 text-black border border-white/70 cursor-wait"
                  : "bg-white text-black border border-white"
            }`}
          >
            {optedIn ? "You're on the waitlist" : submitting ? "Joining…" : "Join the waitlist"}
          </PressableButton>
          <p className="text-center text-caption font-light text-white/35 mt-3">
            We'll send a one-time alert the moment cards become available.
          </p>
        </motion.div>
      </div>
    </PageContainer>
  );
}
