// Builds the five metrics PDF reports in the browser from the frozen numbers
// the dashboard shows (same data, same calculations in metricsModel.js), so a
// report downloaded twice is identical.
//
//   kpi       Monthly KPI Report
//   audience  Audience Report
//   economy   Artist Economy Report
//   cohorts   Cohorts and Retention Report
//   quarter   Quarterly Investor Pack
import { jsPDF } from 'jspdf';
import {
  headlineKpis, sectionMetrics, breakdown, pairedRows, changeLabel, quarterKpis, quarterOf, quarterMonths,
  previousQuarter, monthLabel, shortMonth, periodLabel, dateLabel, segmentLabel, ageLabel, hourLabel,
  AGE_BANDS, ADULT_BANDS, fmtByUnit, fmtCount, fmtInt, fmtUsd, isNum, hiddenText, indexRows,
} from '../metricsModel';
import { fetchCohorts } from '../metricsApi';
import { cohortModel } from '../MetricsTabs';

const PAGE_W = 612;
const PAGE_H = 792;
const M = 48;                  // margin
const CONTENT_W = PAGE_W - M * 2;
const INK = [17, 17, 17];
const INK_2 = [82, 81, 78];
const MUTED = [137, 135, 129];
const GRID = [225, 224, 217];
const BLUE = [42, 120, 214];   // series slot 1, light surface
const BRAND = [22, 51, 135];

const REPORT_NAMES = {
  kpi: 'Monthly KPI Report',
  audience: 'Audience Report',
  economy: 'Artist Economy Report',
  cohorts: 'Cohorts and Retention Report',
  quarter: 'Quarterly Investor Pack',
};

// Standard PDF fonts only cover Latin-1; swap the few typographic characters we use.
const clean = (s) => String(s ?? '')
  .replace(/[–—−]/g, '-')
  .replace(/[‘’]/g, "'")
  .replace(/[“”]/g, '"')
  .replace(/…/g, '...')
  .replace(/≥/g, '>=')
  .replace(/[▲▼▾]/g, '')
  .replace(/[^\x00-\xFF]/g, '');

// ── A small layout helper over jsPDF ─────────────────────────────────────────

class Report {
  constructor(title, subtitle, meta) {
    this.doc = new jsPDF({ unit: 'pt', format: 'letter' });
    this.title = title;
    this.meta = meta;
    this.y = M;
    this.cover(subtitle);
  }

  cover(subtitle) {
    const d = this.doc;
    d.setFillColor(...BRAND);
    d.rect(0, 0, PAGE_W, 6, 'F');
    d.setFont('helvetica', 'bold');
    d.setFontSize(10);
    d.setTextColor(...MUTED);
    d.text('UNIS MUSIC CORPORATION', M, M);
    d.setFontSize(24);
    d.setTextColor(...INK);
    d.text(clean(this.title), M, M + 30);
    d.setFont('helvetica', 'normal');
    d.setFontSize(14);
    d.setTextColor(...INK_2);
    d.text(clean(subtitle), M, M + 52);
    this.y = M + 72;
    for (const line of this.meta.coverLines) this.small(line);
    this.y += 6;
    this.rule();
  }

  ensure(h) {
    if (this.y + h > PAGE_H - M - 20) {
      this.doc.addPage();
      this.y = M + 10;
    }
  }

  rule() {
    this.doc.setDrawColor(...GRID);
    this.doc.setLineWidth(0.75);
    this.doc.line(M, this.y, PAGE_W - M, this.y);
    this.y += 14;
  }

  newPage() {
    this.doc.addPage();
    this.y = M + 10;
  }

  // Headings reserve room for what follows them, so one never ends a page alone.
  h1(text, keep = 60) {
    this.ensure(30 + keep);
    this.y += 6;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(15);
    this.doc.setTextColor(...INK);
    this.doc.text(clean(text), M, this.y);
    this.y += 18;
  }

  h2(text, keep = 40) {
    this.ensure(16 + keep);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(11);
    this.doc.setTextColor(...INK);
    this.doc.text(clean(text), M, this.y);
    this.y += 14;
  }

