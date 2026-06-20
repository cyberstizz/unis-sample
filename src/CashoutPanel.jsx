import { useState } from "react";
import "./cashoutPanel.scss"; // ★ theme: styling moved out of inline objects into --unis-* SCSS

/*
 * CashoutPanel — Unis Earnings Payout via Stripe Connect
 *
 * Presentation only. All behaviour is driven by props; the parent owns the
 * actual Stripe calls (onRequestPayout / onConnectStripe).
 *
 *   <CashoutPanel
 *     balance={7523}                    // available balance in cents ($75.23)
 *     pendingBalance={1250}             // pending/uncleared balance in cents
 *     minimumPayout={5000}              // minimum payout in cents ($50.00)
 *     stripeConnected={true}            // whether the user has onboarded Stripe
 *     onRequestPayout={(amount) => {}}  // cents; resolves on success, rejects on failure
 *     onConnectStripe={() => {}}        // opens Stripe Connect onboarding
 *     payoutHistory={[                  // recent payouts
 *       { id: "po_1", amount: 5000, status: "paid", date: "2026-04-01" },
 *     ]}
 *   />
 *
 * ★ theme: the only inline styles that remain are the confirm button's
 *   pointerEvents/opacity (a behavioural lock the test-suite asserts on) and
 *   the per-status badge colors (semantic, not the old Stripe purple). Every
 *   other surface now reads --unis-primary and friends.
 */

// ── Inline SVG Icons ────────────────────────────────────────────────
const IconWallet = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
    <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
    <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
  </svg>
);

const IconArrowUp = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="19" x2="12" y2="5" />
    <polyline points="5 12 12 5 19 12" />
  </svg>
);

const IconClock = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconX = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconStripe = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z" />
  </svg>
);

const IconBank = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="22" x2="21" y2="22" />
    <line x1="6" y1="18" x2="6" y2="11" />
    <line x1="10" y1="18" x2="10" y2="11" />
    <line x1="14" y1="18" x2="14" y2="11" />
    <line x1="18" y1="18" x2="18" y2="11" />
    <polygon points="12 2 20 8 4 8" />
  </svg>
);

// ── Helpers ──────────────────────────────────────────────────────────

const formatCents = (cents) => {
  if (cents == null) return "$0.00";
  return `$${(cents / 100).toFixed(2)}`;
};

