// ─────────────────────────────────────────────────────────────────────────────
// lazyWithRetry — React.lazy for page code that lives in its own file (chunk).
//
// Each page now downloads only when someone opens it, instead of the whole app
// (admin pages, PDF export, charts, legal text) arriving with the first page.
//
// The catch with split code: after a deploy, a tab that was opened before it
// still asks for the OLD chunk file names, which no longer exist. The import
// then fails. When that happens we reload the page once, which picks up the
// new index.html and the new chunk names. A flag in sessionStorage stops a
// reload loop if something else is wrong (offline, a real bug): the second
// failure in a row is thrown to the error boundary as before.
// ─────────────────────────────────────────────────────────────────────────────
import { lazy } from 'react';

const RELOAD_FLAG = 'unis:chunk-reload';

export default function lazyWithRetry(importer) {
  return lazy(async () => {
    try {
      const mod = await importer();
      try { sessionStorage.removeItem(RELOAD_FLAG); } catch { /* storage blocked: nothing to clear */ }
      return mod;
    } catch (err) {
      let canReload = false;
      try {
        if (!sessionStorage.getItem(RELOAD_FLAG)) {
          sessionStorage.setItem(RELOAD_FLAG, '1');
          canReload = true;
        }
      } catch {
        canReload = false; // no way to remember the attempt: don't risk a loop
      }
      if (canReload) {
        console.warn('[lazyWithRetry] a page chunk failed to load; reloading once for the new version', err);
        window.location.reload();
        return new Promise(() => {}); // keep the loading state until the reload happens
      }
      throw err;
    }
  });
}
