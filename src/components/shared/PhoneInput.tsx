import { PhoneInput as ReactPhoneInput } from "react-international-phone";
import "react-international-phone/style.css";

export type PhoneInputVariant = "underline" | "surface" | "surface-10";

/** Shared props/class for dashboard phone fields (payment link, KYC bank, clients, etc.). */
export const DASHBOARD_PHONE_INPUT_PROPS = {
  variant: "surface-10" as const,
  fontSizePx: 13,
  placeholder: "Phone number",
  className:
    "overflow-hidden rounded-[10px] border border-white/10 focus-within:border-white/20 min-h-[46px]",
};

type PhoneInputProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  /** `surface` matches `.zendt-input-surface`; `surface-10` matches `.zendt-input-surface-10`. */
  variant?: PhoneInputVariant;
  className?: string;
  /** Font size (px) for surface variants; defaults to 10. */
  fontSizePx?: number;
};

const SURFACE_CSS_VARS = {
  "--react-international-phone-background-color": "transparent",
  "--react-international-phone-text-color": "white",
  "--react-international-phone-border-color": "transparent",
  "--react-international-phone-country-selector-background-color": "transparent",
  "--react-international-phone-country-selector-background-color-hover": "rgba(255,255,255,0.06)",
  "--react-international-phone-dropdown-background-color": "#1a1a1a",
  "--react-international-phone-dropdown-item-background-color": "#1a1a1a",
  "--react-international-phone-dropdown-item-background-color-hover": "rgba(255,255,255,0.1)",
  "--react-international-phone-dropdown-item-text-color": "white",
  "--react-international-phone-dropdown-item-dial-code-color": "rgba(255,255,255,0.5)",
  "--react-international-phone-selected-dropdown-item-background-color": "rgba(255,255,255,0.08)",
} as React.CSSProperties;

export default function PhoneInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Enter phone number",
  variant = "underline",
  className = "",
  fontSizePx,
}: PhoneInputProps) {
  const isSurface = variant === "surface" || variant === "surface-10";
  const surfaceFontPx = fontSizePx ?? 10;

  const wrapperClass = [
    "relative w-full overflow-visible",
    variant === "underline" && "phone-input-dark border-b border-white/10 pb-1",
    variant === "surface" && "phone-input-surface",
    variant === "surface-10" && "phone-input-surface-10",
    // overflow-hidden clips the country dropdown; border radius still works on the field shell
    className.replace(/\boverflow-hidden\b/g, "").trim(),
  ]
    .filter(Boolean)
    .join(" ");

  const inputStyle: React.CSSProperties = isSurface
    ? {
        width: "100%",
        backgroundColor: "transparent",
        color: "white",
        border: "none",
        borderRadius: 0,
        minHeight: 0,
        padding: "12px 16px 12px 8px",
        fontSize: surfaceFontPx,
        outline: "none",
      }
    : {
        width: "100%",
        backgroundColor: "transparent",
        color: "white",
        border: "none",
        borderRadius: 0,
        minHeight: 48,
        padding: "12px 8px 12px 0",
        fontSize: 14,
        outline: "none",
      };

  const countryButtonStyle: React.CSSProperties = isSurface
    ? {
        backgroundColor: "transparent",
        border: "none",
        borderRadius: 0,
        minHeight: 0,
        padding: "12px 8px 12px 16px",
      }
    : {
        backgroundColor: "transparent",
        border: "none",
        borderRadius: 0,
        minHeight: 48,
        padding: "12px 8px 12px 0",
      };

  return (
    <div className={wrapperClass}>
      <ReactPhoneInput
        defaultCountry="in"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="w-full"
        inputStyle={inputStyle}
        countrySelectorStyleProps={{
          buttonStyle: countryButtonStyle,
          dropdownStyleProps: {
            style: { zIndex: 60 },
          },
        }}
        style={
          {
            ...SURFACE_CSS_VARS,
            "--react-international-phone-border-radius": isSurface ? "10px" : "0px",
            "--react-international-phone-height": isSurface ? "auto" : "48px",
            "--react-international-phone-font-size": isSurface ? `${surfaceFontPx}px` : "14px",
          } as React.CSSProperties
        }
      />
    </div>
  );
}
