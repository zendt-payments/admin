import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { dataService } from "../services/dataService";
import { DASH_QUERY_STALE, dqk } from "../lib/dashboardQueries";
import { deriveKycGateState, type FreelancerGateState, type KycStatusData } from "../lib/kycGate";

export type { FreelancerGateState, KycStatusData };

/** Shared KYC status query — dedupes across KycGate, KycPage, and login prefetch. */
export function useKycStatusQuery() {
  return useQuery({
    queryKey: dqk.kycStatus,
    queryFn: () => dataService.getKycStatus(),
    staleTime: DASH_QUERY_STALE.kycStatus,
  });
}

export function useKycStatus() {
  const { data, isPending, isFetching } = useKycStatusQuery();

  return useMemo(() => {
    const { isFullyVerified, gateState } = deriveKycGateState(data);
    const loading = isPending && data == null;
    return { loading, isFullyVerified, gateState, kycStatus: data, isFetching };
  }, [data, isPending, isFetching]);
}
