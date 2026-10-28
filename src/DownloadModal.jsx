// ─────────────────────────────────────────────────────────────────────────────
// DownloadModal — free downloads and song purchases.
//
// The window asks the server what this person may do with the song
// (GET /v1/songs/{id}/download), so the player and the artist page never
// decide it from stale track data:
//   free         → save the file
//   paid, owned  → save the file again
//   paid         → pay with Stripe right here (card details go to Stripe,
//                  never to Unis), the server confirms, then the file saves
//   unavailable  → streaming only
// Paying: POST /v1/songs/{id}/purchase → clientSecret → Stripe's card form →
// POST /v1/songs/{id}/purchase/confirm → the file. If the page closes after
// paying, Stripe's webhook still records the purchase, and opening this
// window again offers the download.
//
// The file is fetched and saved with its real name (Artist - Title.mp3). It
// never opens the bare audio file in the browser's own player page.
//
// Env: VITE_STRIPE_PUBLISHABLE_KEY (same key as SupportSheet).
// ─────────────────────────────────────────────────────────────────────────────

import { useCallback, useEffect, useMemo, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { apiCall } from "./components/axiosInstance";
import { buildUrl } from "./utils/buildUrl";
import "./DownloadModal.scss";

// Loaded only when someone actually buys, and only if the key exists, so a
// missing key can't break the player (same rule as SupportSheet).
const STRIPE_KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;
let stripePromise = null;
const getStripe = () => {
  if (!STRIPE_KEY) return null;
  if (!stripePromise) stripePromise = loadStripe(STRIPE_KEY);
  return stripePromise;
};

/** Stripe's card form in the active Unis theme. */
function stripeAppearance() {
  const root = document.getElementById("root") || document.documentElement;
  const css = getComputedStyle(root);
  const read = (name, fallback) => (css.getPropertyValue(name) || fallback).trim();
  return {
    theme: "night",
    variables: {
      colorPrimary: read("--unis-primary", "#163387"),
      colorBackground: "#0e1118",
      colorText: "#ffffff",
      colorTextSecondary: "rgba(255,255,255,0.6)",
      colorDanger: "#e54b4a",
      fontFamily: "Inter, system-ui, sans-serif",
      borderRadius: "12px",
      spacingUnit: "4px",
    },
  };
}

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

// ── Inline SVG Icons ────────────────────────────────────────────────
const IconDownload = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const IconLock = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

const IconX = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconCheck = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconDollar = () => (
  <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

const IconSparkle = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    <path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15z" />
  </svg>
);

// ── Card step (must sit inside <Elements>) ───────────────────────────────────
function PayStep({ songId, priceFormatted, onPaid, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError("");
    const { error: payError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });
    if (payError) {
      console.warn("[Download] payment refused:", payError.code, payError.message);
      setError(payError.message || "Your payment didn't go through. Please try again.");
      setBusy(false);
      return;
    }
    if (!paymentIntent || paymentIntent.status !== "succeeded") {
      setError("Your payment wasn't completed.");
      setBusy(false);
      return;
    }
    try {
      const res = await apiCall({
        method: "post",
        url: `/v1/songs/${songId}/purchase/confirm`,
        data: { paymentIntentId: paymentIntent.id },
      });
      console.info("[Download] purchase confirmed", songId, res?.data?.purchaseId);
      onPaid(res?.data || {});
    } catch (err) {
      // Paid but not confirmed here: Stripe's webhook still records it.
      console.error("[Download] confirm failed after payment", songId, err?.response?.status, err?.message);
      onPaid({ confirmFailed: true });
    }
  };

  return (
    <div className="download-modal__pay">
      <PaymentElement options={{ layout: "tabs" }} />
      {error && <p className="download-modal__pay-error" role="alert">{error}</p>}
      <button
        className="download-modal__button download-modal__button--primary"
        onClick={pay}
        disabled={busy || !stripe}
      >
        {busy ? (
          <>
            <span className="download-modal__spinner" />
            <span>Paying...</span>
          </>
        ) : (
          <span>Pay {priceFormatted}</span>
        )}
      </button>
      <button className="download-modal__button download-modal__button--ghost" onClick={onBack} disabled={busy}>
        Back
      </button>
    </div>
  );
}

