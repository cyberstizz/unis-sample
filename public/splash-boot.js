/*
 * splash-boot.js: runs before the first paint (a plain <script> in <head>).
 *
 * The launch splash (#unis-splash in index.html, styled by /splash.css) is
 * on screen before React exists. This file makes its first frame correct:
 *
 *   1. Theme: a signed-in visitor's splash plays in their own colour, read
 *      from the same localStorage keys AuthContext uses ('token' +
 *      'unis-theme'). Guests always get blue, matching the header.
 *   2. Quick mode: the full intro plays once per browser session. A reload in
 *      the same session gets the short version (the logo is already lit).
 *
 * It lives in its own file, not inline in index.html, because the site's
 * Content-Security-Policy forbids inline scripts.
 * src/boot/bootSplash.js takes over once React loads and decides when the
 * splash leaves.
 */
(function () {
  var THEMES = ['blue', 'orange', 'red', 'green', 'purple', 'yellow', 'dianna'];
  var root = document.documentElement;
  var theme = 'blue';
  try {
    if (localStorage.getItem('token')) {
      var cached = localStorage.getItem('unis-theme');
      if (THEMES.indexOf(cached) !== -1) theme = cached;
    }
    if (sessionStorage.getItem('unis-splash-seen')) root.classList.add('splash-quick');
  } catch (e) {
    /* storage blocked (private mode): blue, full intro */
  }
  root.setAttribute('data-splash-theme', theme);
})();
