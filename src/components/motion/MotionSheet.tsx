import { AnimatePresence, motion, type Transition, type Variants } from "motion/react";
import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useReducedMotionCtx } from "./MotionContext";

type MotionSheetVariant = "sheet" | "center";

const SPRING: Transition = { type: "spring", stiffness: 380, damping: 34, mass: 0.7 };
const EASE_OUT: Transition = { duration: 0.18, ease: [0.4, 0, 0.2, 1] };

const sheetVariants: Variants = {
  hidden: { y: "100%", opacity: 0 },
  visible: { y: 0, opacity: 1, transition: SPRING },
  exit: { y: "100%", opacity: 0, transition: EASE_OUT },
};

const centerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96, y: 6 },
  visible: { opacity: 1, scale: 1, y: 0, transition: SPRING },
  exit: { opacity: 0, scale: 0.97, transition: EASE_OUT },
};

const reducedVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.12 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

const backdropVariants: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.18 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

interface MotionSheetProps {
  open: boolean;
  onClose?: () => void;
  variant?: MotionSheetVariant;
  /** Set false if you want to render children without the styled card wrapper. */
  bare?: boolean;
  className?: string;
  children: ReactNode;
  /** Disable backdrop click-to-close (defaults to true). */
  dismissOnBackdrop?: boolean;
  /** Override default backdrop dim + blur (default: bg-black/60 backdrop-blur-sm). */
  backdropClassName?: string;
}

export default function MotionSheet({
  open,
  onClose,
  variant = "sheet",
  bare = false,
  className,
  children,
  dismissOnBackdrop = true,
  backdropClassName = "bg-black/60 backdrop-blur-sm",
}: MotionSheetProps) {
  const reduced = useReducedMotionCtx();

  // Lock body scroll while open. Capacitor WebViews on Android otherwise let
  // the page underneath scroll behind the sheet.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const contentVariants = reduced ? reducedVariants : variant === "sheet" ? sheetVariants : centerVariants;

  const positionClass =
    variant === "sheet"
      ? "fixed inset-x-0 bottom-0 z-50 flex justify-center"
      : "fixed inset-0 z-50 flex items-center justify-center px-6";

  if (typeof document === "undefined") return null;

  // Portal to document.body so the modal always sits above the viewport,
  // immune to ancestor `transform` / `will-change` containing-block traps
  // introduced by page transition motion.divs.
  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className={`fixed inset-0 z-40 ${backdropClassName}`}
            variants={backdropVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            onClick={dismissOnBackdrop ? onClose : undefined}
          />
          <div className={positionClass}>
            <motion.div
              className={
                bare
                  ? className
                  : [
                      "relative w-full max-w-sm",
                      variant === "sheet" ? "rounded-t-3xl pb-safe" : "rounded-2xl",
                      "bg-[#1E1E1E] border border-white/10",
                      "shadow-[0_8px_32px_rgba(0,0,0,0.5)]",
                      className || "",
                    ].join(" ")
              }
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              onClick={(e) => e.stopPropagation()}
            >
              {children}
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