export default function DownloadModal({
  isOpen = false,
  onClose = () => {},
  song = {},
}) {
  // loading | idle | starting | pay | downloading | complete | error | signin
  const [status, setStatus] = useState("loading");
  const [info, setInfo] = useState(null);       // the server's answer for this song
  const [clientSecret, setClientSecret] = useState(null);
  const [message, setMessage] = useState("");   // error or note to show
  const [lastUrl, setLastUrl] = useState(null);
  const [animate, setAnimate] = useState(false);

  const {
    id,
    title = "Untitled",
    artist = "Unknown Artist",
    artworkUrl,
    fileName,
  } = song || {};

  const artistName = typeof artist === "string"
    ? artist
    : artist?.name || artist?.username || "Unknown Artist";

  const policy = info?.downloadPolicy || "free";
  const owned = Boolean(info?.alreadyPurchased);
  const price = info?.price ?? null;

  const priceFormatted = useMemo(() => {
    if (!price) return "Free";
    return `$${(Number(price) / 100).toFixed(2)}`;
  }, [price]);

  const safeFileName = fileName || `${artistName} - ${title}.mp3`;

  const loadInfo = useCallback(async () => {
    if (!id) {
      setMessage("This song can't be downloaded right now.");
      setStatus("error");
      return;
    }
    setStatus("loading");
    setMessage("");
    try {
      const res = await apiCall({ method: "get", url: `/v1/songs/${id}/download`, useCache: false });
      setInfo(res?.data || {});
      setStatus("idle");
    } catch (err) {
      const code = err?.response?.status;
      if (code === 401 || code === 403) {
        setStatus("signin");
      } else {
        console.error("[Download] info failed", id, code, err?.message);
        setMessage("We couldn't load this song's download options.");
        setStatus("error");
      }
    }
  }, [id]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setInfo(null);
    setClientSecret(null);
    setLastUrl(null);
    loadInfo();
    const frame = requestAnimationFrame(() => setAnimate(true));

    const handleKeyDown = (event) => {
      if (event.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, id]);

  if (!isOpen) return null;

  const handleClose = () => {
    setAnimate(false);
    window.setTimeout(onClose, 220);
  };

  /** Fetches the file and saves it under its real name. Never navigates to it. */
  const saveFile = async (rawUrl) => {
    const url = buildUrl(rawUrl) || rawUrl;
    if (!url) throw new Error("No file address");
    setLastUrl(url);
    const response = await fetch(url);
    if (!response.ok) throw new Error(`File request returned ${response.status}`);
    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = safeFileName;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 4000);
  };

  const download = async (rawUrl) => {
    setStatus("downloading");
    setMessage("");
    try {
      await saveFile(rawUrl);
      console.info("[Download] saved", id);
      setStatus("complete");
      window.setTimeout(handleClose, 1600);
    } catch (err) {
      console.error("[Download] save failed", id, err?.message);
      setMessage("We couldn't save the file. Please try again.");
      setStatus("error");
    }
  };

  const startPurchase = async () => {
    if (!getStripe()) {
      console.error("[Download] VITE_STRIPE_PUBLISHABLE_KEY is not set in this build — purchases are off.");
      setMessage("Purchases aren't available right now.");
      setStatus("error");
      return;
    }
    setStatus("starting");
    setMessage("");
    try {
      const res = await apiCall({ method: "post", url: `/v1/songs/${id}/purchase` });
      const secret = res?.data?.clientSecret;
      if (!secret) throw new Error("No client secret");
      setClientSecret(secret);
      setStatus("pay");
    } catch (err) {
      const text = errorText(err, "We couldn't start your purchase. Please try again.");
      console.error("[Download] purchase start failed", id, err?.response?.status, text);
      if (/already own/i.test(text)) { loadInfo(); return; }
      setMessage(text);
      setStatus("error");
    }
  };

  const handlePaid = async (result) => {
    if (result?.downloadUrl) {
      setInfo((prev) => ({ ...(prev || {}), alreadyPurchased: true, downloadUrl: result.downloadUrl }));
      await download(result.downloadUrl);
      return;
    }
    if (result?.refunded) {
      setMessage(result.message || "This song was removed, and you've been refunded.");
      setStatus("error");
      return;
    }
    // Paid, but the confirm call failed: ask the server again (the webhook
    // records the purchase within seconds).
    setStatus("loading");
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await new Promise((r) => window.setTimeout(r, 2000));
      try {
        const res = await apiCall({ method: "get", url: `/v1/songs/${id}/download`, useCache: false });
        if (res?.data?.alreadyPurchased && res?.data?.downloadUrl) {
          setInfo(res.data);
          await download(res.data.downloadUrl);
          return;
        }
      } catch { /* keep waiting */ }
    }
    setMessage("Your payment went through. The song will be ready to download from here in a minute.");
    setStatus("error");
  };

  const isBusy = status === "downloading" || status === "starting";

  const renderContent = () => {
    if (status === "loading") {
      return (
        <div className="download-modal__state" role="status">
          <span className="download-modal__spinner" />
          <p className="download-modal__state-copy">Getting the download ready...</p>
        </div>
      );
    }

    if (status === "signin") {
      return (
        <div className="download-modal__state">
          <p className="download-modal__state-title">Sign in to download</p>
          <p className="download-modal__state-copy">Downloads and purchases are saved to your Unis account.</p>
          <button className="download-modal__button download-modal__button--secondary" onClick={handleClose}>
            Got it
          </button>
        </div>
      );
    }

    if (status === "complete") {
      return (
        <div className="download-modal__state download-modal__state--success">
          <div className="download-modal__success-orb">
            <IconCheck />
          </div>
          <div>
            <p className="download-modal__state-title">Download started</p>
            <p className="download-modal__state-copy">Saved as {safeFileName}.</p>
          </div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="download-modal__state download-modal__state--error" role="alert">
          <p className="download-modal__state-title">Something went wrong</p>
          <p className="download-modal__state-copy">{message || "Please try again."}</p>
          <button className="download-modal__button download-modal__button--secondary" onClick={loadInfo}>
            Try again
          </button>
          {lastUrl && (
            <a className="download-modal__file-link" href={lastUrl} target="_blank" rel="noopener noreferrer">
              Open the file in a new tab instead
            </a>
          )}
        </div>
      );
    }

    if (status === "pay" && clientSecret) {
      return (
        <>
          <div className="download-modal__badge download-modal__badge--paid">
            <IconDollar />
            <span>{priceFormatted}</span>
          </div>
          <Elements stripe={getStripe()} options={{ clientSecret, appearance: stripeAppearance() }}>
            <PayStep
              songId={id}
              priceFormatted={priceFormatted}
              onPaid={handlePaid}
              onBack={() => { setClientSecret(null); setStatus("idle"); }}
            />
          </Elements>
          <p className="download-modal__fine">Card details go to Stripe. Unis never sees them. Stripe emails your receipt.</p>
        </>
      );
    }

    if (info?.removed || policy === "unavailable") {
      return (
        <>
          <div className="download-modal__badge download-modal__badge--locked">
            <IconLock />
            <span>Streaming only</span>
          </div>

          <p className="download-modal__description">
            {info?.removed
              ? "This song was removed, so it can't be downloaded or bought."
              : "The artist has not enabled downloads for this track. You can still keep it in rotation on Unis."}
          </p>

          <button className="download-modal__button download-modal__button--secondary" onClick={handleClose}>
            Got it
          </button>
        </>
      );
    }

    if (policy === "paid" && !owned) {
      return (
        <>
          <div className="download-modal__badge download-modal__badge--paid">
            <IconDollar />
            <span>{priceFormatted}</span>
          </div>

          <p className="download-modal__description">
            Own a high-quality copy of this track and support the artist directly.
          </p>

          <div className="download-modal__notice">
            <IconSparkle />
            <span>
              Digital downloads are final after purchase. You have already had the chance to preview this track on Unis.
            </span>
          </div>

          <button
            className="download-modal__button download-modal__button--primary"
            onClick={startPurchase}
            disabled={isBusy}
          >
            {status === "starting" ? (
              <>
                <span className="download-modal__spinner" />
                <span>Opening checkout...</span>
              </>
            ) : (
              <>
                <IconDollar />
                <span>Buy for {priceFormatted}</span>
              </>
            )}
          </button>

          <button className="download-modal__button download-modal__button--ghost" onClick={handleClose}>
            Not now
          </button>
        </>
      );
    }

    // Free, or already bought.
    return (
      <>
        <div className={`download-modal__badge download-modal__badge--${owned ? "paid" : "free"}`}>
          {owned ? <IconCheck /> : <IconDownload />}
          <span>{owned ? "You own this" : "Free"}</span>
        </div>

        <p className="download-modal__description">
          {owned
            ? "You bought this track. Download it again any time."
            : "The artist made this track available for you to save and enjoy offline."}
        </p>

        <button
          className="download-modal__button download-modal__button--primary"
          onClick={() => download(info?.downloadUrl)}
          disabled={isBusy || !info?.downloadUrl}
        >
          {status === "downloading" ? (
            <>
              <span className="download-modal__spinner" />
              <span>Starting download...</span>
            </>
          ) : (
            <>
              <IconDownload />
              <span>Download Track</span>
            </>
          )}
        </button>

        <button className="download-modal__button download-modal__button--ghost" onClick={handleClose}>
          Cancel
        </button>
      </>
    );
  };

  return (
    <div
      className={`download-modal ${animate ? "is-visible" : ""}`}
      onMouseDown={status === "pay" ? undefined : handleClose}
      role="presentation"
    >
      <div
        className="download-modal__shell"
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="download-modal-title"
      >
        <div className="download-modal__ambient download-modal__ambient--one" />
        <div className="download-modal__ambient download-modal__ambient--two" />

        {artworkUrl && (
          <div
            className="download-modal__art-backdrop"
            style={{ backgroundImage: `url(${artworkUrl})` }}
            aria-hidden="true"
          />
        )}

        <button className="download-modal__close" onClick={handleClose} aria-label="Close download modal">
          <IconX />
        </button>

        <div className="download-modal__hero">
          <div className="download-modal__art-wrap">
            {artworkUrl ? (
              <img className="download-modal__art" src={artworkUrl} alt={`${title} artwork`} />
            ) : (
              <div className="download-modal__art download-modal__art--placeholder">
                <IconDownload />
              </div>
            )}

            <div className="download-modal__art-ring" aria-hidden="true" />
          </div>

          <div className="download-modal__eyebrow">
            <span>{policy === "paid" && !owned ? "Buy" : "Download"}</span>
          </div>

          <h3 id="download-modal-title" className="download-modal__title">
            {title}
          </h3>

          <p className="download-modal__artist">{artistName}</p>
        </div>

        <div className="download-modal__divider" />

        <div className="download-modal__content">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
