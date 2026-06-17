type AcceptanceCheckboxProps = {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

/** Custom checkbox — native inputs hide ticks in Android/iOS WebViews on dark backgrounds. */
export default function AcceptanceCheckbox({
  id,
  checked,
  onChange,
  disabled = false,
}: AcceptanceCheckboxProps) {
  return (
    <button
      type="button"
      id={id}
      role="checkbox"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "mt-0.5 size-5 shrink-0 rounded border flex items-center justify-center transition-colors touch-manipulation",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        checked ? "border-emerald-400 bg-emerald-400" : "border-white/50 bg-white/10",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      {checked ? (
        <svg viewBox="0 0 12 10" className="size-3 text-[#141414]" aria-hidden fill="none">
          <path
            d="M1 5.2 4.2 8.4 11 1.6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ) : null}
    </button>
  );
}
