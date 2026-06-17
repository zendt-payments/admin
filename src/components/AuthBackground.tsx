import type { ReactNode } from "react";
import { motion } from "motion/react";
import NavigationBar from "./layout/NavigationBar";
import GradientBlob from "./icons/GradientBlob";
import { useReducedMotionCtx } from "./motion";

interface AuthBackgroundProps {
  children: ReactNode;
  showNavigation?: boolean;
  /** When navigation is hidden (e.g. admin-only flows), still show the Zendt mark. */
  showBrandLogo?: boolean;
  navigationContent?: ReactNode;
}

export default function AuthBackground({
  children,
  showNavigation = true,
  showBrandLogo = false,
  navigationContent,
}: AuthBackgroundProps) {
  const reduced = useReducedMotionCtx();

  return (
    <div className="bg-[#141414] relative min-h-screen w-full bg-linear-to-b overflow-hidden text-white flex flex-col items-center">
      {showNavigation && (
        <NavigationBar
          className="relative z-50 w-full max-w-4xl pt-safe-nav"
          centerContent={navigationContent}
        />
      )}
      {!showNavigation && showBrandLogo && (
        <div className="relative z-50 w-full max-w-4xl mx-auto px-4 pt-safe-nav flex justify-start shrink-0">
          <img src="/z-logo-nobg.png" alt="Zendt" className="h-16 w-16 object-contain md:h-18 md:w-18" />
        </div>
      )}
      <motion.div
        className="absolute top-20 right-8 w-[200px] h-[200px] border border-gray-700 opacity-10 rounded-3xl rotate-12"
        animate={reduced ? undefined : { x: [0, 20, 0], y: [0, -16, 0], rotate: [12, 14, 12] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="pointer-events-none absolute top-[-72px] md:top-[-80px] left-1/2 -translate-x-1/2 w-[360px] h-[472px] rotate-[-1deg]"
        animate={reduced ? undefined : { y: [0, -12, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      >
        <img
          src="/auth-pattern.svg"
          alt=""
          className="w-full h-full object-contain object-top drop-shadow-[0_25px_45px_rgba(0,0,0,0.45)]"
        />
        <motion.div
          className="absolute"
          style={{ top: "50px", left: "170px", width: "350px", height: "450px", zIndex: 0 }}
          animate={reduced ? undefined : { scale: [1, 1.06, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        >
          <GradientBlob
            className="absolute opacity-40 blur-2xl"
            style={{ top: 0, left: 0, width: "100%", height: "100%", zIndex: 0 }}
          />
        </motion.div>
      </motion.div>

      {children}
    </div>
  );
}
