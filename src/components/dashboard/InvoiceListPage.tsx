import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Share2, X } from "lucide-react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import { dataService } from "../../services/dataService";
import KycGate from "../shared/KycGate";
import { shareText } from "../../utils/shareText";
import { StaggeredList, StaggerItem, MotionSheet } from "../motion";
import { DashboardPageTitle, dashboardDialogTitleClass } from "./DashboardTitles";
import { useInfiniteListQuery } from "../../hooks/useInfiniteListQuery";
import { useScrollSentinel } from "../../hooks/useScrollSentinel";
import { activityRefetchInterval, dqk } from "../../lib/dashboardQueries";
import { useSocketConnected } from "../../context/SocketProvider";
import ListRowsSkeleton from "./ListRowsSkeleton";
import DashboardEmptyState from "./DashboardEmptyState";

interface Invoice {
  _id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  currency: string;
  total: number;
  status: string;
  payment_mode: string;
  payment_link?: string;
  invoice_pdf_url: string;
  createdAt: string;
}

const statusColors: Record<string, string> = {
  draft: "text-white/50",
  sent: "text-blue-400",
  paid: "text-emerald-400",
  cancelled: "text-red-400/70",
};

const invoiceIconBtn =
  "inline-flex items-center justify-center rounded-[10px] p-2 transition-colors disabled:opacity-40";

function ConfirmCancelModal({
  isOpen,
  onClose,
  onConfirm,
  cancelling,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  cancelling: boolean;
}) {
  return (
    <MotionSheet open={isOpen} onClose={onClose} variant="center" className="zendt-dashboard-cairo">
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <h3 className={dashboardDialogTitleClass}>Cancel invoice?</h3>
          <p className="text-white/60 text-body">
            Are you sure you want to cancel this invoice? This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={cancelling}
            className="rounded-[10px] border border-white/10 px-4 py-2 text-body text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
          >
            No, keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={cancelling}
            className="rounded-[10px] bg-red-500/20 border border-red-500/30 px-4 py-2 text-body text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {cancelling ? "Cancelling..." : "Yes, cancel it"}
          </button>
        </div>
      </div>
    </MotionSheet>
  );
}

