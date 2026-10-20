// Turns the raw metric rows from the API into the numbers the dashboard and
// the PDF reports show. Both use this file, so a figure on screen and the same
// figure in a PDF can never disagree.
//
// Raw rows look like { key, segmentType, segmentValue, value, suppressed }.
// Money is stored in cents and time in seconds; this file converts.

// ── Formatting ───────────────────────────────────────────────────────────────

export const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

export function fmtCount(n) {
  if (!isNum(n)) return '—';
  const abs = Math.abs(n);
  if (abs >= 1e6) return `${(n / 1e6).toFixed(abs >= 1e7 ? 0 : 1)}M`;
  if (abs >= 1e4) return `${(n / 1e3).toFixed(abs >= 1e5 ? 0 : 1)}K`;
  return Math.round(n).toLocaleString('en-US');
}
export const fmtInt = (n) => (isNum(n) ? Math.round(n).toLocaleString('en-US') : '—');
export const fmtPct = (n, digits = 1) => (isNum(n) ? `${(n * 100).toFixed(digits)}%` : '—');
export function fmtUsd(n, { cents = true } = {}) {
  if (!isNum(n)) return '—';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (Math.abs(n) >= 1e4) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: cents ? 2 : 0 })}`;
}
export const fmtHours = (n) => (isNum(n) ? `${n.toFixed(n >= 10 ? 0 : 1)} h` : '—');
export const fmtRatio = (n, digits = 1) => (isNum(n) ? n.toFixed(digits) : '—');
export const fmtDays = (n) => (isNum(n) ? `${n.toFixed(1)} days` : '—');

export function fmtByUnit(n, unit) {
  switch (unit) {
    case 'percent': return fmtPct(n);
    case 'usd': return fmtUsd(n);
    case 'hours': return fmtHours(n);
    case 'ratio': return fmtRatio(n);
    case 'days': return fmtDays(n);
    default: return fmtInt(n);
  }
}

export const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

export function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}
export function shortMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${String(y).slice(2)}`;
}
export function dateLabel(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_NAMES[m - 1].slice(0, 3)} ${d}, ${y}`;
}
export function periodLabel(period) {
  if (!period) return '';
  if (period.month && period.first?.endsWith('-01')) return monthLabel(period.month);
  return `${dateLabel(period.first)} – ${dateLabel(period.last)}`;
}

// ── Segment labels ───────────────────────────────────────────────────────────

const PLAIN_LABELS = {
  platform: { web: 'Web', ios: 'iPhone', android: 'Android', unknown: 'Unknown (older app)' },
  role: { listener: 'Listeners', artist: 'Artists', unknown: 'Unknown' },
  gender: { female: 'Female', male: 'Male', 'non-binary': 'Non-binary', not_stated: 'Not stated' },
  age_band: { not_given: 'Not given' },
  source: {
    referral: 'Referral code', waitlist: 'Waitlist', campaign: 'Campaign link', organic: 'On their own',
    unknown: 'Before tracking', feed: 'Feed', 'song-page': 'Song page', playlist: 'Playlist',
    discover: 'Discover', recommended: 'Recommended', player: 'Player', other: 'Other',
    'browse-subgenre': 'Subgenre page', 'browse-mood': 'Mood page',
  },
  kind: { download: 'Downloads', support: 'Direct support' },
  language: { en: 'English', es: 'Spanish', fr: 'French', other: 'Other language', instrumental: 'Instrumental', not_set: 'Not set' },
  weekday: { 1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 7: 'Sun' },
};

/** A readable name for a segment value, using the label maps the API sends. */
export function segmentLabel(segmentType, value, labels = {}) {
  if (value === 'none') return 'No neighborhood';
  if (segmentType === 'area') return labels.areas?.[value] || 'Unknown area';
  if (segmentType === 'subgenre') return value === 'untagged' ? 'Untagged' : (labels.subgenres?.[value] || value);
  if (segmentType === 'mood') return value === 'untagged' ? 'Untagged' : (labels.moods?.[value] || value);
  if (segmentType === 'hour') return hourLabel(value);
  const map = PLAIN_LABELS[segmentType];
  if (map && map[value] != null) return map[value];
  return value;
}

export function hourLabel(h) {
  const n = Number(h);
  if (n === 0) return '12 AM';
  if (n === 12) return '12 PM';
  return n < 12 ? `${n} AM` : `${n - 12} PM`;
}

export const AGE_BANDS = ['13-17', '18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'not_given'];
export const ADULT_BANDS = ['18-24', '25-34', '35-44', '45-54', '55-64', '65+', 'not_given'];
export const ageLabel = (b) => (b === 'not_given' ? 'Not given' : b === '65+' ? '65 and over' : b.replace('-', '–'));

// ── Reading rows ─────────────────────────────────────────────────────────────

/** Fast lookups over a period's rows. */
export function indexRows(rows = []) {
  const byKey = new Map();
  for (const r of rows) {
    const k = `${r.key}|${r.segmentType}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  }
  const get = (key, segmentType = 'all', segmentValue = 'all') => {
    const list = byKey.get(`${key}|${segmentType}`) || [];
    const row = list.find((r) => r.segmentValue === segmentValue);
    return row && isNum(row.value) ? row.value : null;
  };
  const list = (key, segmentType) => byKey.get(`${key}|${segmentType}`) || [];
  return { get, list, v: (key) => get(key) };
}