  para(text, { size = 10, color = INK_2, gap = 8 } = {}) {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const lines = this.doc.splitTextToSize(clean(text), CONTENT_W);
    for (const line of lines) {
      this.ensure(size + 4);
      this.doc.text(line, M, this.y);
      this.y += size + 3;
    }
    this.y += gap;
  }

  small(text) {
    this.para(text, { size: 9, color: MUTED, gap: 2 });
  }

  bullets(items) {
    for (const item of items) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9.5);
      this.doc.setTextColor(...INK_2);
      const lines = this.doc.splitTextToSize(clean(item), CONTENT_W - 14);
      lines.forEach((line, i) => {
        this.ensure(14);
        if (i === 0) this.doc.text('-', M, this.y);
        this.doc.text(line, M + 12, this.y);
        this.y += 12.5;
      });
    }
    this.y += 6;
  }

  /** columns: [{ title, width (0..1 share), align }] rows: [[cells]] */
  table(columns, rows, { size = 9 } = {}) {
    const d = this.doc;
    const widths = columns.map((c) => c.width * CONTENT_W);
    const lineH = size + 3.5;
    const header = () => {
      this.ensure(lineH * 2);
      d.setFont('helvetica', 'bold');
      d.setFontSize(size - 0.5);
      d.setTextColor(...MUTED);
      let x = M;
      columns.forEach((c, i) => {
        const tx = c.align === 'right' ? x + widths[i] - 4 : x + 4;
        d.text(clean(c.title), tx, this.y, { align: c.align === 'right' ? 'right' : 'left' });
        x += widths[i];
      });
      this.y += 5;
      d.setDrawColor(...GRID);
      d.setLineWidth(0.75);
      d.line(M, this.y, PAGE_W - M, this.y);
      this.y += lineH;
    };
    header();
    d.setFont('helvetica', 'normal');
    for (const row of rows) {
      const wrapped = row.map((cell, i) => d.splitTextToSize(clean(cell), widths[i] - 8));
      const h = Math.max(...wrapped.map((w) => w.length)) * lineH;
      if (this.y + h > PAGE_H - M - 20) {
        d.addPage();
        this.y = M + 10;
        header();
        d.setFont('helvetica', 'normal');
      }
      d.setFontSize(size);
      let x = M;
      wrapped.forEach((lines, i) => {
        const c = columns[i];
        d.setTextColor(...(i === 0 ? INK : INK_2));
        lines.forEach((line, j) => {
          const tx = c.align === 'right' ? x + widths[i] - 4 : x + 4;
          d.text(line, tx, this.y + j * lineH, { align: c.align === 'right' ? 'right' : 'left' });
        });
        x += widths[i];
      });
      this.y += h - lineH + 4;
      d.setDrawColor(240, 239, 236);
      d.line(M, this.y, PAGE_W - M, this.y);
      this.y += lineH;
    }
    this.y += 6;
  }

  /** Horizontal bars with the value at each bar's tip. rows: [{ label, value, text }] */
  bars(rows, { emptyText = 'No data for this period.' } = {}) {
    if (!rows.length) { this.small(emptyText); this.y += 4; return; }
    const d = this.doc;
    const labelW = CONTENT_W * 0.32;
    const valueW = 90;
    const trackW = CONTENT_W - labelW - valueW - 12;
    const max = Math.max(...rows.map((r) => (isNum(r.value) ? r.value : 0)), 0);
    for (const r of rows) {
      this.ensure(16);
      d.setFont('helvetica', 'normal');
      d.setFontSize(9);
      d.setTextColor(...INK_2);
      const label = d.splitTextToSize(clean(r.label), labelW - 6)[0];
      d.text(label, M, this.y);
      if (isNum(r.value) && max > 0) {
        const w = Math.max(2, (r.value / max) * trackW);
        d.setFillColor(...BLUE);
        d.roundedRect(M + labelW, this.y - 8, w, 9, 2, 2, 'F');
      }
      d.setTextColor(...(isNum(r.value) ? INK : MUTED));
      d.text(clean(r.text), PAGE_W - M, this.y, { align: 'right' });
      this.y += 15;
    }
    this.y += 6;
  }

  /** A simple daily line: points [{ x: label, y: number }] */
  line(points, { unit = 'count', height = 120 } = {}) {
    const vals = points.filter((p) => isNum(p.y));
    if (vals.length < 2) { this.small('Not enough days yet for a chart.'); return; }
    this.ensure(height + 30);
    const d = this.doc;
    const left = M + 40;
    const right = PAGE_W - M;
    const top = this.y;
    const bottom = top + height;
    const max = Math.max(...vals.map((p) => p.y)) || 1;
    const niceMax = niceCeil(max);
    // 4 gridlines for 1/2/10 x 10^k tops, 5 for 2.5/5 x 10^k, so every label is a round number.
    const lead = niceMax / 10 ** Math.floor(Math.log10(niceMax));
    const steps = lead === 2.5 || lead === 5 ? 5 : 4;
    const tick = (v) => {
      const n = Number.isInteger(v) ? fmtCount(v) : v.toFixed(v < 1 ? 2 : 1);
      return unit === 'usd' ? `$${n}` : n;
    };
    d.setFontSize(8);
    d.setTextColor(...MUTED);
    d.setDrawColor(...GRID);
    d.setLineWidth(0.5);
    for (let i = 0; i <= steps; i++) {
      const v = (niceMax / steps) * i;
      const yy = bottom - (v / niceMax) * height;
      d.line(left, yy, right, yy);
      d.text(clean(tick(v)), left - 4, yy + 3, { align: 'right' });
    }
    const step = (right - left) / (points.length - 1);
    d.setDrawColor(...BLUE);
    d.setLineWidth(1.6);
    let prev = null;
    points.forEach((p, i) => {
      if (!isNum(p.y)) { prev = null; return; }
      const x = left + i * step;
      const yy = bottom - (p.y / niceMax) * height;
      if (prev) d.line(prev[0], prev[1], x, yy);
      prev = [x, yy];
    });
    d.setTextColor(...MUTED);
    d.text(clean(points[0].x), left, bottom + 12);
    d.text(clean(points[points.length - 1].x), right, bottom + 12, { align: 'right' });
    this.y = bottom + 26;
  }

  finish(fileName) {
    const d = this.doc;
    const pages = d.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
      d.setPage(i);
      d.setFont('helvetica', 'normal');
      d.setFontSize(8);
      d.setTextColor(...MUTED);
      if (i > 1) {
        d.text(clean(`Unis Music Corporation | ${this.title}`), M, M - 18);
      }
      d.text('CONFIDENTIAL', PAGE_W - M, M - 18, { align: 'right' });
      d.text(clean(this.meta.footer), M, PAGE_H - M + 18);
      d.text(`Page ${i} of ${pages}`, PAGE_W - M, PAGE_H - M + 18, { align: 'right' });
    }
    d.save(fileName);
  }
}

