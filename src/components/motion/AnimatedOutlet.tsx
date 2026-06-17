import { AnimatePresence, motion, type Transition, type Variants } from "motion/react";
import { Suspense } from "react";
import { useLocation, useOutlet } from "react-router-dom";
import { useReducedMotionCtx } from "./MotionContext";

export type OutletMode = "fade" | "slide" | "sheet";

/** Sheet flows keep a softer spring so full-screen stacks still feel deliberate. */
const SHEET_SPRING: Transition = {
  type: "spring",
  stiffness: 480,
  damping: 40,
  mass: 0.48,
};

/**
 * Slide entry uses a short tween (not a spring) so tab switches serialize less
 * work on Android WebViews; exits stay fast ease-out.
 */
const SLIDE_IN: Transition = { duration: 0.14, ease: [0.32, 0.72, 0, 1] };

/** Quick exit — next route can animate in sooner with `AnimatePresence sync`. */
const EASE_OUT: Transition = { duration: 0.14, ease: [0.32, 0.72, 0, 1] };

const slideVariants: Variants = {
  initial: { opacity: 0, x: 14, scale: 0.992 },
  animate: { opacity: 1, x: 0, scale: 1, transition: SLIDE_IN },
  exit: { opacity: 0, x: -8, scale: 0.998, transition: EASE_OUT },
};

const fadeVariants: Variants = {
  initial: { opacity: 0, scale: 0.988 },
  animate: { opacity: 1, scale: 1, transition: SLIDE_IN },
  exit: { opacity: 0, scale: 1, transition: { duration: 0.11, ease: [0.32, 0.72, 0, 1] } },
};

const sheetVariants: Variants = {
  initial: { opacity: 0, y: 28, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1, transition: SHEET_SPRING },
  exit: { opacity: 0, y: 12, scale: 0.995, transition: EASE_OUT },
};

const reducedVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

interface AnimatedOutletProps {
  /** Optional callback to choose mode based on the current pathname. */
  modeFor?: (pathname: string) => OutletMode;
  className?: string;
}

/**
 * Empty fallback — no flash. The motion.div around it already has the page
 * background color, so during a sub-100ms chunk-load you see the page's bg
 * gracefully filling in instead of a black gap.
 */
function NoFlashFallback() {
  return null;
}

/**
 * Animated route container for the dashboard outlet.
 *
 * - `AnimatePresence mode="sync"`: exiting and entering routes can overlap so
 *   tab changes feel snappier than `mode="wait"`.
 * - Uses full slide/sheet/fade unless the OS requests reduced motion.
 */
export default function AnimatedOutlet({ modeFor, className }: AnimatedOutletProps) {
  const location = useLocation();
  const element = useOutlet();
  const reduced = useReducedMotionCtx();

  const mode: OutletMode = modeFor ? modeFor(location.pathname) : "slide";
  const variants = reduced
    ? reducedVariants
    : mode === "sheet"
      ? sheetVariants
      : mode === "fade"
        ? fadeVariants
        : slideVariants;

  return (
    <AnimatePresence mode="sync" initial={false}>
      <motion.div
        key={location.pathname}
        className={className}
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
        style={{
          minHeight: "100%",
          backfaceVisibility: "hidden",
        }}
      >
        <Suspense fallback={<NoFlashFallback />}>{element}</Suspense>
      </motion.div>
    </AnimatePresence>
  );
}