const ratio = (a, b) => (isNum(a) && isNum(b) && b > 0 ? a / b : null);
const cents = (c) => (isNum(c) ? c / 100 : null);

// ── The 10 headline KPIs ─────────────────────────────────────────────────────
// agg: how a quarter is built from its three months —
//   end: the last month's value; sum: added up; mean: average of the months.

export const HEADLINE = [
  { key: 'mau', name: 'Monthly active users', unit: 'count', agg: 'end', calc: (v) => v('mau') },
  { key: 'dau', name: 'Daily active users', unit: 'count', agg: 'mean', calc: (v) => v('dau_avg'),
    sub: (v) => { const r = ratio(v('dau_avg'), v('mau')); return r == null ? null : `${fmtPct(r)} of MAU each day`; } },
  { key: 'mal', name: 'Monthly active listeners', unit: 'count', agg: 'end', calc: (v) => v('mal') },
  { key: 'listen_hours_per_listener', name: 'Listening hours per listener', unit: 'hours', agg: 'mean',
    calc: (v) => ratio(isNum(v('listen_secs')) ? v('listen_secs') / 3600 : null, v('mal')) },
  { key: 'voting_participation', name: 'Voting participation', unit: 'percent', agg: 'mean',
    calc: (v) => ratio(v('voters_30d'), v('mau')) },
  { key: 'local_listening_share', name: 'Local listening share', unit: 'percent', agg: 'mean',
    calc: (v) => ratio(v('local_plays'), v('plays')) },
  { key: 'active_artists', name: 'Monthly active artists', unit: 'count', agg: 'end', calc: (v) => v('active_artists') },
  { key: 'gpv', name: 'Gross payments volume', unit: 'usd', agg: 'sum', calc: (v) => cents(v('gpv_cents')) },
  { key: 'net_revenue', name: 'Net revenue', unit: 'usd', agg: 'sum', calc: (v) => cents(v('net_revenue_cents')),
    sub: (v) => { const a = ratio(cents(v('net_revenue_cents')), v('mau_avg')); return a == null ? null : `${fmtUsd(a)} per user`; } },
  { key: 'retention_m3', name: 'Month-3 retention', unit: 'percent', agg: 'end', calc: () => null, fromRetention: true },
];

