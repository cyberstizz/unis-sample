// Building blocks for the Metrics pages: stat tiles, bar lists, trend lines,
// column charts, tables and heat tables. Colors come from metricsPage.scss
// (dark chart palette, validated for color-vision differences).
import React from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { fmtByUnit, fmtCount, isNum, hiddenText } from './metricsModel';

export const SERIES = ['#3987e5', '#d95926', '#199e70'];   // blue, orange, aqua (dark mode)
const GRID = '#2c2c2a';
const AXIS = '#898781';
const TEXT_2 = '#c3c2b7';

// ── Stat tile ────────────────────────────────────────────────────────────────

export function StatTile({ label, value, unit, sub, change, changeGood = true, trend, hero = false, note }) {
  const shown = isNum(value) ? fmtByUnit(value, unit) : '—';
  const up = isNum(change?.raw) ? change.raw > 0 : null;
  const tone = up == null || change.raw === 0 ? 'flat' : (up === changeGood ? 'good' : 'bad');
  return (
    <div className={`mx-tile${hero ? ' mx-tile--hero' : ''}`}>
      <div className="mx-tile__label">{label}</div>
      <div className="mx-tile__value">{shown}</div>
      {change?.text && (
        <div className={`mx-tile__change mx-tile__change--${tone}`}>
          <span aria-hidden="true">{up == null ? '' : up ? '▲ ' : '▼ '}</span>{change.text}
        </div>
      )}
      {sub && <div className="mx-tile__sub">{sub}</div>}
      {note && <div className="mx-tile__note">{note}</div>}
      {trend && trend.filter((t) => isNum(t.value)).length > 1 && <Sparkline points={trend} unit={unit} />}
    </div>
  );
}

