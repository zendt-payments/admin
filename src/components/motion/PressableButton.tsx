import { motion, type HTMLMotionProps, type Transition } from "motion/react";
import { forwardRef } from "react";
import { useReducedMotionCtx } from "./MotionContext";

type PressableButtonProps = HTMLMotionProps<"button"> & {
  /** Adds a subtle ripple/glow on tap. Defaults to true. */
  ripple?: boolean;
  /** Adds a small lift on hover (web only — does nothing on touch). Defaults to true. */
  lift?: boolean;
};

/**
 * Premium, weighty press feedback. Tuned for "this app feels expensive."
 *
 * - Snappy spring (stiffness 520, damping 28) → presses bottom out fast,
 *   then bounce back with a tiny rebound that reads as confidence, not jitter.
 * - Hover lift (y: -1) on web only — touch devices ignore hover so it's free.
 * - Optional CSS ripple via `.btn-ripple` pseudo-element on `:active`.
 */
const PRESS_SPRING: Transition = {
  type: "spring",
  stiffness: 520,
  damping: 28,
  mass: 0.35,
};

const PressableButton = forwardRef<HTMLButtonElement, PressableButtonProps>(function PressableButton(
  { children, whileTap, whileHover, ripple = true, lift = true, className, transition, ...props },
  ref
) {
  const reduced = useReducedMotionCtx();

  const tap = whileTap ?? { scale: 0.94 };
  const hover = whileHover ?? (lift ? { scale: 1.02, y: -1 } : undefined);

  const finalClassName = [ripple ? "btn-ripple" : "", className || ""].filter(Boolean).join(" ");

  return (
    <motion.button
      ref={ref}
      className={finalClassName}
      whileTap={reduced ? undefined : tap}
      whileHover={reduced ? undefined : hover}
      transition={transition ?? PRESS_SPRING}
      {...props}
    >
      {children}
    </motion.button>
  );
});

export default PressableButton;