/** Headline values for one period, with the prior period and a trend. */
export function headlineKpis(data, priorData) {
  const idx = indexRows(data?.rows);
  const prior = priorData ? indexRows(priorData.rows) : null;
  const history = data?.history || [];
  return HEADLINE.map((def) => {
    let value = def.calc(idx.v);
    let priorValue = prior ? def.calc(prior.v) : null;
    let sub = def.sub ? def.sub(idx.v) : null;
    if (def.fromRetention) {
      const r = data?.retention;
      value = r && r.cohortSize > 0 ? r.activeUsers / r.cohortSize : null;
      const pr = priorData?.retention;
      priorValue = pr && pr.cohortSize > 0 ? pr.activeUsers / pr.cohortSize : null;
      sub = r ? `People who joined in ${monthLabel(r.cohortMonth)}` : 'Needs three months after launch';
    }
    if (priorValue == null && !def.fromRetention && history.length > 1 && priorData == null) {
      const prev = history[history.length - 2];
      priorValue = def.calc((k) => (isNum(prev?.values?.[k]) ? prev.values[k] : null));
    }
    const trend = def.fromRetention ? [] : history.map((h) => ({
      month: h.month,
      value: def.calc((k) => (isNum(h.values?.[k]) ? h.values[k] : null)),
    }));
    return {
      ...def,
      value,
      priorValue,
      change: isNum(value) && isNum(priorValue)
        ? (def.unit === 'percent' ? value - priorValue : (priorValue !== 0 ? (value - priorValue) / Math.abs(priorValue) : null))
        : null,
      sub,
      trend,
    };
  });
}

/** "+12.0% vs October" or "+1.4 pts vs October". */
export function changeLabel(kpi, priorName) {
  if (!isNum(kpi.change)) return null;
  const sign = kpi.change > 0 ? '+' : kpi.change < 0 ? '−' : '';
  const body = kpi.unit === 'percent'
    ? `${sign}${Math.abs(kpi.change * 100).toFixed(1)} pts`
    : `${sign}${Math.abs(kpi.change * 100).toFixed(1)}%`;
  return priorName ? `${body} vs ${priorName}` : body;
}

// ── Supporting metrics, by section ───────────────────────────────────────────

