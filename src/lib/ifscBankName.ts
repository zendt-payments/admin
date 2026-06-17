/** First four characters of IFSC → display name (not `${prefix} Bank`). */
const IFSC_PREFIX_BANK_NAMES: Record<string, string> = {
  SBIN: "State Bank of India",
  UTIB: "Axis Bank",
  HDFC: "HDFC Bank",
  ICIC: "ICICI Bank",
  KKBK: "Kotak Mahindra Bank",
  PUNB: "Punjab National Bank",
  BARB: "Bank of Baroda",
  IDIB: "Indian Bank",
  CNRB: "Canara Bank",
  UBIN: "Union Bank of India",
  IOBA: "Indian Overseas Bank",
  YESB: "Yes Bank",
  INDB: "IndusInd Bank",
  FDRL: "Federal Bank",
};

export function bankNameFromIfsc(ifsc: string): string {
  const prefix = (ifsc || "").toUpperCase().replace(/\s/g, "").slice(0, 4);
  if (!prefix) return "Bank account";
  return IFSC_PREFIX_BANK_NAMES[prefix] ?? "Bank account";
}

export type BankAccountStatus = "Active" | "Inactive" | "Not verified";

export function bankAccountStatus(
  verified: boolean,
  accountActive: boolean | undefined
): BankAccountStatus {
  if (!verified) return "Not verified";
  return accountActive !== false ? "Active" : "Inactive";
}
