import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PressableButton, useReducedMotionCtx } from "../motion";

interface CopyButtonProps {
  value: string;
}

export default function CopyButton({ value }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const reduced = useReducedMotionCtx();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <PressableButton
      type="button"
      onClick={handleCopy}
      className="h-8 w-6 rounded-lg border border-white/20 text-white flex items-center justify-center hover:border-white/40 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      aria-label={copied ? "Copied" : "Copy to clipboard"}
    >
      <AnimatePresence mode="wait" initial={false}>
        {copied ? (
          <motion.svg
            key="check"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            initial={reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
            animate={
              reduced
                ? { opacity: 1 }
                : { scale: 1, opacity: 1, transition: { type: "spring", stiffness: 600, damping: 28 } }
            }
            exit={reduced ? { opacity: 0 } : { scale: 0.6, opacity: 0 }}
          >
            <path
              d="M4 8L7 11L12 5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </motion.svg>
        ) : (
          <motion.svg
            key="copy"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            initial={reduced ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
            animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1, transition: { duration: 0.18 } }}
            exit={reduced ? { opacity: 0 } : { scale: 0.85, opacity: 0 }}
          >
            <rect x="5" y="3" width="8" height="10" rx="2" stroke="currentColor" strokeWidth="1.2" />
            <rect
              x="3"
              y="5"
              width="8"
              height="10"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.2"
              opacity="0.5"
            />
          </motion.svg>
        )}
      </AnimatePresence>
    </PressableButton>
  );
}
