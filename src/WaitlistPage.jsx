import React, { useState, useCallback, useEffect, useRef } from 'react';
import { apiCall } from './components/axiosInstance';
import Layout from './layout';
import US_STATES_AND_METROS from './data/Usstatesandmetros';

const WaitlistPage = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralValid, setReferralValid] = useState(null);
  const [referralChecking, setReferralChecking] = useState(false);
  const [copied, setCopied] = useState(false);

  // FIX #10: Live region signup count (fetched when state+metro both selected)
  const [regionStats, setRegionStats] = useState(null);
  const [regionStatsLoading, setRegionStatsLoading] = useState(false);

  const [form, setForm] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    displayName: '',
    userType: 'LISTENER',
    stateCode: '',
    metroRegion: '',
    cityFreetext: '',
    referredByCode: '',
  });

  const [result, setResult] = useState(null);

  // FIX #1: Ref to scroll the top-of-form error banner into view on submit failure
  const formTopRef = useRef(null);

  const selectedState = US_STATES_AND_METROS[form.stateCode];
  const metros = selectedState ? [...selectedState.metros, 'Other'] : [];

  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      if (field === 'stateCode') {
        updated.metroRegion = '';
        updated.cityFreetext = '';
      }
      if (field === 'metroRegion' && value !== 'Other') {
        updated.cityFreetext = '';
      }
      return updated;
    });
    setError('');
  };

  const checkReferral = useCallback(async (code) => {
    if (!code || code.trim().length < 5) {
      setReferralValid(null);
      return;
    }
    setReferralChecking(true);
    try {
      const res = await apiCall({ url: `/v1/waitlist/check-referral/${code.trim()}`, method: 'get' });
      setReferralValid(res.data.valid);
    } catch {
      setReferralValid(null);
    } finally {
      setReferralChecking(false);
    }
  }, []);

  // FIX #10: Live region stats fetch
  useEffect(() => {
    if (!form.stateCode || !form.metroRegion) {
      setRegionStats(null);
      return;
    }
    let cancelled = false;
    const fetchStats = async () => {
      setRegionStatsLoading(true);
      try {
        const res = await apiCall({
          url: `/v1/waitlist/region-stats?stateCode=${form.stateCode}&metroRegion=${encodeURIComponent(form.metroRegion)}`,
          method: 'get',
        });
        if (!cancelled) setRegionStats(res.data);
      } catch {
        if (!cancelled) setRegionStats(null);
      } finally {
        if (!cancelled) setRegionStatsLoading(false);
      }
    };
    fetchStats();
    return () => { cancelled = true; };
  }, [form.stateCode, form.metroRegion]);

  // FIX #1: Scroll to the top-of-form error banner after any validation/submit failure
  const scrollToError = () => {
    setTimeout(() => {
      if (formTopRef.current && typeof formTopRef.current.scrollIntoView === 'function') {
        formTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleSubmit = async () => {
    if (!form.email || !form.username || !form.password) {
      setError('Email, username, and password are required.');
      scrollToError();
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      scrollToError();
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      scrollToError();
      return;
    }
    if (!form.stateCode) {
      setError('Please select your state.');
      scrollToError();
      return;
    }
    if (!form.metroRegion) {
      setError('Please select your metro area.');
      scrollToError();
      return;
    }
    if (form.metroRegion === 'Other' && !form.cityFreetext.trim()) {
      setError('Please enter your city or area name.');
      scrollToError();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const payload = {
        email: form.email,
        username: form.username,
        password: form.password,
        displayName: form.displayName || form.username,
        userType: form.userType,
        stateCode: form.stateCode,
        stateName: selectedState.name,
        metroRegion: form.metroRegion,
        cityFreetext: form.cityFreetext || null,
        referredByCode: form.referredByCode || null,
      };
      const res = await apiCall({ url: '/v1/waitlist/register', method: 'post', data: payload });
      setResult(res.data);
      setStep(2);
    } catch (err) {
      const msg = err.response?.data?.error || 'Registration failed. Please try again.';
      setError(msg);
      scrollToError();
    } finally {
      setLoading(false);
    }
  };

  // FIX #2: Copy referral code
  const handleCopyCode = async () => {
    if (!result?.referralCode) return;
    try {
      await navigator.clipboard.writeText(result.referralCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  // FIX #3: Native share with fallback to copy
  const handleShare = async () => {
    if (!result) return;
    const shareText = `I just joined the Unis waitlist for ${result.metroRegion}! Use my code ${result.referralCode} to help unlock Unis here faster.`;
    const shareUrl = `${window.location.origin}/waitlist?ref=${result.referralCode}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Join me on Unis', text: shareText, url: shareUrl });
      } catch {
        // user cancelled
      }
    } else {
      handleCopyCode();
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    background: '#111114',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '10px',
    color: '#fff',
    fontSize: '15px',
    fontFamily: "'DM Sans', sans-serif",
    outline: 'none',
    transition: 'border-color 0.2s',
    boxSizing: 'border-box',
  };

  const labelStyle = {
    display: 'block',
    color: '#A9A9A9',
    fontSize: '13px',
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: '6px',
    letterSpacing: '0.3px',
  };

  const fieldGroup = { marginBottom: '18px' };

  // ─── Success screen ───
  if (step === 2 && result) {
    const remaining = Math.max(0, result.regionThreshold - result.regionSignupCount);

    return (
      <Layout>
        <div style={{
          maxWidth: '560px', margin: '60px auto', padding: '0 20px',
          fontFamily: "'DM Sans', sans-serif",
        }}>
          <div style={{
            background: '#111114', borderRadius: '16px', padding: '40px',
            border: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
          }}>
            <div style={{ marginBottom: '24px' }}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <circle cx="32" cy="32" r="30" stroke="#163387" strokeWidth="3" fill="rgba(22,51,135,0.15)" />
                <path d="M20 33 L28 41 L44 24" stroke="#163387" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </div>

            <h1 style={{ color: '#fff', fontSize: '26px', fontWeight: '700', marginBottom: '12px' }}>
              You're on the waitlist!
            </h1>
            <p style={{ color: '#A9A9A9', fontSize: '15px', lineHeight: '1.6', marginBottom: '28px' }}>
              Unis is coming to <strong style={{ color: '#fff' }}>{result.metroRegion}</strong>,{' '}
              <strong style={{ color: '#fff' }}>{result.stateName}</strong>.
              Share your referral code to unlock your region faster.
            </p>

            {/* FIX #2 + #3: Code card with Copy + Share buttons */}
            <div style={{
              background: '#0a0a0c', borderRadius: '12px', padding: '24px',
              border: '1px solid rgba(22,51,135,0.4)', marginBottom: '16px',
            }}>
              <div style={{ color: '#A9A9A9', fontSize: '12px', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Your Referral Code
              </div>
              <div style={{
                color: '#fff', fontSize: '32px', fontWeight: '700',
                letterSpacing: '3px', marginBottom: '16px',
              }}>
                {result.referralCode}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                <button
                  onClick={handleCopyCode}
                  aria-label="Copy referral code"
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: copied ? 'rgba(34,197,94,0.15)' : 'rgba(22,51,135,0.2)',
                    border: `1px solid ${copied ? '#22c55e' : 'rgba(22,51,135,0.5)'}`,
                    borderRadius: '10px',
                    color: copied ? '#22c55e' : '#fff',
                    fontSize: '14px',
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {copied ? '✓ Copied!' : 'Copy Code'}
                </button>
                <button
                  onClick={handleShare}
                  aria-label="Share referral code"
                  style={{
                    flex: 1,
                    padding: '12px 16px',
                    background: '#163387',
                    border: 'none',
                    borderRadius: '10px',
                    color: '#fff',
                    fontSize: '14px',
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: 'pointer',
                    fontWeight: 600,
                    transition: 'all 0.15s ease',
                  }}
                >
                  Share
                </button>
              </div>
            </div>

            {/* FIX #4: Motivating copy — "N more to unlock!" */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#A9A9A9', fontSize: '13px' }}>
                  {remaining > 0 ? `${remaining} more to unlock!` : "Region activated — you're in!"}
                </span>
                <span style={{ color: '#163387', fontSize: '13px', fontWeight: '600' }}>
                  {result.regionProgressPercent}%
                </span>
              </div>
              <div style={{
                width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)',
                borderRadius: '4px', overflow: 'hidden',
              }}>
                <div style={{
                  width: `${result.regionProgressPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #163387, #2952cc)',
                  borderRadius: '4px',
                  transition: 'width 0.6s ease',
                }} />
              </div>
              <div style={{ color: '#888', fontSize: '12px', marginTop: '6px', textAlign: 'left' }}>
                {result.regionSignupCount} of {result.regionThreshold} signups
              </div>
            </div>

            <p style={{ color: '#666', fontSize: '13px', lineHeight: '1.5', marginBottom: '12px' }}>
              When your region reaches {result.regionThreshold} signups, it will be activated and
              you'll get full access to Unis — voting, earning, and discovering music in your area.
            </p>

            {/* FIX #7: Explain what happens next */}
            <p style={{ color: '#666', fontSize: '12px', lineHeight: '1.5' }}>
              We'll email you the moment your region activates. No spam, no forwarding — just the
              one message you've been waiting for.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Form ───
  return (
    <Layout>
      <div
        ref={formTopRef}
        style={{
          maxWidth: '560px', margin: '40px auto', padding: '0 20px',
          fontFamily: "'DM Sans', sans-serif",
        }}
      >
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ color: '#fff', fontSize: '30px', fontWeight: '700', marginBottom: '10px' }}>
            Join the Unis Waitlist
          </h1>
          <p style={{ color: '#A9A9A9', fontSize: '15px', lineHeight: '1.6', maxWidth: '420px', margin: '0 auto' }}>
            Unis isn't in your area yet — but it can be. Sign up now, get your referral code,
            and help unlock Unis in your region.
          </p>
        </div>

        {/* FIX #1: Top-of-form error banner (scrolled into view on submit) */}
        {error && (
          <div
            role="alert"
            style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '12px 16px',
              marginBottom: '18px',
              color: '#ef4444',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        <div style={{
          background: '#111114', borderRadius: '16px', padding: '32px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          <div style={fieldGroup}>
            <label style={labelStyle}>I am a...</label>
            <div style={{ display: 'flex', gap: '10px' }}>
              {['LISTENER', 'ARTIST'].map(type => (
                <button
                  key={type}
                  onClick={() => handleChange('userType', type)}
                  style={{
                    flex: 1, padding: '12px',
                    background: form.userType === type ? 'rgba(22,51,135,0.25)' : '#0a0a0c',
                    border: `1px solid ${form.userType === type ? '#163387' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: '10px', color: '#fff', fontSize: '14px',
                    fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                    fontWeight: form.userType === type ? '600' : '400',
                    transition: 'all 0.2s',
                  }}
                >
                  {type === 'LISTENER' ? 'Listener' : 'Artist'}
                </button>
              ))}
            </div>
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              value={form.email}
              onChange={e => handleChange('email', e.target.value)}
              placeholder="your@email.com"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#163387'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>Username</label>
            <input
              type="text"
              value={form.username}
              onChange={e => handleChange('username', e.target.value)}
              placeholder="Choose a username"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#163387'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          {/* FIX #8: Context for where Display Name shows up */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              Display Name <span style={{ color: '#555' }}>(optional)</span>
            </label>
            <input
              type="text"
              value={form.displayName}
              onChange={e => handleChange('displayName', e.target.value)}
              placeholder={form.userType === 'ARTIST' ? 'Your artist name' : 'Your display name'}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#163387'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
            <div style={{ color: '#666', fontSize: '12px', marginTop: '6px' }}>
              Shown on votes, comments, and your public profile. Defaults to your username.
            </div>
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              value={form.password}
              onChange={e => handleChange('password', e.target.value)}
              placeholder="Min 8 characters"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#163387'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div style={fieldGroup}>
            <label style={labelStyle}>Confirm Password</label>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={e => handleChange('confirmPassword', e.target.value)}
              placeholder="Re-enter password"
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#163387'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            marginTop: '24px', paddingTop: '24px', marginBottom: '18px',
          }}>
            <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600', marginBottom: '4px' }}>
              Where are you?
            </div>
            <div style={{ color: '#666', fontSize: '13px', marginBottom: '18px' }}>
              This determines which Unis jurisdiction you'll join when it activates.
            </div>
          </div>

          {/* FIX #9: State field with type-ahead via datalist */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              State
              <span style={{ color: '#555', fontWeight: 400, marginLeft: '8px' }}>
                (type to search, or pick below)
              </span>
            </label>
            <input
              list="state-list"
              value={selectedState ? selectedState.name : ''}
              onChange={e => {
                const typed = e.target.value;
                const match = Object.entries(US_STATES_AND_METROS).find(
                  ([, data]) => data.name.toLowerCase() === typed.toLowerCase()
                );
                if (match) {
                  handleChange('stateCode', match[0]);
                } else if (!typed) {
                  handleChange('stateCode', '');
                }
              }}
              placeholder="Start typing a state..."
              style={{ ...inputStyle, marginBottom: '8px' }}
              onFocus={e => e.target.style.borderColor = '#163387'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              aria-label="Type to search state"
            />
            <datalist id="state-list">
              {Object.entries(US_STATES_AND_METROS)
                .sort((a, b) => a[1].name.localeCompare(b[1].name))
                .map(([code, data]) => (
                  <option key={code} value={data.name} />
                ))}
            </datalist>
            <select
              value={form.stateCode}
              onChange={e => handleChange('stateCode', e.target.value)}
              style={{
                ...inputStyle,
                cursor: 'pointer',
                appearance: 'none',
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23A9A9A9' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 16px center',
              }}
            >
              <option value="" style={{ background: '#111114' }}>Select your state</option>
              {Object.entries(US_STATES_AND_METROS)
                .sort((a, b) => a[1].name.localeCompare(b[1].name))
                .map(([code, data]) => (
                  <option key={code} value={code} style={{ background: '#111114' }}>
                    {data.name}
                  </option>
                ))}
            </select>
          </div>

          {form.stateCode && (
            <div style={fieldGroup}>
              <label style={labelStyle}>Metro / Region</label>
              <select
                value={form.metroRegion}
                onChange={e => handleChange('metroRegion', e.target.value)}
                style={{
                  ...inputStyle,
                  cursor: 'pointer',
                  appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg width='12' height='8' viewBox='0 0 12 8' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1.5L6 6.5L11 1.5' stroke='%23A9A9A9' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 16px center',
                }}
              >
                <option value="" style={{ background: '#111114' }}>Select your area</option>
                {metros.map(m => (
                  <option key={m} value={m} style={{ background: '#111114' }}>{m}</option>
                ))}
              </select>
            </div>
          )}

          {form.metroRegion === 'Other' && (
            <div style={fieldGroup}>
              <label style={labelStyle}>Your City or Area</label>
              <input
                type="text"
                value={form.cityFreetext}
                onChange={e => handleChange('cityFreetext', e.target.value)}
                placeholder="e.g. Shreveport, Bakersfield"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#163387'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
            </div>
          )}

          {/* FIX #10: Live region stats shown BEFORE submit */}
          {form.stateCode && form.metroRegion && (
            <div style={{
              background: 'rgba(22,51,135,0.08)',
              border: '1px solid rgba(22,51,135,0.25)',
              borderRadius: '10px',
              padding: '14px 16px',
              marginBottom: '18px',
            }}>
              {regionStatsLoading ? (
                <div style={{ color: '#A9A9A9', fontSize: '13px' }}>
                  Checking region progress...
                </div>
              ) : regionStats ? (
                <>
                  <div style={{ color: '#fff', fontSize: '13px', marginBottom: '8px' }}>
                    {regionStats.signupCount > 0
                      ? `${regionStats.signupCount} people already waiting in ${form.metroRegion}.`
                      : `You'll be the first from ${form.metroRegion}!`}
                    {' '}
                    {regionStats.threshold - regionStats.signupCount > 0 && (
                      <strong style={{ color: '#6b8cff' }}>
                        {regionStats.threshold - regionStats.signupCount} more to unlock.
                      </strong>
                    )}
                  </div>
                  <div style={{
                    width: '100%', height: '6px', background: 'rgba(255,255,255,0.08)',
                    borderRadius: '3px', overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${regionStats.progressPercent}%`,
                      height: '100%',
                      background: 'linear-gradient(90deg, #163387, #2952cc)',
                      borderRadius: '3px',
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                </>
              ) : (
                <div style={{ color: '#A9A9A9', fontSize: '13px' }}>
                  Sign up to start the waitlist for {form.metroRegion}!
                </div>
              )}
            </div>
          )}

          {/* FIX #5: Referral code with benefit explanation */}
          <div style={fieldGroup}>
            <label style={labelStyle}>
              Referral Code <span style={{ color: '#555' }}>(optional)</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={form.referredByCode}
                onChange={e => handleChange('referredByCode', e.target.value.toUpperCase())}
                onBlur={e => checkReferral(e.target.value)}
                placeholder="UNIS-XXXXXX"
                style={{
                  ...inputStyle,
                  paddingRight: '44px',
                  textTransform: 'uppercase',
                  letterSpacing: '1px',
                }}
                onFocus={e => e.target.style.borderColor = '#163387'}
              />
              {referralChecking && (
                <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: '#A9A9A9', fontSize: '12px' }}>
                  ...
                </div>
              )}
              {referralValid === true && (
                <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" fill="rgba(34,197,94,0.2)" stroke="#22c55e" strokeWidth="1.5" />
                    <path d="M6 10.5L9 13.5L14 7.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  </svg>
                </div>
              )}
              {referralValid === false && form.referredByCode.length >= 5 && (
                <div style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)' }}>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" fill="rgba(239,68,68,0.2)" stroke="#ef4444" strokeWidth="1.5" />
                    <path d="M7 7L13 13M13 7L7 13" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
              )}
            </div>
            {referralValid === true ? (
              <div style={{ color: '#22c55e', fontSize: '12px', marginTop: '6px' }}>
                ✓ Nice — you'll help boost their region too when Unis activates.
              </div>
            ) : (
              <div style={{ color: '#666', fontSize: '12px', marginTop: '6px' }}>
                Got a code from a friend? Enter it — you both benefit when your regions activate.
              </div>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            style={{
              width: '100%', padding: '16px',
              background: loading ? 'rgba(22,51,135,0.5)' : '#163387',
              color: '#fff', border: 'none', borderRadius: '10px',
              fontSize: '16px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', sans-serif",
              transition: 'background 0.2s',
            }}
          >
            {loading ? 'Joining...' : 'Join the Waitlist'}
          </button>

          {/* FIX #6: Clickable Terms + Privacy links */}
          <p style={{ color: '#555', fontSize: '12px', textAlign: 'center', marginTop: '16px', lineHeight: '1.5' }}>
            By joining, you agree to Unis{' '}
            <a href="/terms" style={{ color: '#6b8cff', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">
              Terms of Service
            </a>
            {' '}and{' '}
            <a href="/privacy" style={{ color: '#6b8cff', textDecoration: 'underline' }} target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </a>
            . Your account will activate when your region reaches its signup threshold. No uploads or media storage until activation.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default WaitlistPage;