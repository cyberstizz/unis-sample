import React from 'react';
import './ArtistCard.scss';
import { buildUrl } from './utils/buildUrl';


const ArtistCard = ({ artist, onPress, onViewPress, index = 0 }) => {
  const locationName = artist.jurisdictionName || 'Your Area';
  const photoUrl = buildUrl(artist.photoUrl) || 'https://picsum.photos/400/300';

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
          className="ac-photo"
          style={{ backgroundImage: `url(${photoUrl})` }}
        >
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