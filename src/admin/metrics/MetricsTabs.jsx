// The eight Metrics tabs. Each receives the period's data (already through the
// server's privacy rules), the prior month's data, and the daily series.
import React, { useEffect, useMemo, useState } from 'react';
import {
  StatTile, BarList, TrendLine, ColumnChart, DataTable, HeatTable, Card,
} from './MetricsCharts';
import {
  headlineKpis, sectionMetrics, breakdown, pairedRows, changeLabel, monthLabel, shortMonth,
  segmentLabel, hourLabel, AGE_BANDS, ADULT_BANDS, ageLabel, fmtPct, fmtInt, fmtUsd, fmtHours,
  isNum, hiddenText, indexRows,
} from './metricsModel';
import { fetchCohorts } from './metricsApi';

const tiles = (list) => (
  <div className="mx-tiles">
    {list.map((m) => <StatTile key={m.name} label={m.name} value={m.value} unit={m.unit} sub={m.sub} />)}
  </div>
);

// ── Overview ─────────────────────────────────────────────────────────────────

export function OverviewTab({ data, prior, daily }) {
  const kpis = headlineKpis(data, prior);
  const priorName = prior?.period?.month ? monthLabel(prior.period.month).split(' ')[0] : null;
  const [hero, ...rest] = kpis;
  const changeOf = (k) => (isNum(k.change) ? { raw: k.change, text: changeLabel(k, priorName) } : null);
  return (
    <>
      <div className="mx-tiles mx-tiles--headline">
        <StatTile hero label={hero.name} value={hero.value} unit={hero.unit} change={changeOf(hero)} trend={hero.trend}
          sub="Active in the last 30 days" />
        {rest.map((k) => (
          <StatTile key={k.key} label={k.name} value={k.value} unit={k.unit} change={changeOf(k)} trend={k.trend} sub={k.sub} />
        ))}
      </div>
      <div className="mx-grid">
        <Card title="Daily active users">
          <TrendLine data={daily.rows} series={[{ key: 'dau', name: 'Daily active users' }]} />
        </Card>
        <Card title="Monthly active users, day by day" note="Each point counts the 30 days ending that day.">
          <TrendLine data={daily.rows} series={[{ key: 'mau', name: 'Monthly active users' }]} />
        </Card>
      </div>
    </>
  );
}

// ── Growth ───────────────────────────────────────────────────────────────────

export function GrowthTab({ data, daily }) {
  const m = sectionMetrics(data);
  const { v } = indexRows(data?.rows);
  const ga = [
    ['New (joined this period)', fmtInt(v('ga_new'))],
    ['Retained (also active the period before)', fmtInt(v('ga_retained'))],
    ['Returning (back after a quiet period)', fmtInt(v('ga_returning'))],
    ['Lost (active the period before, not this one)', fmtInt(v('ga_lost'))],
  ];
  return (
    <>
      {tiles(m.growth)}
      <div className="mx-grid">
        <Card title="Signups by day">
          <TrendLine data={daily.rows} series={[{ key: 'signups', name: 'Signups' }]} />
        </Card>
        <Card title="How people signed up">
          <BarList rows={breakdown(data, 'signups', 'source')} showShare />
        </Card>
        <Card title="Growth accounting"
          note={data?.period?.launchMonth ? 'Launch month: accounts made before launch day show as returning.' : null}>
          <DataTable columns={['People active this period', 'Count']} rows={ga} />
        </Card>
        <Card title="Waitlist signups by metro" note="Where people outside Harlem are asking for Unis.">
          <BarList rows={breakdown(data, 'waitlist_signups', 'metro', { top: 15 })} />
        </Card>
      </div>
    </>
  );
}

// ── Engagement ───────────────────────────────────────────────────────────────

export function EngagementTab({ data, daily }) {
  const m = sectionMetrics(data);
  const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  const byHour = breakdown(data, 'plays', 'hour');
  const byWeekday = breakdown(data, 'plays', 'weekday');
  return (
    <>
      {tiles(m.engagement)}
      <div className="mx-grid">
        <Card title="Counted plays by day">
          <TrendLine data={daily.rows} series={[{ key: 'plays', name: 'Counted plays' }]} />
        </Card>
        <Card title="Where plays start">
          <BarList rows={breakdown(data, 'plays', 'source')} showShare />
        </Card>
        <Card title="Daily active users by platform" note="Average per day. Someone on two platforms counts once on each.">
          <BarList rows={breakdown(data, 'dau_avg', 'platform')} unit="ratio" />
        </Card>
        <Card title="Plays by platform">
          <BarList rows={breakdown(data, 'plays', 'platform')} showShare />
        </Card>
        <Card title="Plays by hour of day" note="New York time.">
          <ColumnChart data={hours.map((h) => ({ label: hourLabel(h), value: byHour.find((r) => r.id === h)?.value ?? 0 }))} />
        </Card>
        <Card title="Plays by day of week">
          <ColumnChart data={['1', '2', '3', '4', '5', '6', '7'].map((d) => ({
            label: segmentLabel('weekday', d), value: byWeekday.find((r) => r.id === d)?.value ?? 0,
          }))} />
        </Card>
        <Card title="Votes by genre">
          <BarList rows={breakdown(data, 'votes', 'genre')} showShare />
        </Card>
        <Card title="Votes by neighborhood">
          <BarList rows={breakdown(data, 'votes', 'area')} showShare />
        </Card>
      </div>
    </>
  );
}

