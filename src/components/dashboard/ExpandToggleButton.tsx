import { motion } from "motion/react";
import { PressableButton, useReducedMotionCtx } from "../motion";

interface ExpandToggleButtonProps {
  isOpen?: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  className?: string;
  variant?: "toggle" | "button";
}

export default function ExpandToggleButton({
  isOpen,
  onClick,
  icon,
  className,
  variant = "toggle",
}: ExpandToggleButtonProps) {
  const reduced = useReducedMotionCtx();

  const content = icon ?? (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width="13"
      height="27"
      viewBox="0 0 13 27"
      fill="none"
      animate={{ rotate: isOpen ? 90 : 0 }}
      transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 32 }}
    >
      <path
        d="M0.5 0.5L10.6716 10.6716C12.2337 12.2337 12.2337 14.7663 10.6716 16.3284L0.5 26.5"
        stroke="white"
        strokeLinecap="round"
      />
    </motion.svg>
  );

  const ariaProps =
    variant === "toggle"
      ? {
          "aria-expanded": Boolean(isOpen),
        }
      : undefined;

  return (
    <PressableButton
      type="button"
      onClick={onClick}
      className={[
        "h-[135px]  w-[38px] rounded-[10px] bg-[rgba(42,42,42,0.6)] backdrop-blur-[19px] flex justify-center items-center cursor-pointer shrink-0",
        className,
      ].join(" ")}
      {...ariaProps}
    >
      {content}
    </PressableButton>
  );
}
