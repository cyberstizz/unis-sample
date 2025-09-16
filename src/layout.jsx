import React from 'react';
import Header from './header'; 
import './layout.scss'; 

const Layout = ({ children, backgroundImage }) => {
  return (
    <div className="layout-container" style={{ '--background-image': `url(${backgroundImage})` }}>
      <Header />
      <main className="layout-content">
        {children}
      </main>
    </div>
  );
};

export default Layout;