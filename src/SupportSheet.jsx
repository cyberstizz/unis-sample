// src/SupportSheet.jsx
//
// Direct fan-to-artist support ("tip") sheet. Two steps:
//   1. Pick an amount (name-your-price) + optional note
//   2. Pay with Stripe Elements (PaymentElement), themed to the active theme
//
// Money rides your existing Stripe Connect rails: POST /v1/support/{artistId}/intent
// returns a clientSecret (destination charge → pays the artist instantly), then
// POST /v1/support/{artistId}/confirm records it.
//
// Deps:  npm i @stripe/stripe-js @stripe/react-stripe-js
// Env:   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_xxx (frontend publishable key)

import React, { useEffect, useMemo, useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Zap, X, Check } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import './support.scss';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY);

const PRESETS = [3, 5, 10, 25]; // dollars

// Map the live theme into Stripe Elements' appearance API.
function themeAppearance() {
  const root = document.getElementById('root') || document.documentElement;
  const s = getComputedStyle(root);
  const read = (name, fb) => (s.getPropertyValue(name) || fb).trim();
  return {
    theme: 'night',
    variables: {
      colorPrimary: read('--unis-primary', '#163387'),
      colorBackground: '#0e1118',
      colorText: '#ffffff',
      colorTextSecondary: 'rgba(255,255,255,0.6)',
      colorDanger: '#e54b4a',
      fontFamily: 'Inter, system-ui, sans-serif',
      borderRadius: '12px',
      spacingUnit: '4px',
    },
  };
}

// ── Payment step (must live inside <Elements>) ───────────────
function PaymentStep({ artistId, amountCents, note, onPaid, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pay = async () => {
    if (!stripe || !elements) return;
    setBusy(true);
    setError(null);

    const { error: confirmError, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: 'if_required',
    });

    if (confirmError) {
      setError(confirmError.message || 'Payment failed. Please try again.');
      setBusy(false);
      return;
    }
    if (paymentIntent && paymentIntent.status === 'succeeded') {
      try {
        const res = await apiCall({
          method: 'post',
          url: `/v1/support/${artistId}/confirm`,
          data: { paymentIntentId: paymentIntent.id },
        });
        onPaid({ supportId: res.data?.supportId, amount: amountCents, note });
      } catch (_) {
        setError('Payment went through, but we couldn’t record it. Please reach out to support.');
        setBusy(false);
      }
    } else {
      setError('Payment was not completed.');
      setBusy(false);
    }
  };

  return (
    <div className="usp-pay">
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <div className="usp-error">{error}</div>}
      <button className="usp-btn usp-btn--primary" onClick={pay} disabled={busy || !stripe}>
        {busy ? 'Processing…' : `Send $${(amountCents / 100).toFixed(2)} support`}
      </button>
      <button className="usp-btn usp-btn--ghost" onClick={onBack} disabled={busy}>
        Back
      </button>
    </div>
  );
}

export default function SupportSheet({
  isOpen = false,
  onClose = () => {},
  artistId,
  artistName = 'this artist',
  source = 'profile',
  onSuccess = () => {},
}) {
  const [step, setStep] = useState('amount'); // amount | pay | done
  const [selected, setSelected] = useState(10);
  const [custom, setCustom] = useState('');
  const [note, setNote] = useState('');
  const [clientSecret, setClientSecret] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [animate, setAnimate] = useState(false);

  const amountCents = useMemo(() => {
    const dollars = custom !== '' ? parseFloat(custom) : selected;
    if (!dollars || Number.isNaN(dollars)) return 0;
    return Math.round(dollars * 100);
  }, [custom, selected]);

  useEffect(() => {
    if (!isOpen) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    setStep('amount'); setSelected(10); setCustom(''); setNote('');
    setClientSecret(null); setError(null);
    const frame = requestAnimationFrame(() => setAnimate(true));
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  const close = () => { setAnimate(false); window.setTimeout(onClose, 200); };

  const startPayment = async () => {
    if (amountCents < 100) { setError('Minimum support is $1.00.'); return; }
    setBusy(true); setError(null);
    try {
      const res = await apiCall({
        method: 'post',
        url: `/v1/support/${artistId}/intent`,
        data: { amount: amountCents, note: note.trim() || null, source },
      });
      setClientSecret(res.data.clientSecret);
      setStep('pay');
    } catch (e) {
      setError(e?.response?.data?.error || 'Could not start the payment.');
    } finally {
      setBusy(false);
    }
  };

  const handlePaid = (result) => {
    setStep('done');
    onSuccess(result);
    window.setTimeout(close, 1700);
  };

  return (
    <div className={`usp ${animate ? 'is-visible' : ''}`} onMouseDown={close} role="presentation">
      <div className="usp__shell" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="usp__glow" aria-hidden="true" />
        <button className="usp__close" onClick={close} aria-label="Close"><X size={18} /></button>

        <div className="usp__head">
          <div className="usp__bolt"><Zap size={20} /></div>
          <h3 className="usp__title">Support {artistName}</h3>
          <p className="usp__sub">Goes straight to the artist — name your price.</p>
        </div>

        {step === 'amount' && (
          <div className="usp__body">
            <div className="usp-chips">
              {PRESETS.map((d) => (
                <button
                  key={d}
                  className={`usp-chip ${custom === '' && selected === d ? 'active' : ''}`}
                  onClick={() => { setSelected(d); setCustom(''); }}
                >
                  ${d}
                </button>
              ))}
            </div>

            <div className="usp-custom">
              <span className="usp-custom__dollar">$</span>
              <input
                type="number" min="1" step="1" inputMode="decimal"
                className="usp-custom__input" placeholder="Custom amount"
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
              />
            </div>

            <input
              type="text" className="usp-note" maxLength={280}
              placeholder="Add a note (optional)"
              value={note} onChange={(e) => setNote(e.target.value)}
            />

            {error && <div className="usp-error">{error}</div>}

            <button className="usp-btn usp-btn--primary" onClick={startPayment} disabled={busy || amountCents < 100}>
              {busy ? 'One sec…' : `Continue — $${(amountCents / 100).toFixed(2)}`}
            </button>
          </div>
        )}

        {step === 'pay' && clientSecret && (
          <div className="usp__body">
            <Elements stripe={stripePromise} options={{ clientSecret, appearance: themeAppearance() }}>
              <PaymentStep
                artistId={artistId}
                amountCents={amountCents}
                note={note.trim()}
                onPaid={handlePaid}
                onBack={() => setStep('amount')}
              />
            </Elements>
          </div>
        )}

        {step === 'done' && (
          <div className="usp__done">
            <div className="usp__check"><Check size={26} /></div>
            <p className="usp__done-title">Support sent</p>
            <p className="usp__done-sub">Thank you for backing {artistName}.</p>
          </div>
        )}
      </div>
    </div>
  );
}