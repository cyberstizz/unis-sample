// ─────────────────────────────────────────────────────────────────────────────
// Admin → Codes   (/admin/codes, admin + super admin)
//
// Sign-up needs a referral code, so every campaign hands people one:
//   • Short codes (HARLEM, LEGEND) for ads, radio, creators and the marketing
//     sites, each tied to an owner account. Whoever owns the code is the
//     referrer. A short code is never reused; switching it off keeps it.
//   • Members' own codes (crew, shop owners) work as they are.
// Every code has a link, /join/CODE, that opens sign-up with the code filled
// in, and a QR code of that link for posters and cards.
//
// "Sign-ups by code" counts sign-ups per code: the exact code people used.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'qrcode';
import Layout from '../layout';
import { apiCall } from '../components/axiosInstance';
import { cleanReferral, joinLink } from '../utils/referralLink';
import './metrics/metricsPage.scss';
import './communityShareAdmin.scss';
import './launchAdmin.scss';

const count = (v) => (Number.isFinite(Number(v)) ? Number(v).toLocaleString('en-US') : '—');
const errorText = (err, fallback) => err?.response?.data?.error || fallback;

const download = (dataUrl, name) => {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

const copyText = async (text) => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    window.prompt('Copy this link', text);
    return false;
  }
};

const downloadQr = async (code) => {
  try {
    const url = await QRCode.toDataURL(joinLink(code), { width: 1024, margin: 1, errorCorrectionLevel: 'M' });
    download(url, `unis-join-${cleanReferral(code)}.png`);
  } catch (err) {
    console.error('[Codes] QR failed:', err?.message);
  }
};

// ── Any code: link and QR ───────────────────────────────────────────────────

