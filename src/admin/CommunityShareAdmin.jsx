// ─────────────────────────────────────────────────────────────────────────────
// Admin → Community Share   (/admin/community-share, admin + super admin)
//
// How supported artists and referrers get paid. Once a month's money has
// reached Unis (AdSense pays between the 21st and 26th of the next month),
// close that month here:
//
//   1. Enter what Unis received for the month: ad income, other income
//      (local sponsors are filled in from the database; add anything else)
//      and what Unis kept from its fees on song sales and support after
//      Stripe's card fees (filled in from the database).
//   2. Preview: the server settles Unis Plus first (of each subscriber's
//      payment after Stripe's fees: 15% to their supported artist and 45% to
//      the artists they played, by plays; Unis's 40% joins the pot), then
//      divides the pot by counted listening and shows
//      what supported artists and each referral level would get, and what
//      Unis keeps. Nothing is saved.
//   3. Close the month (super admin): everyone's share lands in their Earnings
//      balance. A month can be closed once.
//
// Adjustments (super admin) credit or take back money on one person's
// balance, with a reason that's kept forever, for corrections and the
// live-money payout test.
//
// Monthly payouts (super admin) put every Stripe account on one bank payout a
// month (the 1st). Tax year report (super admin) lists what each person was
// paid in a year, split the way the 1099 forms need it, as a CSV download.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../layout';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';
import './metrics/metricsPage.scss';
import './communityShareAdmin.scss';

// Preview and close read a whole month of listening; at scale that takes longer than
// the app's default 10-second request limit. The server finishes either way.
const CLOSE_TIMEOUT_MS = 5 * 60 * 1000;

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
  const [otherTouched, setOtherTouched] = useState(false);
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
  useEffect(() => {
    setFeeTouched(false); setFeeIncome('');
    setOtherTouched(false); setOtherIncome('');
  }, [month]);

  const params = useCallback(() => {
    const p = new URLSearchParams({ month });
    if (adIncome.trim()) p.set('adIncome', adIncome.trim());
    if (otherTouched && otherIncome.trim()) p.set('otherIncome', otherIncome.trim());
    if (feeTouched && feeIncome.trim()) p.set('feeIncome', feeIncome.trim());
    return p;
  }, [month, adIncome, otherIncome, feeIncome, feeTouched, otherTouched]);

  const runPreview = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      // A big month takes the server a while; don't give up after the usual 10 seconds.
      const res = await apiCall({ method: 'get', url: `/v1/admin/earnings/preview?${params()}`, useCache: false, timeout: CLOSE_TIMEOUT_MS });
      // Left blank, the fee and other income are the server's suggestions
      // (fees after Stripe; local sponsors paid that month); show them in the boxes.
      const fee = feeTouched ? feeIncome.trim() : String(res.data?.feeIncome ?? '');
      if (!feeTouched) setFeeIncome(fee);
      const other = otherTouched ? otherIncome.trim() : String(res.data?.otherIncome ?? '');
      if (!otherTouched) setOtherIncome(other);
      setPreviewed({ key: `${month}|${adIncome.trim()}|${other}|${fee}`, data: res.data });
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
        timeout: CLOSE_TIMEOUT_MS,
        data: {
          month,
          adIncome: adIncome.trim() || '0',
          otherIncome: String(preview.otherIncome ?? '0'),
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
          <input inputMode="decimal" placeholder="Local sponsors: filled in by Preview" value={otherIncome}
            onChange={(e) => { setOtherIncome(e.target.value); setOtherTouched(true); }} />
        </label>
        <label className="mx-select">
          <span>Unis fees on sales &amp; support, after Stripe ($)</span>
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
              <span className="mx-tile__sub">Ads {usd(preview.adIncome)} · other {usd(preview.otherIncome)} · fees {usd(preview.feeIncome)} · Plus {usd(preview.plusToPot)}</span></div>
            <div className="mx-tile"><span className="mx-tile__label">Unis Plus</span>
              <span className="mx-tile__value">{usd(preview.plusIncome)}</span>
              <span className="mx-tile__sub">{count(preview.plusPayments)} payments after Stripe · {usd(preview.plusToArtists)} to artists played</span></div>
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
                <tr><td>Unis Plus to artists (15% supported + 45% by plays)</td><td>{usd(preview.plusToArtists)}</td></tr>
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
              <tr><th>Month</th><th>Revenue</th><th>Counted plays</th><th>To the community</th><th>Unis Plus to artists</th><th>Unis kept</th><th>People paid</th><th>Closed</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.closeId}>
                  <td>{monthLabel(r.month)}</td>
                  <td>{usd(r.totalRevenue)}</td>
                  <td>{count(r.countedPlays)}</td>
                  <td>{usd(r.paidToCommunity)}</td>
                  <td>{usd(r.plusToArtists)}</td>
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

