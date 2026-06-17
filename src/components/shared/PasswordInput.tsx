import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

export type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  /** Override eye button colors (e.g. dark icon on light auth fields). */
  toggleClassName?: string;
};

const DEFAULT_TOGGLE_CLASS = "text-white/40 transition-colors hover:text-white/75";

/** Password field with show/hide toggle (eye icon). */
export default function PasswordInput({
  className = "",
  disabled,
  toggleClassName,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative w-full">
      <input
        {...props}
        disabled={disabled}
        type={visible ? "text" : "password"}
        className={[className, "pr-10"].filter(Boolean).join(" ")}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        className={[
          "absolute right-1 top-1/2 z-[1] flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg disabled:pointer-events-none disabled:opacity-40",
          toggleClassName ?? DEFAULT_TOGGLE_CLASS,
        ]
          .filter(Boolean)
          .join(" ")}
        onClick={() => setVisible((v) => !v)}
      >
        {visible ? (
          <EyeOff className="size-[18px]" aria-hidden />
        ) : (
          <Eye className="size-[18px]" aria-hidden />
        )}
      </button>
    </div>
  );
}
