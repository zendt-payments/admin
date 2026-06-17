import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Share2 } from "lucide-react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import ClientSearchPicker, {
  DASHBOARD_INPUT_FIELD_10,
  DASHBOARD_TEXTAREA_FIELD_10,
  type ClientPickerRow,
} from "../shared/ClientSearchPicker";
import PageContainer from "./PageContainer";
import PhoneInput, { DASHBOARD_PHONE_INPUT_PROPS } from "../shared/PhoneInput";
import { useAppToast } from "../../context/ToastContext";
import { dataService } from "../../services/dataService";
import { INVOICE_CURRENCIES } from "../../constants/invoiceCurrencies";
import { shareText } from "../../utils/shareText";
import KycGate from "../shared/KycGate";
import { DashboardPageTitle } from "./DashboardTitles";
import { invalidatePaymentLinkQueries } from "../../lib/dashboardQueries";

/** Local calendar date as YYYY-MM-DD for date inputs. */
function toLocalDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayDateInputValue(): string {
  return toLocalDateInputValue(new Date());
}

const paymentLinkIconBtn =
  "inline-flex items-center justify-center rounded-[10px] p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white";

function LabeledInput({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-caption text-white/70">
      <span>
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      {children}
    </label>
  );
}

export default function PaymentLinkCreatePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess, showToast } = useAppToast();

  const currencyOptions = INVOICE_CURRENCIES;

  const [amountCurrency, setAmountCurrency] = useState<string>("INR");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [customer, setCustomer] = useState({ name: "", email: "", phone: "" });
  const [selectedClient, setSelectedClient] = useState("");
  const [expiry, setExpiry] = useState("");
  const [notes, setNotes] = useState("");
  const [linkCreated, setLinkCreated] = useState(false);
  const [shareableLink, setShareableLink] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feeAccepted, setFeeAccepted] = useState(false);
  const [firstLinkCreated, setFirstLinkCreated] = useState(false);

  const existingLinksQuery = useQuery({
    queryKey: ["paymentLinks", "firstCreateCheck"] as const,
    queryFn: () => dataService.getPaymentLinksPage({ limit: 1 }),
    staleTime: 60_000,
  });

  const hasExistingLinks = existingLinksQuery.isSuccess && existingLinksQuery.data.items.length > 0;

  /** Shown only until the user creates their first payment link (ever or in this session). */
  const isFirstPaymentLink = !firstLinkCreated && !hasExistingLinks && !existingLinksQuery.isError;

  const fileRef = useRef<File | null>(null);
  const expiryRef = useRef<HTMLInputElement>(null);
  const [invoiceName, setInvoiceName] = useState("");

  const [currencyOpen, setCurrencyOpen] = useState(false);
  const currencyRef = useRef<HTMLDivElement>(null);

  const handleClientSelect = (value: string, client: ClientPickerRow | null) => {
    setSelectedClient(value);
    if (client) {
      setCustomer({ name: client.name, email: client.email, phone: client.phone });
    } else {
      setCustomer({ name: "", email: "", phone: "" });
    }
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (currencyRef.current && !currencyRef.current.contains(event.target as Node)) {
        setCurrencyOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCurrency = currencyOptions.find((c) => c.code === amountCurrency);
  const minExpiryDate = todayDateInputValue();

  const handleExpiryChange = (value: string) => {
    if (value && value < minExpiryDate) {
      showError("Validation Error", "Link expiry cannot be in the past");
      return;
    }
    setExpiry(value);
  };

  const validate = (): string | null => {
    const numericAmount = Number(amount.replace(/[^0-9.]/g, ""));
    if (!amountCurrency) return "Select a currency";
    if (!numericAmount || numericAmount <= 0) return "Enter a valid amount greater than 0";
    if (!description.trim()) return "Payment description is required";
    if (!customer.name.trim()) return "Customer name is required";
    if (!customer.email.trim()) return "Customer email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email.trim())) return "Enter a valid customer email";
    if (!customer.phone.trim()) return "Customer phone number is required";
    if (!expiry) return "Link expiry date is required";
    if (expiry < minExpiryDate) return "Link expiry cannot be in the past";
    if (!fileRef.current) return "Invoice attachment is required";
    if (isFirstPaymentLink && !feeAccepted) {
      return "Please accept the platform fee and settlement terms to continue.";
    }
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;

    const error = validate();
    if (error) {
      showError("Validation Error", error);
      return;
    }

    setSubmitting(true);

    try {
      let invoiceUrl = "";
      if (fileRef.current) {
        const uploaded = await dataService.uploadFile(fileRef.current);
        invoiceUrl = uploaded.url;
      }

      const numericAmount = Number(amount.replace(/[^0-9.]/g, ""));
      const result = (await dataService.createPaymentLink({
        amount: numericAmount,
        currency: amountCurrency,
        customer_name: customer.name,
        customer_email: customer.email,
        customer_phone: customer.phone,
        description,
        notes,
        invoice_attachment: invoiceUrl,
        expiry,
      })) as Record<string, unknown>;

      const payUrl = String(
        (result as { payment_url?: string; short_url?: string }).payment_url ||
          (result as { short_url?: string }).short_url ||
          ""
      );
      if (!payUrl) {
        showToast({
          message: "Partial success",
          subMessage: "Link saved but no checkout URL was returned. Check Zwitch PG config.",
          tone: "warning",
        });
        setShareableLink("");
      } else {
        setShareableLink(payUrl);
      }
      await invalidatePaymentLinkQueries(queryClient);
      setFirstLinkCreated(true);
      setFeeAccepted(false);
      setLinkCreated(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      showError("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(shareableLink);
    showSuccess("Link copied!", "Payment link is now in your clipboard.");
  };

  const handleShare = async () => {
    const numericAmount = Number(amount.replace(/[^0-9.]/g, ""));
    const name = customer.name.trim() || "there";
    let msg = `Hi ${name},\n\n`;
    if (description.trim()) msg += `${description.trim()}\n`;
    msg += `Amount: ${amountCurrency} ${Number.isFinite(numericAmount) ? numericAmount.toLocaleString() : amount}\n\n`;
    msg += `Pay here: ${shareableLink}`;
    const result = await shareText(msg);
    if (result.used === "clipboard") {
      showSuccess("Copied to clipboard", "Paste into any app, or use Copy for the link only.");
    }
  };

  return (
    <KycGate>
      <PageContainer className="zendt-dashboard-clash text-white space-y-6">
        {/* HEADER */}
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

        {/* CONTENT */}
        <div className="bg-[#141414] p-6 space-y-6 rounded-t-3xl relative z-2 pb-20">
          {!linkCreated ? (
            <DashboardPageTitle className="!font-semibold">Create payment link</DashboardPageTitle>
          ) : null}

          {linkCreated ? (
            <section className="space-y-4">
              <DashboardPageTitle as="h2" className="!font-semibold">
                Link created successfully
              </DashboardPageTitle>
              <p className="text-white/70 text-body font-light">
                Share this URL with your customer to collect the payment.
              </p>

              {shareableLink ? (
                <div className="rounded-[10px] border border-white/20 bg-[#1E1E1E] px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                  <span className="truncate text-white/90 min-w-0 flex-1">{shareableLink}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={paymentLinkIconBtn}
                      aria-label="Copy payment link"
                      title="Copy"
                    >
                      <Copy className="h-4 w-4" strokeWidth={2} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleShare()}
                      className={paymentLinkIconBtn}
                      aria-label="Share payment link"
                      title="Share"
                    >
                      <Share2 className="h-4 w-4" strokeWidth={2} />
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-body text-amber-200/90">
                  No payment URL in response — your token may still be valid in the dashboard; contact
                  support if this persists.
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setLinkCreated(false);
                  setShareableLink("");
                  setAmount("");
                  setAmountCurrency("INR");
                  setDescription("");
                  setCustomer({ name: "", email: "", phone: "" });
                  setSelectedClient("");
                  setExpiry("");
                  setNotes("");
                  fileRef.current = null;
                  setInvoiceName("");
                }}
                className="rounded-full border border-white/20 px-4 py-2 text-body text-white/80 hover:text-white"
              >
                Create another link
              </button>
            </section>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6 rounded-t-[36px]">
              <LabeledInput label="Amount" required>
                <div className="flex items-center gap-3">
                  <div ref={currencyRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setCurrencyOpen(!currencyOpen)}
                      className={`${DASHBOARD_INPUT_FIELD_10} w-auto shrink-0 whitespace-nowrap flex items-center gap-2 cursor-pointer hover:border-white/20`}
                    >
                      <span className="text-callout leading-none">{selectedCurrency?.flag}</span>
                      <span>{amountCurrency}</span>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="10"
                        height="10"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        className={`transition-transform duration-200 ${currencyOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M2 4l3 3 3-3" />
                      </svg>
                    </button>

                    {currencyOpen && (
                      <div className="absolute z-50 mt-2 rounded-[10px] bg-[#1E1E1E] border border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.4)] overflow-hidden min-w-[160px]">
                        <div className="max-h-60 overflow-y-auto">
                          {currencyOptions.map((c) => {
                            const disabled = c.code !== "INR";
                            return (
                              <button
                                key={c.code}
                                type="button"
                                disabled={disabled}
                                onClick={() => {
                                  if (disabled) return;
                                  setAmountCurrency(c.code);
                                  setCurrencyOpen(false);
                                }}
                                title={disabled ? "Only INR is currently supported" : undefined}
                                className={`w-full px-4 py-3 text-body text-left flex items-center gap-2 transition-colors ${
                                  disabled
                                    ? "cursor-not-allowed text-white/30"
                                    : c.code === amountCurrency
                                      ? "bg-white/10 text-white"
                                      : "text-white/70 hover:bg-white/5 hover:text-white"
                                }`}
                              >
                                <span className="text-callout leading-none">{c.flag}</span>
                                <span>{c.code}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                  <input
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="Enter amount"
                    className={`${DASHBOARD_INPUT_FIELD_10} flex-1`}
                  />
                </div>
              </LabeledInput>

              <LabeledInput label="Payment for" required>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  placeholder="e.g. Website design"
                  className={DASHBOARD_TEXTAREA_FIELD_10}
                />
              </LabeledInput>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-caption uppercase tracking-[0.35em] text-white/60">
                    Customer details
                  </h2>
                  <button
                    type="button"
                    onClick={() => navigate("/dashboard/add-client")}
                    className="text-caption text-white/60 hover:text-white transition-colors flex items-center gap-1"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    Add Client
                  </button>
                </div>

                <ClientSearchPicker
                  value={selectedClient}
                  onChange={handleClientSelect}
                  placeholder="Choose a client"
                />

                <LabeledInput label="Name" required>
                  <input
                    value={customer.name}
                    onChange={(event) => setCustomer({ ...customer, name: event.target.value })}
                    placeholder="Name"
                    className={DASHBOARD_INPUT_FIELD_10}
                  />
                </LabeledInput>

                <LabeledInput label="Email" required>
                  <input
                    value={customer.email}
                    onChange={(event) => setCustomer({ ...customer, email: event.target.value })}
                    placeholder="Email"
                    className={DASHBOARD_INPUT_FIELD_10}
                  />
                </LabeledInput>

                <LabeledInput label="Phone" required>
                  <PhoneInput
                    {...DASHBOARD_PHONE_INPUT_PROPS}
                    value={customer.phone}
                    onChange={(val) => setCustomer({ ...customer, phone: val })}
                  />
                </LabeledInput>
              </section>

              <LabeledInput label="Link expiry" required>
                <input
                  ref={expiryRef}
                  type="date"
                  value={expiry}
                  min={minExpiryDate}
                  onChange={(event) => handleExpiryChange(event.target.value)}
                  onClick={() => expiryRef.current?.showPicker?.()}
                  className={`${DASHBOARD_INPUT_FIELD_10} cursor-pointer [color-scheme:dark]`}
                />
              </LabeledInput>

              <LabeledInput label="Notes">
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Any additional notes for your client"
                  className={DASHBOARD_TEXTAREA_FIELD_10}
                />
              </LabeledInput>

              <section className="space-y-2">
                <p className="text-caption uppercase tracking-[0.35em] text-white/60">
                  Attach invoice<span className="text-red-500 ml-0.5">*</span>
                </p>

                <label className="flex flex-col items-center justify-center rounded-[10px] border border-dashed border-white/20 bg-[#141414]/20 px-4 py-6 text-body text-white/60 cursor-pointer">
                  <input
                    type="file"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) {
                        fileRef.current = file;
                        setInvoiceName(file.name);
                      }
                    }}
                  />

                  {invoiceName ? (
                    <span>{invoiceName}</span>
                  ) : (
                    <>
                      <span>Upload invoice +</span>
                      <span className="text-caption">jpg/jpeg/png/HEIC/HEIF/PDF/Docs/doc</span>
                    </>
                  )}
                </label>
              </section>

              {isFirstPaymentLink && (
                <div className="flex items-start gap-3">
                  <input
                    id="payment-fee-acceptance"
                    type="checkbox"
                    checked={feeAccepted}
                    onChange={(event) => setFeeAccepted(event.target.checked)}
                    className="mt-0.5 size-4 shrink-0 rounded border-white/30 bg-transparent accent-emerald-500"
                  />
                  <label
                    htmlFor="payment-fee-acceptance"
                    className="text-caption text-white/70 leading-relaxed"
                  >
                    Zendt charges a 4% platform fee plus the live FX rate on all international payments.
                    There are no hidden charges. Funds settle to your registered bank account automatically.
                  </label>
                </div>
              )}

              <div className="flex justify-end pb-12">
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded-[10px] border border-white/10 bg-white/10 px-6 py-3 text-body text-white min-h-[46px] w-42 hover:bg-white/20 disabled:opacity-40 box-border"
                >
                  {submitting ? "Creating..." : "Create"}
                </button>
              </div>
            </form>
          )}
        </div>
      </PageContainer>
    </KycGate>
  );
}
