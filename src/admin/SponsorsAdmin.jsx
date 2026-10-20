// ─────────────────────────────────────────────────────────────────────────────
// Admin → Sponsors   (/admin/sponsors, admin + super admin)
//
// Local sponsorships bought on /sponsor. Waiting-for-review ones come first:
// check the logo, line and link, then Approve (it runs in its weeks) or
// Reject with a reason (super admin: the card is refunded in full and the
// owner is emailed the reason). Approved ones show how often they were shown
// and tapped.
//
// QR codes for the street team: enter a crew member's code (optional) and
// download the QR, or a printable card with it. Scanning opens
// /sponsor?ref=CODE, and the code is kept with any booking made from it.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import Layout from '../layout';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';
import { buildUrl } from '../utils/buildUrl';
import './metrics/metricsPage.scss';
import './communityShareAdmin.scss';
import './sponsorsAdmin.scss';

const usd = (cents) => `$${(Number(cents || 0) / 100).toFixed(2)}`;
const count = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US') : '—');
const errorText = (err, fallback) => err?.response?.data?.error || fallback;
const cleanCode = (raw) => (raw || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 40);

const toDate = (ymd) => {
  const [y, m, d] = String(ymd).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
};
const shortDate = (ymd) => toDate(ymd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const STATUS_LABELS = {
  pending_review: 'Waiting for review',
  approved: 'Approved',
  refunded: 'Rejected · refunded',
  rejected: 'Rejected',
};

/** True when an approved sponsorship hasn't reached its first Monday (Harlem time). */
const notStarted = (row) => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return toDate(row.weekStart) > today;
};

// ── QR codes ────────────────────────────────────────────────────────────────

const download = (dataUrl, name) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

