import { useState } from "react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import PageContainer from "./PageContainer";
import CountrySelect from "../shared/CountrySelect";
import PhoneInput from "../shared/PhoneInput";
import PurposeCodeSelect from "../shared/PurposeCodeSelect";
import { DASHBOARD_INPUT_FIELD_10, DASHBOARD_TEXTAREA_FIELD_10 } from "../shared/ClientSearchPicker";
import { dataService } from "../../services/dataService";
import Toast, { getToastAutoDismissMs } from "../Toast";
import { DashboardPageTitle } from "./DashboardTitles";

const EMPTY_FORM = {
  payerName: "",
  email: "",
  phone: "",
  country: "India",
  purposeCode: "",
  address: "",
  companyName: "",
  companyWebsite: "",
};

export default function AddClientPage() {
  const [type, setType] = useState<"individual" | "company">("individual");
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState({ message: "", sub: "" });

  const toast = (message: string, sub: string) => {
    setToastMsg({ message, sub });
    setShowToast(true);
    setTimeout(() => setShowToast(false), getToastAutoDismissMs({ message }));
  };

  const handleChange =
    (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm({ ...form, [key]: event.target.value });
    };

  const validate = (): string | null => {
    if (!form.payerName.trim()) return "Payer name is required";
    if (!form.email.trim()) return "Email is required";
    if (!form.phone.trim() || form.phone.length < 5) return "Phone number is required";
    if (!form.country) return "Country is required";
    if (!form.purposeCode) return "Purpose code is required";
    if (type === "company" && !form.companyName.trim()) return "Company name is required";
    return null;
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const error = validate();
    if (error) {
      toast("Validation Error", error);
      return;
    }

    try {
      await dataService.addClient({
        name: form.payerName,
        email: form.email,
        phone: form.phone,
        country: form.country,
        purpose_code: form.purposeCode,
        address: form.address,
        company: form.companyName,
        company_website: form.companyWebsite,
      });
      setForm({ ...EMPTY_FORM });
      setType("individual");
      toast("Successfully created", "Client has been saved. You can add another below.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to add client";
      toast("Error", msg);
    }
  };

  return (
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

      <div className="flex items-center justify-between px-4 pt-12 pt-safe-header z-0">
        <GradientBlob
          className="absolute opacity-60 blur-2xl -z-10"
          style={{ right: "82px", top: "-50px", width: "321px", height: "262px", zIndex: "0" }}
        />
        <div className="flex justify-between w-full z-1">
          <BackButton />
        </div>
      </div>

      <div className="bg-[#141414] p-6 shadow-[0_25px_45px_rgba(4,4,7,0.55)] space-y-6 rounded-t-3xl relative z-2">
        <header className="space-y-1">
          <DashboardPageTitle className="!font-semibold">Add Client</DashboardPageTitle>
          <p className="text-caption text-white/60">
            Save a client for faster invoice and payment link creation.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex justify-center items-center">
            <div className="flex border border-white/10 rounded-[10px] bg-[#1E1E1E] overflow-hidden w-full max-w-sm min-h-[46px]">
              {(["individual", "company"] as const).map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setType(option)}
                  className={[
                    "flex-1 min-h-[46px] text-body transition flex items-center justify-center",
                    type === option ? "bg-white/10 text-white" : "text-white/60",
                  ].join(" ")}
                >
                  {option === "individual" ? "Individual" : "Company"}
                </button>
              ))}
            </div>
          </div>

          <Field label="Payer name" required>
            <input
              value={form.payerName}
              onChange={handleChange("payerName")}
              placeholder="Enter payer name"
              className={DASHBOARD_INPUT_FIELD_10}
            />
          </Field>

          <Field label="E-mail" required>
            <input
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              placeholder="Enter email"
              className={DASHBOARD_INPUT_FIELD_10}
            />
          </Field>

          <Field label="Phone number" required>
            <PhoneInput
              variant="surface-10"
              fontSizePx={13}
              value={form.phone}
              onChange={(val) => setForm({ ...form, phone: val })}
              placeholder="Phone number"
              className="overflow-hidden rounded-[10px] border border-white/10 focus-within:border-white/20 min-h-[46px]"
            />
          </Field>

          <Field label="Country" required>
            <CountrySelect
              variant="surface-10"
              value={form.country}
              onChange={(val) => setForm({ ...form, country: val })}
            />
          </Field>

          <Field label="Purpose code" required>
            <PurposeCodeSelect
              variant="surface-10"
              value={form.purposeCode}
              onChange={(val) => setForm({ ...form, purposeCode: val })}
            />
          </Field>

          <Field label="Payer address">
            <textarea
              value={form.address}
              onChange={handleChange("address")}
              rows={3}
              placeholder="Enter payer address"
              className={DASHBOARD_TEXTAREA_FIELD_10}
            />
          </Field>

          {type === "company" && (
            <>
              <Field label="Company name" required>
                <input
                  value={form.companyName}
                  onChange={handleChange("companyName")}
                  placeholder="Enter company name"
                  className={DASHBOARD_INPUT_FIELD_10}
                />
              </Field>

              <Field label="Company website">
                <input
                  value={form.companyWebsite}
                  onChange={handleChange("companyWebsite")}
                  placeholder="Enter company website"
                  className={DASHBOARD_INPUT_FIELD_10}
                />
              </Field>
            </>
          )}

          <div className="flex justify-end pb-20">
            <button
              type="submit"
              className="rounded-[10px] border border-white/10 bg-white/10 px-6 py-3 text-body text-white min-h-[46px] w-42 hover:bg-white/20 disabled:opacity-40 box-border"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </PageContainer>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2 text-body text-white/70">
      <span>
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </span>
      {children}
    </label>
  );
}
