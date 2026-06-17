import CopyButton from "./CopyButton";

type BankAccount = {
  id: string;
  bankName: string;
  currency: string;
  /** Full account number for copy (when stored on server). */
  accountNumber: string;
  /** Masked display, e.g. ****4321 */
  accountNumberMasked: string;
  status: string;
  isDefault: boolean;
  flag: string;
  logo: string;
  ifsc?: string;
};

type BankField = {
  label: string;
  displayValue: string;
  copyValue: string;
};

type BankDetailsCardProps = {
  account: BankAccount;
};

export default function BankDetailsCard({ account }: BankDetailsCardProps) {
  const bankFields: BankField[] = [
    { label: "Bank Name", displayValue: account.bankName, copyValue: account.bankName },
    { label: "Currency", displayValue: account.currency, copyValue: account.currency },
    {
      label: "Account Number",
      displayValue: account.accountNumberMasked,
      copyValue: account.accountNumber,
    },
    ...(account.ifsc ? [{ label: "IFSC", displayValue: account.ifsc, copyValue: account.ifsc }] : []),
    { label: "Status", displayValue: account.status, copyValue: account.status },
    {
      label: "Default",
      displayValue: account.isDefault ? "Yes" : "No",
      copyValue: account.isDefault ? "Yes" : "No",
    },
  ];

  return (
    <section className="space-y-4 rounded-[10px] border border-white/10 bg-[#1E1E1E] p-4 text-caption text-white">
      <h3 className="font-medium text-white/90">Account Details</h3>
      <div className="space-y-4">
        {bankFields.map((field) => (
          <div key={field.label} className="space-y-1">
            <p className="text-caption text-white/50">{field.label}</p>
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-white/70">{field.displayValue}</span>
              <CopyButton value={field.copyValue} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
