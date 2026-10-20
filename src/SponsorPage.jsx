// ─────────────────────────────────────────────────────────────────────────────
// Sponsor Harlem, the booking form — /sponsor/book (public, no account, no
// app chrome). The pitch page at /sponsor (SponsorLanding) comes first; its
// "Book a week" button opens this, carrying ?ref, ?name and ?line.
//
// A shop owner picks Uptown, Downtown or all of Harlem and a week (up to four), adds
// a logo, one line of text and a link, sees exactly how it will look, and pays
// by card on Stripe's checkout page. Unis reviews it within a day; if it can't
// run, the full amount is refunded automatically. While its weeks run it shows
// in Unis's ad spaces for people in that area, labeled "Sponsored · Local".
//
//   /sponsor/book?ref=CODE        the crew member's code from the QR, kept with the booking
//   /sponsor/book?name=…&line=…   what they typed into the live preview on /sponsor
//   /sponsor/book?status=paid     back from Stripe after paying (Stripe returns to
//   /sponsor/book?status=canceled /sponsor?status=…, which forwards here)
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { apiCall } from './components/axiosInstance';
import { SponsorCard } from './components/AdSlot';
import logo from './assets/unisLogoThree.svg';
import './components/adSlot.scss';
import './sponsorPage.scss';

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const HEADLINE_MAX = 80;

const isSafeStripeUrl = (raw) => {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && (u.hostname === 'stripe.com' || u.hostname.endsWith('.stripe.com'));
  } catch {
    return false;
  }
};

const dollars = (cents) => {
  const n = Number(cents || 0) / 100;
  return Number.isInteger(n) ? `$${n}` : `$${n.toFixed(2)}`;
};

/** "2026-11-02" → a local date (no time-zone shift). */
const toDate = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const weekLabel = (ymd) => `Week of ${toDate(ymd).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`;

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

