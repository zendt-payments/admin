import Select, { components } from "react-select";
import type { SingleValue, StylesConfig, OptionProps } from "react-select";
import PURPOSE_CODES from "../../constants/purposeCodes";

type CodeOption = { value: string; label: string; name: string };

const OPTIONS: CodeOption[] = PURPOSE_CODES.map((p) => ({
  value: p.code,
  label: p.code,
  name: p.name,
}));

function CustomOption(props: OptionProps<CodeOption, false>) {
  return (
    <components.Option {...props}>
      <div className="leading-tight">
        <div className="font-semibold text-body">{props.data.value}</div>
        <div className="text-caption opacity-60">{props.data.name}</div>
      </div>
    </components.Option>
  );
}

function CustomSingleValue(props: any) {
  return (
    <components.SingleValue {...props}>
      <div className="leading-tight">
        <span className="font-semibold text-body">{props.data.value}</span>
        <span className="text-caption opacity-60 ml-2">{props.data.name}</span>
      </div>
    </components.SingleValue>
  );
}

function darkStylesFor(borderRadius: number): StylesConfig<CodeOption, false> {
  return {
    control: (base, state) => ({
      ...base,
      backgroundColor: "#1E1E1E",
      borderColor: state.isFocused ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
      borderRadius,
      minHeight: 46,
      boxShadow: "none",
      "&:hover": { borderColor: "rgba(255,255,255,0.2)" },
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: "#1E1E1E",
      borderRadius,
      border: "1px solid rgba(255,255,255,0.1)",
      zIndex: 50,
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "rgba(255,255,255,0.1)" : "transparent",
      color: "white",
      cursor: "pointer",
      padding: "8px 12px",
    }),
    singleValue: (base) => ({ ...base, color: "white" }),
    input: (base) => ({ ...base, color: "white", fontSize: 14 }),
    placeholder: (base) => ({ ...base, color: "rgba(255,255,255,0.4)", fontSize: 14 }),
    indicatorSeparator: () => ({ display: "none" }),
    dropdownIndicator: (base) => ({ ...base, color: "rgba(255,255,255,0.4)" }),
  };
}

type PurposeCodeSelectProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  /** `surface` matches `.zendt-input-surface`; `surface-10` matches `.zendt-input-surface-10`. */
  variant?: "surface" | "surface-10";
};

export default function PurposeCodeSelect({
  value,
  onChange,
  disabled = false,
  variant = "surface",
}: PurposeCodeSelectProps) {
  const selected = OPTIONS.find((o) => o.value === value) || null;
  const borderRadius = variant === "surface-10" ? 10 : 11;

  return (
    <Select<CodeOption>
      options={OPTIONS}
      value={selected}
      onChange={(opt: SingleValue<CodeOption>) => onChange(opt?.value || "")}
      placeholder="Search and select purpose code"
      isSearchable
      isDisabled={disabled}
      styles={darkStylesFor(borderRadius)}
      components={{ Option: CustomOption, SingleValue: CustomSingleValue }}
      filterOption={(option, input) => {
        const q = input.toLowerCase();
        return option.data.value.toLowerCase().includes(q) || option.data.name.toLowerCase().includes(q);
      }}
      menuPlacement="auto"
    />
  );
}