const formatDate = (dateStr) => {
  // ★ Robust to both "2026-04-01" and ISO datetimes. Parse YYYY-MM-DD as a
  // local date so timezones west of UTC don't roll the display back a day.
  if (!dateStr) return "";
  const [year, month, day] = String(dateStr).slice(0, 10).split("-").map(Number);
  if (!year || !month || !day) return String(dateStr);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

const statusConfig = {
  pending: { color: "#ffb13c", bg: "rgba(255,177,60,0.1)", icon: <IconClock />, label: "Pending" },
  paid:    { color: "#22c55e", bg: "rgba(34,197,94,0.1)",  icon: <IconCheck />, label: "Paid" },
  failed:  { color: "#f87171", bg: "rgba(248,113,113,0.1)", icon: <IconX />,    label: "Failed" },
  canceled:{ color: "#94a3b8", bg: "rgba(148,163,184,0.1)", icon: <IconX />,    label: "Canceled" },
};

// ── Component ───────────────────────────────────────────────────────

export default function CashoutPanel({
  balance = 0,
  pendingBalance = 0,
  minimumPayout = 5000,
  stripeConnected = false,
  onRequestPayout = () => {},
  onConnectStripe = () => {},
  payoutHistory = [],
}) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [payoutStatus, setPayoutStatus] = useState("idle"); // idle | processing | success | error
  const [customAmount, setCustomAmount] = useState("");
  const [useCustom, setUseCustom] = useState(false);

  const canPayout = balance >= minimumPayout && stripeConnected;
  const shortfall = minimumPayout - balance;
  const maxPayout = balance;

  const payoutAmount = useCustom && customAmount
    ? Math.round(parseFloat(customAmount) * 100)
    : balance;

  const isValidAmount = payoutAmount >= minimumPayout && payoutAmount <= maxPayout;

  const handlePayout = async () => {
    // Guard: pointer-events: none is purely visual — assistive tech,
    // programmatic dispatch, and rapid double-taps can still fire onClick.
    if (payoutStatus === "processing") return;
    if (useCustom && !isValidAmount) return;

    setPayoutStatus("processing");
    try {
      await onRequestPayout(payoutAmount);
      setPayoutStatus("success");
      setTimeout(() => {
        setShowConfirm(false);
        setPayoutStatus("idle");
        setUseCustom(false);
        setCustomAmount("");
      }, 2000);
    } catch (err) {
      console.error("Payout failed:", err);
      setPayoutStatus("error");
    }
  };

  const confirmLocked = payoutStatus === "processing" || (useCustom && !isValidAmount);

  return (
    <div className="cashout-panel">
      {/* ── Balance Card ─────────────────────────────── */}
      <div className="cashout-balance">
        <div className="cashout-balance__glow" aria-hidden="true" />
        <div className="cashout-balance__head">
          <div className="cashout-balance__icon">
            <IconWallet />
          </div>
          <span className="cashout-balance__label">Available Balance</span>
        </div>
        <div className="cashout-balance__amount">{formatCents(balance)}</div>
        {pendingBalance > 0 && (
          <div className="cashout-pending">
            <IconClock />
            <span>{formatCents(pendingBalance)} pending</span>
          </div>
        )}

        {/* Action area */}
        <div className="cashout-action">
          {!stripeConnected ? (
            // ── Not connected: show onboarding CTA ──
            <div className="cashout-connect">
              <p className="cashout-connect__text">
                Connect your bank account via Stripe to start receiving payouts.
              </p>
              <button className="cashout-btn cashout-btn--stripe" onClick={onConnectStripe} type="button">
                <IconStripe />
                <span>Connect with Stripe</span>
              </button>
            </div>
          ) : !canPayout ? (
            // ── Connected but below minimum ──
            <div className="cashout-minimum">
              <div className="cashout-progress">
                <div
                  className="cashout-progress__fill"
                  style={{ width: `${Math.min((balance / minimumPayout) * 100, 100)}%` }}
                />
              </div>
              <p className="cashout-minimum__text">
                {formatCents(shortfall)} more to reach the {formatCents(minimumPayout)} minimum payout
              </p>
            </div>
          ) : !showConfirm ? (
            // ── Ready to cash out ──
            <button
              className="cashout-btn cashout-btn--payout"
              onClick={() => setShowConfirm(true)}
              type="button"
            >
              <IconArrowUp />
              <span>Cash Out</span>
            </button>
          ) : (
            // ── Confirmation step ──
            <div className="cashout-confirm">
              {payoutStatus === "success" ? (
                <div className="cashout-success">
                  <div className="cashout-success__dot" />
                  <span>Payout requested! Funds typically arrive in 1–2 business days.</span>
                </div>
              ) : (
                <>
                  <p className="cashout-confirm__title">Confirm Payout</p>

                  {/* Amount selector */}
                  <div className="cashout-amounts">
                    <button
                      className={`cashout-amount ${!useCustom ? "is-active" : ""}`}
                      onClick={() => { setUseCustom(false); setCustomAmount(""); }}
                      type="button"
                    >
                      Full balance — {formatCents(balance)}
                    </button>
                    <button
                      className={`cashout-amount ${useCustom ? "is-active" : ""}`}
                      onClick={() => setUseCustom(true)}
                      type="button"
                    >
                      Custom amount
                    </button>
                  </div>

                  {useCustom && (
                    <div className="cashout-custom">
                      <span className="cashout-custom__sign">$</span>
                      <input
                        type="number"
                        min={(minimumPayout / 100).toFixed(2)}
                        max={(maxPayout / 100).toFixed(2)}
                        step="0.01"
                        placeholder={(minimumPayout / 100).toFixed(2)}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        className="cashout-custom__input"
                      />
                    </div>
                  )}

                  {useCustom && customAmount && !isValidAmount && (
                    <p className="cashout-error">
                      {payoutAmount < minimumPayout
                        ? `Minimum payout is ${formatCents(minimumPayout)}`
                        : `Cannot exceed your balance of ${formatCents(balance)}`}
                    </p>
                  )}

                  <div className="cashout-info">
                    <IconBank />
                    <span>Funds will be sent to your connected bank account</span>
                  </div>

                  <div className="cashout-confirm__buttons">
                    <button
                      className="cashout-btn cashout-btn--confirm"
                      // ★ behavioural lock kept inline — the test-suite asserts
                      //   toHaveStyle({ pointerEvents: 'none' }) when invalid.
                      style={{
                        opacity: confirmLocked ? 0.5 : 1,
                        pointerEvents: confirmLocked ? "none" : "auto",
                      }}
                      onClick={handlePayout}
                      type="button"
                    >
                      {payoutStatus === "processing" ? (
                        <span className="cashout-spinner" />
                      ) : (
                        `Confirm ${formatCents(payoutAmount)} Payout`
                      )}
                    </button>
                    <button
                      className="cashout-btn--cancel"
                      onClick={() => {
                        setShowConfirm(false);
                        setPayoutStatus("idle");
                        setUseCustom(false);
                        setCustomAmount("");
                      }}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>

                  {payoutStatus === "error" && (
                    <p className="cashout-error cashout-error--center">
                      Payout failed. Please try again or contact support.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Payout History ────────────────────────────── */}
      {payoutHistory.length > 0 && (
        <div className="cashout-history">
          <h4 className="cashout-history__title">Payout History</h4>
          <div className="cashout-history__list">
            {payoutHistory.map((payout) => {
              const sc = statusConfig[payout.status] || statusConfig.pending;
              return (
                <div key={payout.id} className="cashout-history__item">
                  <div className="cashout-history__left">
                    <div className="cashout-status" style={{ background: sc.bg, color: sc.color }}>
                      {sc.icon}
                      <span>{sc.label}</span>
                    </div>
                    <span className="cashout-history__date">{formatDate(payout.date)}</span>
                  </div>
                  <span className="cashout-history__amount">{formatCents(payout.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}