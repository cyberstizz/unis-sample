import React, { useState, useCallback } from 'react';
import { apiCall } from './components/axiosInstance';
import Layout from './layout';
import US_STATES_AND_METROS from './data/Usstatesandmetros';

const WaitlistPage = () => {
  const [step, setStep] = useState(1); // 1 = form, 2 = success
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [referralValid, setReferralValid] = useState(null); // null | true | false
  const [referralChecking, setReferralChecking] = useState(false);

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

  const [result, setResult] = useState(null); // success response

  // ─── Derived state ───
  const selectedState = US_STATES_AND_METROS[form.stateCode];
  const metros = selectedState ? [...selectedState.metros, 'Other'] : [];

  const handleChange = (field, value) => {
    setForm(prev => {
      const updated = { ...prev, [field]: value };
      // Reset metro when state changes
      if (field === 'stateCode') {
        updated.metroRegion = '';
        updated.cityFreetext = '';
      }
      // Reset freetext when metro changes
      if (field === 'metroRegion' && value !== 'Other') {
        updated.cityFreetext = '';
      }
      return updated;
    });
    setError('');
  };

  // ─── Referral code check (debounced on blur) ───
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

  // ─── Submit ───
  const handleSubmit = async () => {
    // Client validation
    if (!form.email || !form.username || !form.password) {
      setError('Email, username, and password are required.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!form.stateCode) {
      setError('Please select your state.');
      return;
    }
    if (!form.metroRegion) {
      setError('Please select your metro area.');
      return;
    }
    if (form.metroRegion === 'Other' && !form.cityFreetext.trim()) {
      setError('Please enter your city or area name.');
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
    } finally {
      setLoading(false);
    }
  };

  // ─── Shared styles ───
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

  const inputFocusStyle = '1px solid #163387';

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
            {/* Checkmark icon — inline SVG, no lucide */}
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

            {/* Referral code card */}
            <div style={{
              background: '#0a0a0c', borderRadius: '12px', padding: '24px',
              border: '1px solid rgba(22,51,135,0.4)', marginBottom: '24px',
            }}>
              <div style={{ color: '#A9A9A9', fontSize: '12px', letterSpacing: '1px', marginBottom: '8px', textTransform: 'uppercase' }}>
                Your Referral Code
              </div>
              <div style={{
                color: '#fff', fontSize: '32px', fontWeight: '700',
                letterSpacing: '3px', fontFamily: "'DM Sans', sans-serif",
              }}>
                {result.referralCode}
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: '#A9A9A9', fontSize: '13px' }}>
                  {result.regionSignupCount} of {result.regionThreshold} signups
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
            </div>

            <p style={{ color: '#666', fontSize: '13px', lineHeight: '1.5' }}>
              When your region reaches {result.regionThreshold} signups, it will be activated and
              you'll get full access to Unis — voting, earning, and discovering music in your area.
            </p>
          </div>
        </div>
      </Layout>
    );
  }

  // ─── Form ───
  return (
    <Layout>
      <div style={{
        maxWidth: '560px', margin: '40px auto', padding: '0 20px',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{ color: '#fff', fontSize: '30px', fontWeight: '700', marginBottom: '10px' }}>
            Join the Unis Waitlist
          </h1>
          <p style={{ color: '#A9A9A9', fontSize: '15px', lineHeight: '1.6', maxWidth: '420px', margin: '0 auto' }}>
            Unis isn't in your area yet — but it can be. Sign up now, get your referral code, 
            and help unlock Unis in your region.
          </p>
        </div>

        <div style={{
          background: '#111114', borderRadius: '16px', padding: '32px',
          border: '1px solid rgba(255,255,255,0.08)',
        }}>
          {/* User type toggle */}
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

          {/* Email */}
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

          {/* Username */}
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

          {/* Display name */}
          <div style={fieldGroup}>
            <label style={labelStyle}>Display Name <span style={{ color: '#555' }}>(optional)</span></label>
            <input
              type="text"
              value={form.displayName}
              onChange={e => handleChange('displayName', e.target.value)}
              placeholder={form.userType === 'ARTIST' ? 'Your artist name' : 'Your display name'}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#163387'}
              onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
            />
          </div>

          {/* Password */}
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

          {/* Confirm password */}
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

          {/* ─── Location section ─── */}
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

          {/* State dropdown */}
          <div style={fieldGroup}>
            <label style={labelStyle}>State</label>
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

          {/* Metro dropdown */}
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

          {/* Freetext city (if "Other") */}
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

          {/* Referral code */}
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
              {/* Validation indicator */}
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
          </div>

          {/* Error message */}
          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px', padding: '12px 16px', marginBottom: '18px',
              color: '#ef4444', fontSize: '14px',
            }}>
              {error}
            </div>
          )}

          {/* Submit */}
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

          <p style={{ color: '#555', fontSize: '12px', textAlign: 'center', marginTop: '16px', lineHeight: '1.5' }}>
            By joining, you agree to Unis Terms of Service. Your account will activate when your region reaches its signup threshold. No uploads or media storage until activation.
          </p>
        </div>
      </div>
    </Layout>
  );
};

export default WaitlistPage;