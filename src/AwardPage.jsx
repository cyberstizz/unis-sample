// ─────────────────────────────────────────────────────────────────────────────
// /award/:awardId — a winner's share page. The link in every winner email.
//
// Shows the share card (drawn on a canvas by utils/awardCard), the winner's
// photo (the server leaves it out for winners under 17), and three actions:
//   Share     — the phone's share sheet with the card image (Instagram,
//               TikTok, Messages…); falls back to the link where files can't
//               be shared.
//   Save image, Copy link.
// Data: GET /v1/awards/{awardId}/card (public).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import Layout from './layout';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { cardBlob, cardFileName, drawAwardCard } from './utils/awardCard';
import './awardPage.scss';

const AwardPage = () => {
  const { awardId } = useParams();
  const canvasRef = useRef(null);
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [image, setImage] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let cancelled = false;
    setCard(null);
    setError('');
    apiCall({ method: 'get', url: `/v1/awards/${encodeURIComponent(awardId)}/card`, useCache: false })
      .then((res) => { if (!cancelled) setCard(res.data); })
      .catch((err) => {
        console.error('[Award] load failed:', err?.message);
        if (!cancelled) setError(err?.response?.status === 404 ? 'This award isn’t available.' : 'This award couldn’t load. Try again in a minute.');
      });
    return () => { cancelled = true; };
  }, [awardId]);

  useEffect(() => {
    if (!card || !canvasRef.current) return;
    let cancelled = false;
    drawAwardCard(canvasRef.current, card)
      .then((canvas) => { if (!cancelled) setImage(canvas.toDataURL('image/png')); })
      .catch((err) => console.error('[Award] card draw failed:', err?.message));
    document.title = `${card.title}: ${card.targetType === 'song' ? card.songTitle : card.username} · Unis`;
    return () => { cancelled = true; };
  }, [card]);

  const flash = (text) => {
    setNote(text);
    setTimeout(() => setNote(''), 2400);
  };

  const share = async () => {
    if (!card || !canvasRef.current) return;
    const text = `${card.title}: ${card.targetType === 'song' ? `“${card.songTitle}” by ${card.username}` : card.username}`;
    try {
      const blob = await cardBlob(canvasRef.current);
      const file = blob ? new File([blob], cardFileName(card), { type: 'image/png' }) : null;
      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: card.title, text: `${text}\n${card.pageUrl}` });
        return;
      }
      if (navigator.share) {
        await navigator.share({ title: card.title, text, url: card.pageUrl });
        return;
      }
      await navigator.clipboard.writeText(card.pageUrl);
      flash('Link copied');
    } catch (err) {
      if (err?.name !== 'AbortError') console.error('[Award] share failed:', err?.message);
    }
  };

  const save = () => {
    if (!image || !card) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = cardFileName(card);
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.pageUrl);
      flash('Link copied');
    } catch {
      window.prompt('Copy this link', card.pageUrl);
    }
  };

  const winnerHref = card
    ? (card.targetType === 'song' && card.songId ? `/song/${card.songId}` : `/artist/${card.artistId}`)
    : '/';

  return (
    <Layout>
      <div className="aw-page">
        {error && <p className="aw-error" role="alert">{error}</p>}
        {!card && !error && <p className="aw-loading" role="status">Loading…</p>}

        {card && (
          <article className="aw-layout">
            <figure className="aw-card">
              {image
                ? <img src={image} alt={`${card.title}: ${card.targetType === 'song' ? card.songTitle : card.username}`} />
                : <div className="aw-card__placeholder" aria-hidden="true" />}
              <canvas ref={canvasRef} hidden />
            </figure>

            <div className="aw-info">
              <p className="aw-info__kicker">{card.title}</p>
              <h1 className="aw-info__name">
                {card.targetType === 'song' ? <>&ldquo;{card.songTitle}&rdquo;</> : card.username}
              </h1>
              {card.targetType === 'song' && <p className="aw-info__by">by {card.username}</p>}
              <p className="aw-info__period">For {card.periodLabel}</p>

              {card.photoUrl && (
                <img className="aw-info__photo" src={buildUrl(card.photoUrl)} alt={card.username} />
              )}

              <p className="aw-info__note">
                {card.jurisdiction}&rsquo;s votes, plays and likes decided it.
              </p>

              <div className="aw-actions">
                <button type="button" className="aw-btn aw-btn--primary" onClick={share}>Share</button>
                <button type="button" className="aw-btn" onClick={save} disabled={!image}>Save image</button>
                <button type="button" className="aw-btn" onClick={copy}>Copy link</button>
              </div>
              {note && <p className="aw-flash" role="status">{note}</p>}

              <div className="aw-links">
                <Link to={winnerHref}>{card.targetType === 'song' ? 'Play the song' : `See ${card.username}’s page`}</Link>
                <Link to="/voteawards">Vote in today&rsquo;s races</Link>
              </div>
            </div>
          </article>
        )}
      </div>
    </Layout>
  );
};

export default AwardPage;