const AnyCode = () => {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState(false);
  const clean = cleanReferral(code);
  const ready = clean.length >= 3;

  const copy = async () => {
    if (await copyText(joinLink(clean))) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };

  return (
    <section className="mx-card csa-card">
      <h2 className="mx-card__title">Link and QR code for any code</h2>
      <p className="mx-card__note">
        For a crew member&rsquo;s or shop&rsquo;s own code. The link opens sign-up with the code already
        filled in.
      </p>
      <div className="csa-form">
        <label className="mx-select">
          Code
          <input value={code} maxLength={64} placeholder="LENOXCUTS-7K2QP"
            onChange={(e) => setCode(e.target.value)} />
        </label>
        <div className="csa-form__actions">
          <button className="mx-btn mx-btn--ghost" type="button" disabled={!ready} onClick={copy}>
            {copied ? 'Copied' : 'Copy link'}
          </button>
          <button className="mx-btn" type="button" disabled={!ready} onClick={() => downloadQr(clean)}>
            Download QR
          </button>
        </div>
        {ready && <p className="csa-form__note mx-empty">{joinLink(clean)}</p>}
      </div>
    </section>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

const CodesAdmin = () => {
  const navigate = useNavigate();
  const [codes, setCodes] = useState(null);
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ code: '', ownerUsername: '', label: '' });
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const load = useCallback(async () => {
    try {
      const [list, rep] = await Promise.all([
        apiCall({ method: 'get', url: '/v1/admin/referral-codes', useCache: false }),
        apiCall({ method: 'get', url: '/v1/admin/referral-codes/report', useCache: false }),
      ]);
      setCodes(list?.data?.codes || []);
      setReport(rep?.data?.rows || []);
      setError('');
    } catch (err) {
      console.error('[Codes] load failed:', err?.message);
      setError(errorText(err, 'Could not load codes.'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const create = async (e) => {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiCall({
        method: 'post',
        url: '/v1/admin/referral-codes',
        data: { code: cleanReferral(form.code), ownerUsername: form.ownerUsername.trim(), label: form.label.trim() },
      });
      setMessage({ tone: 'good', text: `${res?.data?.code || cleanReferral(form.code)} is ready.` });
      setForm({ code: '', ownerUsername: form.ownerUsername, label: '' });
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorText(err, 'Could not create the code.') });
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (row) => {
    setBusy(true);
    setMessage(null);
    try {
      await apiCall({
        method: 'patch',
        url: `/v1/admin/referral-codes/${encodeURIComponent(row.code)}`,
        data: { active: !row.active },
      });
      await load();
    } catch (err) {
      setMessage({ tone: 'bad', text: errorText(err, 'Could not change the code.') });
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async (code) => {
    if (await copyText(joinLink(code))) {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(''), 1500);
    }
  };

  return (
    <Layout>
      <div className="admin-page mx csa">
        <button className="mx-back" onClick={() => navigate('/admin')}>← Admin dashboard</button>
        <header className="mx-head">
          <div>
            <h1>Codes</h1>
            <p className="mx-head__sub">
              Sign-up needs a code, so every ad, poster, radio spot and creator gives one out. Short codes
              belong to an account you choose (usually your Unis house account), and that account is the
              referrer. Each code&rsquo;s link opens sign-up with the code filled in.
            </p>
          </div>
        </header>

        {error && <p className="mx-error">{error}</p>}

        <section className="mx-card csa-card">
          <h2 className="mx-card__title">Make a short code</h2>
          <form className="csa-form" onSubmit={create}>
            <label className="mx-select">
              Code
              <input value={form.code} maxLength={20} placeholder="HARLEM" required
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </label>
            <label className="mx-select">
              Owner&rsquo;s username
              <input value={form.ownerUsername} maxLength={40} placeholder="unis" required
                onChange={(e) => setForm({ ...form, ownerUsername: e.target.value })} />
            </label>
            <label className="mx-select">
              Label (only you see it)
              <input value={form.label} maxLength={80} placeholder="YouTube ad, November"
                onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </label>
            <div className="csa-form__actions">
              <button className="mx-btn" type="submit" disabled={busy}>Create code</button>
            </div>
            <p className="csa-form__note mx-card__note">
              3 to 20 letters, numbers or hyphens. A code can&rsquo;t be reused, even after you switch it off.
            </p>
          </form>
          {message && <p className={`csa-msg csa-msg--${message.tone}`} role="status">{message.text}</p>}
        </section>

        <section className="mx-card csa-card">
          <h2 className="mx-card__title">Short codes</h2>
          {codes === null && !error && <p className="mx-empty">Loading…</p>}
          {codes !== null && codes.length === 0 && <p className="mx-empty">None yet.</p>}
          {codes !== null && codes.length > 0 && (
            <div className="mx-table-wrap">
              <table className="mx-table">
                <thead>
                  <tr>
                    <th>Code</th><th>Label</th><th>Owner</th><th>Last 7 days</th><th>All time</th><th>Status</th><th />
                  </tr>
                </thead>
                <tbody>
                  {codes.map((row) => (
                    <tr key={row.code}>
                      <td><strong>{row.code}</strong></td>
                      <td>{row.label || '—'}</td>
                      <td>{row.owner}</td>
                      <td>{count(row.last7)}</td>
                      <td>{count(row.total)}</td>
                      <td>{row.active ? 'On' : 'Off'}</td>
                      <td>
                        <div className="csa-form__actions tma-actions">
                          <button className="mx-btn mx-btn--ghost" type="button" onClick={() => copyLink(row.code)}>
                            {copiedCode === row.code ? 'Copied' : 'Copy link'}
                          </button>
                          <button className="mx-btn mx-btn--ghost" type="button" onClick={() => downloadQr(row.code)}>
                            QR
                          </button>
                          <button className="mx-btn mx-btn--ghost" type="button" disabled={busy} onClick={() => toggle(row)}>
                            {row.active ? 'Switch off' : 'Switch on'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <AnyCode />

        <section className="mx-card csa-card">
          <h2 className="mx-card__title">Sign-ups by code</h2>
          <p className="mx-card__note">
            Every code people signed up with, busiest this week first. Sign-ups from before codes were
            recorded count under the referrer&rsquo;s own code. Deleted accounts aren&rsquo;t counted.
          </p>
          {report === null && !error && <p className="mx-empty">Loading…</p>}
          {report !== null && report.length === 0 && <p className="mx-empty">No sign-ups with a code yet.</p>}
          {report !== null && report.length > 0 && (
            <div className="mx-table-wrap">
              <table className="mx-table">
                <thead>
                  <tr>
                    <th>Code</th><th>Owner</th><th>Kind</th><th>Last day</th><th>Last 7 days</th><th>Last 30 days</th><th>All time</th>
                  </tr>
                </thead>
                <tbody>
                  {report.map((row) => (
                    <tr key={`${row.code}-${row.owner}`}>
                      <td><strong>{row.code}</strong></td>
                      <td>{row.owner}</td>
                      <td>{row.shortCode ? 'Short code' : 'Member'}</td>
                      <td>{count(row.last1)}</td>
                      <td>{count(row.last7)}</td>
                      <td>{count(row.last30)}</td>
                      <td>{count(row.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default CodesAdmin;
