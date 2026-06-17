interface BankAccountCardProps {
  bankName: string;
  currency: string;
  accountNumber: string;
  flag: string;
  logo: string;
}

export default function BankAccountCard({
  bankName,
  currency,
  accountNumber,
  flag,
  logo,
}: BankAccountCardProps) {
  return (
    <div className="relative w-full aspect-[340/100] rounded-[24px] bg-[#1E1E1E] overflow-hidden border border-white/5">
      {/* Wavy Background (Flipped) */}
      <svg
        className="absolute inset-0 w-[50%] h-full z-10 scale-x-[-1]"
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 100 100"
        fill="none"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <path
          d="M0 121.681V13.3183C0 5.96282 5.96283 0 13.3183 0H56.0744C60.8326 0 65.2293 2.53846 67.6084 6.65917L74.2492 18.1614C76.6283 22.2821 81.025 24.8205 85.7832 24.8205H87.7799C95.1355 24.8205 101.098 30.7834 101.098 38.1389V121.681C101.098 129.037 95.1355 134.999 87.7799 134.999H13.3183C5.96282 134.999 0 129.037 0 121.681Z"
          fill="#1E1E1E"
        />
      </svg>

      {/* Flag on Top Left */}
      <img src={flag} alt="Flag" className="absolute top-[-5px] -left-3 h-11 w-20 object-cover z-0" />

      {/* Content */}
      <div className="relative z-20 flex items-center h-full px-6 gap-4">
        {/* Bank Logo */}
        <div className="h-10 w-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden p-2">
          <img src={logo} alt={bankName} className="h-full w-full object-contain" />
        </div>

        <div className="flex flex-col justify-center text-caption">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white/90">{bankName}</span>
            <span className="text-white/40">|</span>
            <span className="font-medium text-white/90">{currency}</span>
          </div>
          <div className="mt-1 text-white/70">Account number : {accountNumber}</div>
        </div>
      </div>
    </div>
  );
}
