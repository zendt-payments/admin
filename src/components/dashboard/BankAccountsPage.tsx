import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import KycGate from "../shared/KycGate";
import BankAccountCard from "./BankAccountCard";
import BankAccountSkeleton from "./BankAccountSkeleton";
import { dataService } from "../../services/dataService";
import { StaggeredList, StaggerItem } from "../motion";
import { DashboardPageTitle } from "./DashboardTitles";
import { useBankAccounts } from "../../hooks/useBankAccounts";
import { invalidateBankAccounts } from "../../lib/dashboardQueries";

export default function BankAccountsPage() {
  const queryClient = useQueryClient();
  const { data: accounts = [], isPending: loading } = useBankAccounts();
  const navigate = useNavigate();

  const handleStatusToggle = async (id: string) => {
    const target = accounts.find((a) => a.id === id);
    if (!target || target.status === "Not verified") return;

    const nextStatus = target.status === "Active" ? "Inactive" : "Active";
    try {
      await dataService.updateBankAccount({
        bank_id: id,
        bank_account_active: nextStatus === "Active",
      });
      await invalidateBankAccounts(queryClient);
    } catch (err) {
      console.error("Failed to update bank status:", err);
    }
  };

  const handleDefaultToggle = async (id: string) => {
    const target = accounts.find((a) => a.id === id);
    if (!target || target.status === "Not verified") return;

    try {
      await dataService.updateBankAccount({ bank_id: id, bank_account_default: true });
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
        <div className="pt-6 relative rounded-t-3xl px-4 pb-24 bg-[#141414] z-10 flex-1">
          <header className="space-y-1 mb-8 pl-2">
            <DashboardPageTitle as="h2">Bank details</DashboardPageTitle>
            <p className="text-body text-white/70">View and manage your linked bank accounts.</p>
          </header>

          {/* Bank Cards List or Skeleton */}
          {loading ? (
            <BankAccountSkeleton />
          ) : (
            <StaggeredList className="space-y-8">
              {accounts.map((account) => (
                <StaggerItem key={account.id} className="space-y-3">
                  <button
                    onClick={() => navigate(`/dashboard/bank-account/${encodeURIComponent(account.id)}`)}
                    className="w-full text-left transition-transform active:scale-95"
                  >
                    <BankAccountCard
                      bankName={account.bankName}
                      currency={account.currency}
                      accountNumber={account.accountNumberMasked}
                      flag={account.flag}
                      logo={account.logo}
                    />
                  </button>

                  {/* Action Buttons */}
                  <div className="flex gap-3 px-1">
                    <button
                      onClick={() => handleStatusToggle(account.id)}
                      className={`flex-1 rounded-[14px] py-3 text-caption font-medium transition-colors ${
                        account.status === "Active"
                          ? "bg-[#1E1E1E] text-white/80"
                          : "bg-[#4A4A4A] text-white/40"
                      }`}
                    >
                      {account.status}
                    </button>
                    <button
                      onClick={() => handleDefaultToggle(account.id)}
                      className={`flex-1 rounded-[14px] py-3 text-caption font-medium transition-colors ${
                        account.isDefault ? "bg-[#1E1E1E] text-white/80" : "bg-[#4A4A4A] text-white/40"
                      }`}
                    >
                      Default
                    </button>
                  </div>
                </StaggerItem>
              ))}
            </StaggeredList>
          )}
        </div>
      </PageContainer>
    </KycGate>
  );
}
