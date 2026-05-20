import { useEffect, useMemo, useState } from "react";
import "./DownloadModal.scss";

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

export default function DownloadModal({
  isOpen = false,
  onClose = () => {},
  song = {},
  onPurchase = () => {},
}) {
  const [status, setStatus] = useState("idle");
  const [animate, setAnimate] = useState(false);

  const {
    id,
    title = "Untitled",
    artist = "Unknown Artist",
    artworkUrl,
    downloadUrl,
    downloadPolicy = "free",
    downloadPrice = null,
    fileName,
  } = song || {};

  const artistName = typeof artist === "string"
    ? artist
    : artist?.name || artist?.username || "Unknown Artist";

  const priceFormatted = useMemo(() => {
    if (!downloadPrice) return "Free";
    return `$${(Number(downloadPrice) / 100).toFixed(2)}`;
  }, [downloadPrice]);

  const safeFileName = fileName || `${title} - ${artistName}.mp3`;

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    setStatus("idle");
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
  }, [isOpen]);

  if (!isOpen) return null;

  const handleClose = () => {
    setAnimate(false);
    window.setTimeout(onClose, 220);
  };

  const startBrowserDownload = async (urlToDownload) => {
    if (!urlToDownload) {
      setStatus("error");
      return;
    }

    try {
      const response = await fetch(urlToDownload);
      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);

      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = safeFileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      window.URL.revokeObjectURL(objectUrl);
    } catch (err) {
      // Some public storage URLs may block fetch() because of CORS.
      // Fallback to a normal browser download/open behavior.
      const anchor = document.createElement("a");
      anchor.href = urlToDownload;
      anchor.download = safeFileName;
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    }
  };

  const handleFreeDownload = async (overrideUrl) => {
    const urlToDownload = overrideUrl || downloadUrl;

    if (!urlToDownload) {
      setStatus("error");
      return;
    }

    setStatus("downloading");

    try {
      await startBrowserDownload(urlToDownload);
      setStatus("complete");
      window.setTimeout(handleClose, 1400);
    } catch (err) {
      console.error("Download failed:", err);
      setStatus("error");
    }
  };

  const handlePurchase = async () => {
    setStatus("purchasing");

    try {
      const purchaseResult = await onPurchase(id);

      const signedDownloadUrl =
        typeof purchaseResult === "string"
          ? purchaseResult
          : purchaseResult?.downloadUrl ||
            purchaseResult?.data?.downloadUrl ||
            purchaseResult?.data?.signedDownloadUrl ||
            downloadUrl;

      setStatus("purchased");

      window.setTimeout(() => {
        handleFreeDownload(signedDownloadUrl);
      }, 550);
    } catch (err) {
      console.error("Purchase failed:", err);
      setStatus("error");
    }
  };

  const isBusy = status === "downloading" || status === "purchasing" || status === "purchased";

  const renderContent = () => {
    if (status === "complete") {
      return (
        <div className="download-modal__state download-modal__state--success">
          <div className="download-modal__success-orb">
            <IconCheck />
          </div>
          <div>
            <p className="download-modal__state-title">Download started</p>
            <p className="download-modal__state-copy">Your track is being prepared by your browser.</p>
          </div>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div className="download-modal__state download-modal__state--error">
          <p className="download-modal__state-title">Something went wrong</p>
          <p className="download-modal__state-copy">
            We could not start the download. Please try again.
          </p>

          <button className="download-modal__button download-modal__button--secondary" onClick={() => setStatus("idle")}>
            Retry
          </button>
        </div>
      );
    }

    if (downloadPolicy === "unavailable") {
      return (
        <>
          <div className="download-modal__badge download-modal__badge--locked">
            <IconLock />
            <span>Streaming only</span>
          </div>

          <p className="download-modal__description">
            The artist has not enabled downloads for this track. You can still keep it in rotation on Unis.
          </p>

          <button className="download-modal__button download-modal__button--secondary" onClick={handleClose}>
            Got it
          </button>
        </>
      );
    }

    if (downloadPolicy === "paid") {
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
            onClick={handlePurchase}
            disabled={isBusy}
          >
            {status === "purchasing" || status === "purchased" ? (
              <>
                <span className="download-modal__spinner" />
                <span>{status === "purchased" ? "Unlocking download..." : "Processing..."}</span>
              </>
            ) : (
              <>
                <IconDollar />
                <span>Purchase & Download — {priceFormatted}</span>
              </>
            )}
          </button>

          <button className="download-modal__button download-modal__button--ghost" onClick={handleClose}>
            Not now
          </button>
        </>
      );
    }

    return (
      <>
        <div className="download-modal__badge download-modal__badge--free">
          <IconDownload />
          <span>Free download</span>
        </div>

        <p className="download-modal__description">
          The artist made this track available for you to save and enjoy offline.
        </p>

        <button
          className="download-modal__button download-modal__button--primary"
          onClick={() => handleFreeDownload()}
          disabled={isBusy}
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
      onMouseDown={handleClose}
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
            <span>Unis download</span>
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