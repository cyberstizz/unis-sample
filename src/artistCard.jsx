import React from 'react';
import './ArtistCard.scss';
import { buildUrl } from './utils/buildUrl';


// An artist with no photo used to fall through to picsum.photos, which serves
// a DIFFERENT random stock photograph on every page load. That is why a card
// could look like a real person one moment and someone else the next. A
// monogram is honest: it says "no photo yet" instead of inventing a face.
// The hue is derived from the username so a given artist always gets the same
// colour rather than flickering between renders.
const monogramHue = (name = '') => {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) % 360;
  return h;
};

const ArtistCard = ({ artist, onPress, onViewPress, index = 0 }) => {
  const locationName = artist.jurisdictionName || 'Your Area';
  const photoUrl = buildUrl(artist.photoUrl);
  const initial = (artist.username || '?').trim().charAt(0).toUpperCase();
  const hue = monogramHue(artist.username);

  return (
    <div
      className="ac-wrap"
      // Only inline style left: stagger delay per index. Everything color-
      // related comes from var(--unis-primary) in ArtistCard.scss.
      style={{ animationDelay: `${index * 150}ms` }}
    >
      <div className="ac-pulse-bar" />

      <div className="ac-card" onClick={onPress}>
        <div
          className={`ac-photo${photoUrl ? '' : ' ac-photo--monogram'}`}
          style={photoUrl
            ? { backgroundImage: `url(${photoUrl})` }
            : { '--ac-monogram-hue': hue }}
        >
          {!photoUrl && (
            <span className="ac-monogram" aria-hidden="true">{initial}</span>
          )}

          <div className="ac-fade-right" />
          <div className="ac-fade-bottom" />
          <div className="ac-ambient-glow" />

          {artist.score != null && (
            <div className="ac-score">
              <div className="ac-score__pill">
                <span className="ac-score__star">★</span>
                <span className="ac-score__value">
                  {artist.score.toLocaleString()}
                </span>
              </div>
            </div>
          )}

          <div className="ac-bottom">
            <div className="ac-info">
              <div className="ac-location">
                <div className="ac-location__dot" />
                <span className="ac-location__label">{locationName}</span>
              </div>

              <div className="ac-name">{artist.username}</div>

              <div className="ac-separator" />
            </div>

            <button
              className="ac-view-btn"
              onClick={(e) => {
                e.stopPropagation();
                onViewPress();
              }}
            >
              <div className="ac-view-btn__inner">
                <span className="ac-view-btn__label">VIEW</span>
                <span className="ac-view-btn__arrow">→</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ArtistCard;