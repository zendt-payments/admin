import { useState } from "react";
import BackButton from "./BackButton";
import GradientBlob from "../icons/GradientBlob";
import ClientSearchPicker, {
  DASHBOARD_FIELD_FIXED_HEIGHT,
  DASHBOARD_INPUT_FIELD_10,
  DASHBOARD_TEXTAREA_FIELD_10,
  type ClientPickerRow,
} from "../shared/ClientSearchPicker";
import PageContainer from "./PageContainer";
import CountrySelect from "../shared/CountrySelect";
import PhoneInput from "../shared/PhoneInput";
import PurposeCodeSelect from "../shared/PurposeCodeSelect";
import Toast, { getToastAutoDismissMs } from "../Toast";
import { dataService } from "../../services/dataService";
import { MotionSheet } from "../motion";
import { DashboardPageTitle, dashboardDialogTitleClass } from "./DashboardTitles";

const FIELD_DISABLED = "disabled:opacity-40 disabled:cursor-not-allowed";

const emptyForm = {
  payerName: "",
  email: "",
  phone: "",
  country: "India",
  purposeCode: "",
  address: "",
  companyName: "",
  companyWebsite: "",
};

function ConfirmDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  deleting,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  deleting: boolean;
}) {
  return (
    <MotionSheet open={isOpen} onClose={onClose} variant="center" className="zendt-dashboard-cairo">
      <div className="p-6 space-y-5">
        <div className="space-y-2">
          <h3 className={dashboardDialogTitleClass}>Delete client?</h3>
          <p className="text-white/60 text-body">
            Are you sure you want to delete this client? This action cannot be undone.
          </p>
        </div>

        <div className="flex gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="rounded-[10px] border border-white/10 px-4 py-2 text-body text-white/70 hover:text-white hover:border-white/20 transition-colors disabled:opacity-50"
          >
            No, keep it
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="rounded-[10px] bg-red-500/20 border border-red-500/30 px-4 py-2 text-body text-red-400 hover:bg-red-500/30 transition-colors disabled:opacity-50"
          >
            {deleting ? "Deleting..." : "Yes, delete"}
          </button>
        </div>
      </div>
    </MotionSheet>
  );
}