export function sectionMetrics(data) {
  const { v, get } = indexRows(data?.rows);
  const signups = v('signups');
  const mau = v('mau');
  const plays = v('plays');
  return {
    growth: [
      { name: 'New signups', value: signups, unit: 'count',
        sub: `${fmtInt(get('signups', 'role', 'listener'))} listeners · ${fmtInt(get('signups', 'role', 'artist'))} artists` },
      { name: 'Activation rate', value: ratio(v('activated_signups'), signups), unit: 'percent',
        sub: 'Played or voted within 7 days' },
      { name: 'Referred signups per 100 MAU', value: isNum(ratio(get('signups', 'source', 'referral'), mau)) ? ratio(get('signups', 'source', 'referral'), mau) * 100 : null, unit: 'ratio' },
      { name: 'Quick ratio', value: ratio((v('ga_new') || 0) + (v('ga_returning') || 0), v('ga_lost')), unit: 'ratio',
        sub: '(new + returning) ÷ lost' },
      { name: 'Account closures', value: v('account_closures'), unit: 'count' },
      { name: 'Waitlist signups', value: v('waitlist_signups'), unit: 'count',
        sub: `${fmtInt(v('waitlist_converted'))} waitlist members opened an account` },
    ],
    engagement: [
      { name: 'Counted plays', value: plays, unit: 'count',
        sub: isNum(ratio(plays, v('mal'))) ? `${ratio(plays, v('mal')).toFixed(1)} per active listener` : null },
      { name: 'Completion rate', value: ratio(v('completed_plays'), plays), unit: 'percent', sub: 'Heard to at least 80%' },
      { name: 'Active days per user', value: ratio(v('active_days_total'), v('active_users_period')), unit: 'days' },
      { name: 'Votes', value: v('votes'), unit: 'count',
        sub: isNum(ratio(v('votes'), v('voters_period'))) ? `${ratio(v('votes'), v('voters_period')).toFixed(1)} per voter` : null },
      { name: 'Likes per 1,000 MAU', value: per1000(v('likes'), mau), unit: 'ratio' },
      { name: 'Comments per 1,000 MAU', value: per1000(v('comments'), mau), unit: 'ratio' },
      { name: 'Follows per 1,000 MAU', value: per1000(v('follows'), mau), unit: 'ratio' },
      { name: 'Messages per 1,000 MAU', value: per1000(v('messages'), mau), unit: 'ratio' },
      { name: 'Playlists created', value: v('playlists_created'), unit: 'count',
        sub: `${fmtInt(v('playlist_adds'))} songs added to playlists` },
      { name: 'Plays started from a playlist', value: ratio(get('plays', 'source', 'playlist'), plays), unit: 'percent' },
      { name: 'Logged-out plays', value: v('anon_plays'), unit: 'count',
        sub: `${fmtInt(v('anon_visitors'))} visitors · ${fmtHours(isNum(v('anon_listen_secs')) ? v('anon_listen_secs') / 3600 : null)} heard` },
    ],
    catalog: [
      { name: 'Playable songs', value: v('catalog_songs'), unit: 'count', sub: `${fmtInt(v('uploads'))} new this period` },
      { name: 'Tagged share', value: ratio(v('tagged_songs'), v('catalog_songs')), unit: 'percent', sub: 'Subgenre and mood set' },
      { name: 'Catalog reach', value: ratio(v('songs_played'), v('catalog_songs')), unit: 'percent', sub: 'Songs played at least once' },
      { name: 'Artist concentration', value: isNum(v('artist_concentration')) ? v('artist_concentration') / 100 : null, unit: 'percent',
        sub: 'Plays going to the top 10% of artists' },
      { name: 'Monthly active artists', value: v('active_artists'), unit: 'count' },
      { name: 'New artists', value: v('new_artists'), unit: 'count' },
      { name: 'Artist activation', value: ratio(v('prev_new_artists_activated'), v('prev_new_artists')), unit: 'percent',
        sub: 'Last month’s new artists reaching 10 listeners in 30 days' },
    ],
    economy: [
      { name: 'Gross payments volume', value: cents(v('gpv_cents')), unit: 'usd',
        sub: `${fmtUsd(cents(get('gpv_cents', 'kind', 'download')))} downloads · ${fmtUsd(cents(get('gpv_cents', 'kind', 'support')))} support` },
      { name: 'Net revenue', value: cents(v('net_revenue_cents')), unit: 'usd',
        sub: `${fmtUsd(cents(v('platform_fee_cents')))} fees · ${fmtUsd(cents(v('ad_unis_share_cents')))} ads and other income, less the Community Share` },
      { name: 'Revenue per user', value: ratio(cents(v('net_revenue_cents')), v('mau_avg')), unit: 'usd' },
      { name: 'Take rate', value: ratio(v('platform_fee_cents'), v('gpv_cents')), unit: 'percent' },
      { name: 'Paying fans', value: v('paying_users'), unit: 'count',
        sub: isNum(ratio(v('paying_users'), mau)) ? `${fmtPct(ratio(v('paying_users'), mau))} of MAU` : null },
      { name: 'Average payment', value: ratio(cents(v('gpv_cents')), v('payments')), unit: 'usd' },
      { name: 'Refunded or disputed', value: ratio(v('refunded_payments'), v('payments_made')), unit: 'percent',
        sub: `${fmtUsd(cents(v('refunded_cents')))} of ${fmtUsd(cents(v('payments_made_cents')))}` },
      // Community Share (closed months only). The row keys keep their ad-view-era
      // names: ad_views = counted plays, ad_revenue_cents = ad income received.
      { name: 'Community Share plays', value: v('ad_views'), unit: 'count',
        sub: isNum(ratio(v('ad_views'), mau)) ? `${ratio(v('ad_views'), mau).toFixed(1)} per MAU · ${fmtUsd(cents(v('ad_revenue_cents')))} ad income · closed months` : null },
      { name: 'Artist earnings', value: cents(v('artist_earnings_cents')), unit: 'usd' },
      { name: 'Payouts sent', value: cents(v('payouts_sent_cents')), unit: 'usd',
        sub: `${fmtInt(v('payouts_sent'))} payouts · ${fmtInt(v('payouts_failed'))} failed` },
    ],
    integrity: [
      { name: 'Staff and test accounts left out', value: v('excluded_flagged'), unit: 'count' },
      { name: 'Suspended accounts', value: v('suspended_active'), unit: 'count' },
      { name: 'Closed accounts (all time)', value: v('closed_accounts'), unit: 'count' },
      { name: 'Suspicious plays', value: ratio(v('suspicious_plays'), plays), unit: 'percent',
        sub: `${fmtInt(v('suspicious_plays'))} plays from accounts over 300 in a day` },
      { name: 'DMCA claims received', value: v('dmca_claims'), unit: 'count' },
    ],
  };
}

