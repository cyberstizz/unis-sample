import React from 'react';
import Header from './header';
import Footer from './footer';
import './layout.scss';

// =============================================================================
// Layout
//
// `hideFooter` lets full-height app views (e.g. Messages) drop the footer so
// the content can fill the viewport. Defaults to false — every existing caller
// behaves exactly as before.
//
// `backgroundImage` is DEPRECATED and intentionally inert. The per-page ambient
// background it once fed was removed by design; the CSS that read it is gone.
// The prop is kept only so the ~17 existing callers don't need editing — it has
// no effect. Do NOT re-wire it to a CSS variable or background: passing this
// prop must remain a no-op.
// =============================================================================

// eslint-disable-next-line no-unused-vars -- backgroundImage kept for caller compatibility; intentionally unused
const Layout = ({ children, backgroundImage, hideFooter = false }) => {
  return (
    <div className="layout-container">
      <Header />

      <main className="layout-content">
        {children}
      </main>

      {!hideFooter && <Footer />}
    </div>
  );
};

export default Layout;