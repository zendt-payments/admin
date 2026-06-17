import { useEffect, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Copy, Wallet } from "lucide-react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import Toast, { getToastAutoDismissMs } from "../Toast";
import { dataService } from "../../services/dataService";
import { shareText } from "../../utils/shareText";
import { buildReferralShareMessage } from "../../utils/referralShare";
import { StaggeredList, StaggerItem, MotionSheet } from "../motion";
import { DashboardPageTitle, dashboardDialogTitleClass } from "./DashboardTitles";
import { ReferralBodySkeleton } from "../shared/skeletons/DashboardSkeletons";
import { useAppResumeTick } from "../../hooks/useAppResumeTick";
import { DASHBOARD_INPUT_FIELD_10 } from "../shared/ClientSearchPicker";
import { DASH_QUERY_STALE, activityRefetchInterval, dqk } from "../../lib/dashboardQueries";
import { useSocketConnected } from "../../context/SocketProvider";
import type { CursorPagination } from "../../lib/pagination";

const UPI_REGEX = /^[a-zA-Z0-9._-]{2,256}@[a-zA-Z0-9._-]{2,64}$/;

const referralIconBtn =
  "inline-flex items-center justify-center rounded-[10px] p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white";

function isValidUpiId(value: string): boolean {
  const vpa = value.trim().toLowerCase();
  return vpa.length >= 5 && UPI_REGEX.test(vpa);
}