// ── Monthly payouts ─────────────────────────────────────────────────────────

const MonthlyPayouts = ({ canMoveMoney }) => {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState(null);

  const apply = async () => {
    if (!window.confirm('Put every Stripe account on one bank payout a month (the 1st)?')) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await apiCall({ method: 'post', url: '/v1/admin/earnings/payout-schedule' });
      setResult(res.data);
      console.log('[CommunityShare] monthly payouts', res.data?.updated, 'of', res.data?.accounts);
    } catch (err) {
      console.error('[CommunityShare] monthly payouts failed:', err?.response?.status, err?.message);
      setMessage({ tone: 'bad', text: errorText(err, 'Couldn’t reach Stripe. Nothing was changed.') });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-card csa-card">
      <h2 className="mx-card__title">Monthly payouts</h2>
      <p className="mx-card__note">
        Everyone&rsquo;s Stripe balance (song sales, support and Community Share withdrawals) goes to
        their bank once a month, on the 1st. Stripe charges Unis $2 for each account it pays out to in
        a month, plus about 0.5% + 25&cent; per payout, so one payout a month keeps that to one charge
        per person. New Stripe accounts get this automatically. Press once to apply it to accounts
        that already exist; pressing again is harmless.
      </p>
      {canMoveMoney ? (
        <button className="mx-btn" type="button" onClick={apply} disabled={busy}>
          {busy ? 'Applying…' : 'Apply monthly payouts'}
        </button>
      ) : (
        <p className="mx-empty">Only a super admin can change payout schedules.</p>
      )}
      {message && <p className={`csa-msg csa-msg--${message.tone}`} role="status">{message.text}</p>}
      {result && (
        <div role="status">
          <p className={`csa-msg csa-msg--${result.failed ? 'bad' : 'good'}`}>
            {count(result.updated)} of {count(result.accounts)} accounts are on monthly payouts.
            {result.failed ? ` ${count(result.failed)} couldn’t be changed:` : ''}
          </p>
          {result.failures?.length > 0 && (
            <ul className="csa-list">
              {result.failures.map((f) => <li key={f.username}>{f.username}: {f.error}</li>)}
            </ul>
          )}
        </div>
      )}
    </section>
  );
};

// ── Tax year report ─────────────────────────────────────────────────────────

// Columns of the CSV, in order: [header, row key, kind]
const TAX_COLUMNS = [
  ['Tax year', 'year', 'text'],
  ['Username', 'username', 'text'],
  ['Email', 'email', 'text'],
  ['Stripe account', 'stripeAccountId', 'text'],
  ['Account closed', 'accountClosed', 'bool'],
  ['Community Share paid out', 'communitySharePaidOut', 'usd'],
  ['Community Share payouts', 'communitySharePayouts', 'int'],
  ['Supporter share credited', 'supporterCredited', 'usd'],
  ['Referral share credited', 'referralCredited', 'usd'],
  ['Adjustments credited', 'adjustmentsCredited', 'usd'],
  ['Unis Plus share credited', 'plusCredited', 'usd'],
  ['Song sales (count)', 'salesCount', 'int'],
  ['Song sales gross', 'salesGross', 'usd'],
  ['Song sales to artist', 'salesToArtist', 'usd'],
  ['Support (count)', 'supportCount', 'int'],
  ['Support gross', 'supportGross', 'usd'],
  ['Support to artist', 'supportToArtist', 'usd'],
  ['Card payments gross', 'paymentsGross', 'usd'],
  ['Card payments (count)', 'paymentsCount', 'int'],
  ['Needs 1099-MISC', 'form1099Misc', 'bool'],
  ['Needs 1099-K', 'form1099K', 'bool'],
  ['Unis Plus $10+ (royalties?)', 'plusRoyaltiesCheck', 'bool'],
];

