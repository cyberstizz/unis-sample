// src/context/FeedbackContext.jsx
// ─────────────────────────────────────────────────────────────
// Unis feedback — the "it went through" layer.
//
// Every action a user takes gets a visible answer: a toast for success
// ("Playlist created"), a toast for failure ("Couldn't save. Try again."),
// and an in-app dialog instead of the browser's confirm() for anything
// destructive. One provider, one look, every page.
//
//   const feedback = useFeedback();
//   feedback.success('Playlist created');
//   feedback.error(errorMessage(err, "Couldn't create the playlist."));
//   feedback.info('Removed from queue', { action: { label: 'Undo', onClick: undo } });
//   if (await feedback.confirm({ title: 'Delete playlist?', message: '…',
//                                confirmLabel: 'Delete', danger: true })) { … }
//
// RULES (keep every new screen consistent):
//   • Success copy is past tense and names the thing: "Added to Late Night".
//   • Error copy says what failed and what to do: "Couldn't …. Try again."
//     Prefer errorMessage(err, fallback) — it shows the server's own reason
//     for a 4xx (e.g. "That username is taken") and the fallback otherwise.
//   • When the "+N pts" reward pill already fires for an action (play, like,
//     vote), that pill IS the confirmation — don't add a toast on top of it.
//   • Toasts sit at the top of the screen; the reward pill keeps the bottom,
//     so the two never collide.
//
// The provider renders inside #root, so it picks up the user's theme.
// useFeedback() is safe outside the provider (isolated tests): calls become
// no-ops and confirm() falls back to resolving true.
// ─────────────────────────────────────────────────────────────
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import '../feedback.scss';

const FeedbackContext = createContext(null);

const MAX_ON_SCREEN = 3;
const DURATION = { success: 3000, info: 3200, error: 5200 };
const ACTION_DURATION = 5600;
const EXIT_MS = 220;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/**
 * The server's own message for a 4xx response, otherwise `fallback`.
 * 5xx / network errors never leak raw text ("Internal Server Error").
 */
export function errorMessage(error, fallback = 'Something went wrong. Try again.') {
  const status = error?.response?.status;
  const data = error?.response?.data;
  if (status === 429) return 'Slow down a little — try again in a moment.';
  if (!error?.response && error?.request) return "You're offline or the connection dropped. Try again.";
  const message = typeof data === 'string' ? data : data && (data.message || data.error);
  return status && status < 500 && typeof message === 'string' && message.trim() && message.length < 200
    ? message
    : fallback;
}

const NOOP = {
  success: () => null,
  error: () => null,
  info: () => null,
  dismiss: () => {},
  confirm: () => Promise.resolve(true),
};

export const useFeedback = () => useContext(FeedbackContext) || NOOP;

// ── Glyphs (24px grid, 1.8 stroke — same rules as the Glow icon set) ──
const Glyph = ({ kind }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor"
       strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {kind === 'success' && <path d="M5.5 12.4l4.1 4.1 8.9-9" />}
    {kind === 'error' && <path d="M12 7v6.2M12 17.2v.1" />}
    {kind === 'info' && <path d="M12 11v6M12 7.2v.1" />}
  </svg>
);

const CloseGlyph = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
       strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
    <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
  </svg>
);

// ── One toast ────────────────────────────────────────────────
function Toast({ toast, onDismiss }) {
  const timer = useRef(null);
  const remaining = useRef(toast.duration);
  const startedAt = useRef(0);

  const start = useCallback(() => {
    startedAt.current = Date.now();
    clearTimeout(timer.current);
    timer.current = setTimeout(() => onDismiss(toast.id), remaining.current);
  }, [onDismiss, toast.id]);

  const pause = useCallback(() => {
    clearTimeout(timer.current);
    remaining.current = Math.max(900, remaining.current - (Date.now() - startedAt.current));
  }, []);

  // A repeat of the same message restarts the clock (see `bump`).
  useEffect(() => {
    remaining.current = toast.duration;
    start();
    return () => clearTimeout(timer.current);
  }, [toast.bump, toast.duration, start]);

  const isError = toast.kind === 'error';

  return (
    <div
      className={`ufb-toast ufb-toast--${toast.kind} ${toast.leaving ? 'is-leaving' : ''} ${toast.bump ? 'is-bumped' : ''}`}
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
    >
      <span className="ufb-toast__badge"><Glyph kind={toast.kind} /></span>
      <span className="ufb-toast__text">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="ufb-toast__action"
          onClick={() => {
            onDismiss(toast.id);
            toast.action.onClick?.();
          }}
        >
          {toast.action.label}
        </button>
      )}
      {(isError || toast.action) && (
        <button
          type="button"
          className="ufb-toast__close"
          aria-label="Dismiss"
          onClick={() => onDismiss(toast.id)}
        >
          <CloseGlyph />
        </button>
      )}
    </div>
  );
}

