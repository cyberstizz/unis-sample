import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";

const DEFAULT_THEME = "blue";

const THEME_DOCUMENT_MAP = {
  blue: {
    favicon: "/favicons/logo-blue.ico",
    color: "#163387",
  },
  orange: {
    favicon: "/favicons/logo-orange.ico",
    color: "#f97316",
  },
  red: {
    favicon: "/favicons/logo-red.ico",
    color: "#ef4444",
  },
  green: {
    favicon: "/favicons/logo-green.ico",
    color: "#22c55e",
  },
  purple: {
    favicon: "/favicons/logo-purple.ico",
    color: "#8b5cf6",
  },
  yellow: {
    favicon: "/favicons/logo-gold.ico",
    color: "#d4a017",
  },
  dianna: {
    favicon: "/favicons/logo-dianna.ico",
    color: "#d946ef",
  },
};

function removeExistingIconLinks() {
  const existingIconLinks = document.head.querySelectorAll(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );

  existingIconLinks.forEach((link) => link.remove());
}

function upsertMeta(name, content) {
  let meta = document.head.querySelector(`meta[name="${name}"]`);

  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", name);
    document.head.appendChild(meta);
  }

  meta.setAttribute("content", content);
}

function appendIconLink({ rel, href, type }) {
  const link = document.createElement("link");
  link.setAttribute("rel", rel);
  link.setAttribute("href", href);

  if (type) {
    link.setAttribute("type", type);
  }

  document.head.appendChild(link);
}

// The page scrollbar belongs to <html>, outside #root where the theme
// variables live, so it can't read --unis-primary by itself. This copies the
// theme colour up to <html> as --unis-scroll-thumb (index.css paints the
// scrollbar with it) whenever #root's data-theme changes.
function syncScrollbarColour() {
  const root = document.getElementById("root");
  if (!root) return;
  const primary = getComputedStyle(root).getPropertyValue("--unis-primary").trim();
  if (primary) {
    document.documentElement.style.setProperty("--unis-scroll-thumb", primary);
  }
}

export default function ThemeDocumentSync() {
  const { theme } = useAuth();

  // Watch the attribute itself: AuthContext sets it, sometimes after this
  // component's own effects have already run.
  useEffect(() => {
    const root = document.getElementById("root");
    if (!root || typeof MutationObserver === "undefined") return undefined;
    syncScrollbarColour();
    const observer = new MutationObserver(syncScrollbarColour);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const safeTheme = THEME_DOCUMENT_MAP[theme] ? theme : DEFAULT_THEME;
    const { favicon, color } = THEME_DOCUMENT_MAP[safeTheme];

    // Cache busting is intentional. Browsers aggressively cache favicons.
    const themedFaviconHref = `${favicon}?theme=${safeTheme}`;

    removeExistingIconLinks();

    appendIconLink({
      rel: "icon",
      href: themedFaviconHref,
      type: "image/x-icon",
    });

    appendIconLink({
      rel: "shortcut icon",
      href: themedFaviconHref,
      type: "image/x-icon",
    });

    appendIconLink({
      rel: "apple-touch-icon",
      href: themedFaviconHref,
    });

    upsertMeta("theme-color", color);
    upsertMeta("msapplication-TileColor", color);
  }, [theme]);

  return null;
}