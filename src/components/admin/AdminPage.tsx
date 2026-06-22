import { useEffect, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { isAdmin } from "../../services/auth";
import PageContainer from "../dashboard/PageContainer";
import { DashboardPageTitle } from "../dashboard/DashboardTitles";
import AdminApprovalsSection from "./AdminApprovalsSection";
import AdminAnalyticsSection from "./AdminAnalyticsSection";
import AdminDataSection from "./AdminDataSection";
import AdminSettingsSection from "./AdminSettingsSection";
import AdminWithdrawalsSection from "./AdminWithdrawalsSection";
import AdminUsersSection from "./AdminUsersSection";
import AdminTransactionsSection from "./AdminTransactionsSection";
import AdminPaymentLinksSection from "./AdminPaymentLinksSection";
import AdminInvoicesSection from "./AdminInvoicesSection";
import { PageHeaderSkeleton } from "../shared/skeletons/DashboardSkeletons";
import ListRowsSkeleton from "../shared/skeletons/ListRowsSkeleton";
import { ClipboardCheck, Database, Settings, Wallet, Users, ArrowLeftRight, Link2, FileText, BarChart3 } from "lucide-react";

type Tab = "approvals" | "analytics" | "withdrawals" | "users" | "transactions" | "paymentlinks" | "invoices" | "data" | "settings";

export default function AdminPage() {
  const { logout, isAuthenticated, isLoading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") as Tab | null;
  const [tab, setTab] = useState<Tab>(
    (["approvals","analytics","withdrawals","users","transactions","paymentlinks","invoices","data","settings"] as Tab[]).includes(initialTab as Tab)
      ? (initialTab as Tab)
      : "approvals"
  );
  const [adminOk, setAdminOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (!isAuthenticated || isLoading) return;
    isAdmin().then(setAdminOk);
  }, [isAuthenticated, isLoading]);

  if (isLoading || (isAuthenticated && adminOk === null)) {
    return (
      <div className="min-h-screen bg-[#141414] text-white px-4 py-10 pt-safe pb-safe max-w-4xl mx-auto space-y-6">
        <PageHeaderSkeleton />
        <ListRowsSkeleton rows={6} />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  if (!adminOk) {
    return (
      <PageContainer className="text-white pb-16">
        <div className="px-4 pt-14 max-w-md mx-auto space-y-6">
          <img src="/z-logo-nobg.png" alt="Zendt" className="h-14 w-14 object-contain" />
          <DashboardPageTitle>Admin access</DashboardPageTitle>
          <p className="text-body text-white/60 leading-relaxed">
            You&apos;re signed in, but this account doesn&apos;t have admin privileges yet.
          </p>
          <Link to="/admin/register?pending=1" className="inline-flex rounded-full bg-white text-black px-6 py-3 text-body font-medium">
            Enter registration key
          </Link>
          <div>
            <button type="button" onClick={() => logout().then(() => { window.location.href = "/login"; })} className="text-body text-white/55 hover:text-white underline-offset-2 hover:underline">
              Sign in with a different account
            </button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const tabs: { id: Tab; label: string; icon: typeof ClipboardCheck }[] = [
    { id: "approvals", label: "Approvals", icon: ClipboardCheck },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
    { id: "withdrawals", label: "Withdrawals", icon: Wallet },
    { id: "users", label: "Users", icon: Users },
    { id: "transactions", label: "Transactions", icon: ArrowLeftRight },
    { id: "paymentlinks", label: "Payment Links", icon: Link2 },
    { id: "invoices", label: "Invoices", icon: FileText },
    { id: "data", label: "Data", icon: Database },
    { id: "settings", label: "Settings", icon: Settings },
  ];

  return (
    <PageContainer className="text-white pb-16 min-h-screen max-w-none w-full">
      <header className="sticky top-0 z-20 bg-[#141414]/95 backdrop-blur border-b border-white/10 px-3 sm:px-4 pt-20 pt-safe pb-3">
        <div className="w-full flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/z-logo-nobg.png" alt="Zendt" className="h-6 w-6 object-contain shrink-0 md:h-14 md:w-14" />
            <DashboardPageTitle>Zendt Admin</DashboardPageTitle>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button type="button" onClick={() => logout().then(() => (window.location.href = "/login"))} className="text-caption text-white/55 hover:text-white px-2 py-1">
              Log out
            </button>
          </div>
        </div>
        <nav className="w-full flex gap-1 mt-4 overflow-x-auto pb-1">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTab(id);
                const next = new URLSearchParams(searchParams);
                next.set("tab", id);
                if (id !== "withdrawals") next.delete("id");
                setSearchParams(next, { replace: true });
              }}
              className={`flex items-center gap-2 shrink-0 rounded-full px-4 py-2 text-body transition ${
                tab === id ? "bg-white text-black" : "text-white/65 hover:bg-white/10"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="w-full px-3 sm:px-4 mt-6 space-y-6 xl:space-y-8">
        {tab === "approvals" && <AdminApprovalsSection />}
        {tab === "analytics" && <AdminAnalyticsSection />}
        {tab === "withdrawals" && <AdminWithdrawalsSection />}
        {tab === "users" && <AdminUsersSection />}
        {tab === "transactions" && <AdminTransactionsSection />}
        {tab === "paymentlinks" && <AdminPaymentLinksSection />}
        {tab === "invoices" && <AdminInvoicesSection />}
        {tab === "data" && <AdminDataSection />}
        {tab === "settings" && <AdminSettingsSection />}
      </main>
    </PageContainer>
  );
}
