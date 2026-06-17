import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useKycStatus } from "../../hooks/useKycStatus";
import PageContainer from "../dashboard/PageContainer";
import BackButton from "../dashboard/BackButton";
import GradientBlob from "../icons/GradientBlob";

export default function KycGate({ children }: { children: ReactNode }) {
  const { loading, isFullyVerified, gateState } = useKycStatus();
  const navigate = useNavigate();

  // Show page content while KYC status loads; gate only once we know verification state.
  if (loading) {
    return <>{children}</>;
  }

  if (isFullyVerified) {
    return <>{children}</>;
  }

  const pending = gateState === "pending_review";

  return (
    <PageContainer className="text-white space-y-6">
      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
        <GradientBlob
          className="absolute opacity-60 blur-2xl -z-10"
          style={{ right: "82px", top: "-50px", width: "321px", height: "262px", zIndex: "0" }}
        />
        <div className="flex justify-between w-full z-1">
          <BackButton />
        </div>
      </div>

      <div className="pt-6 relative rounded-t-3xl px-4 pb-25 bg-[#141414] z-1 flex-1 flex flex-col items-center justify-center">
        <div className="text-center space-y-6 max-w-sm">
          <div className="mx-auto w-24 h-24 rounded-full bg-white/5 border border-white/10 flex items-center justify-center backdrop-blur-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="48"
              height="48"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/60"
            >
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
          </div>

          <div className="space-y-3">
            <h1 className="text-display font-light">
              {pending ? "Verification in progress" : "Complete your verification"}
            </h1>
            <p className="text-white/60 text-body leading-relaxed">
              {pending
                ? "Your documents are under review. You will be notified when your account is approved. Payment features stay limited until then."
                : "You need to complete verification (including freelancer proof) before you can access this feature."}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate("/dashboard/kyc")}
            className="rounded-[11px] bg-white/10 px-6 py-2.5 text-body text-white hover:bg-white/20 transition"
          >
            {pending ? "View verification status" : "Go to Verification"}
          </button>

          <GradientBlob
            className="absolute opacity-30 blur-3xl -z-10 pointer-events-none"
            style={{
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              width: "300px",
              height: "300px",
              zIndex: "-1",
            }}
          />
        </div>
      </div>
    </PageContainer>
  );
}
