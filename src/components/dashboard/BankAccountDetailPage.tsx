import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import BankAccountCard from "./BankAccountCard";
import BankDetailsCard from "./BankDetailsCard";
import BankAccountSkeleton from "./BankAccountSkeleton";
import { dataService } from "../../services/dataService";
import KycGate from "../shared/KycGate";
import { DashboardPageTitle } from "./DashboardTitles";
import { useBankAccounts } from "../../hooks/useBankAccounts";
import { invalidateBankAccounts } from "../../lib/dashboardQueries";

type BankAccount = {
  id: string;
  bankName: string;
  currency: string;
  accountNumber: string;
  accountNumberMasked: string;
  status: string;
  isDefault: boolean;
  flag: string;
  logo: string;
  ifsc?: string;
};

export default function BankAccountDetailPage() {
  const queryClient = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const { data: accounts = [], isPending: loading } = useBankAccounts();
  const account = useMemo(
    () => accounts.find((acc) => acc.id === id) ?? null,
    [accounts, id]
  ) as BankAccount | null;

  const handleStatusToggle = async () => {
    if (!account) return;
    if (account.status === "Not verified") return;
    const nextStatus = account.status === "Active" ? "Inactive" : "Active";
    try {
      await dataService.updateBankAccount({
        bank_id: account.id,
        bank_account_active: nextStatus === "Active",
      });
      await invalidateBankAccounts(queryClient);
    } catch (err) {
      console.error("Failed to update bank status:", err);
    }
  };

  const handleDefaultToggle = async () => {
    if (!account) return;
    if (account.status === "Not verified") return;
    try {
      await dataService.updateBankAccount({ bank_id: account.id, bank_account_default: true });
      await invalidateBankAccounts(queryClient);
    } catch (err) {
      console.error("Failed to update default bank:", err);
    }
  };

  return (
    <KycGate>
      <PageContainer className="text-white space-y-6">
        {/* Top Section */}
        <div className="flex items-center justify-between px-4 pt-12 pt-safe-header relative">
          <GradientBlob
            className="absolute opacity-60 blur-2xl -z-10"
            style={{
              right: "82px",
              top: "-50px",
              width: "321px",
              height: "262px",
              zIndex: "0",
            }}
          />

          {/* Back Button */}
          <div className="flex w-full z-10">
            <BackButton />
          </div>
        </div>

        {/* Main Content Block */}
        <div className="pt-6 relative rounded-t-3xl px-4 pb-24 pb-safe-nav bg-[#141414] z-10 flex-1">
          <header className="space-y-1 mb-6 pl-2">
            <DashboardPageTitle as="h2">Bank account details</DashboardPageTitle>
            <p className="text-body text-white/70">Account information and payout settings.</p>
          </header>

          {/* Bank Card at Top or Skeleton */}
          {loading || !account ? (
            <BankAccountSkeleton />
          ) : (
            <div className="mb-6 space-y-4">
              <div>
                <BankAccountCard
                  bankName={account.bankName}
                  currency={account.currency}
                  accountNumber={account.accountNumberMasked}
                  flag={account.flag}
                  logo={account.logo}
                />
              </div>

              {/* Action Buttons Below Card */}
              <div className="flex gap-3 px-1">
                <button
                  onClick={handleStatusToggle}
                  className={`flex-1 rounded-[14px] py-3 text-caption font-medium transition-colors ${
                    account.status === "Active"
                      ? "bg-[#1E1E1E] text-white/80"
                      : "bg-[#4A4A4A] text-white/40"
                  }`}
                >
                  {account.status}
                </button>
                <button
                  onClick={handleDefaultToggle}
                  className={`flex-1 rounded-[14px] py-3 text-caption font-medium transition-colors ${
                    account.isDefault ? "bg-[#1E1E1E] text-white/80" : "bg-[#4A4A4A] text-white/40"
                  }`}
                >
                  Default
                </button>
              </div>

              {/* Bank Details Below Buttons */}
              <BankDetailsCard account={account} />
            </div>
          )}
        </div>
      </PageContainer>
    </KycGate>
  );
}
