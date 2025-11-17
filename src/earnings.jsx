import React from 'react';
import Layout from './layout'; 
import backimage from './assets/randomrapper.jpeg'; 
import './earnings.scss';

const Earnings = () => {
  return (
    <Layout backgroundImage={backimage}>
      <div className="earnings-page-container">
        <header className="earningsheader">
          <h1>Your Earnings</h1>
        </header>

        <main className="content-wrapper">
          <section className="graph-section">
            <div className="coming-soon-placeholder">
              <h2>Earnings Breakdown Coming Soon!</h2>
              <p>We're excited to launch detailed insights on your earnings from ad plays and views of your referred artists. You'll get a full breakdown of your percentage shares right here.</p>
              <p>Stay tuned—launching soon after production!</p>
            </div>
          </section>

          <section className="info-box">
            <div className="coming-soon-bar">
              <p>👉 <strong>Earnings tracking will appear here</strong> once live—track your growth and cash out your share!</p>
            </div>
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default Earnings;