const cleanRef = (raw) => (raw || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

const SponsorPage = () => {
  const [params] = useSearchParams();
  const returned = params.get('status');
  const ref = cleanRef(params.get('ref'));

  const [options, setOptions] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(() => ({
    businessName: (params.get('name') || '').slice(0, 60),
    contactEmail: '',
    headline: (params.get('line') || '').slice(0, HEADLINE_MAX),
    link: '',
    area: 'uptown',
    weekStart: '',
    weeks: 1,
  }));
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiCall({ method: 'get', url: '/v1/sponsors/options', useCache: false })
      .then((res) => {
        if (cancelled) return;
        const data = res?.data;
        if (!data || !Array.isArray(data.areas) || !Array.isArray(data.weeks)) throw new Error('Bad options');
        setOptions(data);
      })
      .catch((err) => {
        console.error('[Sponsor] options failed:', err?.response?.status, err?.message);
        if (!cancelled) setLoadError('Booking isn’t available right now. Please try again later.');
      });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => () => { if (logoPreview) URL.revokeObjectURL(logoPreview); }, [logoPreview]);

  const set = (field) => (e) => {
    const value = e?.target ? e.target.value : e;
    setForm((f) => ({ ...f, [field]: value }));
    setError('');
  };

  const area = options?.areas?.find((a) => a.key === form.area);
  const maxWeeks = options?.maxWeeks || 4;

  // A start week works if every week it covers (that we know about) has a spot left.
  const weekOpen = useMemo(() => {
    const weeks = options?.weeks || [];
    return (startIndex, count) => {
      for (let i = startIndex; i < Math.min(weeks.length, startIndex + count); i += 1) {
        if ((weeks[i]?.spotsLeft?.[form.area] ?? 0) <= 0) return false;
      }
      return true;
    };
  }, [options, form.area]);

  // Keep the chosen week valid when the area or length changes.
  useEffect(() => {
    if (!options) return;
    const idx = options.weeks.findIndex((w) => w.weekStart === form.weekStart);
    if (idx >= 0 && weekOpen(idx, Number(form.weeks))) return;
    const first = options.weeks.findIndex((_, i) => weekOpen(i, Number(form.weeks)));
    setForm((f) => ({ ...f, weekStart: first >= 0 ? options.weeks[first].weekStart : '' }));
  }, [options, form.area, form.weeks, form.weekStart, weekOpen]);

  const total = (area?.weekPriceCents || 0) * Number(form.weeks || 1);

  const pickLogo = (e) => {
    const file = e.target.files?.[0];
    setError('');
    if (!file) { setLogoFile(null); setLogoPreview(null); return; }
    if (!file.type.startsWith('image/')) { setError('The logo has to be an image (JPG, PNG or WebP).'); e.target.value = ''; return; }
    if (file.size > LOGO_MAX_BYTES) { setError('The logo is too large. The limit is 2 MB.'); e.target.value = ''; return; }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!agree) { setError('Please agree to the sponsorship terms.'); return; }
    if (!form.weekStart) { setError('Pick a week.'); return; }
    setBusy(true);
    setError('');
    try {
      const data = new FormData();
      data.append('businessName', form.businessName.trim());
      data.append('contactEmail', form.contactEmail.trim());
      data.append('headline', form.headline.trim());
      data.append('link', form.link.trim());
      data.append('area', form.area);
      data.append('weekStart', form.weekStart);
      data.append('weeks', String(form.weeks));
      if (ref) data.append('ref', ref);
      if (logoFile) data.append('logo', logoFile);
      const res = await apiCall({ method: 'post', url: '/v1/sponsors/checkout', data, timeout: 30000 });
      const url = res?.data?.url;
      if (!isSafeStripeUrl(url)) throw new Error('Not a Stripe address');
      window.location.assign(url);
    } catch (err) {
      console.error('[Sponsor] checkout failed:', err?.response?.status, err?.message);
      setError(errorText(err, 'Checkout couldn’t start. Please check the form and try again.'));
      setBusy(false);
    }
  };

  const header = (
    <header className="sp-top">
      <Link to="/" className="sp-top__brand" aria-label="Unis home">
        <img src={logo} alt="" width="36" height="36" />
        <span>UNIS</span>
      </Link>
      <Link to="/sponsor" className="sp-top__tag">Sponsor Harlem</Link>
    </header>
  );

  if (returned === 'paid') {
    return (
      <div className="sponsor-page">
        {header}
        <main className="sp-main">
          <section className="sp-card sp-done" role="status">
            <h1>You&rsquo;re booked for review</h1>
            <p>
              Thanks. Your payment went through and your sponsorship is waiting for a quick review. We check
              every booking within one business day and email you when it&rsquo;s approved.
            </p>
            <p>
              If we can&rsquo;t run it, we refund the full amount to your card, and we&rsquo;ll tell you why.
              Questions? Reply to the email we sent you.
            </p>
            <Link className="sp-btn sp-btn--ghost" to="/sponsor/book">Book another week</Link>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="sponsor-page">
      {header}
      <main className="sp-main">
        <section className="sp-hero">
          <h1>Book your week</h1>
          <p>
            Pick where and when, add your details, and pay once by card. We review every booking within one
            business day; if we can&rsquo;t run it, you get a full refund.{' '}
            <Link to="/sponsor" className="sp-back">How it works</Link>
          </p>
        </section>

        {returned === 'canceled' && (
          <p className="sp-msg" role="status">Checkout was canceled. You weren&rsquo;t charged. Your details are below if you want to try again.</p>
        )}
        {ref && <p className="sp-ref">Referred by <strong>{ref}</strong></p>}
        {loadError && <p className="sp-msg sp-msg--bad" role="alert">{loadError}</p>}

        {options && (
          <form className="sp-card sp-form" onSubmit={submit} noValidate>
            <fieldset className="sp-areas">
              <legend>Where should it show?</legend>
              {options.areas.map((a) => (
                <label key={a.key} className={`sp-area ${form.area === a.key ? 'is-on' : ''}`}>
                  <input type="radio" name="area" value={a.key} checked={form.area === a.key} onChange={set('area')} />
                  <span className="sp-area__name">{a.label}</span>
                  <span className="sp-area__price">{dollars(a.weekPriceCents)}/week</span>
                </label>
              ))}
            </fieldset>

            <div className="sp-row">
              <label className="sp-field">
                <span>Starting</span>
                <select value={form.weekStart} onChange={set('weekStart')} required>
                  {options.weeks.map((w, i) => {
                    const open = weekOpen(i, Number(form.weeks));
                    const left = w.spotsLeft?.[form.area] ?? 0;
                    return (
                      <option key={w.weekStart} value={w.weekStart} disabled={!open}>
                        {weekLabel(w.weekStart)}{open ? (left === 1 ? ' · 1 spot left' : '') : ' · full'}
                      </option>
                    );
                  })}
                </select>
              </label>
              <label className="sp-field">
                <span>How long</span>
                <select value={form.weeks} onChange={(e) => set('weeks')(Number(e.target.value))}>
                  {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>{n === 1 ? '1 week' : `${n} weeks`}</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="sp-field">
              <span>Business name</span>
              <input value={form.businessName} onChange={set('businessName')} maxLength={60} autoComplete="organization" required />
            </label>
            <label className="sp-field">
              <span>One line about your business</span>
              <input value={form.headline} onChange={set('headline')} maxLength={HEADLINE_MAX}
                placeholder="e.g. Fresh patties and coffee on Lenox, open till 10" required />
              <small>{form.headline.length}/{HEADLINE_MAX}</small>
            </label>
            <label className="sp-field">
              <span>Link (website, Instagram or Google Maps)</span>
              <input value={form.link} onChange={set('link')} inputMode="url" placeholder="instagram.com/yourshop" maxLength={300} required />
            </label>
            <label className="sp-field">
              <span>Logo (optional, square works best, up to 2 MB)</span>
              <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickLogo} />
            </label>
            <label className="sp-field">
              <span>Your email (for the receipt and approval)</span>
              <input type="email" value={form.contactEmail} onChange={set('contactEmail')} maxLength={120} autoComplete="email" required />
            </label>

            <div className="sp-preview">
              <span className="sp-preview__title">How it will look</span>
              <div className="ad-slot ad-slot--banner">
                <span className="ad-slot__label">Sponsored · Local</span>
                <div className="ad-slot__body">
                  <SponsorCard preview sponsor={{
                    businessName: form.businessName.trim() || 'Your business',
                    headline: form.headline.trim() || 'Your line of text goes here.',
                    logoUrl: logoPreview,
                  }} />
                </div>
              </div>
            </div>

            <label className="sp-agree">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                I agree to the <Link to="/terms" target="_blank">Local Sponsorship terms</Link>. Unis reviews every
                sponsorship and refunds it in full if it can&rsquo;t run.
              </span>
            </label>

            {error && <p className="sp-msg sp-msg--bad" role="alert">{error}</p>}

            <div className="sp-pay">
              <div>
                <span className="sp-pay__total">{dollars(total)}</span>
                <span className="sp-pay__note">
                  {area?.label} · {Number(form.weeks) === 1 ? '1 week' : `${form.weeks} weeks`}
                </span>
              </div>
              <button className="sp-btn" type="submit" disabled={busy || !form.weekStart}>
                {busy ? 'Opening checkout…' : 'Continue to payment'}
              </button>
            </div>
            <p className="sp-fine">Paid securely through Stripe. Unis never sees your card. One-time payment, no subscription.</p>
          </form>
        )}

        <section className="sp-card sp-rules">
          <h2>What we can run</h2>
          <p>
            Local businesses and services in or near Harlem. We don&rsquo;t run ads for alcohol, tobacco,
            vaping or cannabis, gambling, weapons, adult content, political or issue campaigns, payday or
            crypto lending, or anything illegal, and the link has to go to your own business. Keep the line
            honest: no claims you can&rsquo;t back up.
          </p>
          <p>
            Who sees it: people using Unis in the area you pick (Uptown or Downtown Harlem, or both with All of
            Harlem). Members on Unis Plus don&rsquo;t see ads. The day after your weeks end, we email you how
            many times it was shown and tapped.
          </p>
        </section>
      </main>
    </div>
  );
};

export default SponsorPage;