/** A 4×6 printable card (1200×1800): headline, price, the QR and the link. */
const drawCard = async (qrDataUrl, link, code) => {
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#07090f';
  ctx.fillRect(0, 0, 1200, 1800);
  const glow = ctx.createRadialGradient(1050, 0, 50, 1050, 0, 1100);
  glow.addColorStop(0, 'rgba(59,130,246,0.45)');
  glow.addColorStop(1, 'rgba(59,130,246,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, 1200, 1800);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '800 54px Inter, Arial, sans-serif';
  ctx.fillText('U N I S', 600, 150);
  ctx.font = '800 96px Inter, Arial, sans-serif';
  ctx.fillText('Your shop', 600, 330);
  ctx.fillText('on Unis', 600, 440);
  ctx.fillStyle = 'rgba(255,255,255,0.78)';
  ctx.font = '500 46px Inter, Arial, sans-serif';
  ctx.fillText('Reach Harlem listeners', 600, 540);
  ctx.fillText('from $25 a week', 600, 600);

  const img = new Image();
  img.src = qrDataUrl;
  await img.decode();
  ctx.fillStyle = '#ffffff';
  const x = 260, y = 680, size = 680;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(x - 30, y - 30, size + 60, size + 60, 40);
  else ctx.rect(x - 30, y - 30, size + 60, size + 60);
  ctx.fill();
  ctx.drawImage(img, x, y, size, size);

  ctx.fillStyle = '#ffffff';
  ctx.font = '700 60px Inter, Arial, sans-serif';
  ctx.fillText('Scan to book', 600, 1520);
  ctx.fillStyle = 'rgba(255,255,255,0.6)';
  ctx.font = '500 34px Inter, Arial, sans-serif';
  ctx.fillText(link.replace(/^https?:\/\//, ''), 600, 1600);
  if (code) ctx.fillText(`Code ${code}`, 600, 1660);
  return canvas.toDataURL('image/png');
};

const QrMaker = () => {
  const [code, setCode] = useState('');
  const [qr, setQr] = useState(null);
  const [copied, setCopied] = useState(false);
  const clean = cleanCode(code);
  const link = `${window.location.origin}/sponsor${clean ? `?ref=${encodeURIComponent(clean)}` : ''}`;

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(link, { width: 1024, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => { if (!cancelled) setQr(url); })
      .catch((err) => console.error('[Sponsors] QR failed:', err?.message));
    return () => { cancelled = true; };
  }, [link]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy this link', link);
    }
  };

  const fileBase = `unis-sponsor-qr${clean ? `-${clean}` : ''}`;

  return (
    <section className="mx-card csa-card">
      <h2 className="mx-card__title">Street-team QR code</h2>
      <p className="mx-card__note">
        Put this on cards and store posters. Scanning it opens the Sponsor Harlem page, where the owner books
        and pays by themselves. Add a crew member&rsquo;s code to see which bookings they brought in.
      </p>
      <div className="sa-qr">
        <div className="sa-qr__controls">
          <label className="mx-select">
            <span>Crew member code (optional)</span>
            <input value={code} maxLength={40} placeholder="e.g. their referral code" onChange={(e) => setCode(e.target.value)} />
          </label>
          <p className="sa-qr__link">{link}</p>
          <div className="csa-form__actions sa-wrap">
            <button className="mx-btn mx-btn--ghost" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy link'}</button>
            <button className="mx-btn mx-btn--ghost" type="button" disabled={!qr} onClick={() => download(qr, `${fileBase}.png`)}>Download QR</button>
            <button className="mx-btn" type="button" disabled={!qr}
              onClick={async () => download(await drawCard(qr, link, clean), `${fileBase}-card.png`)}>
              Download printable card
            </button>
          </div>
        </div>
        {qr && <img className="sa-qr__img" src={qr} alt={`QR code for ${link}`} width="180" height="180" />}
      </div>
    </section>
  );
};

// ── Sponsorships ────────────────────────────────────────────────────────────

const SponsorRow = ({ row, canRefund, busy, onApprove, onReject }) => {
  const ctr = row.impressions > 0 ? `${((row.clicks / row.impressions) * 100).toFixed(1)}%` : '—';
  const end = toDate(row.weekStart);
  end.setDate(end.getDate() + row.weeks * 7 - 1);
  const rejectable = row.status === 'pending_review' || (row.status === 'approved' && notStarted(row));
  return (
    <article className={`sa-item sa-item--${row.status}`}>
      <div className="sa-item__media">
        {row.logoUrl ? <img src={buildUrl(row.logoUrl)} alt="" /> : <span>{(row.businessName || '?').charAt(0)}</span>}
      </div>
      <div className="sa-item__main">
        <div className="sa-item__top">
          <strong>{row.businessName}</strong>
          <span className={`sa-chip sa-chip--${row.status}`}>{STATUS_LABELS[row.status] || row.status}</span>
        </div>
        <p className="sa-item__line">{row.headline}</p>
        <p className="sa-item__meta">
          <a href={row.linkUrl} target="_blank" rel="noopener noreferrer nofollow">{row.linkUrl}</a>
        </p>
        <p className="sa-item__meta">
          {row.areaLabel} · {shortDate(row.weekStart)}–{end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          {' '}({row.weeks === 1 ? '1 week' : `${row.weeks} weeks`}) · {usd(row.amountCents)} · {row.contactEmail}
          {row.referralCode ? ` · code ${row.referralCode}` : ''}
        </p>
        {row.status === 'approved' && (
          <p className="sa-item__meta">Shown {count(row.impressions)} · tapped {count(row.clicks)} · {ctr}</p>
        )}
        {row.reviewNote && <p className="sa-item__meta">Reason: {row.reviewNote}</p>}
        {(row.status === 'pending_review' || rejectable) && (
          <div className="csa-form__actions sa-wrap">
            {row.status === 'pending_review' && (
              <button className="mx-btn" type="button" disabled={busy} onClick={() => onApprove(row)}>Approve</button>
            )}
            {rejectable && (canRefund ? (
              <button className="mx-btn mx-btn--ghost" type="button" disabled={busy} onClick={() => onReject(row)}>Reject &amp; refund</button>
            ) : (
              <span className="mx-empty">Only a super admin can reject (it refunds the card).</span>
            ))}
          </div>
        )}
      </div>
    </article>
  );
};

const SponsorsAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canRefund = user?.adminRole === 'super_admin';
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    apiCall({ method: 'get', url: '/v1/admin/sponsors', useCache: false })
      .then((res) => { setRows(Array.isArray(res.data) ? res.data : []); setError(''); })
      .catch((err) => {
        console.error('[Sponsors] list failed:', err?.response?.status, err?.message);
        setError(errorText(err, 'Couldn’t load sponsorships.'));
      });
  }, []);

  useEffect(() => { load(); }, [load]);

  const act = async (row, kind) => {
    let data;
    if (kind === 'reject') {
      const note = window.prompt(`Why can't "${row.businessName}" run? The owner sees this, and ${usd(row.amountCents)} is refunded.`);
      if (note === null) return;
      if (!note.trim()) { setMessage({ tone: 'bad', text: 'Write a short reason; the owner sees it.' }); return; }
      data = { note: note.trim() };
    } else if (!window.confirm(`Approve "${row.businessName}" for ${row.areaLabel} from ${shortDate(row.weekStart)}?`)) {
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      await apiCall({ method: 'post', url: `/v1/admin/sponsors/${row.campaignId}/${kind}`, data });
      setMessage({ tone: 'good', text: kind === 'approve' ? `${row.businessName} is approved. The owner was emailed.` : `${row.businessName} was rejected and refunded. The owner was emailed.` });
      load();
    } catch (err) {
      console.error('[Sponsors]', kind, 'failed:', err?.response?.status, err?.message);
      setMessage({ tone: 'bad', text: errorText(err, 'That didn’t go through. Nothing was changed.') });
    } finally {
      setBusy(false);
    }
  };

  const waiting = rows?.filter((r) => r.status === 'pending_review') || [];
  const others = rows?.filter((r) => r.status !== 'pending_review') || [];

  return (
    <Layout>
      <div className="admin-page mx csa sa">
        <button className="mx-back" onClick={() => navigate('/admin')}>← Admin dashboard</button>
        <header className="mx-head">
          <div>
            <h1>Sponsors</h1>
            <p className="mx-head__sub">
              Harlem businesses book and pay for a week in Unis&rsquo;s ad spaces themselves, labeled
              &ldquo;Sponsored · Local&rdquo;. Approve each one before its week starts; rejecting refunds it in
              full. The money is Unis income and is filled in as &ldquo;other income&rdquo; when the month is
              closed in Community Share.
            </p>
          </div>
        </header>

        <QrMaker />

        <section className="mx-card csa-card">
          <h2 className="mx-card__title">Waiting for review {waiting.length ? `(${waiting.length})` : ''}</h2>
          {message && <p className={`csa-msg csa-msg--${message.tone}`} role="status">{message.text}</p>}
          {error && <p className="mx-error">{error}</p>}
          {rows === null && !error && <p className="mx-empty">Loading…</p>}
          {rows !== null && waiting.length === 0 && <p className="mx-empty">Nothing to review.</p>}
          {waiting.map((r) => (
            <SponsorRow key={r.campaignId} row={r} canRefund={canRefund} busy={busy}
              onApprove={(x) => act(x, 'approve')} onReject={(x) => act(x, 'reject')} />
          ))}
        </section>

        <section className="mx-card csa-card">
          <h2 className="mx-card__title">All sponsorships</h2>
          {rows !== null && others.length === 0 && <p className="mx-empty">None yet.</p>}
          {others.map((r) => (
            <SponsorRow key={r.campaignId} row={r} canRefund={canRefund} busy={busy}
              onApprove={(x) => act(x, 'approve')} onReject={(x) => act(x, 'reject')} />
          ))}
        </section>
      </div>
    </Layout>
  );
};

export default SponsorsAdmin;
