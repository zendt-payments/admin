import { motion, type Variants } from "motion/react";
import { type ElementType, type ReactNode } from "react";
import { useReducedMotionCtx } from "./MotionContext";

const item: Variants = {
  hidden: { opacity: 0, y: 8 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring", stiffness: 420, damping: 36, mass: 0.6 },
  },
};

const reducedItem: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.15 } },
};

interface StaggerItemProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
  onClick?: () => void;
}

export default function StaggerItem({ as: Tag = "div", className, children, onClick }: StaggerItemProps) {
  const reduced = useReducedMotionCtx();
  const MotionTag = motion(Tag);
  return (
    <MotionTag className={className} variants={reduced ? reducedItem : item} onClick={onClick}>
      {children}
    </MotionTag>
  );
}
