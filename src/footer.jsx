import React from 'react';
import { Link } from 'react-router-dom'; 
import './footer.scss';

const Footer = () => {
  return (
    <footer className="layout-footer">
      <div className="footer-links">
        <Link to="/privacy">Privacy Policy</Link>
        <span className="footer-separator">|</span>
        <Link to="/terms">Terms of Use</Link>
        <span className="footer-separator">|</span>
        <Link to="/cookie">Cookie Policy</Link>
        <span className="footer-separator">|</span>
        <Link to="/report">Report Infringement</Link>
      </div>
      <div className="footer-copyright">
        © {new Date().getFullYear()} Unis. All rights reserved.
      </div>
    </footer>
  );
};

export default Footer;