// ── Catalog and artists ──────────────────────────────────────────────────────

export function CatalogTab({ data }) {
  const m = sectionMetrics(data);
  return (
    <>
      {tiles(m.catalog)}
      <div className="mx-grid">
        <Card title="Plays by genre"><BarList rows={breakdown(data, 'plays', 'genre')} showShare /></Card>
        <Card title="Plays by subgenre" note="By each song's main subgenre.">
          <BarList rows={breakdown(data, 'plays', 'subgenre')} showShare />
        </Card>
        <Card title="Plays by mood" note="By each song's main mood.">
          <BarList rows={breakdown(data, 'plays', 'mood')} showShare />
        </Card>
      </div>
    </>
  );
}

// ── Artist economy ───────────────────────────────────────────────────────────

export function EconomyTab({ data, daily }) {
  const m = sectionMetrics(data);
  const { v, list } = indexRows(data?.rows);
  const adSplit = [
    { id: 'unis', label: 'Unis', value: isNum(v('ad_unis_share_cents')) ? v('ad_unis_share_cents') / 100 : null },
    { id: 'artists', label: 'Supported artists', value: isNum(v('ad_artist_share_cents')) ? v('ad_artist_share_cents') / 100 : null },
    { id: 'referrers', label: 'Referrers', value: isNum(v('ad_referrer_share_cents')) ? v('ad_referrer_share_cents') / 100 : null },
  ];
  const mauByArea = Object.fromEntries(list('mau_avg', 'area').map((r) => [r.segmentValue, r]));
  const areaRows = list('net_revenue_cents', 'area').map((r) => {
    const users = mauByArea[r.segmentValue];
    const perUser = isNum(r.value) && isNum(users?.value) && users.value > 0 ? r.value / 100 / users.value : null;
    return [
      segmentLabel('area', r.segmentValue, data?.labels),
      r.suppressed ? hiddenText(r.suppressed) : fmtUsd(r.value / 100),
      users?.suppressed ? hiddenText(users.suppressed) : fmtInt(users?.value),
      perUser == null ? '—' : fmtUsd(perUser),
    ];
  });
  return (
    <>
      {tiles(m.economy)}
      <div className="mx-grid">
        <Card title="Payments by day" note="Completed downloads and support.">
          <TrendLine data={daily.rows.map((d) => ({ ...d, gpv: isNum(d.gpv_cents) ? d.gpv_cents / 100 : null }))}
            series={[{ key: 'gpv', name: 'Gross payments volume' }]} unit="usd" />
        </Card>
        <Card title="Payments split">
          <BarList rows={breakdown(data, 'gpv_cents', 'kind').map((r) => ({ ...r, value: isNum(r.value) ? r.value / 100 : null }))} unit="usd" showShare />
        </Card>
        <Card title="Community Share split" note="Closed months only. Unis is ad and other income left after paying the share; Unis's fees are counted separately.">
          <BarList rows={adSplit} unit="usd" />
        </Card>
        <Card title="Revenue per user by area" note="People 18 and over, or with no birth date.">
          <DataTable columns={['Area', 'Net revenue', 'Average MAU', 'Per user']} rows={areaRows} />
        </Card>
      </div>
    </>
  );
}

// ── Audience ─────────────────────────────────────────────────────────────────

