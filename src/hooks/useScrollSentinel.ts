import { useEffect, useRef } from "react";

/**
 * Invokes onVisible when the sentinel enters the scroll root (or viewport).
 */
export function useScrollSentinel(
  onVisible: () => void,
  enabled: boolean,
  rootRef?: React.RefObject<HTMLElement | null>
) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const el = sentinelRef.current;
    if (!el) return;

    const root = rootRef?.current ?? null;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) onVisible();
      },
      { root, rootMargin: "120px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled, onVisible, rootRef]);

  return sentinelRef;
}