export default function UpdateClientPage() {
  const [selectedId, setSelectedId] = useState("");
  const [type, setType] = useState<"individual" | "company">("individual");
  const [form, setForm] = useState(emptyForm);
  const [showToast, setShowToast] = useState(false);
  const [toastMsg, setToastMsg] = useState({ message: "", sub: "" });
  const [submitting, setSubmitting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isSelected = selectedId !== "";

  const toast = (message: string, sub: string) => {
    setToastMsg({ message, sub });
    setShowToast(true);
    setTimeout(() => setShowToast(false), getToastAutoDismissMs({ message }));
  };

  const handleClientSelect = (value: string, client: ClientPickerRow | null) => {
    setSelectedId(value);
    if (client) {
      setForm({
        payerName: client.name,
        email: client.email,
        phone: client.phone,
        country: client.country || "India",
        purposeCode: client.purpose_code || "",
        address: client.address || "",
        companyName: client.company || "",
        companyWebsite: client.company_website || "",
      });
      setType(client.company ? "company" : "individual");
    } else {
      setForm(emptyForm);
      setType("individual");
    }
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

  const handleUpdate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedId) return;
    const error = validate();
    if (error) {
      toast("Validation Error", error);
      return;
    }

    setSubmitting(true);
    try {
      await dataService.updateClient(selectedId, {
        name: form.payerName,
        email: form.email,
        phone: form.phone,
        country: form.country,
        purpose_code: form.purposeCode,
        address: form.address,
        company: form.companyName,
        company_website: form.companyWebsite,
      });
      toast("Updated", "Client updated successfully.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Update failed";
      toast("Error", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setDeleting(true);
    try {
      await dataService.deleteClient(selectedId);
      toast("Deleted", "Client removed successfully.");
      setSelectedId("");
      setForm(emptyForm);
      setType("individual");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Delete failed";
      toast("Error", msg);
    } finally {
      setDeleting(false);
      setShowDeleteModal(false);
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
          <DashboardPageTitle className="!font-semibold">Update Client</DashboardPageTitle>
          <p className="text-caption text-white/60">
            Select a client to edit their details or remove them.
          </p>
        </header>

        <form onSubmit={handleUpdate} className="space-y-6">
          <Field label="Select client">
            <ClientSearchPicker
              value={selectedId}
              onChange={handleClientSelect}
              placeholder="Select a client"
            />
          </Field>
          <div className="flex justify-center items-center">
            <div
              className={`flex border border-white/10 rounded-[10px] bg-[#1E1E1E] overflow-hidden w-full max-w-sm min-h-[46px] ${!isSelected ? "opacity-40 pointer-events-none" : ""}`}
            >
              {(["individual", "company"] as const).map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setType(option)}
                  disabled={!isSelected}
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
              disabled={!isSelected}
              className={`${DASHBOARD_INPUT_FIELD_10} ${FIELD_DISABLED}`}
            />
          </Field>

          <Field label="E-mail" required>
            <input
              type="email"
              value={form.email}
              onChange={handleChange("email")}
              placeholder="Enter email"
              disabled={!isSelected}
              className={`${DASHBOARD_INPUT_FIELD_10} ${FIELD_DISABLED}`}
            />
          </Field>

          <Field label="Phone number" required>
            <PhoneInput
              variant="surface-10"
              fontSizePx={13}
              value={form.phone}
              onChange={(val) => setForm({ ...form, phone: val })}
              disabled={!isSelected}
              placeholder="Phone number"
              className={`overflow-hidden rounded-[10px] border border-white/10 focus-within:border-white/20 min-h-[46px] ${!isSelected ? "opacity-40 pointer-events-none" : ""}`}
            />
          </Field>

          <Field label="Country" required>
            <CountrySelect
              variant="surface-10"
              value={form.country}
              onChange={(val) => setForm({ ...form, country: val })}
              disabled={!isSelected}
            />
          </Field>

          <Field label="Purpose code" required>
            <PurposeCodeSelect
              variant="surface-10"
              value={form.purposeCode}
              onChange={(val) => setForm({ ...form, purposeCode: val })}
              disabled={!isSelected}
            />
          </Field>

          <Field label="Payer address">
            <textarea
              value={form.address}
              onChange={handleChange("address")}
              rows={3}
              placeholder="Enter payer address"
              disabled={!isSelected}
              className={`${DASHBOARD_TEXTAREA_FIELD_10} ${FIELD_DISABLED}`}
            />
          </Field>

          {type === "company" && (
            <>
              <Field label="Company name" required>
                <input
                  value={form.companyName}
                  onChange={handleChange("companyName")}
                  placeholder="Enter company name"
                  disabled={!isSelected}
                  className={`${DASHBOARD_INPUT_FIELD_10} ${FIELD_DISABLED}`}
                />
              </Field>

              <Field label="Company website">
                <input
                  value={form.companyWebsite}
                  onChange={handleChange("companyWebsite")}
                  placeholder="Enter company website"
                  disabled={!isSelected}
                  className={`${DASHBOARD_INPUT_FIELD_10} ${FIELD_DISABLED}`}
                />
              </Field>
            </>
          )}

          <div className="flex justify-between gap-4 pb-20">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              disabled={!isSelected}
              className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} w-36 flex items-center justify-center hover:border-white/20 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              Delete
            </button>
            <button
              type="submit"
              disabled={!isSelected || submitting}
              className={`${DASHBOARD_INPUT_FIELD_10} ${DASHBOARD_FIELD_FIXED_HEIGHT} w-36 flex items-center justify-center hover:border-white/20 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed`}
            >
              {submitting ? "Updating..." : "Update"}
            </button>
          </div>
        </form>
      </div>

      <ConfirmDeleteModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        deleting={deleting}
      />
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
