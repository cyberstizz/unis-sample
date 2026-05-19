// src/components/ThemeDocumentSync.jsx

import { useEffect } from "react";
import { useAuth } from "./context/AuthContext";

const THEME_DOCUMENT_MAP = {
  blue: {
    favicon: "/favicons/logo-blue.ico",
    color: "#1d42a8",
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

const DEFAULT_THEME = "blue";

function ensureHeadElement(selector, createElement) {
  let element = document.head.querySelector(selector);

  if (!element) {
    element = createElement();
    document.head.appendChild(element);
  }

  return element;
}

export default function ThemeDocumentSync() {
  const { theme } = useAuth();

  useEffect(() => {
    const safeTheme = THEME_DOCUMENT_MAP[theme] ? theme : DEFAULT_THEME;
    const themeConfig = THEME_DOCUMENT_MAP[safeTheme];

    const cacheBustedFavicon = `${themeConfig.favicon}?v=${safeTheme}`;

    // Standard favicon
    const iconLink = ensureHeadElement("link[rel='icon']", () => {
      const link = document.createElement("link");
      link.setAttribute("rel", "icon");
      return link;
    });

    iconLink.setAttribute("type", "image/x-icon");
    iconLink.setAttribute("href", cacheBustedFavicon);

    // Some browsers still look for shortcut icon
    const shortcutIconLink = ensureHeadElement("link[rel='shortcut icon']", () => {
      const link = document.createElement("link");
      link.setAttribute("rel", "shortcut icon");
      return link;
    });

    shortcutIconLink.setAttribute("type", "image/x-icon");
    shortcutIconLink.setAttribute("href", cacheBustedFavicon);

    // Browser top UI color / mobile address bar / PWA chrome color
    const themeColorMeta = ensureHeadElement("meta[name='theme-color']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      return meta;
    });

    themeColorMeta.setAttribute("content", themeConfig.color);

    // Windows tile color fallback
    const tileColorMeta = ensureHeadElement("meta[name='msapplication-TileColor']", () => {
      const meta = document.createElement("meta");
      meta.setAttribute("name", "msapplication-TileColor");
      return meta;
    });

    tileColorMeta.setAttribute("content", themeConfig.color);
  }, [theme]);

  return null;
}