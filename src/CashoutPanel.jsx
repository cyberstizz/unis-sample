import { useState, useEffect } from "react";

/*
 * CashoutPanel — Unis Earnings Payout via Stripe Connect
 *
 * Usage:
 *   <CashoutPanel
 *     balance={7523}                    // balance in cents ($75.23)
 *     pendingBalance={1250}             // pending/uncleared balance in cents
 *     minimumPayout={5000}              // minimum payout in cents ($50.00)
 *     stripeConnected={true}            // whether user has connected Stripe
 *     onRequestPayout={(amount) => {}}  // calls your backend
 *     onConnectStripe={() => {}}        // opens Stripe Connect onboarding
 *     payoutHistory={[                  // recent payouts
 *       { id: "po_1", amount: 5000, status: "paid", date: "2026-04-01" },
 *     ]}
 *   />
 *
 * ─── BACKEND IMPLEMENTATION GUIDE ───────────────────────────────────
 *
 * You already have Stripe Connect set up. Here's what you need to add:
 *
 * 1. GET /api/earnings/{userId}
 *    Returns:
 *    {
 *      availableBalance: 7523,     // cents, withdrawable now
 *      pendingBalance: 1250,       // cents, still clearing
 *      lifetimeEarnings: 45000,    // cents, total ever earned
 *      stripeAccountId: "acct_...",
 *      stripeConnected: true,
 *      payoutHistory: [...]
 *    }
 *
 *    In your Spring Boot service:
 *    - Call stripe.balance.retrieve({ stripeAccount: acctId })
 *    - available[0].amount = withdrawable, pending[0].amount = clearing
 *    - Or maintain your own ledger in PostgreSQL and sync periodically
 *
 * 2. POST /api/earnings/{userId}/payout
 *    Body: { amount: 5000 }  // cents, must be >= minimumPayout
 *    
 *    In your Spring Boot service:
 *    - Validate amount >= $50.00 and <= available balance
 *    - Create a Stripe payout:
 *        Payout.create(
 *          PayoutCreateParams.builder()
 *            .setAmount(amount)
 *            .setCurrency("usd")
 *            .build(),
 *          RequestOptions.builder()
 *            .setStripeAccount(stripeAccountId)
 *            .build()
 *        );
 *    - Record the payout in your payouts table
 *    - Return { success: true, payoutId: "po_..." }
 *
 *    IMPORTANT: Stripe Connect payouts go to the connected account's
 *    external account (their bank). Make sure artists have completed
 *    onboarding and added a bank account/debit card.
 *
 * 3. Database additions:
 *    CREATE TABLE payouts (
 *      id BIGSERIAL PRIMARY KEY,
 *      user_id BIGINT NOT NULL REFERENCES users(id),
 *      stripe_payout_id VARCHAR(255),
 *      amount INTEGER NOT NULL,          -- in cents
 *      status VARCHAR(50) DEFAULT 'pending', -- pending, paid, failed, canceled
 *      requested_at TIMESTAMP DEFAULT NOW(),
 *      completed_at TIMESTAMP,
 *      failure_reason TEXT
 *    );
 *
 * 4. Stripe Webhooks (add these to your existing webhook handler):
 *    - payout.paid      → update status to 'paid', set completed_at
 *    - payout.failed    → update status to 'failed', set failure_reason
 *    - payout.canceled  → update status to 'canceled'
 *
 * 5. Stripe Connect Onboarding (if not already implemented):
 *    POST /api/stripe/connect/onboard
 *    - Creates an Account Link for Standard or Express onboarding
 *    - Redirects user to Stripe's hosted onboarding flow
 *    - On return, verify account.charges_enabled && account.payouts_enabled
 * ────────────────────────────────────────────────────────────────────
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
  const d = new Date(dateStr);
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

  return (
    <div style={styles.container}>
      {/* ── Balance Card ─────────────────────────────── */}
      <div style={styles.balanceCard}>
        <div style={styles.balanceGlow} />
        <div style={styles.balanceHeader}>
          <div style={styles.balanceIcon}>
            <IconWallet />
          </div>
          <span style={styles.balanceLabel}>Available Balance</span>
        </div>
        <div style={styles.balanceAmount}>{formatCents(balance)}</div>
        {pendingBalance > 0 && (
          <div style={styles.pendingRow}>
            <IconClock />
            <span>{formatCents(pendingBalance)} pending</span>
          </div>
        )}

        {/* Action area */}
        <div style={styles.actionArea}>
          {!stripeConnected ? (
            // ── Not connected: show onboarding CTA ──
            <div style={styles.connectPrompt}>
              <p style={styles.connectText}>
                Connect your bank account via Stripe to start receiving payouts.
              </p>
              <button style={styles.btnStripe} onClick={onConnectStripe}>
                <IconStripe />
                <span>Connect with Stripe</span>
              </button>
            </div>
          ) : !canPayout ? (
            // ── Connected but below minimum ──
            <div style={styles.minimumNotice}>
              <div style={styles.progressBarTrack}>
                <div
                  style={{
                    ...styles.progressBarFill,
                    width: `${Math.min((balance / minimumPayout) * 100, 100)}%`,
                  }}
                />
              </div>
              <p style={styles.minimumText}>
                {formatCents(shortfall)} more to reach the {formatCents(minimumPayout)} minimum payout
              </p>
            </div>
          ) : !showConfirm ? (
            // ── Ready to cash out ──
            <button
              style={styles.btnPayout}
              onClick={() => setShowConfirm(true)}
            >
              <IconArrowUp />
              <span>Cash Out</span>
            </button>
          ) : (
            // ── Confirmation step ──
            <div style={styles.confirmPanel}>
              {payoutStatus === "success" ? (
                <div style={styles.payoutSuccess}>
                  <div style={styles.successDot} />
                  <span>Payout requested! Funds typically arrive in 1–2 business days.</span>
                </div>
              ) : (
                <>
                  <p style={styles.confirmTitle}>Confirm Payout</p>

                  {/* Amount selector */}
                  <div style={styles.amountOptions}>
                    <button
                      style={{
                        ...styles.amountOption,
                        ...((!useCustom) ? styles.amountOptionActive : {}),
                      }}
                      onClick={() => { setUseCustom(false); setCustomAmount(""); }}
                    >
                      Full balance — {formatCents(balance)}
                    </button>
                    <button
                      style={{
                        ...styles.amountOption,
                        ...(useCustom ? styles.amountOptionActive : {}),
                      }}
                      onClick={() => setUseCustom(true)}
                    >
                      Custom amount
                    </button>
                  </div>

                  {useCustom && (
                    <div style={styles.customInputWrapper}>
                      <span style={styles.dollarSign}>$</span>
                      <input
                        type="number"
                        min={(minimumPayout / 100).toFixed(2)}
                        max={(maxPayout / 100).toFixed(2)}
                        step="0.01"
                        placeholder={(minimumPayout / 100).toFixed(2)}
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        style={styles.customInput}
                      />
                    </div>
                  )}

                  {useCustom && customAmount && !isValidAmount && (
                    <p style={styles.validationError}>
                      {payoutAmount < minimumPayout
                        ? `Minimum payout is ${formatCents(minimumPayout)}`
                        : `Cannot exceed your balance of ${formatCents(balance)}`}
                    </p>
                  )}

                  <div style={styles.confirmInfo}>
                    <IconBank />
                    <span>Funds will be sent to your connected bank account</span>
                  </div>

                  <div style={styles.confirmButtons}>
                    <button
                      style={{
                        ...styles.btnConfirm,
                        opacity: (payoutStatus === "processing" || (useCustom && !isValidAmount)) ? 0.5 : 1,
                        pointerEvents: (payoutStatus === "processing" || (useCustom && !isValidAmount)) ? "none" : "auto",
                      }}
                      onClick={handlePayout}
                    >
                      {payoutStatus === "processing" ? (
                        <span style={styles.spinner} />
                      ) : (
                        `Confirm ${formatCents(payoutAmount)} Payout`
                      )}
                    </button>
                    <button
                      style={styles.btnCancel}
                      onClick={() => {
                        setShowConfirm(false);
                        setPayoutStatus("idle");
                        setUseCustom(false);
                        setCustomAmount("");
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {payoutStatus === "error" && (
                    <p style={styles.errorText}>Payout failed. Please try again or contact support.</p>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Payout History ────────────────────────────── */}
      {payoutHistory.length > 0 && (
        <div style={styles.historySection}>
          <h4 style={styles.historyTitle}>Payout History</h4>
          <div style={styles.historyList}>
            {payoutHistory.map((payout) => {
              const sc = statusConfig[payout.status] || statusConfig.pending;
              return (
                <div key={payout.id} style={styles.historyItem}>
                  <div style={styles.historyLeft}>
                    <div style={{ ...styles.statusBadge, background: sc.bg, color: sc.color }}>
                      {sc.icon}
                      <span>{sc.label}</span>
                    </div>
                    <span style={styles.historyDate}>{formatDate(payout.date)}</span>
                  </div>
                  <span style={styles.historyAmount}>{formatCents(payout.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────────────

const styles = {
  container: {
    fontFamily: "'DM Sans', sans-serif",
    maxWidth: "440px",
    width: "100%",
  },
  balanceCard: {
    position: "relative",
    background: "#1a1a1f",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.06)",
    padding: "24px",
    overflow: "hidden",
  },
  balanceGlow: {
    position: "absolute",
    top: "-40px",
    right: "-40px",
    width: "160px",
    height: "160px",
    borderRadius: "50%",
    background: "radial-gradient(circle, rgba(22,51,135,0.25) 0%, transparent 70%)",
    pointerEvents: "none",
  },
  balanceHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "8px",
  },
  balanceIcon: {
    width: "36px",
    height: "36px",
    borderRadius: "10px",
    background: "rgba(22,51,135,0.2)",
    color: "#6b8cff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  balanceLabel: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.45)",
    fontWeight: 500,
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },
  balanceAmount: {
    fontSize: "36px",
    fontWeight: 700,
    color: "#fff",
    letterSpacing: "-0.02em",
    lineHeight: 1.2,
    marginBottom: "4px",
  },
  pendingRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    color: "#ffb13c",
    marginBottom: "4px",
  },
  actionArea: {
    marginTop: "20px",
  },
  // ── Stripe Connect ──
  connectPrompt: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  connectText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: 1.5,
    color: "rgba(255,255,255,0.4)",
  },
  btnStripe: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "#635bff",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
  // ── Below minimum ──
  minimumNotice: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  progressBarTrack: {
    height: "6px",
    borderRadius: "3px",
    background: "rgba(255,255,255,0.06)",
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: "3px",
    background: "linear-gradient(90deg, #163387, #6b8cff)",
    transition: "width 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
  },
  minimumText: {
    margin: 0,
    fontSize: "13px",
    color: "rgba(255,255,255,0.4)",
  },
  // ── Cash out button ──
  btnPayout: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "#163387",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    transition: "all 0.15s",
  },
  // ── Confirm panel ──
  confirmPanel: {
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  confirmTitle: {
    margin: 0,
    fontSize: "16px",
    fontWeight: 600,
    color: "#fff",
  },
  amountOptions: {
    display: "flex",
    gap: "8px",
  },
  amountOption: {
    flex: 1,
    padding: "10px 12px",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.08)",
    background: "rgba(255,255,255,0.03)",
    color: "rgba(255,255,255,0.5)",
    fontSize: "12px",
    fontWeight: 500,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    transition: "all 0.15s",
    textAlign: "center",
  },
  amountOptionActive: {
    border: "1px solid rgba(22,51,135,0.5)",
    background: "rgba(22,51,135,0.15)",
    color: "#6b8cff",
  },
  customInputWrapper: {
    display: "flex",
    alignItems: "center",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.08)",
    padding: "0 14px",
  },
  dollarSign: {
    fontSize: "18px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.3)",
  },
  customInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#fff",
    fontSize: "18px",
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    padding: "12px 8px",
  },
  validationError: {
    margin: 0,
    fontSize: "12px",
    color: "#f87171",
  },
  confirmInfo: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "13px",
    color: "rgba(255,255,255,0.35)",
  },
  confirmButtons: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  btnConfirm: {
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: "#22c55e",
    color: "#fff",
    fontSize: "15px",
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
  },
  btnCancel: {
    background: "transparent",
    border: "none",
    color: "rgba(255,255,255,0.4)",
    fontSize: "13px",
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    padding: "8px",
  },
  payoutSuccess: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "14px",
    borderRadius: "12px",
    background: "rgba(34,197,94,0.08)",
    border: "1px solid rgba(34,197,94,0.15)",
    fontSize: "14px",
    color: "#22c55e",
    lineHeight: 1.4,
  },
  successDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#22c55e",
    flexShrink: 0,
  },
  errorText: {
    margin: 0,
    fontSize: "13px",
    color: "#f87171",
    textAlign: "center",
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
  // ── History ──
  historySection: {
    marginTop: "20px",
  },
  historyTitle: {
    margin: "0 0 12px",
    fontSize: "14px",
    fontWeight: 600,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
  },
  historyList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  historyItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderRadius: "12px",
    background: "rgba(255,255,255,0.02)",
    border: "1px solid rgba(255,255,255,0.04)",
  },
  historyLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    borderRadius: "100px",
    fontSize: "12px",
    fontWeight: 500,
  },
  historyDate: {
    fontSize: "13px",
    color: "rgba(255,255,255,0.3)",
  },
  historyAmount: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#fff",
  },
};