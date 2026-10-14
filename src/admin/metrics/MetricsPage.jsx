// Admin → Metrics & Reports. Admin and super admin only (App.jsx route and the
// server both check). Everything here reads the frozen nightly snapshots;
// nothing is recomputed from live tables except an unofficial custom range.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../../layout';
import { useAuth } from '../../context/AuthContext';
import {
  fetchStatus, fetchDefinitions, fetchMonth, fetchRange, fetchDaily, rebuildDays, lockMonth,
} from './metricsApi';
import { monthLabel, periodLabel, dateLabel } from './metricsModel';
import {
  OverviewTab, GrowthTab, EngagementTab, CatalogTab, EconomyTab, AudienceTab, CohortsTab, IntegrityTab,
} from './MetricsTabs';
import '../admin.scss';
import './metricsPage.scss';

const TABS = [
  { id: 'overview', label: 'Overview', Comp: OverviewTab },
  { id: 'growth', label: 'Growth', Comp: GrowthTab },
  { id: 'engagement', label: 'Engagement', Comp: EngagementTab },
  { id: 'catalog', label: 'Catalog & Artists', Comp: CatalogTab },
  { id: 'economy', label: 'Artist Economy', Comp: EconomyTab },
  { id: 'audience', label: 'Audience', Comp: AudienceTab },
  { id: 'cohorts', label: 'Cohorts', Comp: CohortsTab },
  { id: 'integrity', label: 'Integrity', Comp: IntegrityTab },
];

export const REPORTS = [
  { id: 'kpi', label: 'Monthly KPI Report', range: true },
  { id: 'audience', label: 'Audience Report', range: true },
  { id: 'economy', label: 'Artist Economy Report', range: true },
  { id: 'cohorts', label: 'Cohorts and Retention Report', range: false },
  { id: 'quarter', label: 'Quarterly Investor Pack', range: false },
];

const DAILY_KEYS = ['dau', 'mau', 'plays', 'signups', 'gpv_cents', 'anon_plays', 'listen_secs'];

const STATUS_TEXT = {
  closed: 'Locked: these are the official numbers for this month.',
  open: 'Open: this month updates every night and locks on the 1st.',
  preview: 'Preview: before launch day. Test activity, not part of the official record.',
  unofficial: 'Custom range: computed now, not part of the official record.',
};

