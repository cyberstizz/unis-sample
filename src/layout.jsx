import React from 'react';
import Header from './header';
import Footer from './footer';
import './layout.scss';

// =============================================================================
// Layout
//
// IMPORTANT: `backgroundImage` is intentionally accepted but UNUSED.
// The global atmospheric gradient (defined in unis-design-tokens.scss on
// body::before) is now the background for every page.
//
// We keep the prop in the signature so existing pages that still pass it
// don't break — they just don't paint anything anymore. Over time you can
// clean those callers up, but there's no rush.
//
// CONTEXTUAL IMAGERY (song page, jurisdiction page, etc.):
//   If a page wants to layer contextual artwork on top of the gradient
//   (faded album art, neighborhood photo, etc.), render this inside the
//   page's component, NOT here:
//
//     <div className="unis-context-bg" style={{ backgroundImage: `url(${art})` }} />
//
//   The .unis-context-bg helper class is defined in unis-design-tokens.scss.
//   It already handles low opacity, blur, and a fade-to-bg gradient mask.
// =============================================================================

const Layout = ({ children, backgroundImage }) => {
  // backgroundImage is intentionally ignored — kept in signature for
  // backwards compatibility only. See note above.

  return (
    <div className="layout-container">
      <Header />

      <main className="layout-content">
        {children}
      </main>

      <Footer />
    </div>
  );
};

export default Layout;