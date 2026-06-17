import Select from "react-select";
import type { SingleValue, StylesConfig } from "react-select";
import { INDIAN_STATE_OPTIONS, indianStateLabel, type IndianStateOption } from "../../lib/indianStates";

/** Matches `.zendt-input-surface` horizontal padding (px-4). */
const INPUT_PAD_X = 12;

const darkStyles: StylesConfig<IndianStateOption, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: "#1E1E1E",
    borderColor: state.isFocused ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
    borderRadius: 11,
    minHeight: 46,
    boxShadow: "none",
    "&:hover": { borderColor: "rgba(255,255,255,0.2)" },
  }),
  valueContainer: (base) => ({
    ...base,
    paddingLeft: INPUT_PAD_X,
    paddingRight: 8,
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#1E1E1E",
    borderRadius: 11,
    border: "1px solid rgba(255,255,255,0.1)",
    zIndex: 50,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? "rgba(255,255,255,0.1)" : "transparent",
    color: "white",
    cursor: "pointer",
    fontSize: 14,
    padding: `10px ${INPUT_PAD_X}px`,
  }),
  singleValue: (base) => ({ ...base, color: "white", fontSize: 14 }),
  input: (base) => ({ ...base, color: "white", fontSize: 14 }),
  placeholder: (base) => ({ ...base, color: "rgba(255,255,255,0.4)", fontSize: 14 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "rgba(255,255,255,0.4)" }),
};

type Props = {
  /** 2-letter state code stored in profile (e.g. KA). */
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
};

export default function IndianStateSelect({ value, onChange, disabled = false }: Props) {
  const normalized = value.trim().toUpperCase();
  const selected =
    INDIAN_STATE_OPTIONS.find((o) => o.value === normalized) ||
    (normalized
      ? ({ value: normalized, label: indianStateLabel(normalized) } satisfies IndianStateOption)
      : null);

  return (
    <Select<IndianStateOption>
      options={INDIAN_STATE_OPTIONS}
      value={selected}
      onChange={(opt: SingleValue<IndianStateOption>) => onChange((opt?.value || "").trim().toUpperCase())}
      placeholder="Search and select state"
      isSearchable
      isClearable
      isDisabled={disabled}
      styles={darkStyles}
      menuPlacement="auto"
    />
  );
}
