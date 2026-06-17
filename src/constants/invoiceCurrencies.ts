/**
 * Currencies supported by Zwitch payment links (payment token API).
 * Source: Zwitch API docs + multi-currency blog (zwitch.io).
 * If Zwitch adds more currencies, extend this list accordingly.
 */

export type InvoiceCurrencyCode = "INR" | "USD" | "EUR" | "GBP" | "AUD" | "JPY" | "AED";

export type InvoiceCurrencyOption = {
  code: InvoiceCurrencyCode;
  name: string;
  countryName: string;
  flag: string;
  symbol: string;
  provider: "zwitch";
};

export const INVOICE_CURRENCIES: InvoiceCurrencyOption[] = [
  {
    code: "INR",
    name: "Indian Rupee",
    countryName: "India",
    flag: "\u{1F1EE}\u{1F1F3}",
    symbol: "\u20B9",
    provider: "zwitch",
  },
  {
    code: "USD",
    name: "US Dollar",
    countryName: "United States",
    flag: "\u{1F1FA}\u{1F1F8}",
    symbol: "$",
    provider: "zwitch",
  },
  {
    code: "EUR",
    name: "Euro",
    countryName: "Euro area",
    flag: "\u{1F1EA}\u{1F1FA}",
    symbol: "\u20AC",
    provider: "zwitch",
  },
  {
    code: "GBP",
    name: "British Pound",
    countryName: "United Kingdom",
    flag: "\u{1F1EC}\u{1F1E7}",
    symbol: "\u00A3",
    provider: "zwitch",
  },
  {
    code: "AUD",
    name: "Australian Dollar",
    countryName: "Australia",
    flag: "\u{1F1E6}\u{1F1FA}",
    symbol: "A$",
    provider: "zwitch",
  },
  {
    code: "JPY",
    name: "Japanese Yen",
    countryName: "Japan",
    flag: "\u{1F1EF}\u{1F1F5}",
    symbol: "\u00A5",
    provider: "zwitch",
  },
  {
    code: "AED",
    name: "UAE Dirham",
    countryName: "United Arab Emirates",
    flag: "\u{1F1E6}\u{1F1EA}",
    symbol: "AED",
    provider: "zwitch",
  },
];

/** Lookup a currency by code */
function getCurrency(code: string): InvoiceCurrencyOption | undefined {
  return INVOICE_CURRENCIES.find((c) => c.code === code);
}

/** Get the symbol for a currency code, falling back to the code itself */
export function getCurrencySymbol(code: string): string {
  return getCurrency(code)?.symbol ?? code;
}
