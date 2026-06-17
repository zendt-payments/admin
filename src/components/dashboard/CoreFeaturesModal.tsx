import { Link } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import GradientBlob from "../icons/GradientBlob";
import { useReducedMotionCtx } from "../motion";

interface CoreFeaturesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const features = [
  { id: "payment-links", label: "Payment links", to: "/dashboard/payment-links" },
  { id: "create-payment-link", label: "Create payment link", to: "/dashboard/payment-links/new" },
  { id: "invoice", label: "Invoice", to: "/dashboard/invoice-options" },
  { id: "clients", label: "Clients", to: "/dashboard/clients" },
] as const;

export default function CoreFeaturesModal({ isOpen, onClose }: CoreFeaturesModalProps) {
  const reduced = useReducedMotionCtx();

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            className="fixed inset-0 z-40 bg-black/40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          {/* Animate outside the clip — scale + rounded overflow breaks corners on iOS. */}
          <motion.div
            className="fixed bottom-[calc(110px+var(--zendt-safe-bottom))] left-1/2 z-50 w-[374px] -translate-x-1/2 shadow-2xl"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 24 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 16 }}
            transition={
              reduced ? { duration: 0.15 } : { type: "spring", stiffness: 380, damping: 32, mass: 0.7 }
            }
          >
            {/* clip-path rounds blurred children reliably on iOS (overflow-hidden alone does not). */}
            <div className="relative isolate translate-z-0 [clip-path:inset(0_round_32px)]">
              <div className="absolute inset-0 bg-[#161616]">
                <GradientBlob
                  className="absolute opacity-50 blur-2xl"
                  style={{
                    top: "-200px",
                    left: "-50px",
                    width: "150%",
                    height: "150%",
                    zIndex: 0,
                  }}
                />
              </div>

              <motion.div
                className="relative z-10 flex flex-col gap-3 p-8 pb-10"
                initial="hidden"
                animate="show"
                exit="hidden"
                variants={{
                  hidden: {},
                  show: {
                    transition: { staggerChildren: reduced ? 0 : 0.04, delayChildren: 0.05 },
                  },
                }}
              >
                {features.map((feature) => (
                  <motion.div
                    key={feature.id}
                    variants={
                      reduced
                        ? { hidden: { opacity: 0 }, show: { opacity: 1 } }
                        : {
                            hidden: { opacity: 0, x: -12 },
                            show: {
                              opacity: 1,
                              x: 0,
                              transition: { type: "spring", stiffness: 420, damping: 32 },
                            },
                          }
                    }
                  >
                    <Link
                      to={feature.to}
                      onClick={onClose}
                      className="block px-4 py-1 -mx-4 text-title font-light text-white"
                    >
                      {feature.label}
                    </Link>
                  </motion.div>
                ))}
              </motion.div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
