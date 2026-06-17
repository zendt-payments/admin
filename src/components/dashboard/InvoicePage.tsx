import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invalidateInvoiceQueries,
  invalidatePaymentLinkQueries,
  DASH_QUERY_STALE,
  dqk,
} from "../../lib/dashboardQueries";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import Toast, { getToastAutoDismissMs } from "../Toast";
import CustomDropdown from "../CustomDropdown";
import ClientSearchPicker, {
  DASHBOARD_FIELD_FIXED_HEIGHT,
  DASHBOARD_INPUT_FIELD_10,
  DASHBOARD_TEXTAREA_FIELD_10,
  type ClientPickerRow,
} from "../shared/ClientSearchPicker";
import PhoneInput from "../shared/PhoneInput";
import InvoiceCurrencySelect from "../shared/InvoiceCurrencySelect";
import type { InvoiceCurrencyCode } from "../../constants/invoiceCurrencies";
import { dataService } from "../../services/dataService";
import KycGate from "../shared/KycGate";
import { DashboardPageTitle } from "./DashboardTitles";

interface ServiceItem {
  id: number;
  description: string;
  /** String so typing "2" stays "2", not coerced through number input quirks */
  rate: string;
  quantity: string;
}

function sanitizeDecimalInput(raw: string): string {
  let s = raw.replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot !== -1) {
    s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, "")}`;
  }
  const parts = s.split(".");
  let intPart = parts[0] ?? "";
  const frac = parts.length > 1 ? `.${parts[1]}` : "";
  // 02 → 2; 00.5 → 0.5; keep single 0
  if (intPart.length > 1) {
    intPart = intPart.replace(/^0+/, "") || "0";
  }
  return intPart + frac;
}

function parseAmount(s: string): number {
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

/** Avoid -0.00 and odd float display */
function formatMoney(n: number): string {
  const rounded = Math.round((n + Number.EPSILON) * 100) / 100;
  const x = Object.is(rounded, -0) ? 0 : rounded;
  return x.toFixed(2);
}

/** Local calendar date as YYYY-MM-DD (for date inputs). */
function toLocalDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function todayDateInputValue(): string {
  return toLocalDateInputValue(new Date());
}

function createEmptyService(): ServiceItem {
  return { id: Date.now(), description: "", rate: "", quantity: "1" };
}

export default function InvoicePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [currency, setCurrency] = useState<InvoiceCurrencyCode | "">("INR");
  const [generating, setGenerating] = useState(false);
  const [creationDate, setCreationDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const creationDateRef = useRef<HTMLInputElement>(null);
  const dueDateRef = useRef<HTMLInputElement>(null);

  const [services, setServices] = useState<ServiceItem[]>(() => [createEmptyService()]);
  const [notes, setNotes] = useState("");
  const [paymentMode, setPaymentMode] = useState<"payment_link" | "account_to_account">("payment_link");
  const [submitting, setSubmitting] = useState(false);

  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState({ message: "", sub: "" });

  const [billFromData, setBillFromData] = useState({ name: "", email: "", phone: "", address: "" });
  const [selectedBillFrom, setSelectedBillFrom] = useState<string>("personal");

  const [selectedClient, setSelectedClient] = useState<string>("");
  const [billToData, setBillToData] = useState({ name: "", email: "", phone: "", address: "" });

  const { data: billFromOptions } = useQuery({
    queryKey: dqk.invoiceBillFrom,
    queryFn: () => dataService.getInvoiceBillFrom(),
    staleTime: DASH_QUERY_STALE.profileSettings,
  });

  useEffect(() => {
    if (billFromOptions?.personal) {
      setBillFromData(billFromOptions.personal);
    }
  }, [billFromOptions]);

  const toast = (message: string, sub: string) => {
    setToastMsg({ message, sub });
    setShowToast(true);
    setTimeout(() => setShowToast(false), getToastAutoDismissMs({ message }));
  };

  const handleGenerateNumber = async () => {
    setGenerating(true);
    try {
      const res = await dataService.generateInvoiceNumber();
      setInvoiceNumber(res.invoice_number);
    } catch {
      toast("Error", "Failed to generate invoice number");
    } finally {
      setGenerating(false);
    }
  };

  const handleBillFromChange = (value: string) => {
    setSelectedBillFrom(value);
    if (billFromOptions) {
      const next = billFromOptions[value as keyof typeof billFromOptions];
      setBillFromData(
        (next as { name: string; email: string; phone: string; address: string }) || {
          name: "",
          email: "",
          phone: "",
          address: "",
        }
      );
    }
  };

  const handleClientChange = (value: string, client: ClientPickerRow | null) => {
    setSelectedClient(value);
    if (client) {
      setBillToData({
        name: client.name,
        email: client.email,
        phone: client.phone,
        address: client.address || "",
      });
    } else {
      setBillToData({ name: "", email: "", phone: "", address: "" });
    }
  };

  const handleServiceChange = (id: number, key: keyof ServiceItem, value: string) => {
    setServices((items) =>
      items.map((item) => {
        if (item.id !== id) return item;
        if (key === "description") return { ...item, description: value };
        if (key === "rate" || key === "quantity") {
          return { ...item, [key]: sanitizeDecimalInput(value) };
        }
        return item;
      })
    );
  };

  const addService = () => {
    setServices((items) => [...items, createEmptyService()]);
  };

  const removeService = (id: number) => {
    setServices((items) => items.filter((s) => s.id !== id));
  };

  const total = services.reduce(
    (sum, item) => sum + parseAmount(item.rate) * parseAmount(item.quantity),
    0
  );

  const minCreationDate = todayDateInputValue();

  const handleCreationDateChange = (value: string) => {
    if (value && value < minCreationDate) {
      toast("Validation Error", "Creation date cannot be in the past");
      return;
    }
    setCreationDate(value);
    if (dueDate && value && dueDate < value) {
      setDueDate(value);
    }
  };

  const handleDueDateChange = (value: string) => {
    const minDue = creationDate || minCreationDate;
    if (value && value < minDue) {
      toast("Validation Error", "Due date must be on or after the creation date");
      return;
    }
    setDueDate(value);
  };

  const validate = (): string | null => {
    if (!invoiceNumber) return "Generate an invoice number first";
    if (!currency) return "Currency is required";
    if (!creationDate) return "Creation date is required";
    if (creationDate < minCreationDate) return "Creation date cannot be in the past";
    if (dueDate && dueDate < creationDate) {
      return "Due date must be on or after the creation date";
    }
    if (!billFromData.name.trim()) return "Bill from name is required";
    if (!billFromData.email.trim()) return "Bill from email is required";
    if (!selectedClient && !billToData.name.trim()) return "Select a client or enter bill-to name";
    const phoneDigits = String(billToData.phone || "").replace(/\D/g, "");
    if (phoneDigits.length < 10) return "Client phone is required (10+ digits) for the payment link";
    if (services.length === 0) return "Add at least one service";
    for (const s of services) {
      if (!s.description.trim()) return "All service descriptions are required";
      if (parseAmount(s.rate) <= 0) return "All service rates must be greater than 0";
      if (parseAmount(s.quantity) <= 0) return "All service quantities must be greater than 0";
    }
    return null;
  };

  const handleCreate = async () => {
    const error = validate();
    if (error) {
      toast("Validation Error", error);
      return;
    }

    setSubmitting(true);
    try {
      const created = (await dataService.createInvoice({
        invoice_number: invoiceNumber,
        client_id: selectedClient || undefined,
        client_name: billToData.name,
        client_email: billToData.email,
        client_phone: billToData.phone,
        client_address: billToData.address,
        currency,
        services: services.map((s) => {
          const rate = parseAmount(s.rate);
          const qty = parseAmount(s.quantity);
          return {
            description: s.description,
            rate,
            quantity: qty,
            total: rate * qty,
          };
        }),
        total,
        payment_mode: paymentMode,
        bill_from_type: selectedBillFrom,
        bill_from: billFromData,
        creation_date: creationDate,
        due_date: dueDate || undefined,
        notes: notes || undefined,
      })) as {
        _id: string;
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
      if (created.invoice_number) setInvoiceNumber(created.invoice_number);
      await Promise.all([invalidatePaymentLinkQueries(queryClient), invalidateInvoiceQueries(queryClient)]);
      navigate("/dashboard/invoice/success", {
        state: {
          invoiceId: created._id,
          invoice_number: created.invoice_number,
          total: created.total,
          currency: created.currency,
          client_name: created.client_name,
          payment_mode: created.payment_mode,
          payment_link: created.payment_link,
          pdf_uploaded: created.pdf_uploaded,
          email_sent: created.email_sent,
          email_error: created.email_error,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to create invoice";
      toast("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KycGate>
      <PageContainer className="zendt-dashboard-clash text-white space-y-6">
        <Toast
          message={toastMsg.message}
          subMessage={toastMsg.sub}
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

        <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0 select-none">
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

        <div className="relative z-2 space-y-6 rounded-t-3xl bg-[#141414] p-6 pb-20 pb-safe-nav flex-1">
          <header className="space-y-1">
            <DashboardPageTitle className="!font-semibold">Create invoice</DashboardPageTitle>
          </header>

          <div className="space-y-6">
            {/* Invoice Number */}
            <div className="flex flex-col gap-2 text-caption text-white/70">
              <span>
                Invoice Number <span className="text-red-400 ml-1">*</span>
              </span>
              <div className="flex gap-2">
                <input
                  value={invoiceNumber}
                  readOnly
                  placeholder="Click Generate"
                  className={`${DASHBOARD_INPUT_FIELD_10} flex-1 opacity-80`}
                />
                <button
                  type="button"
                  onClick={handleGenerateNumber}
                  disabled={generating}
                  className="rounded-[10px] bg-white/10 border border-white/10 px-4 py-3 text-body text-white hover:bg-white/20 disabled:opacity-40 whitespace-nowrap min-h-[46px] box-border"
                >
                  {generating ? "..." : "Generate"}
                </button>
              </div>
            </div>

            {/* Currency — matches Section 5 VA lookup by invoice currency */}
            <div className="flex flex-col gap-2 text-caption text-white/70">
              <span>
                Currency <span className="text-red-400 ml-1">*</span>
              </span>
              <InvoiceCurrencySelect
                value={currency}
                onChange={(code) => setCurrency(code)}
                enabledCurrencies={["INR"]}
              />
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex min-w-0 flex-col gap-2 text-caption text-white/70">
                <span>
                  Creation date <span className="text-red-400 ml-1">*</span>
                </span>
                <input
                  ref={creationDateRef}
                  type="date"
                  value={creationDate}
                  min={minCreationDate}
                  onChange={(e) => handleCreationDateChange(e.target.value)}
                  onClick={() => creationDateRef.current?.showPicker?.()}
                  className={`${DASHBOARD_INPUT_FIELD_10} min-w-0 appearance-none cursor-pointer [color-scheme:dark]`}
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2 text-caption text-white/70">
                <span>Due date</span>
                <input
                  ref={dueDateRef}
                  type="date"
                  value={dueDate}
                  min={creationDate || minCreationDate}
                  onChange={(e) => handleDueDateChange(e.target.value)}
                  onClick={() => dueDateRef.current?.showPicker?.()}
                  className={`${DASHBOARD_INPUT_FIELD_10} min-w-0 appearance-none cursor-pointer [color-scheme:dark]`}
                />
              </div>
            </div>

            {/* Bills From */}
            <AddressBlock
              title="Bills from"
              required
              selectedOption={selectedBillFrom}
              onOptionChange={handleBillFromChange}
              options={[
                { value: "personal", label: "Personal" },
                { value: "brand", label: "Brand" },
              ]}
              data={billFromData}
              onDataChange={setBillFromData}
            />

            {/* Bills To */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-body uppercase tracking-tight text-white/70">
                  Bills to <span className="text-red-400 ml-1">*</span>
                </p>
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
                    <line x1="12" y1="5" x2="12" y2="19" />
                    <line x1="5" y1="12" x2="19" y2="12" />
                  </svg>
                  Add Client
                </button>
              </div>

              <ClientSearchPicker
                value={selectedClient}
                onChange={handleClientChange}
                placeholder="Select Client"
              />

              <div className="space-y-3">
                <input
                  placeholder="Name"
                  value={billToData.name}
                  onChange={(e) => setBillToData({ ...billToData, name: e.target.value })}
                  className={DASHBOARD_INPUT_FIELD_10}
                />
                <input
                  placeholder="Email"
                  value={billToData.email}
                  onChange={(e) => setBillToData({ ...billToData, email: e.target.value })}
                  className={DASHBOARD_INPUT_FIELD_10}
                />
                <PhoneInput
                  variant="surface-10"
                  fontSizePx={13}
                  value={billToData.phone}
                  onChange={(val) => setBillToData({ ...billToData, phone: val })}
                  placeholder="Phone number"
                  className="overflow-hidden rounded-[10px] border border-white/10 focus-within:border-white/20 min-h-[46px]"
                />
                <textarea
                  rows={3}
                  placeholder="Address"
                  value={billToData.address}
                  onChange={(e) => setBillToData({ ...billToData, address: e.target.value })}
                  className={DASHBOARD_TEXTAREA_FIELD_10}
                />
              </div>
            </div>

            {/* Services */}
            <div className="space-y-4">
              <p className="text-body uppercase tracking-tight text-white/70">
                Services <span className="text-red-400 ml-1">*</span>
              </p>

              <div className="space-y-4">
                {services.map((service, index) => (
                  <div key={service.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        className={`${DASHBOARD_INPUT_FIELD_10} flex-1 min-w-0`}
                        value={service.description}
                        onChange={(e) => handleServiceChange(service.id, "description", e.target.value)}
                        placeholder="Service description"
                      />
                      {services.length > 1 ? (
                        <ServiceIconButton
                          type="button"
                          onClick={() => removeService(service.id)}
                          title="Remove service"
                          variant="remove"
                        >
                          <TrashIcon />
                        </ServiceIconButton>
                      ) : (
                        <span className="h-[46px] w-[46px] shrink-0" aria-hidden />
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-nowrap">
                      <NumberBubble
                        className="flex-1 min-w-0"
                        value={service.rate}
                        onChange={(v) => handleServiceChange(service.id, "rate", v)}
                        placeholder="Rate"
                      />
                      <span className="shrink-0 text-body text-white/60">×</span>
                      <NumberBubble
                        className="flex-1 min-w-0"
                        value={service.quantity}
                        onChange={(v) => handleServiceChange(service.id, "quantity", v)}
                        placeholder="Qty"
                      />
                      <span className="shrink-0 text-body text-white/60">=</span>
                      <div
                        className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} flex-1 min-w-0 flex items-center tabular-nums truncate`}
                      >
                        {currency ? `${currency} ` : ""}
                        {formatMoney(parseAmount(service.rate) * parseAmount(service.quantity))}
                      </div>
                      {index === services.length - 1 ? (
                        <ServiceIconButton
                          type="button"
                          onClick={addService}
                          title="Add service"
                          variant="add"
                        >
                          <PlusIcon />
                        </ServiceIconButton>
                      ) : (
                        <span className="h-[46px] w-[46px] shrink-0" aria-hidden />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div
              className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} flex items-center justify-between`}
            >
              <span>Total Amount</span>
              <span className="tabular-nums">
                {currency ? `${currency} ${formatMoney(total)}` : formatMoney(total)}
              </span>
            </div>

            {/* Mode of payment */}
            <div className="flex flex-col gap-2">
              <p className="text-body uppercase tracking-tight text-white/70">Mode of payment</p>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setPaymentMode("payment_link")}
                  className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} flex items-center text-left transition-colors ${
                    paymentMode === "payment_link"
                      ? "border-white/25 text-white"
                      : "border-white/10 text-white/80 hover:border-white/20"
                  }`}
                >
                  Payment link
                </button>
                <div
                  className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} flex items-center truncate text-white/50 opacity-50 cursor-not-allowed`}
                  aria-disabled="true"
                  title="This feature is currently unavailable"
                >
                  Direct to account
                  <span className="text-white/40"> — unavailable</span>
                </div>
              </div>
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-2 text-caption text-white/70">
              <span>Notes</span>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes"
                className={DASHBOARD_TEXTAREA_FIELD_10}
              />
            </div>

            {/* Submit */}
            <div className="flex justify-end pb-12">
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting}
                className="rounded-[10px] border border-white/10 bg-white/10 px-6 py-3 text-body text-white min-h-[46px] w-42 hover:bg-white/20 disabled:opacity-40 box-border"
              >
                {submitting ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      </PageContainer>
    </KycGate>
  );
}

/* ── Shared sub-components ── */

interface AddressBlockProps {
  title: string;
  required?: boolean;
  selectedOption: string;
  onOptionChange: (value: string) => void;
  options: { value: string; label: string }[];
  data: { name: string; email: string; phone: string; address: string };
  onDataChange: (data: { name: string; email: string; phone: string; address: string }) => void;
}

function AddressBlock({
  title,
  required,
  selectedOption,
  onOptionChange,
  options,
  data,
  onDataChange,
}: AddressBlockProps) {
  return (
    <div className="space-y-3">
      <p className="text-body uppercase tracking-tight text-white/70">
        {title}
        {required && <span className="text-red-400 ml-1">*</span>}
      </p>

      <CustomDropdown
        value={selectedOption}
        onChange={onOptionChange}
        options={options}
        placeholder="Select an option"
      />

      <div className="space-y-3">
        <input
          placeholder="Name"
          value={data.name}
          onChange={(e) => onDataChange({ ...data, name: e.target.value })}
          className={DASHBOARD_INPUT_FIELD_10}
        />
        <input
          placeholder="Email"
          value={data.email}
          onChange={(e) => onDataChange({ ...data, email: e.target.value })}
          className={DASHBOARD_INPUT_FIELD_10}
        />
        <PhoneInput
          variant="surface-10"
          fontSizePx={13}
          value={data.phone}
          onChange={(val) => onDataChange({ ...data, phone: val })}
          placeholder="Phone number"
          className="overflow-hidden rounded-[10px] border border-white/10 focus-within:border-white/20 min-h-[46px]"
        />
        <textarea
          rows={3}
          placeholder="Address"
          value={data.address}
          onChange={(e) => onDataChange({ ...data, address: e.target.value })}
          className={DASHBOARD_TEXTAREA_FIELD_10}
        />
      </div>
    </div>
  );
}

const SERVICE_ICON_BTN =
  "shrink-0 flex h-[46px] w-[46px] items-center justify-center rounded-[10px] border border-white/10 transition-colors";

function ServiceIconButton({
  variant,
  title,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant: "add" | "remove";
}) {
  const variantClass =
    variant === "remove"
      ? "text-red-400/60 hover:text-red-400 hover:bg-red-500/10"
      : "text-white/70 hover:text-white hover:bg-white/10";
  return (
    <button type="button" title={title} className={`${SERVICE_ICON_BTN} ${variantClass}`} {...props}>
      {children}
    </button>
  );
}

function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

interface NumberBubbleProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

function NumberBubble({ value, onChange, placeholder, className = "" }: NumberBubbleProps) {
  return (
    <input
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${DASHBOARD_INPUT_FIELD_10} text-center ${className}`}
    />
  );
}
