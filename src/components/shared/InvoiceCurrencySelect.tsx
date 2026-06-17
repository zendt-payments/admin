import Select from "react-select";
import type { SingleValue, StylesConfig } from "react-select";
import { INVOICE_CURRENCIES, type InvoiceCurrencyCode } from "../../constants/invoiceCurrencies";

type Option = { value: InvoiceCurrencyCode; label: string; flag: string; countryName: string };

const OPTIONS: Option[] = INVOICE_CURRENCIES.map((c) => ({
  value: c.code,
  label: `${c.flag} ${c.countryName}`,
  flag: c.flag,
  countryName: c.countryName,
}));

const darkStyles: StylesConfig<Option, false> = {
  control: (base, state) => ({
    ...base,
    backgroundColor: "#1E1E1E",
    borderColor: state.isFocused ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.1)",
    borderRadius: 10,
    minHeight: 46,
    boxShadow: "none",
    "&:hover": { borderColor: "rgba(255,255,255,0.2)" },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "#1E1E1E",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.1)",
    zIndex: 50,
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused && !state.isDisabled ? "rgba(255,255,255,0.1)" : "transparent",
    color: state.isDisabled ? "rgba(255,255,255,0.35)" : "white",
    cursor: state.isDisabled ? "not-allowed" : "pointer",
    fontSize: 13,
  }),
  singleValue: (base) => ({ ...base, color: "white", fontSize: 13 }),
  input: (base) => ({ ...base, color: "white", fontSize: 13 }),
  placeholder: (base) => ({ ...base, color: "rgba(255,255,255,0.4)", fontSize: 13 }),
  indicatorSeparator: () => ({ display: "none" }),
  dropdownIndicator: (base) => ({ ...base, color: "rgba(255,255,255,0.4)" }),
};

type Props = {
  value: InvoiceCurrencyCode | "";
  onChange: (code: InvoiceCurrencyCode) => void;
  disabled?: boolean;
  /** When set, only these codes are selectable; others appear disabled in the list. */
  enabledCurrencies?: InvoiceCurrencyCode[];
  availableCurrencies?: InvoiceCurrencyCode[];
};

export default function InvoiceCurrencySelect({
  value,
  onChange,
  disabled = false,
  enabledCurrencies,
  availableCurrencies,
}: Props) {
  const filteredOptions = availableCurrencies
    ? OPTIONS.filter((o) => availableCurrencies.includes(o.value))
    : OPTIONS;
  const selected = filteredOptions.find((o) => o.value === value) || null;

  return (
    <Select<Option>
      options={filteredOptions}
      value={selected}
      onChange={(opt: SingleValue<Option>) => {
        if (opt) onChange(opt.value);
      }}
      placeholder="Select currency"
      isSearchable
      isDisabled={disabled}
      isOptionDisabled={
        enabledCurrencies ? (option) => !enabledCurrencies.includes(option.value) : undefined
      }
      styles={darkStyles}
      menuPlacement="auto"
      formatOptionLabel={(opt) => (
        <div className="flex items-center gap-2">
          <span className="text-title leading-none" aria-hidden>
            {opt.flag}
          </span>
          <div className="flex flex-col leading-tight">
            <span className="text-body text-white">{opt.countryName}</span>
            <span className="text-caption text-white/50">{opt.value}</span>
          </div>
        </div>
      )}
      filterOption={(option, input) => {
        const q = input.toLowerCase();
        return (
          option.data.value.toLowerCase().includes(q) || option.data.countryName.toLowerCase().includes(q)
        );
      }}
    />
  );
}
