import { motion, type Variants } from "motion/react";
import { type ElementType, type ReactNode } from "react";
import { useReducedMotionCtx } from "./MotionContext";

const container: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.04, delayChildren: 0.02 },
  },
};

const reducedContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0 } },
};

interface StaggeredListProps {
  as?: ElementType;
  className?: string;
  children: ReactNode;
}

export default function StaggeredList({ as: Tag = "div", className, children }: StaggeredListProps) {
  const reduced = useReducedMotionCtx();
  const MotionTag = motion(Tag);
  return (
    <MotionTag
      className={className}
      variants={reduced ? reducedContainer : container}
      initial="hidden"
      animate="show"
    >
      {children}
    </MotionTag>
  );
}
