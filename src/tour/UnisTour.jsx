// src/tour/UnisTour.jsx
// ─────────────────────────────────────────────────────────────
// The welcome tour: a short guided walk through the interface.
//
// How it looks and moves:
//   • A dark veil covers the app with a rounded window cut out of it over
//     the thing being explained. The window, its glowing ring and the coach
//     card all travel between steps on springs (a touch of overshoot, then
//     still), so moving from the header to the feed feels like one camera
//     move instead of a jump cut.
//   • The window follows its target every frame, so scrolling, a resize or
//     content loading in never leaves it pointing at the wrong place.
//   • The card sits next to its target with a small pointer on desktop and
//     docks to the top or bottom edge on phones, away from the target.
//     Its height glides when the copy is longer or shorter, and each step's
//     copy slides in from the direction you're moving.
//   • Bookends: the welcome card shows the wordmark over a soft aura with a
//     little four-bar level meter (the same idea as the launch splash); the
//     finish card draws a check ring and throws a small burst of colour.
//   • Reduced motion: no springs, no burst; things simply appear.
//
// Keys: → / Enter next, ← back, Esc closes. Focus stays inside the card.
// Rendered into #root so it picks up the user's theme colours.
// ─────────────────────────────────────────────────────────────
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../context/AuthContext';
import { TOUR_STEPS, renderTitle } from './tourSteps';
import './unisTour.scss';

const PAD = 8;            // breathing room around the highlighted element
const GAP = 16;           // between the window and the card
const EDGE = 12;          // nearest the card gets to the screen edge
const PHONE_MAX = 640;    // at or below this width the card docks
const SPRING_K = 240;     // stiffness
const SPRING_C = 26;      // damping (a little under critical: a soft settle)
const CLOSE_MS = 340;

const THEMES = ['blue', 'orange', 'red', 'green', 'purple', 'yellow', 'dianna'];

const reducedMotion = () => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const clamp = (v, lo, hi) => Math.min(Math.max(v, lo), Math.max(lo, hi));

function findTarget(step) {
  if (step.kind !== 'spot') return null;
  for (const selector of step.targets || []) {
    const el = document.querySelector(selector);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (r.width < 2 || r.height < 2) continue;
    if (r.right <= 0 || r.left >= window.innerWidth) continue; // e.g. the closed phone drawer
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    return el;
  }
  return null;
}

function holeFor(el) {
  const r = el.getBoundingClientRect();
  const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;
  const w = r.width + PAD * 2;
  const h = r.height + PAD * 2;
  return { x: r.left - PAD, y: r.top - PAD, w, h, r: Math.min(radius + PAD, h / 2, w / 2) };
}

// Where the card goes for a given window. Uses the target's resting
// position (not the moving one) so the card picks a side once and commits.
function placeCard(hole, cw, ch, vw, vh, safe = { top: 0, bottom: 0 }) {
  if (!hole) {
    return { x: (vw - cw) / 2, y: (vh - ch) / 2, side: 'center' };
  }
  if (vw <= PHONE_MAX) {
    const dockTop = hole.y + hole.h / 2 > vh * 0.52;
    return {
      x: (vw - cw) / 2,
      y: dockTop ? EDGE + safe.top : vh - ch - EDGE - safe.bottom,
      side: dockTop ? 'dock-top' : 'dock-bottom',
    };
  }
  const cx = clamp(hole.x + hole.w / 2 - cw / 2, EDGE, vw - cw - EDGE);
  const cy = clamp(hole.y + hole.h / 2 - ch / 2, EDGE, vh - ch - EDGE);
  if (vh - (hole.y + hole.h) - GAP - EDGE >= ch) return { x: cx, y: hole.y + hole.h + GAP, side: 'below' };
  if (hole.y - GAP - EDGE >= ch) return { x: cx, y: hole.y - GAP - ch, side: 'above' };
  if (vw - (hole.x + hole.w) - GAP - EDGE >= cw) return { x: hole.x + hole.w + GAP, y: cy, side: 'right' };
  if (hole.x - GAP - EDGE >= cw) return { x: hole.x - GAP - cw, y: cy, side: 'left' };
  return { x: (vw - cw) / 2, y: vh - ch - EDGE, side: 'center' };
}