// ── Confirm dialog ───────────────────────────────────────────
function ConfirmDialog({ request, onAnswer }) {
  const titleId = useId();
  const textId = useId();
  const cancelRef = useRef(null);
  const confirmRef = useRef(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const returnTo = document.activeElement;
    // Destructive dialogs focus Cancel so a stray Enter can't delete anything.
    (request.danger ? cancelRef : confirmRef).current?.focus();
    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onAnswer(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      returnTo?.focus?.({ preventScroll: true });
    };
  }, [request, onAnswer]);

  return (
    <div
      className="ufb-confirm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onAnswer(false);
      }}
    >
      <div
        className="ufb-confirm__card"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={request.message ? textId : undefined}
      >
        <h3 id={titleId} className="ufb-confirm__title">{request.title}</h3>
        {request.message && <p id={textId} className="ufb-confirm__text">{request.message}</p>}
        <div className="ufb-confirm__actions">
          <button
            ref={cancelRef}
            type="button"
            className="ufb-btn ufb-btn--ghost"
            disabled={busy}
            onClick={() => onAnswer(false)}
          >
            {request.cancelLabel || 'Cancel'}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`ufb-btn ${request.danger ? 'ufb-btn--danger' : 'ufb-btn--primary'}`}
            disabled={busy}
            onClick={() => {
              setBusy(true);
              onAnswer(true);
            }}
          >
            {request.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * The theme name currently on #root, kept in step as the user switches
 * themes (AuthContext writes [data-theme] straight to the DOM, so there is
 * no React state to subscribe to — a MutationObserver is the live view).
 */
function useRootTheme() {
  const read = () =>
    (typeof document !== 'undefined' &&
      document.getElementById('root')?.getAttribute('data-theme')) || null;

  const [theme, setTheme] = useState(read);

  useEffect(() => {
    const root = document.getElementById('root');
    if (!root || typeof MutationObserver === 'undefined') return undefined;
    setTheme(root.getAttribute('data-theme'));
    const observer = new MutationObserver(() => setTheme(root.getAttribute('data-theme')));
    observer.observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);

  return theme;
}

// ── Provider ─────────────────────────────────────────────────
export const FeedbackProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const [confirmQueue, setConfirmQueue] = useState([]);
  const exitTimers = useRef({});

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    clearTimeout(exitTimers.current[id]);
    exitTimers.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      delete exitTimers.current[id];
    }, EXIT_MS);
  }, []);

  useEffect(() => () => Object.values(exitTimers.current).forEach(clearTimeout), []);

  const push = useCallback((kind, message, opts = {}) => {
    if (!message) return null;
    const text = String(message);
    const duration = opts.duration ?? (opts.action ? ACTION_DURATION : DURATION[kind]);
    const id = opts.id || newId();

    setToasts((prev) => {
      // Same message already showing (a double tap, a retried save): refresh
      // it in place instead of stacking a copy.
      const same = prev.find((t) => !t.leaving && (t.id === id || (t.kind === kind && t.message === text)));
      if (same) {
        return prev.map((t) =>
          t.id === same.id ? { ...t, message: text, action: opts.action || null, duration, bump: (t.bump || 0) + 1 } : t
        );
      }
      const next = [...prev.filter((t) => !t.leaving), { id, kind, message: text, action: opts.action || null, duration, bump: 0 }];
      // Oldest goes first when the stack is full.
      return next.slice(-MAX_ON_SCREEN);
    });
    return id;
  }, []);

  const confirm = useCallback(
    (request) =>
      new Promise((resolve) => {
        setConfirmQueue((prev) => [...prev, { ...request, resolve, key: newId() }]);
      }),
    []
  );

  const answer = useCallback((value) => {
    setConfirmQueue((prev) => {
      const [first, ...rest] = prev;
      first?.resolve(value);
      return rest;
    });
  }, []);

  const api = useMemo(
    () => ({
      success: (message, opts) => push('success', message, opts),
      error: (message, opts) => push('error', message, opts),
      info: (message, opts) => push('info', message, opts),
      dismiss,
      confirm,
    }),
    [push, dismiss, confirm]
  );

  const activeConfirm = confirmQueue[0];
  const theme = useRootTheme();

  // The layer goes in <body>, NOT inside #root.
  //
  // unis-design-tokens.scss gives #root `position: relative; z-index: 0`,
  // which makes it a stacking context: anything inside it, at any z-index,
  // is painted below a body-level sibling. Several full-screen overlays
  // (the photo viewer, the broadcast sheet, the date picker) portal to
  // <body> at z-index 3000+, so a toast inside #root would be hidden behind
  // them. In <body> the layer's z-index is compared against theirs and wins.
  //
  // The cost of leaving #root is the theme: [data-theme] lives there, so the
  // colour variables stop resolving. useRootTheme copies the attribute onto
  // the layer, which is enough — theme.scss selects on [data-theme] itself,
  // not on a descendant of #root.
  const layer = (
    <div className="ufb-layer" data-theme={theme || undefined}>
      <div className="ufb-stack">
        {toasts.map((toast) => (
          <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
      {activeConfirm && <ConfirmDialog key={activeConfirm.key} request={activeConfirm} onAnswer={answer} />}
    </div>
  );

  return (
    <FeedbackContext.Provider value={api}>
      {children}
      {typeof document !== 'undefined' ? createPortal(layer, document.body) : layer}
    </FeedbackContext.Provider>
  );
};

export default FeedbackContext;
