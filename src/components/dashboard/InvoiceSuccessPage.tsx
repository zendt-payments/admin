import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import BackButton from "./BackButton";
import PageContainer from "./PageContainer";
import GradientBlob from "../icons/GradientBlob";
import Toast, { getToastAutoDismissMs } from "../Toast";
import { dataService } from "../../services/dataService";
import { shareText } from "../../utils/shareText";
import { DashboardPageTitle } from "./DashboardTitles";

type SuccessLocationState = {
  invoiceId?: string;
  invoice_number?: string;
  total?: number;
  currency?: string;
  client_name?: string;
  payment_mode?: string;
  payment_link?: string;
  pdf_uploaded?: boolean;
  email_sent?: boolean;
  email_error?: string;
};

export default function InvoiceSuccessPage() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const s = (state || {}) as SuccessLocationState;

  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastSub, setToastSub] = useState("");
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);

  const showPageToast = (message: string, sub: string) => {
    setToastMessage(message);
    setToastSub(sub);
    setShowToast(true);
    setTimeout(() => setShowToast(false), getToastAutoDismissMs({ message }));
  };

  const handleDownload = async () => {
    if (!s.invoiceId) {
      showPageToast("Open invoice list", "Download PDF from the Invoices list.");
      navigate("/dashboard/invoices");
      return;
    }
    setDownloading(true);
    try {
      await dataService.downloadInvoicePdf(s.invoiceId);
      showPageToast("Download started", "Check your Downloads folder.");
    } catch (e) {
      showPageToast("Download failed", e instanceof Error ? e.message : "Try again from Invoices.");
    } finally {
      setDownloading(false);
    }
  };

  const handleShare = async () => {
    const num = s.invoice_number || "Invoice";
    const client = (s.client_name || "there").trim();
    const cur = s.currency || "INR";
    const amt = typeof s.total === "number" ? s.total.toLocaleString() : "";
    const link = (s.payment_link || "").trim();

    let body = `Hi ${client},\n\nHere is invoice ${num}${amt ? ` for ${cur} ${amt}` : ""}.`;
    if (link) {
      body += `\n\nPay online: ${link}`;
    } else {
      body += `\n\nFull details are in the PDF${s.email_sent ? " (also sent by email)" : ""}.`;
    }

    setSharing(true);
    try {
      const result = await shareText(body);
      if (!result.ok) {
        showPageToast("Couldn't share", "Copy the invoice details manually or try Download PDF.");
      } else if (result.used === "clipboard") {
        showPageToast(
          "Copied to clipboard",
          "This device opened the copy instead of the share sheet. Paste into any app."
        );
      }
    } finally {
      setSharing(false);
    }
  };

  return (
    <PageContainer className="text-white">
      <Toast
        message={toastMessage}
        subMessage={toastSub}
        visible={showToast}
        onDismiss={() => setShowToast(false)}
        icon={
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            fill="none"
            stroke="grey"
            strokeWidth="2"
          >
            <circle cx="9" cy="9" r="8" />
            <path d="m7 9 2 2 4-4" />
          </svg>
        }
      />

      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
        <GradientBlob
          className="absolute opacity-60 blur-2xl -z-10"
          style={{
            right: "82px",
            top: "-50px",
            width: "321px",
            height: "262px",
            zIndex: -1,
            pointerEvents: "none",
          }}
        />

        <div className="flex justify-between w-full z-1">
          <BackButton />
        </div>
      </div>

      <div className="pt-6 relative rounded-t-3xl bg-[#141414] z-1 flex-1 px-4">
        <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] space-y-6 text-center">
          <DashboardPageTitle className="text-center !font-semibold">
            Created Successfully!
          </DashboardPageTitle>

          {s.email_sent === false && s.email_error && (
            <p className="text-caption text-amber-400/90 max-w-sm px-2">
              Email was not sent: {s.email_error}. Configure AWS SES (
              <code className="text-white/60">FROM_EMAIL</code>, verified domain/recipient in sandbox) in
              the backend .env.
            </p>
          )}
          {s.email_sent === true && (
            <p className="text-caption text-emerald-400/90 max-w-sm">
              A payment email was sent to the client with the invoice PDF.
            </p>
          )}
          {s.pdf_uploaded === false && (
            <p className="text-caption text-white/50 max-w-sm">
              PDF was not stored in S3 (check <code className="text-white/60">S3_BUCKET_NAME</code> and AWS
              keys). You can still download the PDF below.
            </p>
          )}

          <div className="flex items-center justify-center gap-3 text-body text-white/60">
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownload}
              className="hover:text-white transition-colors disabled:opacity-50"
            >
              {downloading ? "Downloading…" : "Download PDF"}
            </button>
            <span>|</span>
            <button
              type="button"
              disabled={sharing}
              onClick={() => void handleShare()}
              className="hover:text-white transition-colors disabled:opacity-50"
            >
              {sharing ? "…" : "Share"}
            </button>
            <span>|</span>
            <button
              type="button"
              onClick={() => navigate("/dashboard/invoices")}
              className="hover:text-white transition-colors"
            >
              View all invoices
            </button>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
