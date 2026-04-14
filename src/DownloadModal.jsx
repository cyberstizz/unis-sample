import { useState, useEffect } from "react";

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
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconDollar = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="1" x2="12" y2="23" />
    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
  </svg>
);

// ── Component ───────────────────────────────────────────────────────

export default function DownloadModal({
  isOpen = false,
  onClose = () => {},
  song = {},
  onPurchase = () => {},
}) {
  const [status, setStatus] = useState("idle"); // idle | downloading | purchased | complete | error
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Small delay so the CSS transition plays
      requestAnimationFrame(() => setAnimate(true));
      setStatus("idle");
    } else {
      setAnimate(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const {
    title = "Untitled",
    artist = "Unknown Artist",
    artworkUrl,
    downloadUrl,
    downloadPolicy = "free", // "free" | "paid" | "unavailable"
    downloadPrice = null,
    fileName,
  } = song;

  const priceFormatted = downloadPrice
    ? `$${(downloadPrice / 100).toFixed(2)}`
    : "Free";

  // ── Handlers ────────────────────────────────────────────────────

  const handleClose = () => {
    setAnimate(false);
    setTimeout(onClose, 200);
  };

  const handleFreeDownload = async () => {
    if (!downloadUrl) return;
    setStatus("downloading");
    try {
      const response = await fetch(downloadUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName || `${title} - ${artist}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      setStatus("complete");
      setTimeout(handleClose, 1500);
    } catch (err) {
      console.error("Download failed:", err);
      setStatus("error");
    }
  };

  const handlePurchase = async () => {
    setStatus("purchasing");
    try {
      // This should call your backend endpoint which:
      // 1. Creates a Stripe PaymentIntent or charges the user
      // 2. Records the purchase
      // 3. Returns a signed download URL
      await onPurchase(song.id);
      setStatus("purchased");
      // After purchase confirmation, trigger the download
      setTimeout(() => handleFreeDownload(), 600);
    } catch (err) {
      console.error("Purchase failed:", err);
      setStatus("error");
    }
  };

  // ── Render helpers ──────────────────────────────────────────────

  const renderContent = () => {
    if (status === "complete") {
      return (
        <div style={styles.successState}>
          <div style={styles.successIcon}>
            <IconCheck />
          </div>
          <p style={styles.successText}>Download started!</p>
        </div>
      );
    }

    if (status === "error") {
      return (
        <div style={styles.errorState}>
          <p style={styles.errorText}>Something went wrong. Please try again.</p>
          <button style={styles.btnSecondary} onClick={() => setStatus("idle")}>
            Retry
          </button>
        </div>
      );
    }

    switch (downloadPolicy) {
      case "unavailable":
        return (
          <>
            <div style={styles.policyBadge}>
              <IconLock />
              <span>Download Unavailable</span>
            </div>
            <p style={styles.description}>
              The artist has chosen not to make this track available for download.
              You can still stream it anytime on Unis.
            </p>
            <button style={styles.btnSecondary} onClick={handleClose}>
              Got it
            </button>
          </>
        );

      case "paid":
        return (
          <>
            <div style={{ ...styles.policyBadge, ...styles.policyPaid }}>
              <IconDollar />
              <span>{priceFormatted}</span>
            </div>
            <p style={styles.description}>
              Purchase this track to download a high-quality copy you can keep forever.
            </p>
            <p style={{
              margin: 0,
              fontSize: '11px',
              lineHeight: 1.4,
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
              padding: '0 12px',
            }}>
              All song purchases are final. You've previewed this track for free — by purchasing, you agree that digital downloads are non-refundable.
            </p>
            <button
              style={{
                ...styles.btnPrimary,
                opacity: status === "purchasing" ? 0.7 : 1,
                pointerEvents: status === "purchasing" ? "none" : "auto",
              }}
              onClick={handlePurchase}
            >
              {status === "purchasing" ? (
                <span style={styles.spinner} />
              ) : (
                <>
                  <IconDollar />
                  <span>Purchase & Download — {priceFormatted}</span>
                </>
              )}
            </button>
            <button style={styles.btnGhost} onClick={handleClose}>
              Cancel
            </button>
          </>
        );

      case "free":
      default:
        return (
          <>
            <div style={{ ...styles.policyBadge, ...styles.policyFree }}>
              <IconDownload />
              <span>Free Download</span>
            </div>
            <p style={styles.description}>
              This track is available as a free download from the artist.
            </p>
            <button
              style={{
                ...styles.btnPrimary,
                opacity: status === "downloading" ? 0.7 : 1,
                pointerEvents: status === "downloading" ? "none" : "auto",
              }}
              onClick={handleFreeDownload}
            >
              {status === "downloading" ? (
                <span style={styles.spinner} />
              ) : (
                <>
                  <IconDownload />
                  <span>Download Track</span>
                </>
              )}
            </button>
            <button style={styles.btnGhost} onClick={handleClose}>
              Cancel
            </button>
          </>
        );
    }
  };

  return (
    <div
      style={{
        ...styles.overlay,
        opacity: animate ? 1 : 0,
        pointerEvents: animate ? "auto" : "none",
      }}
      onClick={handleClose}
    >
      <div
        style={{
          ...styles.modal,
          transform: animate ? "translateY(0) scale(1)" : "translateY(24px) scale(0.96)",
          opacity: animate ? 1 : 0,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button style={styles.closeBtn} onClick={handleClose}>
          <IconX />
        </button>

        {/* Artwork + Track Info */}
        <div style={styles.trackInfo}>
          <div style={styles.artworkWrapper}>
            {artworkUrl ? (
              <img src={artworkUrl} alt={title} style={styles.artwork} />
            ) : (
              <div style={styles.artworkPlaceholder}>
                <IconDownload />
              </div>
            )}
            {/* Ambient glow behind artwork */}
            {artworkUrl && (
              <div
                style={{
                  ...styles.artworkGlow,
                  backgroundImage: `url(${artworkUrl})`,
                }}
              />
            )}
          </div>
          <h3 style={styles.trackTitle}>{title}</h3>
          <p style={styles.trackArtist}>{artist}</p>
        </div>

        {/* Divider */}
        <div style={styles.divider} />

        {/* Dynamic content area */}
        <div style={styles.contentArea}>{renderContent()}</div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.75)",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    transition: "opacity 0.2s ease",
    padding: "20px",
  },
  modal: {
    background: "#1a1a1f",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.08)",
    width: "100%",
    maxWidth: "360px",
    padding: "28px 24px 24px",
    position: "relative",
    transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease",
    boxShadow: "0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04)",
  },
  closeBtn: {
    position: "absolute",
    top: "12px",
    right: "12px",
    background: "rgba(255,255,255,0.06)",
    border: "none",
    borderRadius: "50%",
    width: "32px",
    height: "32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.5)",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  trackInfo: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    marginBottom: "4px",
  },
  artworkWrapper: {
    position: "relative",
    width: "100px",
    height: "100px",
    marginBottom: "16px",
  },
  artwork: {
    width: "100px",
    height: "100px",
    borderRadius: "12px",
    objectFit: "cover",
    position: "relative",
    zIndex: 1,
  },
  artworkGlow: {
    position: "absolute",
    inset: "-8px",
    borderRadius: "20px",
    backgroundSize: "cover",
    backgroundPosition: "center",
    filter: "blur(24px)",
    opacity: 0.35,
    zIndex: 0,
  },
  artworkPlaceholder: {
    width: "100px",
    height: "100px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.06)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "rgba(255,255,255,0.25)",
  },
  trackTitle: {
    margin: 0,
    fontSize: "17px",
    fontWeight: 600,
    color: "#fff",
    fontFamily: "'DM Sans', sans-serif",
    lineHeight: 1.3,
  },
  trackArtist: {
    margin: "4px 0 0",
    fontSize: "13px",
    color: "rgba(255,255,255,0.45)",
    fontFamily: "'DM Sans', sans-serif",
  },
  divider: {
    height: "1px",
    background: "rgba(255,255,255,0.06)",
    margin: "20px 0",
  },
  contentArea: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "14px",
  },
  policyBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 16px",
    borderRadius: "100px",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.55)",
    fontSize: "13px",
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
  },
  policyFree: {
    background: "rgba(22, 51, 135, 0.2)",
    color: "#6b8cff",
  },
  policyPaid: {
    background: "rgba(255, 177, 60, 0.12)",
    color: "#ffb13c",
  },
  description: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
    fontFamily: "'DM Sans', sans-serif",
    padding: "0 8px",
  },
  btnPrimary: {
    width: "100%",
    padding: "14px 20px",
    borderRadius: "12px",
    border: "none",
    background: "#163387",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    transition: "all 0.15s ease",
    marginTop: "4px",
  },
  btnSecondary: {
    width: "100%",
    padding: "14px 20px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.1)",
    background: "rgba(255,255,255,0.04)",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    transition: "all 0.15s ease",
  },
  btnGhost: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: "13px",
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    padding: "4px 8px",
  },
  successState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "8px 0",
  },
  successIcon: {
    width: "48px",
    height: "48px",
    borderRadius: "50%",
    background: "rgba(34, 197, 94, 0.15)",
    color: "#22c55e",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  successText: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 500,
    color: "#22c55e",
    fontFamily: "'DM Sans', sans-serif",
  },
  errorState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
    padding: "8px 0",
    width: "100%",
  },
  errorText: {
    margin: 0,
    fontSize: "14px",
    color: "#f87171",
    textAlign: "center",
    fontFamily: "'DM Sans', sans-serif",
  },
  spinner: {
    width: "20px",
    height: "20px",
    border: "2px solid rgba(255,255,255,0.2)",
    borderTopColor: "#fff",
    borderRadius: "50%",
    display: "inline-block",
    animation: "spin 0.6s linear infinite",
  },
};