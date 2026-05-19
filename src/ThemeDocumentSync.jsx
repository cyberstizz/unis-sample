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

export default function ThemeDocumentSync() {
  const { theme } = useAuth();

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