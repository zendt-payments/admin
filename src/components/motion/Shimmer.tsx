import { motion } from "motion/react";
import { type CSSProperties, type ReactNode } from "react";
import { useReducedMotionCtx } from "./MotionContext";

interface ShimmerProps {
  className?: string;
  style?: CSSProperties;
  /** Override base block color (default: bg-white/5). */
  bg?: string;
  /** Override sweep color (default: bg-white/10). */
  highlight?: string;
  rounded?: string;
  children?: ReactNode;
}

export default function Shimmer({
  className,
  style,
  bg = "bg-white/5",
  highlight = "via-white/10",
  rounded = "rounded-lg",
  children,
}: ShimmerProps) {
  const reduced = useReducedMotionCtx();
  return (
    <div style={style} className={["relative overflow-hidden", bg, rounded, className || ""].join(" ")}>
      {children}
      {!reduced && (
        <motion.div
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent ${highlight} to-transparent`}
          initial={{ x: "-100%" }}
          animate={{ x: "100%" }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        />
      )}
    </div>
  );
}