function niceCeil(n) {
  if (n <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(n));
  const f = n / p;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * p;
}

// ── Shared pieces ────────────────────────────────────────────────────────────

const STATUS_LINE = {
  closed: 'Official: this month is locked.',
  open: 'Provisional: this month is still open and updates nightly until it locks on the 1st.',
  preview: 'Preview: before launch day. Test activity, not part of the official record.',
  unofficial: 'Unofficial: a custom date range, computed when downloaded.',
};

function metaFor(data, title) {
  const p = data.period;
  const generated = new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
  const frozen = p.closedAt ? `Locked ${fmtTimestamp(p.closedAt)}` : (p.computedAt ? `Numbers as of ${fmtTimestamp(p.computedAt)}` : '');
  const coverLines = [
    STATUS_LINE[p.status] || '',
    [frozen, `Definitions version ${p.definitionsVersion ?? 1}`, `Generated ${generated} (New York time)`].filter(Boolean).join(' | '),
  ];
  if (p.reruns > 0) coverLines.push(`Corrected after locking (${p.reruns}x). Latest reason: ${p.lastRerunReason}`);
  if (p.launchMonth) coverLines.push(`Launch month: the official record starts on ${dateLabel(p.first)}.`);
  return { coverLines, footer: `${title} | ${periodLabel(p)} | definitions v${p.definitionsVersion ?? 1}` };
}

