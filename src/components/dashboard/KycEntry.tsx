import PageContainer from "./PageContainer";
import GradientBlob from "../icons/GradientBlob";
import KycPage from "./KycPage";
import { KycStepsSkeleton } from "../shared/skeletons/DashboardSkeletons";
import { useKycStatus } from "../../hooks/useKycStatus";

export default function KycEntry() {
  const { loading } = useKycStatus();

  if (loading) {
    return (
      <PageContainer className="text-white space-y-6">
        <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
          <GradientBlob
            className="absolute opacity-60 blur-2xl -z-10"
            style={{ right: "82px", top: "-50px", width: "321px", height: "262px", zIndex: "0" }}
          />
        </div>
        <div className="px-4 pb-10">
          <KycStepsSkeleton rows={3} />
        </div>
      </PageContainer>
    );
  }

  return <KycPage />;
}
