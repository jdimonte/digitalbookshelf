import { useLayoutEffect, useRef, useState } from "react";

// Sizes a text element to the largest font size that fits real, rendered DOM
// metrics — canvas measureText() predictions drift from live layout for
// variable fonts (weight interpolation, letter-spacing, font-swap timing).
export function useFitFontSize({ maxSize, minSize, maxWidth, maxHeight, deps = [] }) {
  const ref = useRef(null);
  const [fontSize, setFontSize] = useState(maxSize);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measureAndSet = () => {
      let best = minSize;
      for (let size = maxSize; size >= minSize; size--) {
        el.style.fontSize = `${size}px`;
        const fitsWidth = maxWidth == null || el.scrollWidth <= maxWidth;
        const fitsHeight = maxHeight == null || el.scrollHeight <= maxHeight;
        if (fitsWidth && fitsHeight) {
          best = size;
          break;
        }
      }
      el.style.fontSize = `${best}px`;
      setFontSize(best);
    };

    measureAndSet();

    if (typeof document === "undefined" || !document.fonts) return;
    if (document.fonts.status === "loaded") return;

    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled && ref.current) measureAndSet();
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [maxSize, minSize, maxWidth, maxHeight, ...deps]);

  return { ref, fontSize };
}