export default function ReferralPage() {
  const resumeTick = useAppResumeTick();
  const queryClient = useQueryClient();
  const socketConnected = useSocketConnected();
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState({ message: "", sub: "" });
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [upiId, setUpiId] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const query = useInfiniteQuery({
    queryKey: dqk.referralStats,
    queryFn: ({ pageParam }) => dataService.getReferralStats({ cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination?.hasMore ? (lastPage.pagination.nextCursor ?? undefined) : undefined,
    staleTime: DASH_QUERY_STALE.txsList,
    refetchInterval: activityRefetchInterval(socketConnected),
  });

  useEffect(() => {
    if (resumeTick > 0) {
      void queryClient.invalidateQueries({ queryKey: dqk.referralStats });
    }
  }, [resumeTick, queryClient]);

  const firstPage = query.data?.pages[0];
  const stats = firstPage ?? null;
  const referrals = query.data?.pages.flatMap((page) => page.referrals || []) ?? [];
  const pagination: CursorPagination | null = query.data?.pages.at(-1)?.pagination ?? null;
  const loading = query.isPending && !query.data;
  const loadingMore = query.isFetchingNextPage;

  const toast = (message: string, sub: string) => {
    setToastMsg({ message, sub });
    setShowToast(true);
    setTimeout(() => setShowToast(false), getToastAutoDismissMs({ message }));
  };

  useEffect(() => {
    if (query.isError) {
      toast("Error", "Failed to load referral data");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- toast once per failed fetch
  }, [query.isError, query.errorUpdatedAt]);

  const loadMore = () => {
    if (pagination?.hasMore && !loadingMore) {
      void query.fetchNextPage();
    }
  };

  const handleCopyCode = () => {
    if (!stats?.code) return;
    navigator.clipboard.writeText(stats.code);
    toast("Copied", "Referral code copied to clipboard");
  };

  const handleShare = async () => {
    if (!stats?.code) return;
    const text = buildReferralShareMessage(stats.code, stats.reward_per_referral);
    const result = await shareText(text, { title: "Zendt Referral", dialogTitle: "Share referral" });
    if (result.used === "clipboard") {
      toast("Copied", "Share message copied to clipboard");
    }
  };

  const availableEarnings = stats?.available_earnings ?? stats?.total_earnings ?? 0;
  const pendingWithdrawal = stats?.pending_withdrawal ?? null;

  const handleWithdrawClick = () => {
    if (pendingWithdrawal) {
      toast("Withdrawal in progress", "You already have a pending withdrawal request.");
      return;
    }
    if (availableEarnings <= 0) {
      toast("No earnings to withdraw", "Earn from referrals to build up a balance first.");
      return;
    }
    setWithdrawOpen(true);
  };

  const closeWithdrawModal = () => {
    if (submitting) return;
    setWithdrawOpen(false);
    setTermsAccepted(false);
  };

  const handleWithdrawSubmit = async () => {
    const trimmed = upiId.trim();
    if (!isValidUpiId(trimmed)) {
      toast("Invalid UPI ID", "Enter a valid UPI ID (e.g. name@bank)");
      return;
    }
    if (!termsAccepted) {
      toast("Confirmation required", "Please agree to the Referral Program Terms to continue.");
      return;
    }
    if (submitting) return;
    setSubmitting(true);
    try {
      await dataService.requestReferralWithdraw({ upi_id: trimmed.toLowerCase() });
      setWithdrawOpen(false);
      setUpiId("");
      setTermsAccepted(false);
      toast("Withdrawal requested", "Our team will pay you via UPI shortly");
      await queryClient.invalidateQueries({ queryKey: dqk.referralStats });
    } catch (e) {
      toast("Error", e instanceof Error ? e.message : "Failed to submit withdrawal");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageContainer className="text-white space-y-6">
      <Toast
        message={toastMsg.message}
        subMessage={toastMsg.sub}
        visible={showToast}
        onDismiss={() => setShowToast(false)}
      />

      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
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
        <div className="flex justify-between w-full z-1">
          <BackButton />
        </div>
      </div>

      <div className="pt-6 relative rounded-t-3xl px-4 pb-25 bg-[#141414] z-1 flex-1">
        {loading ? (
          <ReferralBodySkeleton />
        ) : (
          <div className="space-y-6">
            <div className="space-y-1 pt-4">
              <DashboardPageTitle as="h2">Refer & Earn</DashboardPageTitle>
              <p className="text-body text-white/70">
                Invite friends and earn ₹75 for each successful referral
              </p>
            </div>

            <div className="rounded-[28px] bg-[#1E1E1E] p-6 space-y-4">
              <p className="text-caption text-white/50 uppercase tracking-wider">Your Referral Code</p>
              <div className="flex items-center justify-between bg-[#141414] rounded-xl px-4 py-3">
                <span className="text-headline font-mono tracking-[0.2em]">{stats?.code || "—"}</span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className={referralIconBtn}
                  aria-label="Copy referral code"
                  title="Copy"
                >
                  <Copy className="h-4 w-4" strokeWidth={2} />
                </button>
              </div>
              <button
                type="button"
                onClick={handleShare}
                className="w-full rounded-xl bg-white/10 py-3 text-body text-white hover:bg-white/20 transition"
              >
                Share Invite
              </button>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-2xl bg-[#1E1E1E] p-4 text-center">
                <p className="text-headline font-light">{stats?.total_referrals || 0}</p>
                <p className="text-caption text-white/40 mt-1">Invited</p>
              </div>
              <div className="rounded-2xl bg-[#1E1E1E] p-4 text-center">
                <p className="text-headline font-light">{stats?.completed_referrals || 0}</p>
                <p className="text-caption text-white/40 mt-1">Completed</p>
              </div>
              <div className="rounded-2xl bg-[#1E1E1E] p-4 text-center">
                <p className="text-headline font-light text-emerald-400">
                  ₹{availableEarnings.toLocaleString("en-IN")}
                </p>
                <p className="text-caption text-white/40 mt-1">Available</p>
              </div>
            </div>

            <div className="rounded-[28px] bg-[#1E1E1E] p-5 space-y-4">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#141414]">
                  <Wallet className="h-5 w-5 text-white/70" strokeWidth={1.75} />
                </div>

                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-caption text-white/50 uppercase tracking-wider">Withdraw earnings</p>
                  <p className="text-body text-white/70">Payout via UPI</p>
                </div>

                <button
                  type="button"
                  onClick={handleWithdrawClick}
                  className="shrink-0 rounded-xl bg-white/10 px-4 py-2.5 text-caption font-medium text-white transition hover:bg-white/20"
                >
                  Withdraw
                </button>
              </div>

              {pendingWithdrawal ? (
                <div className="flex items-start gap-2.5 rounded-xl bg-[#141414] px-3.5 py-3">
                  <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-300/90" strokeWidth={2} />
                  <p className="text-caption leading-relaxed text-white/60">
                    ₹{pendingWithdrawal.amount.toLocaleString("en-IN")} pending · submitted{" "}
                    {new Date(pendingWithdrawal.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                    })}{" "}
                    · {pendingWithdrawal.upi_id}
                  </p>
                </div>
              ) : availableEarnings <= 0 ? (
                <p className="text-caption text-white/40 pl-16">Earn from referrals to withdraw.</p>
              ) : null}
            </div>

            {referrals.length > 0 && (
              <div className="rounded-[28px] bg-[#1E1E1E] p-5 space-y-3">
                <p className="text-caption text-white/50 uppercase tracking-wider">Your Referrals</p>
                <StaggeredList className="space-y-2">
                  {referrals.map((r, i) => (
                    <StaggerItem
                      key={`${r.email}-${r.date}-${i}`}
                      className="flex items-center justify-between py-2 border-b border-white/5 last:border-0"
                    >
                      <div>
                        <p className="text-body text-white">{r.name || r.email}</p>
                        <p className="text-caption text-white/40">
                          {new Date(r.date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <div className="text-right">
                        <span
                          className={`text-caption px-2 py-0.5 rounded-full ${
                            r.status === "rewarded"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "bg-yellow-500/10 text-yellow-400"
                          }`}
                        >
                          {r.status === "rewarded" ? "Completed" : "Pending"}
                        </span>
                        {r.status === "rewarded" && (
                          <p className="text-caption text-emerald-400 mt-1">+₹{r.reward}</p>
                        )}
                      </div>
                    </StaggerItem>
                  ))}
                </StaggeredList>
                {pagination?.hasMore && (
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full rounded-xl bg-white/5 py-2.5 text-caption text-white/70 hover:bg-white/10 disabled:opacity-50"
                  >
                    {loadingMore ? "Loading…" : "Load more"}
                  </button>
                )}
              </div>
            )}

            <div className="rounded-[28px] bg-[#1E1E1E] p-5 space-y-4">
              <p className="text-caption text-white/50 uppercase tracking-wider">How it works</p>
              <div className="space-y-3">
                {[
                  { step: "1", text: "Share your referral code with friends" },
                  { step: "2", text: "They sign up on Zendt and enter your code" },
                  { step: "3", text: "Once they complete their first payment, you earn ₹75" },
                  { step: "4", text: "Withdraw your earnings to your UPI ID anytime" },
                ].map((item) => (
                  <div key={item.step} className="flex items-start gap-3">
                    <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center shrink-0 text-caption">
                      {item.step}
                    </div>
                    <p className="text-body text-white/70 pt-0.5">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <MotionSheet
        open={withdrawOpen}
        onClose={closeWithdrawModal}
        variant="center"
        backdropClassName="bg-black/60 backdrop-blur-[1px]"
      >
        <div className="p-6 space-y-5">
          <div className="space-y-2">
            <h3 className={dashboardDialogTitleClass}>Withdraw referral earnings</h3>
            <p className="text-body text-white/60">
              Enter your UPI ID. We will pay the full available balance of{" "}
              <span className="text-emerald-400">₹{availableEarnings.toLocaleString("en-IN")}</span> to this
              account.
            </p>
          </div>

          <label className="flex flex-col gap-2 text-caption text-white/70">
            <span>
              UPI ID <span className="text-red-500">*</span>
            </span>
            <input
              value={upiId}
              onChange={(e) => setUpiId(e.target.value)}
              placeholder="yourname@bank"
              autoComplete="off"
              className={DASHBOARD_INPUT_FIELD_10}
            />
          </label>

          <div className="flex items-start gap-3">
            <input
              id="referral-terms-acceptance"
              type="checkbox"
              checked={termsAccepted}
              onChange={(event) => setTermsAccepted(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 rounded border-white/30 bg-transparent accent-emerald-500"
            />
            <label
              htmlFor="referral-terms-acceptance"
              className="text-caption text-white/70 leading-relaxed"
            >
              I agree to the{" "}
              <a
                href="https://www.zendtpayments.com/referral-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-400 hover:text-white/80 transition-colors"
              >
                Referral Program Terms
              </a>
            </label>
          </div>

          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={closeWithdrawModal}
              disabled={submitting}
              className="rounded-[10px] border border-white/10 px-4 py-2 text-body text-white/70 hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleWithdrawSubmit()}
              disabled={submitting || !upiId.trim()}
              className="rounded-[10px] bg-white px-4 py-2 text-body font-medium text-black disabled:opacity-50"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        </div>
      </MotionSheet>
    </PageContainer>
  );
}
