// ─────────────────────────────────────────────────────────────────────────────
// /award/:awardId — a winner's share page. The link in every winner email.
//
// Shows the share card (drawn on a canvas by utils/awardCard) in the viewer's
// theme colour, as a Story (9:16, the default) or a Post (4:5), and three
// actions:
//   Share     — the phone's share sheet with the card image (Instagram,
//               TikTok, Messages…); falls back to the link where files can't
//               be shared.
//   Save image, Copy link.
// Below them, the winning song (or the artist) with a way to play or visit.
// Data: GET /v1/awards/{awardId}/card (public).
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Play } from 'lucide-react';
import Layout from './layout';
import UnisLoader from './components/UnisLoader';
import { apiCall } from './components/axiosInstance';
import { useFeedback } from './context/FeedbackContext';
import { useAuth } from './context/AuthContext';
import { buildUrl } from './utils/buildUrl';
import { cardBlob, cardFileName, drawAwardCard } from './utils/awardCard';
import './awardPage.scss';

const AwardPage = () => {
  const { awardId } = useParams();
  const canvasRef = useRef(null);
  const [card, setCard] = useState(null);
  const [error, setError] = useState('');
  const [image, setImage] = useState('');
  const [format, setFormat] = useState('story'); // 'story' (9:16) | 'post' (4:5)
  const feedback = useFeedback();
  const { theme } = useAuth();

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
    setImage('');
    drawAwardCard(canvasRef.current, card, { theme, format })
      .then((canvas) => { if (!cancelled) setImage(canvas.toDataURL('image/png')); })
      .catch((err) => console.error('[Award] card draw failed:', err?.message));
    document.title = `${card.title}: ${card.targetType === 'song' ? card.songTitle : card.username} · Unis`;
    return () => { cancelled = true; };
  }, [card, theme, format]);

  const flash = (text) => feedback.success(text, { id: 'award-share' });

  const share = async () => {
    if (!card || !canvasRef.current) return;
    const text = `${card.title}: ${card.targetType === 'song' ? `“${card.songTitle}” by ${card.username}` : card.username}`;
    try {
      const blob = await cardBlob(canvasRef.current);
      const file = blob ? new File([blob], cardFileName(card, format), { type: 'image/png' }) : null;
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
      // Closing the share sheet is not a failure.
      if (err?.name !== 'AbortError') {
        console.error('[Award] share failed:', err?.message);
        feedback.error("Couldn't open sharing. Use Copy link instead.");
      }
    }
  };

  const save = () => {
    if (!image || !card) return;
    const a = document.createElement('a');
    a.href = image;
    a.download = cardFileName(card, format);
    document.body.appendChild(a);
    a.click();
    a.remove();
    flash(format === 'story' ? 'Story card saved to your downloads' : 'Post card saved to your downloads');
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(card.pageUrl);
      flash('Link copied');
    } catch {
      feedback.info(`Copy this link: ${card.pageUrl}`);
    }
  };

  const isSong = card?.targetType === 'song';
  const thumb = card ? buildUrl(isSong ? card.artworkUrl : card.photoUrl) : null;
  const initial = String((isSong ? card?.songTitle : card?.username) || '?').trim().charAt(0).toUpperCase();

  const winnerHref = card
    ? (card.targetType === 'song' && card.songId ? `/song/${card.songId}` : `/artist/${card.artistId}`)
    : '/';

  return (
    <Layout>
      <div className="aw-page">
        {error && <p className="aw-error" role="alert">{error}</p>}
        {!card && !error && <UnisLoader label="Loading award…" />}

        {card && (
          <article className="aw-layout">
            <figure className={`aw-card aw-card--${format}`}>
              {image
                ? <img src={image} alt={`${card.title}: ${isSong ? card.songTitle : card.username}`} />
                : <div className="aw-card__placeholder" aria-hidden="true" />}
              <canvas ref={canvasRef} hidden />
            </figure>

            <div className="aw-info">
              <p className="aw-info__kicker">{card.title}</p>
              <h1 className="aw-info__name">
                {isSong ? <>&ldquo;{card.songTitle}&rdquo;</> : card.username}
              </h1>
              <p className="aw-info__by">
                {isSong ? `by ${card.username} · ` : ''}for {card.periodLabel}
              </p>
              <p className="aw-info__note">
                {card.jurisdiction}&rsquo;s votes, plays and likes decided it.
              </p>

              <div className="aw-shape" role="group" aria-label="Card shape">
                <button type="button" aria-pressed={format === 'story'} onClick={() => setFormat('story')}>
                  Story <span>9:16</span>
                </button>
                <button type="button" aria-pressed={format === 'post'} onClick={() => setFormat('post')}>
                  Post <span>4:5</span>
                </button>
              </div>

              <div className="aw-actions">
                <button type="button" className="aw-btn aw-btn--primary" onClick={share} disabled={!image}>Share</button>
                <button type="button" className="aw-btn" onClick={save} disabled={!image}>Save image</button>
                <button type="button" className="aw-btn" onClick={copy}>Copy link</button>
              </div>

              <div className="aw-winner">
                {thumb
                  ? <img className={`aw-winner__art ${isSong ? '' : 'is-round'}`} src={thumb} alt="" />
                  : <span className={`aw-winner__art aw-winner__art--blank ${isSong ? '' : 'is-round'}`} aria-hidden="true">{initial}</span>}
                <div className="aw-winner__who">
                  <strong>{isSong ? card.songTitle : card.username}</strong>
                  <span>{isSong ? card.username : [card.jurisdiction, card.genre].filter(Boolean).join(' · ')}</span>
                </div>
                <Link className="aw-winner__go" to={winnerHref}>
                  {isSong ? <><Play size={15} fill="currentColor" aria-hidden="true" /> Play the song</> : 'See their page'}
                </Link>
              </div>

              <div className="aw-links">
                {isSong && <Link to={`/artist/${card.artistId}`}>See {card.username}&rsquo;s page</Link>}
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
