import React, { useEffect, useState } from 'react';
import './artistOfWeekCard.scss';

// ============================================================================
// ArtistOfWeekCard — the feed's Artist of the Week.
//
// A full-bleed "cover" card: the winner's photo fills the card, a theme-tinted
// scrim keeps the type readable, and a gold award badge marks it as an honour
// rather than just another list item. With no photo on file (or a photo that
// fails to load) it falls back to a theme gradient with the artist's initial,
// never a stock photo of somebody else.
//
// Props
//   artist  { userId, username, photoUrl, votesCount, awardDate }
//   place   jurisdiction name shown in the chip ("Uptown Harlem")
//   onOpen  called when the card is tapped (navigates to the artist page)
//
// awardDate is the last day of the winning week, the same convention
// LastWonNotification uses, so the range is awardDate − 6 → awardDate.
// ============================================================================

const weekRange = (ymd) => {
  if (!ymd) return '';
  const end = new Date(`${ymd}T12:00:00`);
  if (Number.isNaN(end.getTime())) return '';
  const start = new Date(end);
  start.setDate(start.getDate() - 6);
  const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return start.getMonth() === end.getMonth()
    ? `${fmt(start)} – ${end.getDate()}`
    : `${fmt(start)} – ${fmt(end)}`;
};

const Crown = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
    <path d="M3 18h18l-1.5-9-4.5 4-3-7-3 7-4.5-4L3 18z" fill="currentColor" />
  </svg>
);

const Arrow = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    <path
      d="M5 12h13M13 6l6 6-6 6"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const ArtistOfWeekCard = ({ artist, place, onOpen }) => {
  const [photoBroken, setPhotoBroken] = useState(false);

  // A new winner (or a jurisdiction switch) gets a fresh chance to load.
  useEffect(() => { setPhotoBroken(false); }, [artist?.photoUrl]);

  if (!artist) return null;

  const name = artist.username || 'Unknown';
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const showPhoto = !!artist.photoUrl && !photoBroken;
  const votes = artist.votesCount || 0;
  const range = weekRange(artist.awardDate);

  return (
    <button
      type="button"
      className={`aotw${showPhoto ? '' : ' aotw--no-photo'}`}
      onClick={onOpen}
      aria-label={`Artist of the Week in ${place}: ${name}. View artist`}
    >
      <span className="aotw-media" aria-hidden="true">
        {showPhoto ? (
          <img src={artist.photoUrl} alt="" onError={() => setPhotoBroken(true)} />
        ) : (
          <span className="aotw-monogram">{initial}</span>
        )}
      </span>
      <span className="aotw-scrim" aria-hidden="true" />
      <span className="aotw-sheen" aria-hidden="true" />

      <span className="aotw-top">
        <span className="aotw-badge">
          <span className="aotw-medal"><Crown /></span>
          <span className="aotw-badge-text">Artist of the Week</span>
        </span>
        <span className="aotw-place">{place}</span>
      </span>

      <span className="aotw-bottom">
        <span className="aotw-kicker">The week belonged to</span>
        <span className="aotw-name">{name}</span>
        <span className="aotw-foot">
          <span className="aotw-stats">
            {votes > 0 && (
              <span className="aotw-stat">
                <strong>{votes.toLocaleString('en-US')}</strong> vote{votes !== 1 ? 's' : ''}
              </span>
            )}
            {range && <span className="aotw-stat">{range}</span>}
          </span>
          <span className="aotw-cta">
            View artist <Arrow />
          </span>
        </span>
      </span>
    </button>
  );
};

export default ArtistOfWeekCard;
