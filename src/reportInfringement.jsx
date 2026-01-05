import React, { useState } from 'react';
import Layout from './layout';
import './reportInfringement.scss';
import backimage from './assets/randomrapper.jpeg';
import './reportInfringement.scss'

const ReportInfringement = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phoneNumber: '',
    companyName: '',
    copyrightOwner: '',
    workDescription: '',
    infringingUrl: '',
    originalWorkUrl: '',
    goodFaithStatement: false,
    accuracyStatement: false,
    authorizedStatement: false,
    signature: '',
    date: new Date().toISOString().split('T')[0]
  });

  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate all checkboxes are checked
    if (!formData.goodFaithStatement || !formData.accuracyStatement || !formData.authorizedStatement) {
      alert('Please check all required statements to submit your DMCA notice.');
      return;
    }

    // In production, this would send to your backend
    console.log('DMCA Notice Submitted:', formData);
    
    // Simulate sending email to dmca@unis.com
    alert('Your DMCA notice has been submitted. We will review it within 24-48 hours and take appropriate action.');
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <Layout backgroundImage={backimage}>
        <div className="report-container">
          <div className="report-content">
            <div className="success-message">
              <h1>✓ DMCA Notice Submitted</h1>
              <p>
                Thank you for submitting your copyright infringement notice. We take intellectual property rights 
                seriously and will review your claim within 24-48 hours.
              </p>
              <p>
                You will receive a confirmation email at <strong>{formData.email}</strong> with next steps.
              </p>
              <p className="reference-note">
                Reference Number: DMCA-{Date.now().toString(36).toUpperCase()}
              </p>
              <button onClick={() => window.location.href = '/'} className="btn-primary">
                Return to Home
              </button>
            </div>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout backgroundImage={backimage}>
      <div className="report-container">
        <div className="report-content">
          
          <header className="report-header">
            <h1>Report Copyright Infringement</h1>
            <p className="subtitle">DMCA Takedown Notice</p>
          </header>

          <section className="report-intro">
            <p>
              Unis respects the intellectual property rights of others and expects users to do the same. If you believe 
              that your copyrighted work has been uploaded to Unis without authorization, you may submit a DMCA takedown 
              notice using the form below.
            </p>
            <p className="warning">
              <strong>⚠️ Warning:</strong> Filing a false or fraudulent DMCA notice may result in legal consequences, 
              including liability for damages, costs, and attorney fees under 17 U.S.C. § 512(f). Only submit this form 
              if you are the copyright owner or authorized to act on their behalf.
            </p>
          </section>

          <section className="dmca-requirements">
            <h2>DMCA Requirements (17 U.S.C. § 512)</h2>
            <p>Your notice must include:</p>
            <ol>
              <li>Identification of the copyrighted work claimed to have been infringed</li>
              <li>Identification of the infringing material and its location on Unis</li>
              <li>Your contact information (name, address, phone, email)</li>
              <li>A statement of good faith belief that the use is not authorized</li>
              <li>A statement that the information is accurate and you are authorized to act</li>
              <li>Your physical or electronic signature</li>
            </ol>
          </section>

          <form onSubmit={handleSubmit} className="dmca-form">
            
            <div className="form-section">
              <h3>1. Your Contact Information</h3>
              
              <div className="form-group">
                <label htmlFor="fullName">Full Legal Name *</label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                />
              </div>

              <div className="form-group">
                <label htmlFor="email">Email Address *</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  placeholder="you@example.com"
                />
              </div>

              <div className="form-group">
                <label htmlFor="phoneNumber">Phone Number *</label>
                <input
                  type="tel"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  required
                  placeholder="(555) 123-4567"
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyName">Company/Organization (if applicable)</label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Example Records LLC"
                />
              </div>
            </div>

            <div className="form-section">
              <h3>2. Copyright Ownership</h3>
              
              <div className="form-group">
                <label htmlFor="copyrightOwner">
                  Are you the copyright owner, or authorized to act on their behalf? *
                </label>
                <select
                  id="copyrightOwner"
                  name="copyrightOwner"
                  value={formData.copyrightOwner}
                  onChange={handleChange}
                  required
                >
                  <option value="">-- Select --</option>
                  <option value="owner">I am the copyright owner</option>
                  <option value="agent">I am authorized to act on behalf of the copyright owner</option>
                </select>
              </div>
            </div>

            <div className="form-section">
              <h3>3. Copyrighted Work</h3>
              
              <div className="form-group">
                <label htmlFor="workDescription">
                  Describe the copyrighted work (song title, album, artist) *
                </label>
                <textarea
                  id="workDescription"
                  name="workDescription"
                  value={formData.workDescription}
                  onChange={handleChange}
                  required
                  rows="4"
                  placeholder='e.g., "Summer Nights" by Jane Doe, released on the album "Moonlight Dreams" (2024)'
                />
              </div>

              <div className="form-group">
                <label htmlFor="originalWorkUrl">
                  Link to original work (Spotify, Apple Music, official website, etc.)
                </label>
                <input
                  type="url"
                  id="originalWorkUrl"
                  name="originalWorkUrl"
                  value={formData.originalWorkUrl}
                  onChange={handleChange}
                  placeholder="https://open.spotify.com/track/..."
                />
              </div>
            </div>

            <div className="form-section">
              <h3>4. Infringing Material on Unis</h3>
              
              <div className="form-group">
                <label htmlFor="infringingUrl">
                  URL of infringing content on Unis (song page, artist page, etc.) *
                </label>
                <input
                  type="url"
                  id="infringingUrl"
                  name="infringingUrl"
                  value={formData.infringingUrl}
                  onChange={handleChange}
                  required
                  placeholder="https://unis.com/song/12345"
                />
                <small>Right-click the infringing song/page and copy the URL</small>
              </div>
            </div>

            <div className="form-section">
              <h3>5. Statements (Required by Law)</h3>
              
              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="goodFaithStatement"
                    checked={formData.goodFaithStatement}
                    onChange={handleChange}
                    required
                  />
                  <span>
                    I have a good faith belief that the use of the material in the manner complained of is not 
                    authorized by the copyright owner, its agent, or the law.
                  </span>
                </label>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="accuracyStatement"
                    checked={formData.accuracyStatement}
                    onChange={handleChange}
                    required
                  />
                  <span>
                    The information in this notification is accurate, and under penalty of perjury, I am the copyright 
                    owner or authorized to act on behalf of the owner of an exclusive right that is allegedly infringed.
                  </span>
                </label>
              </div>

              <div className="checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    name="authorizedStatement"
                    checked={formData.authorizedStatement}
                    onChange={handleChange}
                    required
                  />
                  <span>
                    I understand that filing a fraudulent DMCA notice may result in legal liability for damages, 
                    costs, and attorney fees under 17 U.S.C. § 512(f).
                  </span>
                </label>
              </div>
            </div>

            <div className="form-section">
              <h3>6. Signature</h3>
              
              <div className="form-group">
                <label htmlFor="signature">
                  Electronic Signature (type your full name) *
                </label>
                <input
                  type="text"
                  id="signature"
                  name="signature"
                  value={formData.signature}
                  onChange={handleChange}
                  required
                  placeholder="John Doe"
                />
                <small>By typing your name, you are electronically signing this DMCA notice</small>
              </div>

              <div className="form-group">
                <label htmlFor="date">Date *</label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={formData.date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                Submit DMCA Notice
              </button>
              <p className="submission-note">
                Your notice will be sent to <strong>dmca@unis.com</strong> and reviewed within 24-48 hours.
              </p>
            </div>

          </form>

          <section className="counter-notice-info">
            <h2>Counter-Notification</h2>
            <p>
              If your content was removed due to a DMCA notice and you believe it was removed in error, you may file 
              a counter-notification. Contact <a href="mailto:dmca@unis.com">dmca@unis.com</a> for the counter-notice 
              process.
            </p>
          </section>

          <section className="contact-section">
            <h2>Alternative Contact Methods</h2>
            <p>
              <strong>Email:</strong> <a href="mailto:dmca@unis.com">dmca@unis.com</a><br />
              <strong>Mail:</strong> Unis Inc., DMCA Agent, 123 Harlem Ave, New York, NY 10026<br />
              <strong>Phone:</strong> For urgent matters only
            </p>
          </section>

        </div>
      </div>
    </Layout>
  );
};

export default ReportInfringement;