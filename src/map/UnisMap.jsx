import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { US_STATES } from './geometry/usStates.js';
import {
  geometryToPath,
  pathBounds,
  pathAnchor,
  unionBounds,
  padBounds,
  isEmptyBounds,
  cameraForBounds,
  cameraToTransform,
  interpolateCamera,
  easeInOutSine,
  EMPTY_BOUNDS,
} from './geo.js';
import './unisMap.scss';

/**
 * UnisMap — the Unis territory map.
 *
 * Replaces leaflet + react-leaflet + react-simple-maps + topojson-client with
 * one SVG element and a camera. No tiles, no API keys, no attribution, no
 * per-request cost, and nothing on the network at render time.
 *
 * HOW IT WORKS
 * ------------
 * Everything lives in one coordinate system ("world space"), defined by
 * albersUsa.js. State outlines are baked into that space at build time;
 * jurisdiction polygons from Postgres are projected into it on arrival. A
 * single <g> holds all of it, and zooming is nothing more than changing that
 * group's transform.
 *
 * The camera is [centerX, centerY, viewportWidthInWorldUnits]. Moving between
 * two cameras uses interpolateCamera (Van Wijk), which is what makes the
 * 3,600x flight from the whole country down to one Harlem block read as
 * continuous motion rather than a cut.
 *
 * PERFORMANCE
 * -----------
 * The animation loop never touches React. It writes transforms straight to
 * the DOM through refs, so a flight costs zero renders and zero reconciliation
 * regardless of how many polygons are on screen. React is only involved when
 * the *set* of things to draw changes.
 */

/* -------------------------------------------------------------------------
 * Precomputed once at module load: bounds and label anchors for every state.
 * 51 shoelace passes, run one time, reused for the life of the tab.
 * ---------------------------------------------------------------------- */
const STATE_INDEX = US_STATES.map((s) => ({
  name: s.name,
  d: s.d,
  bounds: pathBounds(s.d),
  anchor: pathAnchor(s.d),
}));

const STATE_BY_NAME = Object.fromEntries(STATE_INDEX.map((s) => [s.name, s]));
const US_BOUNDS = padBounds(unionBounds(STATE_INDEX.map((s) => s.bounds)), 0.015);

/** Below this camera width, the country layer is culled — see cull note below. */
const NATIONAL_CULL_WIDTH = 60;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;

