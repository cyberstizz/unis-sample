// ─────────────────────────────────────────────────────────────────────────────
// Admin → Community Share   (/admin/community-share, admin + super admin)
//
// How supported artists and referrers get paid. Once a month's money has
// reached Unis (AdSense pays between the 21st and 26th of the next month),
// close that month here:
//
//   1. Enter what Unis received for the month: ad income, other income
//      (sponsors, Unis Plus) and Unis's fees on song sales and support (filled
//      in from the database; change it if you want Stripe's fees taken off).
//   2. Preview: the server divides the money by counted listening and shows
//      what supported artists and each referral level would get, and what
//      Unis keeps. Nothing is saved.
//   3. Close the month (super admin): everyone's share lands in their Earnings
//      balance. A month can be closed once.
//
// Adjustments (super admin) credit or take back money on one person's
// balance, with a reason that's kept forever, for corrections and the
// live-money payout test.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../layout';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';
import './metrics/metricsPage.scss';
import './communityShareAdmin.scss';

const usd = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
};
const count = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—';
};
const errorText = (err, fallback) =>
  err?.response?.data?.error || err?.response?.data?.message || fallback;

/** Last month in Harlem time, as "2026-11". The month can only be closed once it has ended. */
const previousMonth = () => {
  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthLabel = (ym) => {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const STREAM_LABELS = {
  supporter: 'Supported artists (15%)',
  referral_1: 'Level 1 referrers (10%)',
  referral_2: 'Level 2 referrers (5%)',
  referral_3: 'Level 3 referrers (2%)',
};

// ── Close a month ───────────────────────────────────────────────────────────

const CloseMonth = ({ canMoveMoney, onClosed }) => {
  const [month, setMonth] = useState(previousMonth());
  const [adIncome, setAdIncome] = useState('');
  const [otherIncome, setOtherIncome] = useState('');
  const [feeIncome, setFeeIncome] = useState('');
  const [feeTouched, setFeeTouched] = useState(false);
  const [note, setNote] = useState('');
  const [previewed, setPreviewed] = useState(null); // { key, data }
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { tone: 'good' | 'bad', text }

  // A preview only counts for the exact numbers it was run with; change any of
  // them and it disappears until Preview is pressed again.
  const inputsKey = `${month}|${adIncome.trim()}|${otherIncome.trim()}|${feeIncome.trim()}`;
  const preview = previewed && previewed.key === inputsKey ? previewed.data : null;
  useEffect(() => { setChecked(false); }, [inputsKey]);
  useEffect(() => { setFeeTouched(false); setFeeIncome(''); }, [month]);

  const params = useCallback(() => {
    const p = new URLSearchParams({ month });
    if (adIncome.trim()) p.set('adIncome', adIncome.trim());
    if (otherIncome.trim()) p.set('otherIncome', otherIncome.trim());
    if (feeTouched && feeIncome.trim()) p.set('feeIncome', feeIncome.trim());
    return p;
  }, [month, adIncome, otherIncome, feeIncome, feeTouched]);

  const runPreview = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiCall({ method: 'get', url: `/v1/admin/earnings/preview?${params()}`, useCache: false });
      // Left blank, the fee is the server's suggestion; show it in the box.
      const fee = feeTouched ? feeIncome.trim() : String(res.data?.feeIncome ?? '');
      if (!feeTouched) setFeeIncome(fee);
      setPreviewed({ key: `${month}|${adIncome.trim()}|${otherIncome.trim()}|${fee}`, data: res.data });
      console.log('[CommunityShare] preview', res.data?.month, res.data?.totalRevenue);
    } catch (err) {
      console.error('[CommunityShare] preview failed:', err?.response?.status, err?.message);
      setMessage({ tone: 'bad', text: errorText(err, 'The preview failed. Check the numbers and try again.') });
    } finally {
      setBusy(false);
    }
  };

  const runClose = async () => {
    if (!preview || !checked) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiCall({
        method: 'post',
        url: '/v1/admin/earnings/close',
        data: {
          month,
          adIncome: adIncome.trim() || '0',
          otherIncome: otherIncome.trim() || '0',
          feeIncome: String(preview.feeIncome ?? '0'),
          note: note.trim() || null,
        },
      });
      console.log('[CommunityShare] closed', res.data?.month);
      setMessage({
        tone: 'good',
        text: `${monthLabel(month)} is closed. ${usd(res.data?.paidToCommunity)} went to ${count(res.data?.earners)} people.`,
      });
      setPreviewed(null);
      setChecked(false);
      setNote('');
      onClosed?.();
    } catch (err) {
      console.error('[CommunityShare] close failed:', err?.response?.status, err?.message);
      setMessage({ tone: 'bad', text: errorText(err, 'Closing the month failed. Nothing was saved.') });
    } finally {
      setBusy(false);
    }
  };

  const streams = preview?.byStream || {};

  return (
    <section className="mx-card csa-card">
      <h2 className="mx-card__title">Close a month</h2>
      <p className="mx-card__note">
        Do this once the month&rsquo;s money has reached Unis. Enter only money Unis actually
        received for that month. Listening is counted in Harlem time, at most 50 plays per person a
        day, and plays of your own songs don&rsquo;t count.
      </p>

      <form className="csa-form" onSubmit={runPreview}>
        <label className="mx-select">
          <span>Month</span>
          <input type="month" value={month} max={previousMonth()} onChange={(e) => setMonth(e.target.value)} required />
        </label>
        <label className="mx-select">
          <span>Ad income received ($)</span>
          <input inputMode="decimal" placeholder="AdSense + AdMob" value={adIncome} onChange={(e) => setAdIncome(e.target.value)} />
        </label>
        <label className="mx-select">
          <span>Other income ($)</span>
          <input inputMode="decimal" placeholder="Sponsors, Unis Plus" value={otherIncome} onChange={(e) => setOtherIncome(e.target.value)} />
        </label>
        <label className="mx-select">
          <span>Unis fees on sales &amp; support ($)</span>
          <input inputMode="decimal" placeholder="Filled in by Preview" value={feeIncome}
            onChange={(e) => { setFeeIncome(e.target.value); setFeeTouched(true); }} />
        </label>
        <label className="mx-select csa-form__note">
          <span>Note (optional, kept with the month)</span>
          <input value={note} maxLength={500} placeholder="e.g. AdSense paid Dec 23" onChange={(e) => setNote(e.target.value)} />
        </label>
        <div className="csa-form__actions">
          <button className="mx-btn mx-btn--ghost" type="submit" disabled={busy || !month}>
            {busy && !preview ? 'Working…' : 'Preview'}
          </button>
        </div>
      </form>

      {message && <p className={`csa-msg csa-msg--${message.tone}`} role="status">{message.text}</p>}

      {preview && (
        <div className="csa-preview">
          {preview.alreadyClosed && (
            <p className="csa-msg csa-msg--bad">{monthLabel(preview.month)} is already closed. This is only a preview.</p>
          )}
          <div className="mx-tiles">
            <div className="mx-tile"><span className="mx-tile__label">Revenue for {monthLabel(preview.month)}</span>
              <span className="mx-tile__value">{usd(preview.totalRevenue)}</span>
              <span className="mx-tile__sub">Ads {usd(preview.adIncome)} · other {usd(preview.otherIncome)} · fees {usd(preview.feeIncome)}</span></div>
            <div className="mx-tile"><span className="mx-tile__label">Counted plays</span>
              <span className="mx-tile__value">{count(preview.countedPlays)}</span>
              <span className="mx-tile__sub">{count(preview.listeners)} listeners</span></div>
            <div className="mx-tile"><span className="mx-tile__label">To the community</span>
              <span className="mx-tile__value">{usd(preview.paidToCommunity)}</span>
              <span className="mx-tile__sub">{count(preview.earners)} people get paid</span></div>
            <div className="mx-tile"><span className="mx-tile__label">Unis keeps</span>
              <span className="mx-tile__value">{usd(preview.keptByUnis)}</span>
              <span className="mx-tile__sub">Including every empty share</span></div>
          </div>

          <div className="mx-table-wrap">
            <table className="mx-table">
              <thead><tr><th>Goes to</th><th>Amount</th></tr></thead>
              <tbody>
                {Object.entries(STREAM_LABELS).map(([key, label]) => (
                  <tr key={key}><td>{label}</td><td>{usd(streams[key])}</td></tr>
                ))}
              </tbody>
            </table>
          </div>

          {canMoveMoney ? (
            !preview.alreadyClosed && (
              <div className="csa-confirm">
                <label className="csa-check">
                  <input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
                  <span>These amounts match what Unis received for {monthLabel(preview.month)}. Closing can&rsquo;t be undone.</span>
                </label>
                <button className="mx-btn" type="button" onClick={runClose} disabled={!checked || busy}>
                  {busy ? 'Closing…' : `Close ${monthLabel(preview.month)}`}
                </button>
              </div>
            )
          ) : (
            <p className="mx-empty">Only a super admin can close a month.</p>
          )}
        </div>
      )}
    </section>
  );
};

