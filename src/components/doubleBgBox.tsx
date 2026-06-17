import type { ReactNode } from "react";
import ExchangeRateCornerAccent from "./dashboard/ExchangeRateCornerAccent";

interface DoubleBgBoxProps {
  className?: string;
  backgroundImage?: string;
  flagImage?: string;
  flagEmoji?: string;
  /** Gray (or custom) top-right corner block — same wave cutout as exchange rate cards. */
  arcColor?: string;
  topLeft?: ReactNode;
  topRight?: ReactNode;
  bottomLeft?: ReactNode;
  bottomRight?: ReactNode;
  variant?: "wallet" | "others";
  /** Vertical distribution of child content (dashboard summary tiles use `between`). */
  layout?: "center" | "between";
  /** Grow with content instead of a fixed aspect ratio (dashboard payment tiles). */
  fitContent?: boolean;
  flagPosition?: "left" | "right";
  children?: ReactNode;
}

export default function DoubleBgBox({
  className,
  variant = "others",
  layout = "center",
  fitContent = false,
  backgroundImage,
  flagImage,
  flagEmoji,
  flagPosition = "right",
  arcColor,
  topLeft,
  topRight,
  bottomLeft,
  bottomRight,
  children,
}: DoubleBgBoxProps) {
  const useCornerAccent = Boolean(arcColor);
  const useWalletWave = variant === "wallet" && !useCornerAccent;
  const baseClasses = "relative overflow-hidden rounded-[20px] text-gray-100 ";
  const sizeClass = fitContent
    ? "w-full min-h-[120px]"
    : variant === "wallet"
      ? "w-full aspect-[130/135]"
      : "w-full aspect-[185/135]";
  const containerClass = [baseClasses, sizeClass, useCornerAccent ? "bg-[#161616]" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerClass}>
      {useCornerAccent ? (
        <ExchangeRateCornerAccent accentColor={arcColor} />
      ) : useWalletWave ? (
        <svg
          className="absolute inset-0 z-10 h-full w-[101%]"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 102 135"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0 121.681V13.3183C0 5.96282 5.96283 0 13.3183 0H56.0744C60.8326 0 65.2293 2.53846 67.6084 6.65917L74.2492 18.1614C76.6283 22.2821 81.025 24.8205 85.7832 24.8205H87.7799C95.1355 24.8205 101.098 30.7834 101.098 38.1389V121.681C101.098 129.037 95.1355 134.999 87.7799 134.999H13.3183C5.96282 134.999 0 129.037 0 121.681Z"
            fill="#161616"
          />
        </svg>
      ) : (
        <svg
          className="absolute inset-0 z-10 h-[102%] w-full"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 185 136"
          fill="none"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M185 114V44.8713C185 39.1693 180.378 34.5469 174.676 34.5469C171.88 34.5469 169.203 33.413 167.259 31.4044L142.744 6.08736C138.976 2.19652 133.792 0 128.376 0H20C8.95431 0 0 8.9543 0 20V114C0 125.046 8.9543 134 20 134H165C176.046 134 185 125.046 185 114Z"
            fill="#161616"
          />
        </svg>
      )}
      {flagEmoji ? (
        <span
          className={[
            "absolute leading-none",
            variant === "wallet"
              ? "pointer-events-none right-[-6px] top-[-10px] z-[25] text-[2rem] drop-shadow-[0_2px_8px_rgba(0,0,0,.5)] sm:text-[2.5rem]"
              : ["top-0 z-0 text-headline", flagPosition === "left" ? "left-1" : "right-1"].join(" "),
          ].join(" ")}
          aria-hidden
        >
          {flagEmoji}
        </span>
      ) : flagImage ? (
        <img
          src={flagImage}
          alt=""
          className={`absolute top-[-5px] z-0 h-11 w-14 object-cover ${
            flagPosition === "left" ? "-left-3 rounded-br-3xl" : "-right-3 rounded-bl-3xl"
          }`}
        />
      ) : null}

      {backgroundImage && (
        <img
          src={backgroundImage}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-10"
          aria-hidden="true"
        />
      )}

      <div
        className={[
          "relative z-[14] flex h-full w-full flex-col",
          children && useWalletWave && layout !== "between" ? "p-0" : "px-4 py-4",
          layout === "between" || useWalletWave || useCornerAccent ? "justify-between" : "justify-center",
        ].join(" ")}
      >
        {children ? (
          children
        ) : (
          <>
            {(topLeft || topRight) && (
              <div className="flex items-start justify-between text-caption uppercase tracking-[0.35em] text-white">
                <span>{topLeft}</span>
                <span className="ml-4">{topRight}</span>
              </div>
            )}

            {backgroundImage && (
              <div className="flex flex-1 items-center justify-center">
                <img src={backgroundImage} alt="" className="max-h-[60%] max-w-[60%] object-contain" />
              </div>
            )}

            {(bottomLeft || bottomRight) && (
              <div
                className={`flex flex-col gap-1 text-left text-white ${
                  useWalletWave ? "absolute bottom-4 left-4 w-[calc(100%-32px)]" : ""
                }`}
              >
                {bottomLeft && <div className="text-title font-semibold leading-tight">{bottomLeft}</div>}
                {bottomRight && (
                  <div className="text-caption uppercase tracking-[0.3em] text-gray-400">{bottomRight}</div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