const per1000 = (n, mau) => (isNum(n) && isNum(mau) && mau > 0 ? (n / mau) * 1000 : null);

// ── Breakdowns ───────────────────────────────────────────────────────────────

/**
 * Rows of one breakdown as { label, value, share, suppressed }, biggest first
 * (or in a fixed order). Hidden rows keep their place and say why.
 */
export function breakdown(data, key, segmentType, { order, labelFn, top } = {}) {
  const { list } = indexRows(data?.rows);
  const rows = list(key, segmentType);
  const total = rows.reduce((s, r) => s + (isNum(r.value) ? r.value : 0), 0);
  let out = rows.map((r) => ({
    id: r.segmentValue,
    label: labelFn ? labelFn(r.segmentValue) : segmentLabel(segmentType, r.segmentValue, data?.labels),
    value: isNum(r.value) ? r.value : null,
    share: isNum(r.value) && total > 0 ? r.value / total : null,
    suppressed: r.suppressed,
  }));
  // A share of only the visible rows would overstate them, so no shares when any row is hidden.
  if (out.some((r) => r.suppressed)) out = out.map((r) => ({ ...r, share: null }));
  if (order) {
    out.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  } else {
    out.sort((a, b) => (b.value ?? -1) - (a.value ?? -1));
  }
  if (top) out = out.slice(0, top);
  return out;
}

/** Text shown for a hidden figure. */
export const hiddenText = (why) => (why === 'complement' ? 'hidden' : 'fewer than 10');

/** Rows for "a|b" segment values, grouped by the part before the bar. */
export function pairedRows(data, key, segmentType) {
  const { list } = indexRows(data?.rows);
  const groups = {};
  for (const r of list(key, segmentType)) {
    const [a, b] = r.segmentValue.split('|');
    (groups[a] = groups[a] || []).push({ id: b, value: r.value, suppressed: r.suppressed });
  }
  for (const g of Object.values(groups)) g.sort((x, y) => (y.value ?? -1) - (x.value ?? -1));
  return groups;
}

// ── Quarters ─────────────────────────────────────────────────────────────────

export function quarterOf(ym) {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, q: Math.floor((m - 1) / 3) + 1 };
}
export function quarterMonths(year, q) {
  return [0, 1, 2].map((i) => `${year}-${String((q - 1) * 3 + 1 + i).padStart(2, '0')}`);
}
export function previousQuarter(year, q) {
  return q === 1 ? { year: year - 1, q: 4 } : { year, q: q - 1 };
}

/** One quarter's headline values from its months' data (missing months are skipped). */
export function quarterKpis(monthsData) {
  const perMonth = monthsData.map((d) => (d && d.period?.hasData ? headlineKpis(d, null) : null));
  return HEADLINE.map((def, i) => {
    const vals = perMonth.map((k) => (k ? k[i].value : null)).filter(isNum);
    let value = null;
    if (vals.length) {
      if (def.agg === 'sum') value = vals.reduce((a, b) => a + b, 0);
      else if (def.agg === 'mean') value = vals.reduce((a, b) => a + b, 0) / vals.length;
      else value = vals[vals.length - 1];
    }
    return { ...def, value, months: perMonth.map((k) => (k ? k[i].value : null)) };
  });
}