export function AudienceTab({ data }) {
  const labels = data?.labels || {};
  const taste = pairedRows(data, 'taste_plays', 'age_subgenre');
  const tasteMood = pairedRows(data, 'taste_plays', 'age_mood');
  const tasteRows = ADULT_BANDS.filter((b) => taste[b] || tasteMood[b]).map((b) => [
    ageLabel(b),
    topNames(taste[b], (id) => labels.subgenres?.[id] || id),
    topNames(tasteMood[b], (id) => labels.moods?.[id] || id),
  ]);

  // Local charts: choose an area
  const songCharts = pairedRows(data, 'chart_song_plays', 'area_song');
  const areaIds = Object.keys(songCharts);
  const [area, setArea] = useState('');
  const chosen = area && songCharts[area] ? area : areaIds[0] || '';
  const artistCharts = pairedRows(data, 'chart_artist_plays', 'area_artist');
  const subCharts = pairedRows(data, 'chart_subgenre_plays', 'area_subgenre');

  // When people listen: age band rows × hour columns, shaded within each band
  const hourly = pairedRows(data, 'hour_plays', 'age_hour');
  const hours = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
  const heatBands = ADULT_BANDS.filter((b) => hourly[b]);
  const heatCells = heatBands.map((b) => {
    const rows = hourly[b];
    const max = Math.max(...rows.map((r) => (isNum(r.value) ? r.value : 0)), 1);
    return hours.map((h) => {
      const r = rows.find((x) => x.id === h);
      if (!r) return { text: '', shade: null };
      if (r.suppressed) return { text: '·', shade: null };
      return { text: fmtInt(r.value), shade: r.value / max };
    });
  });

  return (
    <>
      <p className="mx-rules">
        Age and gender are shown only as group totals. Any figure about fewer than 10 people is hidden.
        People under 18 appear only in the age headcount below and are left out of every other split.
      </p>
      <div className="mx-grid">
        <Card title="Monthly active users by age">
          <BarList rows={breakdown(data, 'mau', 'age_band', { order: AGE_BANDS, labelFn: ageLabel })} showShare />
        </Card>
        <Card title="Monthly active users by gender" note="18 and over, or with no birth date.">
          <BarList rows={breakdown(data, 'mau', 'gender')} showShare />
        </Card>
        <Card title="Monthly active users by neighborhood" note="18 and over, or with no birth date.">
          <BarList rows={breakdown(data, 'mau', 'area')} showShare />
        </Card>
        <Card title="Plays by language">
          <BarList rows={breakdown(data, 'plays', 'language')} showShare />
        </Card>
        <Card title="Taste by age" note="Top subgenres and moods for each age band, by plays." wide>
          <DataTable columns={['Age', 'Top subgenres', 'Top moods']} rows={tasteRows} />
        </Card>
        <Card title="Local charts" note="What each area plays most. Includes the neighborhoods inside it." wide>
          {areaIds.length === 0 ? <p className="mx-empty">No data for this period yet.</p> : (
            <>
              <label className="mx-select">
                <span>Area</span>
                <select value={chosen} onChange={(e) => setArea(e.target.value)}>
                  {areaIds.map((id) => <option key={id} value={id}>{labels.areas?.[id] || 'Unknown area'}</option>)}
                </select>
              </label>
              <div className="mx-grid mx-grid--3">
                <ChartList title="Top songs" rows={songCharts[chosen]}
                  name={(id) => labels.songs?.[id] ? `${labels.songs[id].title} — ${labels.songs[id].artist}` : 'Unknown song'} />
                <ChartList title="Top artists" rows={artistCharts[chosen]} name={(id) => labels.artists?.[id] || 'Unknown artist'} />
                <ChartList title="Top subgenres" rows={subCharts[chosen]} name={(id) => labels.subgenres?.[id] || id} />
              </div>
            </>
          )}
        </Card>
        <Card title="When people listen" note="Plays by hour (New York time) for each age band, 18 and over. Darker means busier within that band. A dot means fewer than 10 listeners." wide>
          <HeatTable columns={hours.map((h) => hourLabel(h).replace(' ', ''))} rowLabels={heatBands.map(ageLabel)} cells={heatCells} />
        </Card>
        <Card title="Who pays: by age" note="18 and over.">
          <BarList rows={breakdown(data, 'paying_users', 'age_band', { order: ADULT_BANDS, labelFn: ageLabel })} />
        </Card>
        <Card title="Who pays: by gender" note="18 and over.">
          <BarList rows={breakdown(data, 'paying_users', 'gender')} />
        </Card>
        <Card title="Who pays: by neighborhood" note="18 and over.">
          <BarList rows={breakdown(data, 'paying_users', 'area')} />
        </Card>
      </div>
    </>
  );
}

function topNames(rows, nameFn, n = 3) {
  if (!rows) return '—';
  const shown = rows.filter((r) => !r.suppressed).slice(0, n).map((r) => nameFn(r.id));
  return shown.length ? shown.join(', ') : 'fewer than 10 listeners';
}

