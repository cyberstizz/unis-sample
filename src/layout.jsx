import React from 'react';
import Header from './header';
import Footer from './footer';
import './layout.scss';

// =============================================================================
// Layout//
// `hideFooter` lets full-height app views (e.g. Messages) drop the footer so
// the content can fill the viewport. Defaults to false — every existing caller
// behaves exactly as before.
// =============================================================================

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