function Sparkline({ points, unit }) {
  const data = points.map((p) => ({ x: p.month, y: isNum(p.value) ? p.value : null }));
  return (
    <div className="mx-spark" aria-hidden="true">
      <ResponsiveContainer width="100%" height={36}>
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <Line type="monotone" dataKey="y" stroke={TEXT_2} strokeWidth={1.5} dot={false} connectNulls isAnimationActive={false} />
          <Tooltip
            cursor={false}
            contentStyle={tooltipStyle}
            formatter={(v) => [fmtByUnit(v, unit), '']}
            labelFormatter={(l) => l}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

const tooltipStyle = {
  background: '#232321', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 8,
  color: '#f0efec', fontSize: 12,
};

// ── Horizontal bar list (plain HTML, value at the bar's tip) ─────────────────

export function BarList({ rows, unit = 'count', showShare = false, emptyText = 'No data for this period yet.' }) {
  if (!rows || rows.length === 0) return <p className="mx-empty">{emptyText}</p>;
  const max = Math.max(...rows.map((r) => (isNum(r.value) ? r.value : 0)), 0);
  return (
    <ul className="mx-bars">
      {rows.map((r) => {
        const pct = isNum(r.value) && max > 0 ? Math.max(1.5, (r.value / max) * 100) : 0;
        const valueText = r.suppressed ? hiddenText(r.suppressed)
          : `${fmtByUnit(r.value, unit)}${showShare && isNum(r.share) ? ` · ${(r.share * 100).toFixed(1)}%` : ''}`;
        return (
          <li key={r.id ?? r.label} className="mx-bars__row">
            <span className="mx-bars__label" title={r.label}>{r.label}</span>
            <span className="mx-bars__track">
              {!r.suppressed && <span className="mx-bars__fill" style={{ width: `${pct}%` }} />}
            </span>
            <span className={`mx-bars__value${r.suppressed ? ' is-hidden' : ''}`}>{valueText}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Trend line (daily series) ────────────────────────────────────────────────

export function TrendLine({ data, series, unit = 'count', height = 220 }) {
  // data: [{ date: '2026-11-21', a: 12, b: 30 }], series: [{ key: 'a', name: 'DAU' }]
  if (!data || data.length === 0) return <p className="mx-empty">No daily numbers for this period yet.</p>;
  return (
    <>
      {series.length > 1 && (
        <div className="mx-legend">
          {series.map((s, i) => (
            <span key={s.key} className="mx-legend__item">
              <span className="mx-legend__line" style={{ background: SERIES[i] }} />{s.name}
            </span>
          ))}
        </div>
      )}
      <div className="mx-chart" style={{ height: height + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="date" stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false}
              tickFormatter={(d) => d.slice(5).replace('-', '/')} minTickGap={24} />
            <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={(v) => (unit === 'usd' ? `$${fmtCount(v)}` : fmtCount(v))} width={48} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [fmtByUnit(v, unit), name]} />
            {series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={SERIES[i]}
                strokeWidth={2} dot={false} activeDot={{ r: 4, stroke: '#1a1a19', strokeWidth: 2 }}
                connectNulls isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <NumbersTable
        columns={['Date', ...series.map((s) => s.name)]}
        rows={data.map((d) => [d.date, ...series.map((s) => fmtByUnit(d[s.key], unit))])}
      />
    </>
  );
}

// ── Column chart (hours, weekdays) ───────────────────────────────────────────

export function ColumnChart({ data, unit = 'count', height = 200 }) {
  // data: [{ label, value }]
  if (!data || data.every((d) => !isNum(d.value))) return <p className="mx-empty">No data for this period yet.</p>;
  return (
    <>
      <div className="mx-chart" style={{ height: height + 28 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="label" stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} interval="preserveStartEnd" />
            <YAxis stroke={AXIS} tick={{ fill: AXIS, fontSize: 11 }} tickLine={false} axisLine={false}
              tickFormatter={(v) => fmtCount(v)} width={44} />
            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={tooltipStyle}
              formatter={(v) => [fmtByUnit(v, unit), 'Plays']} />
            <Bar dataKey="value" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <NumbersTable columns={['', 'Value']} rows={data.map((d) => [d.label, fmtByUnit(d.value, unit)])} />
    </>
  );
}

// ── Tables ───────────────────────────────────────────────────────────────────

/** A collapsed table twin under each chart, so no value depends on hovering. */
export function NumbersTable({ columns, rows }) {
  return (
    <details className="mx-numbers">
      <summary>Show the numbers</summary>
      <DataTable columns={columns} rows={rows} />
    </details>
  );
}

export function DataTable({ columns, rows, emptyText = 'No data for this period yet.' }) {
  if (!rows || rows.length === 0) return <p className="mx-empty">{emptyText}</p>;
  return (
    <div className="mx-table-wrap">
      <table className="mx-table">
        <thead>
          <tr>{columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>{r.map((cell, j) => <td key={j}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A table whose cells are shaded by value (one hue, light to dark), for the
 * cohort table and listening hours. cells: [[{ text, shade 0..1 | null }]].
 */
export function HeatTable({ columns, rowLabels, cells, caption }) {
  if (!cells || cells.length === 0) return <p className="mx-empty">No data yet.</p>;
  return (
    <div className="mx-table-wrap">
      <table className="mx-table mx-heat">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr><th scope="col" /> {columns.map((c, i) => <th key={i} scope="col">{c}</th>)}</tr>
        </thead>
        <tbody>
          {cells.map((row, i) => (
            <tr key={i}>
              <th scope="row">{rowLabels[i]}</th>
              {row.map((cell, j) => (
                <td key={j} style={isNum(cell?.shade) ? { background: shade(cell.shade), color: cell.shade > 0.55 ? '#fff' : '#f0efec' } : undefined}>
                  {cell?.text ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Sequential blue for the dark surface: near-surface at 0, strong blue at 1.
function shade(t) {
  const x = Math.max(0, Math.min(1, t));
  const from = [0x23, 0x2b, 0x38];
  const to = [0x25, 0x6a, 0xbf];
  const c = from.map((f, i) => Math.round(f + (to[i] - f) * x));
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

// ── Card ─────────────────────────────────────────────────────────────────────

export function Card({ title, note, children, wide = false }) {
  return (
    <section className={`mx-card${wide ? ' mx-card--wide' : ''}`}>
      {title && <h3 className="mx-card__title">{title}</h3>}
      {note && <p className="mx-card__note">{note}</p>}
      {children}
    </section>
  );
}