function ChartList({ title, rows, name }) {
  const visible = (rows || []).filter((r) => !r.suppressed);
  return (
    <div>
      <h4 className="mx-subtitle">{title}</h4>
      {visible.length === 0 ? <p className="mx-empty">Fewer than 10 listeners.</p> : (
        <ol className="mx-ranked">
          {visible.map((r) => <li key={r.id}><span>{name(r.id)}</span><span>{fmtInt(r.value)}</span></li>)}
        </ol>
      )}
    </div>
  );
}

// ── Cohorts ──────────────────────────────────────────────────────────────────

const COHORT_SEGMENTS = [
  { label: 'Everyone', type: 'all', value: 'all' },
  { label: 'Joined with a referral code', type: 'referred', value: 'referred' },
  { label: 'Joined without one', type: 'referred', value: 'not_referred' },
  { label: 'Listeners', type: 'role', value: 'listener' },
  { label: 'Artists', type: 'role', value: 'artist' },
];

export function CohortsTab() {
  const [seg, setSeg] = useState(0);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    setRows(null);
    setError('');
    const s = COHORT_SEGMENTS[seg];
    fetchCohorts(s.type, s.value)
      .then((r) => { if (alive) setRows(r); })
      .catch(() => { if (alive) setError('Could not load cohorts.'); });
    return () => { alive = false; };
  }, [seg]);

  const model = useMemo(() => cohortModel(rows || []), [rows]);

  return (
    <>
      <label className="mx-select">
        <span>Group</span>
        <select value={seg} onChange={(e) => setSeg(Number(e.target.value))}>
          {COHORT_SEGMENTS.map((s, i) => <option key={s.label} value={i}>{s.label}</option>)}
        </select>
      </label>
      {error && <p className="mx-error">{error}</p>}
      {!rows && !error && <p className="mx-empty">Loading…</p>}
      {rows && (
        <div className="mx-grid">
          <Card title="Retention by signup month"
            note="Share of each signup month's members active at least once in each month after. Month 0 is the signup month. Accounts made before launch day belong to the launch month." wide>
            <HeatTable columns={model.columns.map((c) => `M${c}`)} rowLabels={model.rowLabels} cells={model.retention} />
          </Card>
          <Card title="Listening per remaining member" note="Hours in each month, per member still active." wide>
            <HeatTable columns={model.columns.map((c) => `M${c}`)} rowLabels={model.rowLabels} cells={model.listening} />
          </Card>
          <Card title="Money per original member" note="Payments and Unis net revenue per person who joined that month, added up to the latest month." wide>
            <DataTable columns={['Signup month', 'Members', 'Payments per member', 'Net revenue per member']} rows={model.money} />
          </Card>
        </div>
      )}
    </>
  );
}

export function cohortModel(rows) {
  const byCohort = {};
  let maxSince = 0;
  for (const r of rows) {
    (byCohort[r.cohortMonth] = byCohort[r.cohortMonth] || {})[r.monthsSince] = r;
    maxSince = Math.max(maxSince, r.monthsSince);
  }
  const cohorts = Object.keys(byCohort).sort();
  const columns = Array.from({ length: Math.min(maxSince, 12) + 1 }, (_, i) => i);
  const retention = cohorts.map((c) => columns.map((i) => {
    const r = byCohort[c][i];
    if (!r || !r.cohortSize) return { text: '', shade: null };
    const share = r.activeUsers / r.cohortSize;
    return { text: fmtPct(share, 0), shade: share };
  }));
  const perMember = (r) => (r && r.activeUsers ? Number(r.listenHours) / r.activeUsers : null);
  const maxListen = Math.max(0.0001, ...cohorts.flatMap((c) => columns.map((i) => perMember(byCohort[c][i]) || 0)));
  const listening = cohorts.map((c) => columns.map((i) => {
    const per = perMember(byCohort[c][i]);
    if (per == null) return { text: '', shade: null };
    return { text: fmtHours(per), shade: per / maxListen };
  }));
  const money = cohorts.map((c) => {
    const latest = byCohort[c][Math.max(...Object.keys(byCohort[c]).map(Number))];
    const size = latest?.cohortSize || 0;
    return [
      shortMonth(c), fmtInt(size),
      size ? fmtUsd(Number(latest.gpvCents) / 100 / size) : '—',
      size ? fmtUsd(Number(latest.netRevenueCents) / 100 / size) : '—',
    ];
  });
  return { columns, rowLabels: cohorts.map(shortMonth), retention, listening, money };
}

// ── Integrity ────────────────────────────────────────────────────────────────

export function IntegrityTab({ data }) {
  const m = sectionMetrics(data);
  return (
    <>
      {tiles(m.integrity)}
      <p className="mx-rules">
        Suspicious plays are shown for review and are not removed from the other numbers. To leave an account out of
        every metric, open it in User Management and choose “Mark as staff or test account”.
      </p>
    </>
  );
}

