/** Shared top-right flag / accent + wave cutout (exchange rate card reference). */
export const FX_CARD_WIDTH_PX = 130;
export const FX_CARD_HEIGHT_PX = 175;

const WAVE_VIEW_BOX = "0 0 102 125";
const WAVE_PATH =
  "M0 121.681V13.3183C0 5.96282 5.96283 0 13.3183 0H56.0744C60.8326 0 65.2293 2.53846 67.6084 6.65917L74.2492 18.1614C76.6283 22.2821 81.025 24.8205 85.7832 24.8205H87.7799C95.1355 24.8205 101.098 30.7834 101.098 38.1389V121.681C101.098 129.037 95.1355 134.999 87.7799 134.999H13.3183C5.96282 134.999 0 129.037 0 121.681Z";

/** Wave notch height on the reference exchange rate card. */
export const FX_CORNER_WAVE_HEIGHT_PX = Math.round((FX_CARD_HEIGHT_PX * 38.139) / 125);

type Props = {
  accentColor?: string;
  flagSrc?: string;
  showShadow?: boolean;
  /** Full-card wave (exchange rate tiles) vs fixed top-right slice (wide dashboard tiles). */
  fullBleed?: boolean;
};

export default function ExchangeRateCornerAccent({
  accentColor,
  flagSrc,
  showShadow = false,
  fullBleed = false,
}: Props) {
  return (
    <>
      {flagSrc ? (
        <img
          src={flagSrc}
          alt=""
          width={56}
          height={44}
          loading="lazy"
          decoding="async"
          className="absolute right-0 top-0 z-[5] h-11 w-14 rounded-bl-[18px] object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            if (img.dataset.fallback) return;
            img.dataset.fallback = "1";
            img.src = "https://flagcdn.com/w80/un.png";
          }}
        />
      ) : accentColor ? (
        <div
          aria-hidden
          className="absolute right-0 top-0 z-[5] h-11 w-14 rounded-bl-[18px]"
          style={{ backgroundColor: accentColor }}
        />
      ) : null}

      {showShadow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 z-[6] h-11 w-14 rounded-bl-[18px] bg-gradient-to-br from-black/55 via-black/20 to-transparent shadow-[inset_-6px_6px_12px_rgba(0,0,0,0.35)]"
        />
      ) : null}

      <svg
        className={
          fullBleed
            ? "pointer-events-none absolute inset-0 z-10 h-full w-[101%]"
            : "pointer-events-none absolute right-0 top-0 z-10"
        }
        style={fullBleed ? undefined : { width: FX_CARD_WIDTH_PX, height: FX_CORNER_WAVE_HEIGHT_PX }}
        xmlns="http://www.w3.org/2000/svg"
        viewBox={WAVE_VIEW_BOX}
        fill="none"
        preserveAspectRatio={fullBleed ? "none" : "xMaxYMin slice"}
        aria-hidden
      >
        <path d={WAVE_PATH} fill="#161616" />
      </svg>
    </>
  );
}