export default function UnisMap({
  mode = 'US',
  focusState = null,
  territories = [],
  selectedId = null,
  liveStates = [],
  liveTerritories = [],
  onStateSelect,
  onTerritorySelect,
  loading = false,
}) {
  const frameRef = useRef(null);
  const worldRef = useRef(null);
  const overlayRef = useRef(null);
  const rafRef = useRef(0);
  const cameraRef = useRef(null);
  const labelRefs = useRef(new Map());

  const [size, setSize] = useState({ w: 960, h: 560 });
  const [hovered, setHovered] = useState(null);
  // Camera width, which drives culling. Starts wide so the first paint shows
  // the country instead of flashing an empty frame before the camera settles.
  const [depth, setDepth] = useState(Number.POSITIVE_INFINITY);
  const nationVisibleRef = useRef(true);

  const liveStateSet = useMemo(() => new Set(liveStates), [liveStates]);
  const liveTerritorySet = useMemo(() => new Set(liveTerritories), [liveTerritories]);

  /* ---------------------------------------------------------------- sizing */
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (!el) return undefined;

    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height) setSize({ w: r.width, h: r.height });
    };
    measure();

    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ------------------------------------------------------- territory paths */
  const territoryShapes = useMemo(() => {
    const out = [];
    for (const t of territories) {
      const d = geometryToPath(t.polygon);
      if (!d) continue;
      out.push({
        id: t.jurisdictionId,
        name: t.name,
        raw: t,
        d,
        bounds: pathBounds(d),
        anchor: pathAnchor(d),
        live: liveTerritorySet.has(t.name),
      });
    }
    return out;
  }, [territories, liveTerritorySet]);

  /** Territories the API returned with no usable polygon. Surfaced, not hidden. */
  const missingGeometry = useMemo(
    () => territories.filter((t) => !geometryToPath(t.polygon)).map((t) => t.name),
    [territories]
  );

  /* ------------------------------------------------------------ target cam */
  const targetCamera = useMemo(() => {
    const { w, h } = size;

    if (mode === 'TERRITORY' && territoryShapes.length) {
      const sel = selectedId && territoryShapes.find((t) => t.id === selectedId);
      const b = sel ? sel.bounds : unionBounds(territoryShapes.map((t) => t.bounds));
      if (!isEmptyBounds(b)) return cameraForBounds(padBounds(b, 0.22), w, h, 0.06);
    }

    if (mode === 'STATE' && focusState && STATE_BY_NAME[focusState]) {
      return cameraForBounds(padBounds(STATE_BY_NAME[focusState].bounds, 0.1), w, h, 0.07);
    }

    return cameraForBounds(US_BOUNDS, w, h, 0.03);
  }, [mode, focusState, territoryShapes, selectedId, size]);

  /* ------------------------------------------------------- the camera loop */
  const paint = useCallback(
    (camera) => {
      const { w, h } = size;
      const { k, tx, ty } = cameraToTransform(camera, w, h);

      if (worldRef.current) {
        worldRef.current.setAttribute('transform', `translate(${tx} ${ty}) scale(${k})`);
      }

      // Screen-space overlay: labels and live pulses are positioned in pixels
      // so they never inherit the camera's scale. A label at 3,600x zoom would
      // otherwise be the size of a building.
      labelRefs.current.forEach((node) => {
        if (!node) return;
        const a = node.__anchor;
        if (!a) return;
        const x = a.x * k + tx;
        const y = a.y * k + ty;
        const off = x < -80 || y < -60 || x > w + 80 || y > h + 60;
        node.style.transform = `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0) translate(-50%, -50%)`;
        node.style.visibility = off ? 'hidden' : 'visible';
      });
    },
    [size]
  );

  useEffect(() => {
    if (!size.w || !size.h) return undefined;

    const from = cameraRef.current;
    const to = targetCamera;

    // First paint, or reduced motion: snap.
    if (!from || prefersReducedMotion()) {
      cameraRef.current = to;
      nationVisibleRef.current = to[2] > NATIONAL_CULL_WIDTH;
      setDepth(to[2]);
      paint(to);
      return undefined;
    }

    const interp = interpolateCamera(from, to);
    if (!Number.isFinite(interp.duration) || interp.duration <= 0) {
      cameraRef.current = to;
      nationVisibleRef.current = to[2] > NATIONAL_CULL_WIDTH;
      setDepth(to[2]);
      paint(to);
      return undefined;
    }

    const start = performance.now();
    cancelAnimationFrame(rafRef.current);

    const step = (now) => {
      const t = Math.min((now - start) / interp.duration, 1);
      const cam = interp(easeInOutSine(t));
      cameraRef.current = cam;
      paint(cam);

      // Drop the country layer at the moment the camera crosses the threshold
      // rather than on arrival. Diving to Harlem pushes distant states past
      // +/- 3,000,000 user units mid-flight, which is where rasterizers start
      // producing artifacts. One state update per flight, at the crossing.
      const wantNation = cam[2] > NATIONAL_CULL_WIDTH;
      if (wantNation !== nationVisibleRef.current) {
        nationVisibleRef.current = wantNation;
        setDepth(cam[2]);
      }

      if (t < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        cameraRef.current = to;
        paint(to);
        nationVisibleRef.current = to[2] > NATIONAL_CULL_WIDTH;
        setDepth(to[2]);
      }
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [targetCamera, size, paint]);

  // Repaint on resize without animating.
  useEffect(() => {
    if (cameraRef.current) paint(cameraRef.current);
  }, [size, paint]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  /* ------------------------------------------------------------- rendering */
  /**
   * Cull the 51-state layer once the camera is tight enough that they're all
   * off-screen anyway. This is not only a paint saving: at Harlem zoom the
   * transform pushes distant states to coordinates near +/- 3,000,000, which is
   * where browser rasterizers start producing artifacts. Removing them keeps
   * the deep-zoom view exact.
   */
  const showNation = depth > NATIONAL_CULL_WIDTH;
  const showTerritories =
    (mode === 'STATE' || mode === 'TERRITORY') && territoryShapes.length > 0;

  const registerLabel = (key, anchor) => (node) => {
    if (node) {
      node.__anchor = anchor;
      labelRefs.current.set(key, node);
      if (cameraRef.current) paint(cameraRef.current);
    } else {
      labelRefs.current.delete(key);
    }
  };

  const handleStateKey = (e, name) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onStateSelect?.(name);
    }
  };

  const handleTerritoryKey = (e, t) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onTerritorySelect?.(t.raw);
    }
  };

  return (
    <div className="unis-map" ref={frameRef} data-mode={mode}>
      <svg
        className="unis-map__canvas"
        width="100%"
        height="100%"
        role="group"
        aria-label={
          mode === 'US'
            ? 'Map of the United States. New York is live on Unis.'
            : `Map of ${focusState || 'the selected region'}`
        }
      >
        <defs>
          {/* Soft bloom under live territory fills. One filter, reused. */}
          <filter id="unis-map-bloom" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="2.2" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g ref={worldRef}>
          {showNation && (
            <g className="unis-map__nation">
              {STATE_INDEX.map((s) => {
                const live = liveStateSet.has(s.name);
                const isFocus = focusState === s.name;
                return (
                  <path
                    key={s.name}
                    d={s.d}
                    className="unis-map__state"
                    data-live={live || undefined}
                    data-focus={isFocus || undefined}
                    data-hover={hovered === s.name || undefined}
                    vectorEffect="non-scaling-stroke"
                    filter={live ? 'url(#unis-map-bloom)' : undefined}
                    tabIndex={live ? 0 : -1}
                    role="button"
                    aria-label={live ? `${s.name}, live on Unis` : `${s.name}, coming soon`}
                    onClick={() => onStateSelect?.(s.name)}
                    onKeyDown={(e) => handleStateKey(e, s.name)}
                    onMouseEnter={() => setHovered(s.name)}
                    onMouseLeave={() => setHovered(null)}
                  />
                );
              })}
            </g>
          )}

          {/* At deep zoom the parent state stays as a horizon line, so the
              territories read as sitting inside somewhere real. */}
          {!showNation && focusState && STATE_BY_NAME[focusState] && (
            <path
              className="unis-map__horizon"
              d={STATE_BY_NAME[focusState].d}
              vectorEffect="non-scaling-stroke"
            />
          )}

          {showTerritories && (
            <g className="unis-map__territories">
              {territoryShapes.map((t) => (
                <path
                  key={t.id}
                  d={t.d}
                  className="unis-map__territory"
                  data-live={t.live || undefined}
                  data-selected={selectedId === t.id || undefined}
                  data-hover={hovered === t.name || undefined}
                  vectorEffect="non-scaling-stroke"
                  tabIndex={0}
                  role="button"
                  aria-label={t.name}
                  onClick={() => onTerritorySelect?.(t.raw)}
                  onKeyDown={(e) => handleTerritoryKey(e, t)}
                  onMouseEnter={() => setHovered(t.name)}
                  onMouseLeave={() => setHovered(null)}
                />
              ))}
            </g>
          )}
        </g>
      </svg>

      {/* ------------------------------------------------------- overlay --- */}
      <div className="unis-map__overlay" ref={overlayRef} aria-hidden="true">
        {showNation &&
          STATE_INDEX.filter((s) => liveStateSet.has(s.name) && s.anchor).map((s) => (
            <span
              key={`pulse-${s.name}`}
              className="unis-map__signal"
              ref={registerLabel(`pulse-${s.name}`, s.anchor)}
            >
              <span className="unis-map__signal-ring" />
              <span className="unis-map__signal-core" />
            </span>
          ))}

        {showTerritories &&
          territoryShapes
            .filter((t) => t.anchor)
            .map((t) => (
              <span
                key={`label-${t.id}`}
                className="unis-map__label"
                data-live={t.live || undefined}
                data-selected={selectedId === t.id || undefined}
                ref={registerLabel(`label-${t.id}`, t.anchor)}
              >
                {t.name}
              </span>
            ))}
      </div>

      {/* Territories the backend returned without geometry. Saying so beats
          drawing nothing and letting it look like a rendering bug. */}
      {showTerritories && missingGeometry.length > 0 && (
        <p className="unis-map__gap" role="status">
          {missingGeometry.length === 1
            ? `${missingGeometry[0]} has no boundary yet`
            : `${missingGeometry.length} regions have no boundary yet`}
        </p>
      )}

      {loading && <div className="unis-map__scan" aria-hidden="true" />}
    </div>
  );
}