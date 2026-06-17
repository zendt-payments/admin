import { motion } from "motion/react";
import { useReducedMotionCtx } from "../motion";

type Props = {
  /** Visual size preset. `sm` for inline teasers, `lg` for the full hero. */
  size?: "sm" | "md" | "lg";
  /** Show the floating badge on the corner. */
  showBadge?: boolean;
  /** Badge label when `showBadge` is true. */
  badgeLabel?: string;
  /** Override the printed cardholder name. Falls back to a placeholder. */
  holder?: string;
  /** Last-4 digits to display. Defaults to 4242. */
  last4?: string;
  /** Subtle parallax tilt on hover (web only — touch devices ignore it). */
  interactive?: boolean;
  className?: string;
};

const SIZE_PX: Record<NonNullable<Props["size"]>, number> = {
  sm: 220,
  md: 300,
  lg: 360,
};

/**
 * Premium card teaser used by the Cards-coming-soon experience.
 *
 * Visual tricks:
 *  - layered radial gradients fake brushed-metal lighting
 *  - a slow `backgroundPosition` shift gives a subtle living shimmer
 *  - chip is drawn from CSS gradients (no asset dependency)
 *  - on hover (web) the card lifts and tilts slightly via spring
 */
export default function ZendtCardPreview({
  size = "md",
  showBadge = false,
  badgeLabel = "Early Access",
  holder = "YOUR NAME",
  last4 = "4242",
  interactive = true,
  className = "",
}: Props) {
  const reduced = useReducedMotionCtx();
  const widthPx = SIZE_PX[size];

  return (
    <div
      className={`relative ${className}`}
      style={{ width: widthPx, maxWidth: "100%", perspective: 1200 }}
    >
      <motion.div
        initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24, rotateX: -8 }}
        animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, rotateX: 0 }}
        whileHover={!reduced && interactive ? { rotateY: 8, rotateX: -4, scale: 1.02 } : undefined}
        transition={{ type: "spring", stiffness: 240, damping: 28 }}
        className="relative w-full overflow-hidden rounded-[20px] select-none"
        style={{
          aspectRatio: "1.585 / 1",
          background: "linear-gradient(135deg, #1c1c1c 0%, #2b2b2b 45%, #0e0e0e 100%)",
          boxShadow:
            "0 28px 60px rgba(0,0,0,0.55), 0 6px 18px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)",
          transformStyle: "preserve-3d",
        }}
      >
        {/* Brushed-metal sheen — slowly drifts across the surface. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(120deg, transparent 30%, rgba(255,255,255,0.08) 48%, transparent 65%)",
            mixBlendMode: "overlay",
            backgroundSize: "200% 100%",
          }}
          animate={reduced ? undefined : { backgroundPosition: ["0% 0%", "100% 0%", "0% 0%"] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Gold accent glow in the upper-right corner */}
        <div
          aria-hidden
          className="absolute -top-16 -right-16 w-40 h-40 rounded-full pointer-events-none"
          style={{
            background: "radial-gradient(circle, rgba(199,156,80,0.22) 0%, transparent 60%)",
          }}
        />

        {/* Card layout — absolute padding scales by size */}
        <div className="absolute inset-0 flex flex-col justify-between p-5">
          {/* Top row: chip + brand wordmark */}
          <div className="flex items-start justify-between">
            <div
              className="rounded-[6px]"
              style={{
                width: size === "sm" ? 32 : 40,
                height: size === "sm" ? 22 : 28,
                background: "linear-gradient(135deg, #c79c50 0%, #f7ddaa 50%, #c79c50 100%)",
                boxShadow: "inset 0 0 0 1px rgba(0,0,0,0.25), inset 0 -1px 0 rgba(255,255,255,0.18)",
                position: "relative",
                overflow: "hidden",
              }}
            >
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "repeating-linear-gradient(90deg, transparent 0 4px, rgba(0,0,0,0.18) 4px 5px), repeating-linear-gradient(0deg, transparent 0 4px, rgba(0,0,0,0.18) 4px 5px)",
                }}
              />
            </div>
            <span
              className="text-white tracking-[0.32em] font-light"
              style={{ fontSize: size === "sm" ? 11 : 14 }}
            >
              ZENDT
            </span>
          </div>

          {/* Card number */}
          <div
            className="text-white/90 font-light tracking-[0.18em]"
            style={{ fontSize: size === "sm" ? 12 : 16 }}
          >
            ••••&nbsp;&nbsp;••••&nbsp;&nbsp;••••&nbsp;&nbsp;{last4}
          </div>

          {/* Bottom row: holder + scheme */}
          <div className="flex items-end justify-between">
            <div>
              <div
                className="text-white/40 uppercase tracking-[0.22em] mb-1"
                style={{ fontSize: size === "sm" ? 7 : 8 }}
              >
                Card holder
              </div>
              <div
                className="text-white font-light tracking-wide uppercase truncate"
                style={{
                  fontSize: size === "sm" ? 10 : 12,
                  maxWidth: size === "sm" ? 110 : 200,
                }}
                title={holder}
              >
                {holder}
              </div>
            </div>
            <span
              className="text-white"
              style={{
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontStyle: "italic",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                fontSize: size === "sm" ? 12 : 16,
              }}
            >
              VISA
            </span>
          </div>
        </div>
      </motion.div>

      {showBadge && (
        <motion.div
          initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.6, rotate: -20 }}
          animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, rotate: 8 }}
          transition={{
            type: "spring",
            stiffness: 320,
            damping: 22,
            delay: reduced ? 0 : 0.35,
          }}
          className="absolute"
          style={{
            top: -10,
            right: -8,
            padding: "6px 12px",
            borderRadius: 999,
            background: "linear-gradient(135deg, rgba(52,211,153,0.95), rgba(16,185,129,0.95))",
            color: "#0a0a0a",
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            boxShadow: "0 8px 22px rgba(16,185,129,0.35), 0 1px 0 rgba(255,255,255,0.2) inset",
            backdropFilter: "blur(6px)",
          }}
        >
          {badgeLabel}
        </motion.div>
      )}
    </div>
  );
}