// ── Closed months ───────────────────────────────────────────────────────────

const ClosedMonths = ({ refreshKey }) => {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    apiCall({ method: 'get', url: '/v1/admin/earnings/closes', useCache: false })
      .then((res) => { if (!cancelled) { setRows(Array.isArray(res.data) ? res.data : []); setError(''); } })
      .catch((err) => {
        console.error('[CommunityShare] closes failed:', err?.response?.status, err?.message);
        if (!cancelled) setError(errorText(err, 'Couldn’t load closed months.'));
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  return (
    <section className="mx-card csa-card">
      <h2 className="mx-card__title">Closed months</h2>
      {error && <p className="mx-error">{error}</p>}
      {rows === null && !error && <p className="mx-empty">Loading…</p>}
      {rows?.length === 0 && <p className="mx-empty">No month has been closed yet.</p>}
      {rows?.length > 0 && (
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead>
              <tr><th>Month</th><th>Revenue</th><th>Counted plays</th><th>To the community</th><th>Unis kept</th><th>People paid</th><th>Closed</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.closeId}>
                  <td>{monthLabel(r.month)}</td>
                  <td>{usd(r.totalRevenue)}</td>
                  <td>{count(r.countedPlays)}</td>
                  <td>{usd(r.paidToCommunity)}</td>
                  <td>{usd(r.keptByUnis)}</td>
                  <td>{count(r.earners)}</td>
                  <td title={r.note || ''}>{r.closedAt ? new Date(r.closedAt).toLocaleDateString('en-US') : ''}{r.closedBy ? ` · ${r.closedBy}` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ── Adjustments ─────────────────────────────────────────────────────────────

const Adjustments = ({ canMoveMoney }) => {
  const [rows, setRows] = useState(null);
  const [username, setUsername] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiCall({ method: 'get', url: '/v1/admin/earnings/adjustments', useCache: false })
      .then((res) => { if (!cancelled) setRows(Array.isArray(res.data) ? res.data : []); })
      .catch((err) => {
        console.error('[CommunityShare] adjustments failed:', err?.response?.status, err?.message);
        if (!cancelled) setRows([]);
      });
    return () => { cancelled = true; };
  }, [refreshKey]);

  const submit = async (e) => {
    e.preventDefault();
    if (!window.confirm(`Change ${username.trim()}'s balance by $${amount.trim()}?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiCall({ method: 'post', url: '/v1/admin/earnings/adjustments', data: { username, amount, note } });
      setMessage({ tone: 'good', text: `Done: ${usd(res.data?.amount)} for ${res.data?.username}.` });
      setUsername(''); setAmount(''); setNote('');
      setRefreshKey((k) => k + 1);
    } catch (err) {
      console.error('[CommunityShare] adjustment failed:', err?.response?.status, err?.message);
      setMessage({ tone: 'bad', text: errorText(err, 'The adjustment failed. Nothing was saved.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-card csa-card">
      <h2 className="mx-card__title">Adjustments</h2>
      <p className="mx-card__note">
        Credits money to one person&rsquo;s balance (or takes it back with a minus sign), for
        corrections and the live payout test. Every adjustment is kept with its reason.
      </p>
      {canMoveMoney ? (
        <form className="csa-form" onSubmit={submit}>
          <label className="mx-select"><span>Username</span>
            <input value={username} onChange={(e) => setUsername(e.target.value)} required /></label>
          <label className="mx-select"><span>Amount ($)</span>
            <input inputMode="decimal" placeholder="50.00 or -12.50" value={amount} onChange={(e) => setAmount(e.target.value)} required /></label>
          <label className="mx-select csa-form__note"><span>Reason</span>
            <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} required /></label>
          <div className="csa-form__actions">
            <button className="mx-btn" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Add adjustment'}</button>
          </div>
        </form>
      ) : (
        <p className="mx-empty">Only a super admin can adjust balances.</p>
      )}
      {message && <p className={`csa-msg csa-msg--${message.tone}`} role="status">{message.text}</p>}
      {rows?.length > 0 && (
        <div className="mx-table-wrap">
          <table className="mx-table">
            <thead><tr><th>When</th><th>Who</th><th>Amount</th><th>Reason</th><th>By</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.entryId}>
                  <td>{new Date(r.createdAt).toLocaleDateString('en-US')}</td>
                  <td>{r.username}</td>
                  <td>{usd(r.amount)}</td>
                  <td>{r.note}</td>
                  <td>{r.createdBy || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

const CommunityShareAdmin = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canMoveMoney = user?.adminRole === 'super_admin';
  const [refreshKey, setRefreshKey] = useState(0);
  const onClosed = useMemo(() => () => setRefreshKey((k) => k + 1), []);

  return (
    <Layout>
      <div className="admin-page mx csa">
        <button className="mx-back" onClick={() => navigate('/admin')}>← Admin dashboard</button>
        <header className="mx-head">
          <div>
            <h1>Community Share</h1>
            <p className="mx-head__sub">
              Each month, what Unis received is divided by counted listening. 15% of each
              listener&rsquo;s part goes to the artist they supported when they played, and 10, 5 and
              2% to the three people above them in the referral chain. Unis keeps the rest,
              including any share whose earner is missing, has left, isn&rsquo;t phone-verified, or
              is a staff or test account.
            </p>
          </div>
        </header>

        <CloseMonth canMoveMoney={canMoveMoney} onClosed={onClosed} />
        <ClosedMonths refreshKey={refreshKey} />
        <Adjustments canMoveMoney={canMoveMoney} />
      </div>
    </Layout>
  );
};

export default CommunityShareAdmin;
