import { useState, useEffect } from "react";
import PhoneInput from "../shared/PhoneInput";
import CountrySelect from "../shared/CountrySelect";
import IndianStateSelect from "../shared/IndianStateSelect";
import { indianStateLabel } from "../../lib/indianStates";
import OtpVerifyModal from "../shared/OtpVerifyModal";
import { DashboardSectionTitle } from "./DashboardTitles";

interface FieldConfig {
  key: string;
  label: string;
  type?: string;
  multiline?: boolean;
  verifiable?: boolean;
  verifyType?: string;
}

interface EditableDetailsCardProps {
  title: string;
  description?: string;
  fields: FieldConfig[];
  initialValues: Record<string, string>;
  verificationStatus?: Record<string, boolean>;
  /**
   * Return a rejected promise on failure. Parent should show a toast and typically rethrow.
   * When `stayEditingOnSaveError` is true, edit mode stays open and the form is left as-is.
   */
  onSave?: (values: Record<string, string>) => void | Promise<void>;
  onVerified?: () => void;
  stayEditingOnSaveError?: boolean;
}

export default function EditableDetailsCard({
  title,
  description,
  fields,
  initialValues,
  verificationStatus = {},
  onSave,
  onVerified,
  stayEditingOnSaveError = false,
}: EditableDetailsCardProps) {
  const [form, setForm] = useState(() => ({ ...initialValues }));
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [verifyField, setVerifyField] = useState<FieldConfig | null>(null);

  useEffect(() => {
    if (!isEditing) setForm({ ...initialValues });
  }, [initialValues, isEditing]);

  const handleChange = (key: string) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [key]: event.target.value });
  };

  const toggleEditing = () => {
    setIsEditing((prev) => {
      const next = !prev;
      if (next || prev) setForm({ ...initialValues });
      return next;
    });
  };

  const handleSave = async () => {
    if (!onSave) {
      setIsEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      setIsEditing(false);
    } catch {
      if (!stayEditingOnSaveError) {
        setForm({ ...initialValues });
        setIsEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const isPhoneField = (field: FieldConfig) =>
    field.type === "tel" || field.key === "phone" || field.label.toLowerCase().includes("mobile");

  const isCountryField = (field: FieldConfig) => field.type === "country" || field.key === "country";

  const isIndianStateField = (field: FieldConfig) =>
    field.type === "indian_state" || field.key === "state_code";

  const renderVerifyBadge = (field: FieldConfig) => {
    if (!field.verifiable) return null;
    const isVerified = verificationStatus[field.key];
    const hasValue = !!form[field.key]?.trim();

    if (isVerified) {
      return (
        <span className="shrink-0 flex items-center gap-1 text-caption text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded-full">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Verified
        </span>
      );
    }

    if (hasValue && !isEditing) {
      return (
        <button
          type="button"
          onClick={() => setVerifyField(field)}
          className="shrink-0 text-caption text-blue-400 bg-blue-400/10 px-2.5 py-0.5 rounded-full hover:bg-blue-400/20 transition-colors"
        >
          Verify
        </button>
      );
    }

    return null;
  };

  return (
    <>
      <section className="rounded-[24px] mb-4 bg-[#1E1E1E] text-white p-6 space-y-4">
        <header className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <DashboardSectionTitle className="text-white/80">{title}</DashboardSectionTitle>
            {description && <p className="text-caption text-white/60 mt-1">{description}</p>}
          </div>
          <button
            type="button"
            onClick={() => toggleEditing()}
            disabled={saving}
            className="shrink-0 text-white/60 hover:text-white text-body focus-visible:outline-none disabled:opacity-40"
          >
            {isEditing ? "Cancel" : "Edit"}
          </button>
        </header>

        <div className="space-y-4">
          {fields.map((field) => (
            <fieldset key={field.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <legend className="text-caption uppercase tracking-wide text-white/50">
                  {field.label}
                </legend>
                {renderVerifyBadge(field)}
              </div>
              {isCountryField(field) ? (
                isEditing ? (
                  <CountrySelect
                    value={form[field.key] ?? ""}
                    onChange={(val) => setForm({ ...form, [field.key]: val })}
                  />
                ) : (
                  <p className="text-body text-white/90 border-b border-white/10 pb-2 pl-0">
                    {form[field.key] || "—"}
                  </p>
                )
              ) : isIndianStateField(field) ? (
                isEditing ? (
                  <IndianStateSelect
                    value={form[field.key] ?? ""}
                    onChange={(code) => setForm({ ...form, [field.key]: code })}
                  />
                ) : (
                  <p className="text-body text-white/90 border-b border-white/10 pb-2 pl-0">
                    {indianStateLabel(form[field.key]) || "—"}
                  </p>
                )
              ) : isPhoneField(field) ? (
                isEditing ? (
                  <PhoneInput
                    value={form[field.key] ?? ""}
                    onChange={(val) => setForm({ ...form, [field.key]: val })}
                  />
                ) : (
                  <p className="text-body text-white/90 border-b border-white/10 pb-2 pl-0">
                    {form[field.key] || "—"}
                  </p>
                )
              ) : field.multiline ? (
                <textarea
                  value={form[field.key] ?? ""}
                  onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                  readOnly={!isEditing}
                  rows={isEditing ? 5 : undefined}
                  className="w-full min-h-[80px] bg-transparent py-3 pl-0 pr-2 text-body text-white/90 focus:outline-none border-b border-white/10 resize-y"
                />
              ) : (
                <input
                  type={field.type ?? "text"}
                  value={form[field.key] ?? ""}
                  onChange={handleChange(field.key)}
                  readOnly={!isEditing}
                  className="w-full bg-transparent py-3 pl-0 pr-2 text-body text-white/90 focus:outline-none border-b border-white/10"
                />
              )}
            </fieldset>
          ))}
        </div>

        {isEditing && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              className="rounded-[10px] bg-white/10 px-5 py-2 text-body text-white hover:bg-white/20 disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        )}
      </section>

      <OtpVerifyModal
        isOpen={verifyField !== null}
        onClose={() => setVerifyField(null)}
        onVerified={() => {
          setVerifyField(null);
          if (onVerified) onVerified();
        }}
        type={verifyField?.verifyType || ""}
        target={verifyField ? form[verifyField.key] || "" : ""}
      />
    </>
  );
}