const csvCell = (value) => {
  const text = value == null ? '' : String(value);
  // Quote everything; double any quotes. A leading = + - @ is neutralised so a
  // spreadsheet never runs a username or email as a formula.
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

const toCsv = (report) => {
  const lines = [TAX_COLUMNS.map(([h]) => csvCell(h)).join(',')];
  for (const row of report.rows || []) {
    lines.push(TAX_COLUMNS.map(([, key, kind]) => {
      const v = key === 'year' ? report.year : row[key];
      if (kind === 'usd') return csvCell(Number(v || 0).toFixed(2));
      if (kind === 'bool') return csvCell(v ? 'yes' : 'no');
      return csvCell(v);
    }).join(','));
  }
  return lines.join('\r\n');
};

const TaxReport = ({ canMoveMoney }) => {
  // In January–March the year to file is last year.
  const now = new Date();
  const defaultYear = now.getMonth() <= 2 ? now.getFullYear() - 1 : now.getFullYear();
  const [year, setYear] = useState(String(defaultYear));
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const load = async (e) => {
    e?.preventDefault();
    setBusy(true);
    setMessage(null);
    setReport(null);
    try {
      const res = await apiCall({ method: 'get', url: `/v1/admin/earnings/tax-report?year=${encodeURIComponent(year)}`, useCache: false });
      setReport(res.data);
      console.log('[CommunityShare] tax report', res.data?.year, res.data?.summary?.people);
    } catch (err) {
      console.error('[CommunityShare] tax report failed:', err?.response?.status, err?.message);
      setMessage({ tone: 'bad', text: errorText(err, 'Couldn’t load the tax report.') });
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!report) return;
    const blob = new Blob([toCsv(report)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `unis-tax-report-${report.year}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  if (!canMoveMoney) {
    return (
      <section className="mx-card csa-card">
        <h2 className="mx-card__title">Tax year report</h2>
        <p className="mx-empty">Only a super admin can see the tax report.</p>
      </section>
    );
  }

  const s = report?.summary;
  const years = [];
  for (let y = now.getFullYear(); y >= 2026; y -= 1) years.push(String(y));

  return (
    <section className="mx-card csa-card">
      <h2 className="mx-card__title">Tax year report</h2>
      <p className="mx-card__note">
        What Unis paid each person in a calendar year, for the 1099 forms Unis files in Stripe
        (Connect &rarr; Tax reporting) each January. Community Share money paid out usually goes on a
        1099-MISC once it reaches $2,000 for the year. Song sales and support go on a 1099-K above
        $20,000 and 200 payments. Stripe counts Community Share payouts into the 1099-K by default, so
        move those amounts onto a 1099-MISC with Stripe&rsquo;s CSV import. An artist&rsquo;s Unis Plus
        share is paid for the use of their music and may count as royalties (1099-MISC box 2, from
        $10); anyone credited $10 or more is flagged. Check the forms with a tax advisor. Opening this
        report is recorded in the audit log.
      </p>
      <form className="csa-form" onSubmit={load}>
        <label className="mx-select">
          <span>Tax year</span>
          <select value={year} onChange={(e) => setYear(e.target.value)}>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <div className="csa-form__actions">
          <button className="mx-btn mx-btn--ghost" type="submit" disabled={busy}>{busy ? 'Loading…' : 'Load report'}</button>
          <button className="mx-btn" type="button" onClick={download} disabled={!report}>Download CSV</button>
        </div>
      </form>
      {message && <p className={`csa-msg csa-msg--${message.tone}`} role="status">{message.text}</p>}
      {s && (
        <div className="mx-tiles">
          <div className="mx-tile"><span className="mx-tile__label">People paid or credited in {report.year}</span>
            <span className="mx-tile__value">{count(s.people)}</span></div>
          <div className="mx-tile"><span className="mx-tile__label">Community Share paid out</span>
            <span className="mx-tile__value">{usd(s.communitySharePaidOut)}</span>
            <span className="mx-tile__sub">{count(s.needs1099Misc)} need a 1099-MISC ({usd(s.miscThreshold)}+)</span></div>
          <div className="mx-tile"><span className="mx-tile__label">Song sales and support</span>
            <span className="mx-tile__value">{usd(Number(s.salesGross || 0) + Number(s.supportGross || 0))}</span>
            <span className="mx-tile__sub">{count(s.needs1099K)} need a 1099-K (over {usd(s.kGrossThreshold)} and {count(s.kCountThreshold)} payments)</span></div>
          <div className="mx-tile"><span className="mx-tile__label">Unis Plus share credited</span>
            <span className="mx-tile__value">{usd(s.plusCredited)}</span>
            <span className="mx-tile__sub">{count(s.plusRoyaltiesCheck)} at {usd(s.royaltyThreshold)}+ (ask about royalties)</span></div>
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
              is a staff or test account. Unis Plus is settled in the same close: of each
              subscriber&rsquo;s payment after Stripe&rsquo;s fees, 15% goes to the artist they support
              and 45% to the artists they played.
            </p>
          </div>
        </header>

        <CloseMonth canMoveMoney={canMoveMoney} onClosed={onClosed} />
        <ClosedMonths refreshKey={refreshKey} />
        <Adjustments canMoveMoney={canMoveMoney} />
        <MonthlyPayouts canMoveMoney={canMoveMoney} />
        <TaxReport canMoveMoney={canMoveMoney} />
      </div>
    </Layout>
  );
};

export default CommunityShareAdmin;
