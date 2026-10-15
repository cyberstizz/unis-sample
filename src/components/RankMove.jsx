import React from 'react';
import './RankMove.scss';

/**
 * How far an entry moved since the period before the one shown.
 *   movement > 0  up    (green chevron + places)
 *   movement < 0  down  (red chevron + places)
 *   movement 0    steady
 *   isNew         scored now, didn't chart last period
 * Renders nothing when there is nothing to compare against.
 */
const RankMove = ({ movement, isNew, className = '' }) => {
  if (isNew) {
    return <span className={`rk-move rk-move--new ${className}`}>New</span>;
  }
  if (typeof movement !== 'number') return null;

  if (movement === 0) {
    return (
      <span className={`rk-move rk-move--steady ${className}`} aria-label="Same place as last period">
        <span aria-hidden="true">–</span>
      </span>
    );
  }

  const up = movement > 0;
  const places = Math.abs(movement);
  return (
    <span
      className={`rk-move ${up ? 'rk-move--up' : 'rk-move--down'} ${className}`}
      aria-label={`${up ? 'Up' : 'Down'} ${places} ${places === 1 ? 'place' : 'places'}`}
    >
      <svg viewBox="0 0 10 10" width="9" height="9" aria-hidden="true">
        <path d={up ? 'M1.5 7 5 3.2 8.5 7' : 'M1.5 3 5 6.8 8.5 3'} />
      </svg>
      <span aria-hidden="true">{places}</span>
    </span>
  );
};

export default RankMove;
