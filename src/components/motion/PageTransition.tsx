import { motion, type Transition, type Variants } from "motion/react";
import { Suspense } from "react";
import { Outlet } from "react-router-dom";
import { useReducedMotionCtx } from "./MotionContext";

type PageTransitionMode = "fade" | "slide" | "sheet" | "scale";

const SPRING_IN: Transition = { type: "spring", stiffness: 420, damping: 38, mass: 0.55 };
const EASE_OUT: Transition = { duration: 0.16, ease: [0.32, 0.72, 0, 1] };

const variants: Record<PageTransitionMode, Variants> = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: SPRING_IN },
    exit: { opacity: 0, transition: EASE_OUT },
  },
  slide: {
    initial: { opacity: 0, x: 24, scale: 0.992 },
    animate: { opacity: 1, x: 0, scale: 1, transition: SPRING_IN },
    exit: { opacity: 0, x: -16, transition: EASE_OUT },
  },
  sheet: {
    initial: { opacity: 0, y: 32, scale: 0.985 },
    animate: { opacity: 1, y: 0, scale: 1, transition: SPRING_IN },
    exit: { opacity: 0, y: 16, transition: EASE_OUT },
  },
  scale: {
    initial: { opacity: 0, scale: 0.97 },
    animate: { opacity: 1, scale: 1, transition: SPRING_IN },
    exit: { opacity: 0, scale: 0.99, transition: EASE_OUT },
  },
};

const reducedVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

interface PageTransitionProps {
  mode?: PageTransitionMode;
  className?: string;
}

/**
 * Top-level animated route shell. Suspense lives INSIDE the motion.div so a
 * lazy-loading child never collapses the entire shell into a black fallback.
 */
export default function PageTransition({ mode = "fade", className }: PageTransitionProps) {
  const reduced = useReducedMotionCtx();
  const v = reduced ? reducedVariants : variants[mode];

  return (
    <motion.div
      className={className}
      style={{
        // No persistent `transform`/`willChange: transform` here — both create
        // a containing block that traps descendant `position: fixed` elements.
        // Framer-motion still sets transform during active animation, which is
        // OK because toasts/modals are portaled to document.body.
        minHeight: "100%",
        backfaceVisibility: "hidden",
      }}
      variants={v}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      <Suspense fallback={null}>
        <Outlet />
      </Suspense>
    </motion.div>
  );
}