// A date from the API as YYYY-MM-DD, whether it arrives as text or as a number.
const isoDay = (x) => (typeof x === 'number' ? new Date(x).toISOString().slice(0, 10) : String(x ?? '').slice(0, 10));

function fmtTimestamp(ts) {
  const d = new Date(typeof ts === 'number' ? ts : String(ts).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' });
}

const KNOWN_LIMITS = [
  'Ad revenue is an estimate at a modeled $3.50 per 1,000 views until an ad network pays real revenue.',
  'Listening time counts a play without a "play finished" message at its 15-second minimum, so it leans low.',
  'Monthly active users use the 30 days ending on the last day of the period, starting no earlier than launch day.',
  'Staff and test accounts, suspended accounts and closed accounts are left out of every figure.',
  'Figures about fewer than 10 people are hidden; people under 18 appear only as one 13-17 headcount.',
];

function definitionsAppendix(r, definitions, categories, data) {
  r.newPage();
  r.h1('Definitions');
  r.small('Each figure in this report is calculated exactly as defined here. These definitions are stored with the data and versioned.');
  r.y += 4;
  const defs = definitions.filter((d) => categories.includes(d.category));
  r.table(
    [{ title: 'Metric', width: 0.28 }, { title: 'Definition', width: 0.72 }],
    defs.map((d) => [d.name, d.definition + (d.version > 1 && d.change_note ? ` (Changed in version ${d.version}: ${d.change_note})` : '')]),
    { size: 8.5 },
  );
  r.h2('Changes in method');
  const changes = definitions.filter((d) => d.version > 1 && d.change_note);
  const lines = changes.map((d) => `${d.name}: ${d.change_note} (version ${d.version}, from ${dateLabel(isoDay(d.effective_from))})`);
  if (data?.period?.reruns > 0) lines.push(`This period was recomputed after locking: ${data.period.lastRerunReason}`);
  r.bullets(lines.length ? lines : ['None. Every definition is at version 1.']);
  r.h2('Known limits');
  r.bullets(KNOWN_LIMITS);
}

function kpiRows(data, prior) {
  return headlineKpis(data, prior).map((k) => [
    k.name,
    fmtByUnit(k.value, k.unit),
    isNum(k.priorValue) ? fmtByUnit(k.priorValue, k.unit) : '-',
    changeLabel(k, null) || '-',
    k.sub || '',
  ]);
}

function kpiColumns(data, prior) {
  const prevName = prior?.period?.month ? shortMonth(prior.period.month)
    : (data.history?.length > 1 ? shortMonth(data.history[data.history.length - 2].month) : 'Prior month');
  return [
    { title: 'KPI', width: 0.30 },
    { title: data.period.month ? shortMonth(data.period.month) : 'This period', width: 0.15, align: 'right' },
    { title: prevName, width: 0.15, align: 'right' },
    { title: 'Change', width: 0.13, align: 'right' },
    { title: 'Note', width: 0.27 },
  ];
}

const metricRows = (list) => list.map((m) => [m.name, fmtByUnit(m.value, m.unit), m.sub || '']);
const METRIC_COLUMNS = [{ title: 'Metric', width: 0.36 }, { title: 'Value', width: 0.18, align: 'right' }, { title: 'Detail', width: 0.46 }];

function barRows(rows, unit = 'count', withShare = true) {
  return rows.map((b) => ({
    label: b.label,
    value: b.suppressed ? null : b.value,
    text: b.suppressed ? hiddenText(b.suppressed)
      : `${fmtByUnit(b.value, unit)}${withShare && isNum(b.share) ? `  (${(b.share * 100).toFixed(1)}%)` : ''}`,
  }));
}

function trendTable(data) {
  const kpis = headlineKpis(data, null).filter((k) => !k.fromRetention);
  const months = (data.history || []).map((h) => h.month);
  if (months.length < 2) return null;
  const share = 0.64 / months.length;
  return {
    columns: [{ title: 'KPI', width: 0.36 }, ...months.map((m) => ({ title: shortMonth(m), width: share, align: 'right' }))],
    rows: kpis.map((k) => [k.name, ...k.trend.map((t) => fmtByUnit(t.value, k.unit))]),
  };
}

const fileStem = (data) => data.period.month || `${data.period.first}_to_${data.period.last}`;

// ── The reports ──────────────────────────────────────────────────────────────

function kpiReport({ data, prior, daily, definitions }) {
  const title = REPORT_NAMES.kpi;
  const r = new Report(title, periodLabel(data.period), metaFor(data, title));
  r.h1('Headline KPIs');
  r.table(kpiColumns(data, prior), kpiRows(data, prior));
  const trend = trendTable(data);
  if (trend) {
    r.h2('Six-month trend');
    r.table(trend.columns, trend.rows, { size: 8.5 });
  }
  r.h2('Daily active users', 150);
  r.line((daily?.rows || []).map((d) => ({ x: dateLabel(d.date), y: d.dau })));
  const s = sectionMetrics(data);
  r.h1('Growth');
  r.table(METRIC_COLUMNS, metricRows(s.growth));
  const { v } = indexRows(data.rows);
  r.h2('Growth accounting');
  r.table([{ title: 'People active this period', width: 0.7 }, { title: 'Count', width: 0.3, align: 'right' }], [
    ['New (joined this period)', fmtInt(v('ga_new'))],
    ['Retained (also active the period before)', fmtInt(v('ga_retained'))],
    ['Returning (back after a quiet period)', fmtInt(v('ga_returning'))],
    ['Lost (active the period before, not this one)', fmtInt(v('ga_lost'))],
  ]);
  if (data.period.launchMonth) r.small('Launch month: accounts made before launch day show as returning.');
  r.h2('How people signed up');
  r.bars(barRows(breakdown(data, 'signups', 'source')));
  r.h1('Engagement');
  r.table(METRIC_COLUMNS, metricRows(s.engagement));
  r.h2('Daily active users by platform (average per day)');
  r.bars(barRows(breakdown(data, 'dau_avg', 'platform'), 'ratio', false));
  r.h1('Integrity');
  r.table(METRIC_COLUMNS, metricRows(s.integrity));
  definitionsAppendix(r, definitions, ['headline', 'growth', 'engagement', 'integrity'], data);
  r.finish(`Unis-KPI-Report-${fileStem(data)}.pdf`);
}

function audienceReport({ data, definitions }) {
  const title = REPORT_NAMES.audience;
  const r = new Report(title, periodLabel(data.period), metaFor(data, title));
  r.para('Age and gender are shown only as group totals. Any figure about fewer than 10 people is hidden. People under 18 appear only in the age headcount and are left out of every other split. Splits other than age cover people 18 and over and people without a birth date.');
  r.h1('Who is active');
  r.h2('Monthly active users by age');
  r.bars(barRows(breakdown(data, 'mau', 'age_band', { order: AGE_BANDS, labelFn: ageLabel })));
  r.h2('Monthly active users by gender');
  r.bars(barRows(breakdown(data, 'mau', 'gender')));
  r.h2('Monthly active users by neighborhood');
  r.bars(barRows(breakdown(data, 'mau', 'area')));
  const labels = data.labels || {};
  r.h1('Taste');
  const taste = pairedRows(data, 'taste_plays', 'age_subgenre');
  const moods = pairedRows(data, 'taste_plays', 'age_mood');
  const top = (rows, nameFn) => (rows ? rows.filter((x) => !x.suppressed).slice(0, 3).map((x) => nameFn(x.id)).join(', ') || 'fewer than 10 listeners' : '-');
  r.table([{ title: 'Age', width: 0.18 }, { title: 'Top subgenres', width: 0.46 }, { title: 'Top moods', width: 0.36 }],
    ADULT_BANDS.filter((b) => taste[b] || moods[b]).map((b) => [
      ageLabel(b), top(taste[b], (id) => labels.subgenres?.[id] || id), top(moods[b], (id) => labels.moods?.[id] || id),
    ]));
  r.h2('Plays by language');
  r.bars(barRows(breakdown(data, 'plays', 'language')));
  r.h1('Local charts');
  const songs = pairedRows(data, 'chart_song_plays', 'area_song');
  const artists = pairedRows(data, 'chart_artist_plays', 'area_artist');
  const areaIds = Object.keys(songs);
  if (!areaIds.length) r.small('No data for this period.');
  for (const area of areaIds) {
    r.h2(labels.areas?.[area] || 'Unknown area');
    const songList = (songs[area] || []).filter((x) => !x.suppressed).slice(0, 5);
    const artistList = (artists[area] || []).filter((x) => !x.suppressed).slice(0, 5);
    const n = Math.max(songList.length, artistList.length);
    if (!n) { r.small('Fewer than 10 listeners for any single song or artist.'); continue; }
    r.table([{ title: '#', width: 0.06 }, { title: 'Top songs', width: 0.5 }, { title: 'Top artists', width: 0.44 }],
      Array.from({ length: n }, (_, i) => [
        String(i + 1),
        songList[i] ? `${labels.songs?.[songList[i].id]?.title || 'Unknown'} - ${labels.songs?.[songList[i].id]?.artist || ''} (${fmtInt(songList[i].value)} plays)`
          : (i === 0 && !songList.length ? 'Fewer than 10 listeners for any single song' : ''),
        artistList[i] ? `${labels.artists?.[artistList[i].id] || 'Unknown'} (${fmtInt(artistList[i].value)} plays)`
          : (i === 0 && !artistList.length ? 'Fewer than 10 listeners for any single artist' : ''),
      ]), { size: 8.5 });
  }
  r.h1('When people listen');
  const hourly = pairedRows(data, 'hour_plays', 'age_hour');
  r.table([{ title: 'Age', width: 0.2 }, { title: 'Busiest hours (New York time)', width: 0.8 }],
    ADULT_BANDS.filter((b) => hourly[b]).map((b) => {
      const visible = hourly[b].filter((x) => !x.suppressed);
      return [ageLabel(b), visible.length ? visible.slice(0, 3).map((x) => `${hourLabel(x.id)} (${fmtInt(x.value)})`).join(', ') : 'fewer than 10 listeners'];
    }));
  r.h1('Who pays');
  r.h2('By age');
  r.bars(barRows(breakdown(data, 'paying_users', 'age_band', { order: ADULT_BANDS, labelFn: ageLabel })));
  r.h2('By gender');
  r.bars(barRows(breakdown(data, 'paying_users', 'gender')));
  r.h2('By neighborhood');
  r.bars(barRows(breakdown(data, 'paying_users', 'area')));
  definitionsAppendix(r, definitions, ['audience'], data);
  r.finish(`Unis-Audience-Report-${fileStem(data)}.pdf`);
}

function economyReport({ data, daily, definitions }) {
  const title = REPORT_NAMES.economy;
  const r = new Report(title, periodLabel(data.period), metaFor(data, title));
  const s = sectionMetrics(data);
  const { v, list } = indexRows(data.rows);
  r.h1('Money');
  r.table(METRIC_COLUMNS, metricRows(s.economy));
  r.h2('Payments by day', 150);
  r.line((daily?.rows || []).map((d) => ({ x: dateLabel(d.date), y: isNum(d.gpv_cents) ? d.gpv_cents / 100 : null })), { unit: 'usd' });
  r.h2('Payments split');
  r.bars(barRows(breakdown(data, 'gpv_cents', 'kind').map((b) => ({ ...b, value: isNum(b.value) ? b.value / 100 : null })), 'usd'));
  r.h2('Estimated ad revenue split');
  r.bars(barRows([
    { label: 'Unis', value: isNum(v('ad_unis_share_cents')) ? v('ad_unis_share_cents') / 100 : null },
    { label: 'Supported artists', value: isNum(v('ad_artist_share_cents')) ? v('ad_artist_share_cents') / 100 : null },
    { label: 'Referrers', value: isNum(v('ad_referrer_share_cents')) ? v('ad_referrer_share_cents') / 100 : null },
  ], 'usd', false));
  r.h2('Revenue per user by area (18 and over, or no birth date)');
  const mauByArea = Object.fromEntries(list('mau_avg', 'area').map((x) => [x.segmentValue, x]));
  r.table([{ title: 'Area', width: 0.4 }, { title: 'Net revenue', width: 0.2, align: 'right' }, { title: 'Average MAU', width: 0.2, align: 'right' }, { title: 'Per user', width: 0.2, align: 'right' }],
    list('net_revenue_cents', 'area').map((x) => {
      const users = mauByArea[x.segmentValue];
      const per = isNum(x.value) && isNum(users?.value) && users.value > 0 ? x.value / 100 / users.value : null;
      return [segmentLabel('area', x.segmentValue, data.labels), x.suppressed ? hiddenText(x.suppressed) : fmtUsd(x.value / 100),
        users?.suppressed ? hiddenText(users.suppressed) : fmtInt(users?.value), per == null ? '-' : fmtUsd(per)];
    }));
  r.h1('Catalog and artists');
  r.table(METRIC_COLUMNS, metricRows(s.catalog));
  r.h2('Plays by genre');
  r.bars(barRows(breakdown(data, 'plays', 'genre')));
  r.h2('Plays by subgenre');
  r.bars(barRows(breakdown(data, 'plays', 'subgenre')));
  r.h2('Plays by mood');
  r.bars(barRows(breakdown(data, 'plays', 'mood')));
  definitionsAppendix(r, definitions, ['economy', 'catalog'], data);
  r.finish(`Unis-Artist-Economy-Report-${fileStem(data)}.pdf`);
}

async function cohortsReport({ data, definitions }) {
  const title = REPORT_NAMES.cohorts;
  const r = new Report(title, periodLabel(data.period), metaFor(data, title));
  r.para('Each row is a signup month. M0 is the signup month itself; M1 is the next calendar month, and so on. Accounts made before launch day belong to the launch month. The table shows all cohorts through the latest computed month.');
  const segments = [
    ['Everyone', 'all', 'all'], ['Joined with a referral code', 'referred', 'referred'],
    ['Joined without one', 'referred', 'not_referred'], ['Listeners', 'role', 'listener'], ['Artists', 'role', 'artist'],
  ];
  for (const [label, type, value] of segments) {
    const rows = await fetchCohorts(type, value);
    const model = cohortModel(rows || []);
    r.h1(`Retention: ${label}`);
    if (!model.rowLabels.length) { r.small('No cohorts yet.'); continue; }
    const cols = model.columns.slice(0, 13);
    const share = Math.min(0.82 / cols.length, 0.1);
    r.table([{ title: 'Cohort', width: 0.18 }, ...cols.map((c) => ({ title: `M${c}`, width: share, align: 'right' }))],
      model.rowLabels.map((lbl, i) => [lbl, ...cols.map((c, j) => model.retention[i][j]?.text || '')]), { size: 8 });
    if (type === 'all') {
      r.h2('Listening hours per remaining member');
      r.table([{ title: 'Cohort', width: 0.18 }, ...cols.map((c) => ({ title: `M${c}`, width: share, align: 'right' }))],
        model.rowLabels.map((lbl, i) => [lbl, ...cols.map((c, j) => model.listening[i][j]?.text || '')]), { size: 8 });
      r.h2('Money per original member (added up to the latest month)');
      r.table([{ title: 'Signup month', width: 0.25 }, { title: 'Members', width: 0.2, align: 'right' }, { title: 'Payments per member', width: 0.275, align: 'right' }, { title: 'Net revenue per member', width: 0.275, align: 'right' }], model.money);
    }
  }
  const s = sectionMetrics(data);
  r.h1('Activation');
  r.table(METRIC_COLUMNS, metricRows([...s.growth, ...s.catalog].filter((m) => m.name === 'Activation rate' || m.name === 'Artist activation')));
  definitionsAppendix(r, definitions, ['cohorts', 'headline'], data);
  r.finish(`Unis-Cohorts-Report-${fileStem(data)}.pdf`);
}

async function quarterReport({ data, definitions, month, fetchMonth }) {
  const { year, q } = quarterOf(month);
  const months = quarterMonths(year, q);
  const pq = previousQuarter(year, q);
  const prevMonths = quarterMonths(pq.year, pq.q);
  const load = (m) => fetchMonth(m).catch(() => null);
  const [cur, prev] = await Promise.all([Promise.all(months.map(load)), Promise.all(prevMonths.map(load))]);
  const last = [...cur].reverse().find((d) => d?.period?.hasData) || data;
  const title = REPORT_NAMES.quarter;
  const meta = metaFor(last, title);
  const statuses = cur.map((d, i) => `${shortMonth(months[i])}: ${d?.period?.hasData ? d.period.status : 'no data'}`).join(' | ');
  meta.coverLines.unshift(`Months: ${statuses}`);
  meta.footer = `${title} | Q${q} ${year} | definitions v${last.period.definitionsVersion ?? 1}`;
  const r = new Report(title, `Q${q} ${year} (${monthLabel(months[0])} - ${monthLabel(months[2])})`, meta);

  const qk = quarterKpis(cur);
  const pk = quarterKpis(prev);
  r.h1('Headline KPIs');
  r.small('Quarter column: totals for money; the last month for user counts and active artists; the average of the three months for rates and daily figures.');
  r.y += 4;
  r.table([
    { title: 'KPI', width: 0.25 },
    ...months.map((m) => ({ title: shortMonth(m), width: 0.12, align: 'right' })),
    { title: `Q${q}`, width: 0.13, align: 'right' },
    { title: `Q${pq.q} ${String(pq.year).slice(2)}`, width: 0.13, align: 'right' },
    { title: 'QoQ', width: 0.13, align: 'right' },
  ], qk.map((k, i) => {
    const p = pk[i].value;
    let change = '-';
    if (isNum(k.value) && isNum(p)) {
      change = k.unit === 'percent' ? `${((k.value - p) * 100).toFixed(1)} pts` : (p !== 0 ? `${(((k.value - p) / Math.abs(p)) * 100).toFixed(1)}%` : '-');
    }
    return [k.name, ...k.months.map((x) => fmtByUnit(x, k.unit)), fmtByUnit(k.value, k.unit), fmtByUnit(p, k.unit), change];
  }), { size: 8 });

  const s = sectionMetrics(last);
  r.h1(`Detail for ${monthLabel(last.period.month || months[2])}`);
  r.h2('Growth');
  r.table(METRIC_COLUMNS, metricRows(s.growth));
  r.h2('Engagement');
  r.table(METRIC_COLUMNS, metricRows(s.engagement));
  r.h2('Catalog and artists');
  r.table(METRIC_COLUMNS, metricRows(s.catalog));
  r.h2('Artist economy');
  r.table(METRIC_COLUMNS, metricRows(s.economy));
  r.h2('Audience by age');
  r.bars(barRows(breakdown(last, 'mau', 'age_band', { order: AGE_BANDS, labelFn: ageLabel })));
  r.h2('Audience by gender (18 and over, or no birth date)');
  r.bars(barRows(breakdown(last, 'mau', 'gender')));
  r.h2('Integrity');
  r.table(METRIC_COLUMNS, metricRows(s.integrity));

  const rows = await fetchCohorts('all', 'all');
  const model = cohortModel(rows || []);
  r.h1('Retention by signup month');
  if (!model.rowLabels.length) r.small('No cohorts yet.');
  else {
    const cols = model.columns.slice(0, 13);
    const share = Math.min(0.82 / cols.length, 0.1);
    r.table([{ title: 'Cohort', width: 0.18 }, ...cols.map((c) => ({ title: `M${c}`, width: share, align: 'right' }))],
      model.rowLabels.map((lbl, i) => [lbl, ...cols.map((c, j) => model.retention[i][j]?.text || '')]), { size: 8 });
  }
  definitionsAppendix(r, definitions, ['headline', 'growth', 'engagement', 'catalog', 'economy', 'audience', 'cohorts', 'integrity'], last);
  r.finish(`Unis-Quarterly-Investor-Pack-Q${q}-${year}.pdf`);
}

export async function generateReport(id, ctx) {
  switch (id) {
    case 'kpi': return kpiReport(ctx);
    case 'audience': return audienceReport(ctx);
    case 'economy': return economyReport(ctx);
    case 'cohorts': return cohortsReport(ctx);
    case 'quarter': return quarterReport(ctx);
    default: throw new Error(`Unknown report ${id}`);
  }
}
