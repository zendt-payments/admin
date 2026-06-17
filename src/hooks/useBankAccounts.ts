import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { dataService } from "../services/dataService";
import { DASH_QUERY_STALE, dqk } from "../lib/dashboardQueries";
import { useAppResumeTick } from "./useAppResumeTick";

/** Shared bank account list — reused by list + detail routes. */
export function useBankAccounts() {
  const resumeTick = useAppResumeTick();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (resumeTick === 0) return;
    void queryClient.invalidateQueries({ queryKey: dqk.bankAccounts });
  }, [resumeTick, queryClient]);

  return useQuery({
    queryKey: dqk.bankAccounts,
    queryFn: () => dataService.getBankAccounts(),
    staleTime: DASH_QUERY_STALE.bankAccounts,
  });
}
