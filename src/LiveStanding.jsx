import React, { useCallback, useEffect, useState } from 'react';
import { ChevronRight, RefreshCw, Trophy } from 'lucide-react';
import { fetchStandings, formatCloseTime } from './utils/standings';

// =============================================================================
// LiveStanding — where the artist is in today's Artist of the Day race, read
// from the same board as Charts and the vote pages (GET /v1/awards/standings).
//
//   variant="card"  dashboard Home: "#3 in Harlem today", opens Races
//   variant="hero"  Races tab: the big live number
// =============================================================================

const fmt = (n) => Number(n || 0).toLocaleString('en-US');

function useLiveStanding(artistId, jurisdictionId) {
  const [state, setState] = useState({ loading: Boolean(artistId && jurisdictionId), error: false, board: null });

  const load = useCallback(() => {
    if (!artistId || !jurisdictionId) return undefined;
    let active = true;
    setState((s) => ({ ...s, loading: true, error: false }));
    fetchStandings({ type: 'artist', jurisdictionId, genre: 'all', period: 'daily', limit: 50 })
      .then((board) => {
        if (active) setState({ loading: false, error: false, board });
      })
      .catch((err) => {
        console.error('Live standing failed:', err);
        if (active) setState({ loading: false, error: true, board: null });
      });
    return () => {
      active = false;
    };
  }, [artistId, jurisdictionId]);

  useEffect(() => load(), [load]);

  const entries = state.board?.entries || [];
  const index = entries.findIndex((e) => e.id === artistId || e.artistId === artistId);
  const entry = index >= 0 ? entries[index] : null;
  const above = index > 0 ? entries[index - 1] : null;
  const live = (state.board?.state || 'LIVE') === 'LIVE';

  return {
    ...state,
    retry: load,
    live,
    rank: entry?.rank ?? null,
    points: entry?.points ?? 0,
    gap: entry && above ? Math.max(0, above.points - entry.points) : null,
    aboveRank: above?.rank ?? null,
    closes: state.board?.closesAt ? formatCloseTime(state.board.closesAt) : '',
  };
}

const LiveStanding = ({ artistId, jurisdictionId, placeName, variant = 'card', latestWin, onOpen }) => {
  const s = useLiveStanding(artistId, jurisdictionId);
  const place = placeName || 'your area';
  const when = s.live ? 'today' : 'yesterday';

  if (!jurisdictionId) return null;

  if (variant === 'hero') {
    return (
      <section className="ad-card ad-live ad-live--hero" aria-labelledby="ad-live-title">
        <span className="ad-live__kicker">
          {s.live && <span className="ad-live__dot" aria-hidden="true" />}
          {s.live ? 'Live · Artist of the day' : 'Final · Artist of the day'}
        </span>
        <h2 id="ad-live-title" className="ad-live__big">
          {s.loading ? (
            <span className="ad-live__muted">Checking today’s race…</span>
          ) : s.error ? (
            <span className="ad-live__muted">Couldn’t load today’s race.</span>
          ) : s.rank ? (
            <>
              <span className="ad-live__num">#{fmt(s.rank)}</span> <span className="ad-live__where">in {place}</span>
            </>
          ) : (
            <span className="ad-live__where">Not in {place}’s top 50 {when} yet</span>
          )}
        </h2>
        {s.error ? (
          <button type="button" className="ad-card__link" onClick={s.retry}>
            <RefreshCw size={13} aria-hidden="true" /> Try again
          </button>
        ) : !s.loading && (
          <p className="ad-live__detail">
            {s.rank
              ? [
                  `${fmt(s.points)} points`,
                  s.gap != null && s.aboveRank ? `${fmt(s.gap)} behind #${s.aboveRank}` : s.rank === 1 ? 'in the lead' : null,
                  s.live && s.closes ? `results final at ${s.closes}` : null,
                ].filter(Boolean).join(' · ')
              : 'Every play, like and vote today counts toward Artist of the Day.'}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="ad-card ad-live" aria-label="Today’s race">
      <button type="button" className="ad-live__row" onClick={onOpen}>
        <span className="ad-live__num">{s.rank ? `#${fmt(s.rank)}` : '—'}</span>
        <span className="ad-live__text">
          <strong>
            {s.loading ? 'Checking today’s race…' : s.rank ? `in ${place} ${when}` : `Not in the top 50 ${when}`}
          </strong>
          <span>
            {s.error
              ? 'Couldn’t load today’s race.'
              : s.rank
                ? ['Artist of the day', `${fmt(s.points)} points`, s.live && s.closes ? `final at ${s.closes}` : null].filter(Boolean).join(' · ')
                : 'Plays, likes and votes today count toward Artist of the Day.'}
          </span>
        </span>
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {latestWin && (
        <div className="ad-win">
          <Trophy size={16} aria-hidden="true" />
          <span>Latest win: {latestWin}</span>
        </div>
      )}
    </section>
  );
};

export default LiveStanding;
