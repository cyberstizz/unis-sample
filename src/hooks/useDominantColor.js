import { useState, useEffect } from 'react';
import ColorThief from 'colorthief';

/**
 * Extract the dominant [r,g,b] from an image URL for ambient theming.
 * Returns null if the image is missing, fails to load, or the canvas is
 * CORS-tainted (R2 host without ACAO) — callers fall back to theme tokens.
 */
export default function useDominantColor(url) {
  const [rgb, setRgb] = useState(null);

  useEffect(() => {
    if (!url) {
      setRgb(null);
      return undefined;
    }
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const c = new ColorThief().getColor(img); // [r, g, b]
        if (!cancelled) setRgb(c);
      } catch (e) {
        if (!cancelled) setRgb(null); // tainted canvas → graceful fallback
      }
    };
    img.onerror = () => {
      if (!cancelled) setRgb(null);
    };
    img.src = url;

    return () => {
      cancelled = true;
    };
  }, [url]);

  return rgb;
}