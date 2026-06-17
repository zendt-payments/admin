import { useId, type CSSProperties, type SVGProps } from "react";
import { Capacitor } from "@capacitor/core";

const GLOW_ASSET = "/gradient-blob-glow.svg";

/** Layout props live on the outer shell; opacity + blur on the inner layer (WebKit-safe). */
const OUTER_STYLE_KEYS = new Set([
  "position",
  "left",
  "right",
  "top",
  "bottom",
  "inset",
  "transform",
  "zIndex",
  "width",
  "height",
  "margin",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
]);

function splitGlowStyles(style?: CSSProperties): { outer: CSSProperties; inner: CSSProperties } {
  if (!style) return { outer: {}, inner: {} };
  const outer: CSSProperties = {};
  const inner: CSSProperties = {};
  for (const [key, value] of Object.entries(style)) {
    if (value == null) continue;
    if (OUTER_STYLE_KEYS.has(key)) {
      (outer as Record<string, unknown>)[key] = value;
    } else {
      (inner as Record<string, unknown>)[key] = value;
    }
  }
  return { outer, inner };
}

/**
 * Decorative gradient halo — used across dashboard and auth screens.
 *
 * - Unique `id`s per instance (`useId`) so `url(#…)` fills work on iOS when
 *   multiple blobs mount (duplicate IDs break WebKit).
 * - No runtime SVG `feGaussianBlur` — stacked SVG filter + CSS blur often drops
 *   the whole shape on iOS WKWebView.
 * - Use {@link GradientBlobGlow} for blurred halos: iOS Capacitor loads a static
 *   pre-blurred SVG asset; other platforms blur a wrapper div (not the inline SVG).
 */
export default function GradientBlob(props: SVGProps<SVGSVGElement>) {
  const paintId = `gradient-blob-paint-${useId().replace(/:/g, "")}`;

  return (
    <svg
      width="379"
      height="278"
      viewBox="0 0 379 278"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
      {...props}
      style={{ pointerEvents: "none", ...(props.style || {}) }}
    >
      <defs>
        <radialGradient
          id={paintId}
          cx="0"
          cy="0"
          r="1"
          gradientUnits="userSpaceOnUse"
          gradientTransform="translate(91.8381 25.5398) rotate(139.561) scale(236.334 180.324)"
        >
          <stop stopColor="#FFAD7A" />
          <stop offset="0.580821" stopColor="#5D689D" />
          <stop offset="1" stopColor="#142337" />
        </radialGradient>
      </defs>
      <path
        d="M251.377 126.5C175.549 191.125 -23.4354 254.634 -88.0339 178.836C-152.632 103.039 -58.3827 -83.3622 17.4454 -147.987C93.2734 -212.611 207.112 -203.554 271.71 -127.757C336.309 -51.9591 327.205 61.8754 251.377 126.5Z"
        fill={`url(#${paintId})`}
      />
    </svg>
  );
}

type GradientBlobGlowProps = Omit<SVGProps<SVGSVGElement>, "style" | "className"> & {
  /** Layout, opacity, positioning — split across outer/inner layers for WebKit. */
  style?: CSSProperties;
  /** Blur class on the inner wrapper (e.g. `my-blur-element`, `my-blur-element-lg`). */
  wrapperClassName?: string;
};

/**
 * iOS-safe blurred halo.
 * - iOS Capacitor: static SVG with baked feGaussianBlur (CSS filter on inline SVG is ignored).
 * - Other platforms: blur on an inner wrapper; position/transform on an outer shell.
 */
export function GradientBlobGlow({
  style,
  wrapperClassName = "my-blur-element",
  ...svgProps
}: GradientBlobGlowProps) {
  const { outer, inner } = splitGlowStyles(style);
  const shellStyle: CSSProperties = { pointerEvents: "none", ...outer };

  if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios") {
    return (
      <img
        src={GLOW_ASSET}
        alt=""
        aria-hidden
        draggable={false}
        decoding="async"
        style={{
          ...shellStyle,
          ...inner,
          objectFit: "fill",
          transform: shellStyle.transform ?? "translateZ(0)",
        }}
      />
    );
  }

  return (
    <div aria-hidden style={shellStyle}>
      <div
        className={`${wrapperClassName} isolate translate-z-0`}
        style={{ width: "100%", height: "100%", ...inner }}
      >
        <GradientBlob {...svgProps} style={{ display: "block", width: "100%", height: "100%" }} />
      </div>
    </div>
  );
}