// The veil is one element with a rounded hole cut out of it (even-odd path).
function veilPath(vw, vh, h) {
  const outer = `M0 0H${vw}V${vh}H0Z`;
  if (!h || h.w < 1 || h.h < 1) return `path(evenodd, "${outer}")`;
  const r = Math.max(0, Math.min(h.r, h.w / 2, h.h / 2));
  const { x, y, w } = h;
  const hh = h.h;
  const hole = `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}`
    + `V${y + hh - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + hh}`
    + `H${x + r}A${r} ${r} 0 0 1 ${x} ${y + hh - r}`
    + `V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
  return `path(evenodd, "${outer} ${hole}")`;
}

const ArrowRight = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h13M13 6l6 6-6 6" />
  </svg>
);

export default function UnisTour({ isGuest = false, onClose, onAction }) {
  const { theme } = useAuth();
  const steps = TOUR_STEPS;
  const spotSteps = useMemo(() => steps.filter((s) => s.kind === 'spot'), [steps]);

  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [closing, setClosing] = useState(false);
  const [contentH, setContentH] = useState(null);
  const [hasTarget, setHasTarget] = useState(false);

  const step = steps[index];
  const spotNumber = step.kind === 'spot' ? spotSteps.indexOf(step) + 1 : 0;
  const isLastSpot = spotNumber === spotSteps.length;

  const veilRef = useRef(null);
  const ringRef = useRef(null);
  const cardRef = useRef(null);
  const innerRef = useRef(null);
  const primaryRef = useRef(null);
  const targetRef = useRef(null);
  const safeRef = useRef(null);
  const closingRef = useRef(false);
  const reduced = useMemo(reducedMotion, []);

  // Spring state, kept outside React: it changes every frame.
  const sim = useRef({
    hole: null,            // {x,y,w,h,r} on screen right now
    holeV: { x: 0, y: 0, w: 0, h: 0, r: 0 },
    card: null,            // {x,y}
    cardV: { x: 0, y: 0 },
  });

  // ── Close ─────────────────────────────────────────────────
  const close = useCallback((how) => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => onClose?.(how), reduced ? 0 : CLOSE_MS);
  }, [onClose, reduced]);

  const go = useCallback((delta) => {
    setIndex((cur) => {
      const next = clamp(cur + delta, 0, steps.length - 1);
      if (next !== cur) setDir(delta > 0 ? 1 : -1);
      return next;
    });
  }, [steps.length]);

  const next = useCallback(() => {
    if (index >= steps.length - 1) close('finished');
    else go(1);
  }, [index, steps.length, close, go]);

  const back = useCallback(() => go(-1), [go]);

  // ── Each step: find its target, bring it into view ─────────
  useLayoutEffect(() => {
    const el = findTarget(step);
    targetRef.current = el;
    setHasTarget(!!el);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const header = 80;
    const offscreen = r.top < header || r.bottom > window.innerHeight - 40;
    if (offscreen && r.height < window.innerHeight * 0.8) {
      el.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' });
    }
  }, [step, reduced]);

  // Focus the main button on every step (without scrolling the page).
  useEffect(() => {
    const t = setTimeout(() => primaryRef.current?.focus({ preventScroll: true }), 60);
    return () => clearTimeout(t);
  }, [index]);

  // The card's height follows its content, so it can glide between steps.
  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return undefined;
    const measure = () => setContentH(inner.offsetHeight);
    measure();
    if (typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measure);
    ro.observe(inner);
    return () => ro.disconnect();
  }, [index]);

  // Lock page scroll while the tour is open (scrollIntoView still works).
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => { html.style.overflow = prev; };
  }, []);

  // ── Keys + focus trap ─────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      if (closingRef.current) return;
      if (e.key === 'Escape') { e.preventDefault(); close('skipped'); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); next(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); back(); return; }
      if (e.key === 'Tab' && cardRef.current) {
        const items = [...cardRef.current.querySelectorAll('button:not([disabled]), [href]')];
        if (!items.length) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (!cardRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        } else if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close, next, back]);

  // ── The frame loop: springs + painting ────────────────────
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const s = sim.current;

    // iPhone notch / home bar, read once from a probe that uses env().
    const safe = { top: 0, bottom: 0 };
    if (safeRef.current) {
      const cs = getComputedStyle(safeRef.current);
      safe.top = parseFloat(cs.paddingTop) || 0;
      safe.bottom = parseFloat(cs.paddingBottom) || 0;
    }

    const frame = (now) => {
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const card = cardRef.current;
      const el = targetRef.current;

      // Where the window should be: around the target, or shrunk to a point
      // behind the card for the bookends (an iris closing).
      const cw = card ? card.offsetWidth : 0;
      const ch = card ? card.offsetHeight : 0;
      const goal = el && el.isConnected
        ? holeFor(el)
        : { x: vw / 2, y: vh / 2, w: 0, h: 0, r: 0 };
      const place = placeCard(el && el.isConnected ? goal : null, cw, ch, vw, vh, safe);

      if (!s.hole || reduced) {
        s.hole = { ...goal };
        s.card = { x: place.x, y: place.y };
      } else {
        for (const k of ['x', 'y', 'w', 'h', 'r']) {
          const a = SPRING_K * (goal[k] - s.hole[k]) - SPRING_C * s.holeV[k];
          s.holeV[k] += a * dt;
          s.hole[k] += s.holeV[k] * dt;
        }
        for (const k of ['x', 'y']) {
          const a = SPRING_K * (place[k] - s.card[k]) - SPRING_C * s.cardV[k];
          s.cardV[k] += a * dt;
          s.card[k] += s.cardV[k] * dt;
        }
      }

      const h = s.hole;
      if (veilRef.current) {
        veilRef.current.style.clipPath = veilPath(vw, vh, h.w > 1 ? h : null);
      }
      if (ringRef.current) {
        const ring = ringRef.current.style;
        ring.transform = `translate3d(${h.x}px, ${h.y}px, 0)`;
        ring.width = `${Math.max(0, h.w)}px`;
        ring.height = `${Math.max(0, h.h)}px`;
        ring.borderRadius = `${Math.max(0, h.r)}px`;
        ring.opacity = h.w > 12 ? '1' : '0';
      }
      if (card) {
        card.style.transform = `translate3d(${Math.round(s.card.x)}px, ${Math.round(s.card.y)}px, 0)`;
        card.dataset.side = place.side;
        if (place.side === 'below' || place.side === 'above') {
          card.style.setProperty('--caret', `${clamp(h.x + h.w / 2 - s.card.x, 22, cw - 22)}px`);
        } else if (place.side === 'left' || place.side === 'right') {
          card.style.setProperty('--caret', `${clamp(h.y + h.h / 2 - s.card.y, 22, ch - 22)}px`);
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [reduced]);

  // ── Finish burst (decided once) ───────────────────────────
  const particles = useMemo(() => Array.from({ length: 22 }, (_, i) => {
    const angle = (i / 22) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const dist = 64 + Math.random() * 70;
    return {
      tx: `${Math.cos(angle) * dist}px`,
      ty: `${Math.sin(angle) * dist}px`,
      s: (0.5 + Math.random() * 0.9).toFixed(2),
      d: `${Math.round(Math.random() * 120)}ms`,
      tone: i % 3,
    };
  }), []);

  const safeTheme = !isGuest && THEMES.includes(theme) ? theme : 'blue';
  const wordmark = `/brand/splash/wordmark-${safeTheme}.${safeTheme === 'blue' ? 'svg' : 'png'}`;

  const Glyph = step.glyph;
  const kindClass = step.kind === 'spot' && !hasTarget ? 'center' : step.kind;

  // ── Card content ──────────────────────────────────────────
  let content;
  if (step.kind === 'intro') {
    content = (
      <>
        <div className="ut-hero" aria-hidden="true">
          <span className="ut-hero__aura" />
          <img className="ut-hero__word" src={wordmark} alt="" draggable="false" />
        </div>
        <p className="ut-eyebrow ut-eyebrow--center">
          <span className="ut-meter" aria-hidden="true"><i /><i /><i /><i /></span>
          {step.eyebrow}
        </p>
        <h2 id="ut-title" className="ut-title ut-title--xl">{renderTitle(step.title)}</h2>
        <p id="ut-body" className="ut-body ut-body--center">{step.body}</p>
        <div className="ut-actions ut-actions--stack">
          <button ref={primaryRef} type="button" className="ut-btn ut-btn--primary" onClick={next}>
            {step.cta}<ArrowRight />
          </button>
          <button type="button" className="ut-btn ut-btn--text" onClick={() => close('skipped')}>
            {step.secondary}
          </button>
        </div>
      </>
    );
  } else if (step.kind === 'outro') {
    content = (
      <>
        <div className="ut-burst" aria-hidden="true">
          {!reduced && particles.map((p, i) => (
            <i
              key={i}
              className={`ut-burst__bit ut-burst__bit--${p.tone}`}
              style={{ '--tx': p.tx, '--ty': p.ty, '--s': p.s, '--d': p.d }}
            />
          ))}
          <svg className="ut-check" viewBox="0 0 64 64">
            <circle className="ut-check__ring" cx="32" cy="32" r="27" />
            <path className="ut-check__tick" d="M21.5 33l7 7L43 25.5" />
          </svg>
        </div>
        <p className="ut-eyebrow ut-eyebrow--center">{step.eyebrow}</p>
        <h2 id="ut-title" className="ut-title ut-title--xl">{renderTitle(step.title)}</h2>
        <p id="ut-body" className="ut-body ut-body--center">{step.body}</p>
        <div className="ut-actions ut-actions--stack">
          {isGuest ? (
            <>
              <button
                ref={primaryRef}
                type="button"
                className="ut-btn ut-btn--primary"
                onClick={() => { close('finished'); onAction?.('signup'); }}
              >
                {step.guestCta}<ArrowRight />
              </button>
              <button type="button" className="ut-btn ut-btn--text" onClick={() => close('finished')}>
                {step.guestSecondary}
              </button>
            </>
          ) : (
            <button ref={primaryRef} type="button" className="ut-btn ut-btn--primary" onClick={() => close('finished')}>
              {step.cta}<ArrowRight />
            </button>
          )}
        </div>
      </>
    );
  } else {
    content = (
      <>
        <div className="ut-head">
          <span className="ut-badge" aria-hidden="true">
            <span className="ut-badge__halo" />
            {Glyph && <Glyph size={20} tone="on" />}
          </span>
          <span className="ut-eyebrow">
            {step.eyebrow}
            <span className="ut-count">{spotNumber} of {spotSteps.length}</span>
          </span>
          <button type="button" className="ut-skip" onClick={() => close('skipped')}>Skip</button>
        </div>
        <h2 id="ut-title" className="ut-title">{renderTitle(step.title)}</h2>
        <p id="ut-body" className="ut-body">{step.body}</p>
        {isGuest && step.guest && (
          <p className="ut-guest"><span className="ut-guest__dot" />{step.guest}</p>
        )}
        <div className="ut-foot">
          <div className="ut-progress" aria-hidden="true">
            {spotSteps.map((s, i) => (
              <span
                key={s.id}
                className={`ut-progress__seg ${i + 1 < spotNumber ? 'is-done' : ''} ${i + 1 === spotNumber ? 'is-now' : ''}`}
              />
            ))}
          </div>
          <div className="ut-actions">
            <button type="button" className="ut-btn ut-btn--ghost" onClick={back}>Back</button>
            <button ref={primaryRef} type="button" className="ut-btn ut-btn--primary" onClick={next}>
              {isLastSpot ? 'Finish' : 'Next'}<ArrowRight />
            </button>
          </div>
        </div>
      </>
    );
  }

  const plainTitle = String(step.title).replace(/\*/g, '');
  const mount = document.getElementById('root') || document.body;

  return createPortal(
    <div
      className={`ut ut--${kindClass} ${closing ? 'is-closing' : ''} ${reduced ? 'is-reduced' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="ut-title"
      aria-describedby="ut-body"
    >
      <div className="ut-veil" ref={veilRef} />
      <div className="ut-ring" ref={ringRef} aria-hidden="true" />
      <div
        className="ut-card"
        ref={cardRef}
        style={contentH != null ? { height: contentH } : undefined}
      >
        <span className="ut-caret" aria-hidden="true" />
        <div className="ut-card__clip">
          <div className="ut-card__inner" ref={innerRef} key={index} data-dir={dir > 0 ? 'next' : 'prev'}>
            {content}
          </div>
        </div>
      </div>
      <span className="ut-safe" ref={safeRef} aria-hidden="true" />
      <p className="ut-live" aria-live="polite">
        {step.kind === 'spot' ? `Step ${spotNumber} of ${spotSteps.length}: ${plainTitle}` : plainTitle}
      </p>
    </div>,
    mount,
  );
}