const todayNy = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const addDays = (iso, n) => {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const prevMonth = (ym) => {
  const [y, m] = ym.split('-').map(Number);
  return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
};

const MetricsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isSuper = user?.adminRole === 'super_admin';

  const [status, setStatus] = useState(null);
  const [definitions, setDefinitions] = useState([]);
  const [mode, setMode] = useState('month');           // month | range
  const [month, setMonth] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [prior, setPrior] = useState(null);
  const [daily, setDaily] = useState({ rows: [] });
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDefs, setShowDefs] = useState(false);
  const [busyReport, setBusyReport] = useState('');

  // ── Load status and definitions once ──
  const loadStatus = useCallback(() => fetchStatus().then((s) => {
    setStatus(s);
    return s;
  }), []);

  useEffect(() => {
    Promise.all([loadStatus(), fetchDefinitions()])
      .then(([s, defs]) => {
        setDefinitions(defs || []);
        const months = (s.months || []).map((m) => m.month);
        const current = todayNy().slice(0, 7);
        setMonth(months.includes(current) ? current : (months[0] || current));
        const yesterday = addDays(todayNy(), -1);
        setFrom(addDays(yesterday, -29));
        setTo(yesterday);
      })
      .catch((err) => {
        setError(err?.response?.status === 403
          ? 'Metrics are for the admin and super admin roles.'
          : 'Could not load metrics. Check that the latest backend is deployed.');
        setLoading(false);
      });
  }, [loadStatus]);

  // ── Load the chosen period ──
  useEffect(() => {
    if (mode === 'month' && !month) return;
    if (mode === 'range' && (!from || !to)) return;
    let alive = true;
    setLoading(true);
    setError('');
    const main = mode === 'month' ? fetchMonth(month) : fetchRange(from, to);
    const priorReq = mode === 'month' ? fetchMonth(prevMonth(month)).catch(() => null) : Promise.resolve(null);
    Promise.all([main, priorReq])
      .then(async ([d, p]) => {
        if (!alive) return;
        setData(d);
        setPrior(p && p.period?.hasData ? p : null);
        const yesterday = addDays(todayNy(), -1);
        const end = d.period.last < yesterday ? d.period.last : yesterday;
        if (d.period.first <= end) {
          const series = await fetchDaily(d.period.first, end, DAILY_KEYS).catch(() => []);
          if (!alive) return;
          const byDate = {};
          for (const r of series) {
            (byDate[r.date] = byDate[r.date] || { date: r.date })[r.key] = Number(r.value);
          }
          setDaily({ rows: Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date)) });
        } else {
          setDaily({ rows: [] });
        }
      })
      .catch((err) => {
        if (alive) setError(err?.response?.data?.error || 'Could not load this period.');
      })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [mode, month, from, to]);

  const months = useMemo(() => {
    const list = (status?.months || []).map((m) => m.month);
    const current = todayNy().slice(0, 7);
    return list.includes(current) ? list : [current, ...list];
  }, [status]);

  // ── Reports ──
  const downloadReport = async (reportId) => {
    if (!data) return;
    setBusyReport(reportId);
    try {
      const { generateReport } = await import('./pdf/metricsPdf');
      await generateReport(reportId, { data, prior, daily, definitions, mode, month, fetchMonth });
    } catch (err) {
      console.error('[Metrics] report failed', err);
      alert('The report could not be created. Please try again.');
    } finally {
      setBusyReport('');
    }
  };

  const ActiveTab = TABS.find((t) => t.id === tab)?.Comp || OverviewTab;
  const period = data?.period;

  return (
    <Layout>
      <div className="admin-page mx">
        <button className="mx-back" onClick={() => navigate('/admin')}>← Admin dashboard</button>
        <header className="mx-head">
          <div>
            <h1>Metrics &amp; Reports</h1>
            <p className="mx-head__sub">
              Official record starts {status ? dateLabel(status.officialStart) : '…'}.
              {status?.lastComputedDay ? ` Numbers through ${dateLabel(status.lastComputedDay)}.` : ' No days computed yet: the first nightly run fills this in.'}
            </p>
          </div>
          <button className="mx-btn mx-btn--ghost" onClick={() => setShowDefs((s) => !s)}>
            {showDefs ? 'Hide definitions' : 'Definitions'}
          </button>
        </header>

        {/* Period controls — one row that scopes everything below */}
        <div className="mx-controls">
          <div className="mx-seg" role="tablist" aria-label="Period type">
            <button role="tab" aria-selected={mode === 'month'} className={mode === 'month' ? 'is-on' : ''} onClick={() => setMode('month')}>Month</button>
            <button role="tab" aria-selected={mode === 'range'} className={mode === 'range' ? 'is-on' : ''} onClick={() => setMode('range')}>Custom range</button>
          </div>
          {mode === 'month' ? (
            <label className="mx-select">
              <span>Month</span>
              <select value={month} onChange={(e) => setMonth(e.target.value)}>
                {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
              </select>
            </label>
          ) : (
            <div className="mx-range">
              <label className="mx-select"><span>From</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
              <label className="mx-select"><span>To</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
            </div>
          )}
          <ReportMenu mode={mode} busy={busyReport} disabled={!data || loading} onPick={downloadReport} />
        </div>

        {period && (
          <div className={`mx-status mx-status--${period.status}`}>
            <strong>{periodLabel(period)}</strong>
            <span>{STATUS_TEXT[period.status]}</span>
            {period.reruns > 0 && (
              <span>Corrected {period.reruns} time{period.reruns > 1 ? 's' : ''}. Latest reason: “{period.lastRerunReason}”</span>
            )}
          </div>
        )}

        {showDefs && <Definitions definitions={definitions} />}

        <nav className="mx-tabs" aria-label="Metrics sections">
          {TABS.map((t) => (
            <button key={t.id} className={tab === t.id ? 'is-on' : ''} aria-current={tab === t.id ? 'page' : undefined}
              onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>

        {error && <p className="mx-error">{error}</p>}
        {!error && loading && !data && <p className="mx-empty">Loading metrics…</p>}
        {!error && data && !period?.hasData && tab !== 'cohorts' && (
          <p className="mx-empty">
            No numbers for this period yet. The nightly job computes each day at 1:15 AM New York time.
          </p>
        )}
        {!error && data && (period?.hasData || tab === 'cohorts') && (
          <div className={`mx-body${loading ? ' is-loading' : ''}`}>
            <ActiveTab data={data} prior={prior} daily={daily} />
          </div>
        )}

        {isSuper && status && (
          <DataControls status={status} onDone={() => { loadStatus(); }} />
        )}
      </div>
    </Layout>
  );
};

// ── Report menu ──────────────────────────────────────────────────────────────

function ReportMenu({ mode, busy, disabled, onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mx-menu">
      <button className="mx-btn" disabled={disabled || Boolean(busy)} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {busy ? 'Creating PDF…' : 'Download PDF ▾'}
      </button>
      {open && (
        <ul className="mx-menu__list" role="menu">
          {REPORTS.map((r) => {
            const allowed = mode === 'month' || r.range;
            return (
              <li key={r.id} role="none">
                <button role="menuitem" disabled={!allowed}
                  title={allowed ? '' : 'Choose a month for this report'}
                  onClick={() => { setOpen(false); onPick(r.id); }}>
                  {r.label}
                  {r.id === 'quarter' && <span className="mx-menu__hint">for this month’s quarter</span>}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ── Definitions ──────────────────────────────────────────────────────────────

const CATEGORY_NAMES = {
  headline: 'Headline KPIs', growth: 'Growth and acquisition', engagement: 'Engagement',
  catalog: 'Catalog and artists', economy: 'Artist economy and revenue', audience: 'Audience',
  cohorts: 'Cohorts', integrity: 'Integrity',
};

function Definitions({ definitions }) {
  const groups = {};
  for (const d of definitions) (groups[d.category] = groups[d.category] || []).push(d);
  return (
    <section className="mx-defs">
      <p className="mx-card__note">
        These definitions are stored in the database, versioned, and printed on every report. If one changes, the
        report says what changed and why.
      </p>
      {Object.keys(CATEGORY_NAMES).filter((c) => groups[c]).map((c) => (
        <div key={c}>
          <h3 className="mx-card__title">{CATEGORY_NAMES[c]}</h3>
          <dl>
            {groups[c].map((d) => (
              <div key={d.metric_key} className="mx-defs__row">
                <dt>{d.name}</dt>
                <dd>{d.definition}{d.version > 1 && d.change_note ? ` (Version ${d.version}: ${d.change_note})` : ''}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </section>
  );
}

// ── Super admin data controls ────────────────────────────────────────────────

function DataControls({ status, onDone }) {
  const yesterday = addDays(todayNy(), -1);
  const [from, setFrom] = useState(addDays(yesterday, -6));
  const [to, setTo] = useState(yesterday);
  const [lockTarget, setLockTarget] = useState(prevMonth(todayNy().slice(0, 7)));
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const locked = (status.months || []).find((m) => m.month === lockTarget && m.closed_at);

  const run = async (fn) => {
    setBusy(true);
    setMessage('');
    try {
      const res = await fn();
      setMessage(res?.message || 'Done.');
      onDone();
    } catch (err) {
      setMessage(err?.response?.data?.error || 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <details className="mx-card mx-controls-panel">
      <summary>Data controls (super admin)</summary>
      <p className="mx-card__note">
        {status.running ? 'A metrics run is in progress right now.' : 'No metrics run in progress.'} Days computed through{' '}
        {status.lastComputedDay ? dateLabel(status.lastComputedDay) : 'none yet'}.
      </p>
      <div className="mx-grid">
        <div>
          <h4 className="mx-subtitle">Rebuild days</h4>
          <p className="mx-card__note">Recompute a range of days, for example after marking test accounts. Locked months are not changed.</p>
          <div className="mx-range">
            <label className="mx-select"><span>From</span><input type="date" value={from} max={yesterday} onChange={(e) => setFrom(e.target.value)} /></label>
            <label className="mx-select"><span>To</span><input type="date" value={to} max={yesterday} onChange={(e) => setTo(e.target.value)} /></label>
          </div>
          <button className="mx-btn" disabled={busy} onClick={() => run(() => rebuildDays(from, to))}>Rebuild</button>
        </div>
        <div>
          <h4 className="mx-subtitle">Lock or correct a month</h4>
          <p className="mx-card__note">
            Months lock automatically on the 1st. Correcting a locked month needs a reason, which is printed on its reports.
          </p>
          <label className="mx-select">
            <span>Month</span>
            <input type="month" value={lockTarget} max={prevMonth(todayNy().slice(0, 7))} onChange={(e) => setLockTarget(e.target.value)} />
          </label>
          {locked && (
            <label className="mx-select mx-select--block">
              <span>Reason for the correction</span>
              <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Test accounts marked after the month locked" />
            </label>
          )}
          <button className="mx-btn" disabled={busy || (locked && !reason.trim())}
            onClick={() => run(() => lockMonth(lockTarget, locked ? reason : null))}>
            {locked ? 'Recompute this locked month' : 'Lock this month'}
          </button>
        </div>
      </div>
      {message && <p className="mx-card__note" role="status">{message}</p>}
    </details>
  );
}

export default MetricsPage;