export default function InvoiceListPage() {
  const socketConnected = useSocketConnected();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const scrollRef = useRef<HTMLDivElement>(null);

  const {
    items: rawInvoices,
    isPending,
    isSuccess,
    isFetchingNextPage,
    hasNextPage,
    loadMore,
  } = useInfiniteListQuery({
    queryKey: dqk.invoicesInfinite,
    queryFn: (cursor) => dataService.getInvoicesPage({ cursor }),
    refetchInterval: activityRefetchInterval(socketConnected),
  });

  const invoices = rawInvoices as unknown as Invoice[];
  const sentinelRef = useScrollSentinel(loadMore, Boolean(hasNextPage), scrollRef);
  const listLoading = isPending && invoices.length === 0;

  const [cancelTarget, setCancelTarget] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [sharingInvoiceId, setSharingInvoiceId] = useState<string | null>(null);

  const handleCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await dataService.cancelInvoice(cancelTarget);
      await queryClient.invalidateQueries({ queryKey: dqk.invoicesInfinite });
    } catch (err) {
      console.error("Failed to cancel invoice:", err);
    } finally {
      setCancelling(false);
      setCancelTarget(null);
    }
  };

  const handleDownloadPdf = async (id: string, invoiceNumber?: string) => {
    try {
      const meta = await dataService.getInvoicePdfMeta(id);
      if (meta.url) {
        window.open(meta.url, "_blank");
        return;
      }
      await dataService.downloadInvoicePdf(
        id,
        invoiceNumber ? `invoice-${invoiceNumber.replace(/[^a-zA-Z0-9-_]/g, "_")}.pdf` : undefined
      );
    } catch (err) {
      console.error("Failed to get PDF:", err);
    }
  };

  const shareInvoice = async (inv: Invoice) => {
    const client = (inv.client_name || "there").trim();
    const link = (inv.payment_link || "").trim();
    const amt = typeof inv.total === "number" ? inv.total.toLocaleString() : String(inv.total);
    let body = `Hi ${client},\n\nHere is invoice ${inv.invoice_number} for ${inv.currency} ${amt}.`;
    if (link && inv.status !== "cancelled") {
      body += `\n\nPay online: ${link}`;
    } else {
      body += `\n\nFull details are in the PDF.`;
    }

    setSharingInvoiceId(inv._id);
    try {
      await shareText(body);
    } finally {
      setSharingInvoiceId(null);
    }
  };

  return (
    <KycGate>
      <PageContainer className="zendt-dashboard-cairo flex h-screen min-h-screen flex-col overflow-hidden text-white space-y-4 pb-6">
        <div className="relative z-0 flex shrink-0 items-center justify-between px-4 pt-12 pt-safe-header">
          <GradientBlob
            className="absolute opacity-60 blur-2xl -z-10"
            style={{ right: "82px", top: "-50px", width: "321px", height: "262px" }}
          />
          <div className="z-1 flex w-full justify-between">
            <BackButton />
          </div>
        </div>

        <section className="relative z-10 flex min-h-0 flex-1 flex-col rounded-t-3xl bg-[#141414] p-5 pt-10">
          <div className="mb-4 flex shrink-0 items-center justify-between">
            <div>
              <DashboardPageTitle as="h2" className="!font-semibold">
                Invoices
              </DashboardPageTitle>
              <p className="text-body text-white/70">View and manage your invoices.</p>
            </div>
            <button
              type="button"
              onClick={() => navigate("/dashboard/invoice")}
              className="rounded-[10px] bg-white/10 px-3 py-1.5 text-caption transition hover:bg-white/20"
            >
              + Create
            </button>
          </div>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pr-1">
            {listLoading && <ListRowsSkeleton rows={4} />}

            {!listLoading && isSuccess && invoices.length === 0 && (
              <DashboardEmptyState
                title="No invoices found"
                subtitle="Invoices will appear here when you create them"
              />
            )}

            {!listLoading && invoices.length > 0 && (
              <StaggeredList className="space-y-3 pb-10">
                {invoices.map((inv) => {
                  const isCancelled = inv.status === "cancelled";
                  const isPaid = inv.status === "paid";

                  return (
                    <StaggerItem
                      key={inv._id}
                      className="rounded-[10px] border border-white/10 bg-[#1E1E1E] p-4 text-caption"
                    >
                      <div className="flex justify-between items-center gap-2">
                        <span className="truncate text-white/90 min-w-0">
                          <span className="text-white/50">Invoice ID:</span>{" "}
                          <span className="font-medium">{inv.invoice_number}</span>
                        </span>
                        <span className={`shrink-0 ${statusColors[inv.status] || "text-white/60"}`}>
                          {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                        </span>
                      </div>

                      <div className="mt-1 text-white/70">
                        {inv.client_name} &middot; {inv.currency} {inv.total.toLocaleString()}
                      </div>

                      <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-caption">
                            {new Date(inv.createdAt).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                          <span className="text-white/30 text-caption bg-white/5 px-1.5 py-0.5 rounded-[10px]">
                            {inv.payment_mode === "payment_link" ? "Payment Link" : "Account to Account"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 justify-end">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(inv._id, inv.invoice_number)}
                            className={`${invoiceIconBtn} text-blue-400/80 hover:bg-blue-500/10 hover:text-blue-300`}
                            aria-label="Download invoice PDF"
                            title="Download PDF"
                          >
                            <Download className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            disabled={sharingInvoiceId !== null}
                            onClick={() => void shareInvoice(inv)}
                            className={`${invoiceIconBtn} text-white/70 hover:bg-white/10 hover:text-white`}
                            aria-label="Share invoice"
                            title="Share"
                          >
                            {sharingInvoiceId === inv._id ? (
                              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
                            ) : (
                              <Share2 className="h-4 w-4" strokeWidth={2} />
                            )}
                          </button>
                          <button
                            type="button"
                            disabled={isCancelled || isPaid}
                            onClick={() => setCancelTarget(inv._id)}
                            className={`${invoiceIconBtn} text-red-400/80 hover:bg-red-500/10 hover:text-red-300`}
                            aria-label="Cancel invoice"
                            title={
                              isCancelled
                                ? "Already cancelled"
                                : isPaid
                                  ? "Paid invoices cannot be cancelled"
                                  : "Cancel"
                            }
                          >
                            <X className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </div>
                    </StaggerItem>
                  );
                })}
              </StaggeredList>
            )}

            <div ref={sentinelRef} className="h-1" aria-hidden />
            {isFetchingNextPage && (
              <p className="py-4 text-center text-caption text-white/40">Loading more…</p>
            )}
          </div>
        </section>

        <ConfirmCancelModal
          isOpen={cancelTarget !== null}
          onClose={() => setCancelTarget(null)}
          onConfirm={handleCancel}
          cancelling={cancelling}
        />
      </PageContainer>
    </KycGate>
  );
}
