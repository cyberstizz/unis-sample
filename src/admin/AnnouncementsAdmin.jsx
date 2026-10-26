// ─────────────────────────────────────────────────────────────────────────────
// Admin → Announcements   (/admin/announcements, admin + super admin)
//
// Every winner whose race ended on a day (default: yesterday, Harlem time),
// as a ready-to-post card image and caption. Post them by hand or through a
// scheduler like Buffer. Suggested rhythm: one post with all of a day's
// winners; weekly and monthly winners get their own posts.
//
// Data: GET /v1/admin/announcements?date=YYYY-MM-DD. Cards are drawn by
// utils/awardCard, the same drawing as the winner's own /award/:id page.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../layout';
import { apiCall } from '../components/axiosInstance';
import { cardFileName, drawAwardCard } from '../utils/awardCard';
import './metrics/metricsPage.scss';
import './communityShareAdmin.scss';
import './launchAdmin.scss';

const errorText = (err, fallback) => err?.response?.data?.error || fallback;

const AnnouncementCard = ({ card }) => {
  const canvasRef = useRef(null);
  const [image, setImage] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!canvasRef.current) return undefined;
    // The card names the app's own address (the share link's host).
    let host = window.location.host;
    try { host = new URL(card.pageUrl).host; } catch { /* keep the current host */ }
    drawAwardCard(canvasRef.current, card, { host })
      .then((c) => { if (!cancelled) setImage(c.toDataURL('image/png')); })
      .catch((err) => console.error('[Announcements] draw failed:', err?.message));
    return () => { cancelled = true; };
  }, [card]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.caption);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt('Copy the caption', card.caption);
    }
  };

  const save = () => {
    if (!image) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = cardFileName(card);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="tma-card">
      {image ? <img src={image} alt={card.title} /> : <div className="tma-card__placeholder" aria-hidden="true" />}
      <canvas ref={canvasRef} hidden />
      <p className="tma-card__title">{card.title}</p>
      <textarea readOnly value={card.caption} aria-label={`Caption for ${card.title}`} />
      <div className="csa-form__actions tma-actions">
        <button className="mx-btn" type="button" onClick={copy}>{copied ? 'Copied' : 'Copy caption'}</button>
        <button className="mx-btn mx-btn--ghost" type="button" disabled={!image} onClick={save}>Save image</button>
        <a className="mx-btn mx-btn--ghost" href={card.pageUrl} target="_blank" rel="noopener noreferrer">Award page</a>
      </div>
    </div>
  );
};

const AnnouncementsAdmin = () => {
  const navigate = useNavigate();
  const [date, setDate] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async (day) => {
    setData(null);
    try {
      const q = day ? `?date=${encodeURIComponent(day)}` : '';
      const res = await apiCall({ method: 'get', url: `/v1/admin/announcements${q}`, useCache: false });
      setData(res.data);
      if (!day) setDate(res.data?.date || '');
      setError('');
    } catch (err) {
      console.error('[Announcements] load failed:', err?.message);
      setError(errorText(err, 'Could not load the winners.'));
    }
  }, []);

  useEffect(() => { load(''); }, [load]);

  const cards = data?.cards || [];
  const groups = cards.reduce((acc, c) => {
    const key = c.unit || 'Day';
    (acc[key] = acc[key] || []).push(c);
    return acc;
  }, {});

  return (
    <Layout>
      <div className="admin-page mx csa">
        <button className="mx-back" onClick={() => navigate('/admin')}>← Admin dashboard</button>
        <header className="mx-head">
          <div>
            <h1>Announcements</h1>
            <p className="mx-head__sub">
              Winners whose race ended on the day you pick, with a card and caption ready to post. Winners
              are also emailed a link to their own card, so they can share it with their fans.
            </p>
          </div>
        </header>

        <div className="mx-controls">
          <label className="mx-select">
            Races that ended on
            <input type="date" value={date} onChange={(e) => { setDate(e.target.value); load(e.target.value); }} />
          </label>
        </div>

        {error && <p className="mx-error">{error}</p>}
        {!data && !error && <p className="mx-empty">Loading…</p>}
        {data && cards.length === 0 && <p className="mx-empty">No winners for that day.</p>}

        {Object.entries(groups).map(([unit, list]) => (
          <section className="mx-card csa-card" key={unit}>
            <h2 className="mx-card__title">Winners of the {unit.toLowerCase()} ({list.length})</h2>
            <div className="tma-cards">
              {list.map((c) => <AnnouncementCard key={c.awardId} card={c} />)}
            </div>
          </section>
        ))}
      </div>
    </Layout>
  );
};

export default AnnouncementsAdmin;
