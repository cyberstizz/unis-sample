import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import './leaderboardsPage.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import buildUrl from './utils/buildUrl';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';

// ─────────────────────────────────────────────────────────────────────────────
// PLAY TRACKING — deliberately absent from this page.
// The Player component owns play tracking (★ PLAY-FLOW in player.jsx): it
// POSTs /v1/media/song/{id}/play only after 15s of real listening (or 25% of
// duration), with source attribution and playId capture for the
// /play/complete percent flow. This page previously fired its own tracking
// POST at click time, which (a) recorded plays the user never listened to —
// requestPlay can end in the PlayChoiceModal being cancelled — and (b) won
// the backend's 30-minute cooldown race, causing the player's legitimate
// sourced POST to be silently rejected. Every track we hand to requestPlay
// carries source: 'leaderboards' so the player's POST attributes correctly.
//
// DESIGN
// Milestones is the archive: closed periods, settled results, bars measuring
// share of the period. This page is its live sibling and the question is a
// different one — not "who won" but "who is ahead, and can they be caught".
// So the leader gets a plate with an explicit margin readout, and every chase
// row's bar is measured against the leader rather than against the total.
// A row at 90% is visibly within reach; a row at 20% is not. That is the one
// place this page spends any boldness.
// ─────────────────────────────────────────────────────────────────────────────

const JURISDICTIONS = [
  { value: 'downtown-harlem', label: 'Downtown' },
  { value: 'uptown-harlem', label: 'Uptown' },
  { value: 'harlem', label: 'Harlem-wide' },
];

const GENRES = [
  { value: 'rap', label: 'Rap' },
  { value: 'rock', label: 'Rock' },
  { value: 'pop', label: 'Pop' },
];

const CATEGORIES = [
  { value: 'artist', label: 'Artist' },
  { value: 'song', label: 'Song' },
];

const INTERVAL_OPTIONS = [
  { value: 'daily', label: 'Today' },
  { value: 'weekly', label: 'Week' },
  { value: 'monthly', label: 'Month' },
  { value: 'quarterly', label: 'Quarter' },
  { value: 'midterm', label: 'Half' },
  { value: 'annual', label: 'Annual' },
];

const formatNumber = (n) => (Number(n) || 0).toLocaleString('en-US');

// ─── Segmented control ───────────────────────────────────────────────────────
// Matches milestonesPage. Small option counts read better as visible choices
// than as collapsed dropdowns, and it kills the form feel.
const Segmented = ({ label, options, value, onChange, name }) => (
  <div className="lb-segmented" role="group" aria-label={label}>
    {options.map((opt) => {
      const active = opt.value === value;
      return (
        <button
          key={opt.value}
          type="button"
          className={`lb-seg${active ? ' is-active' : ''}`}
          aria-pressed={active}
          onClick={() => onChange(opt.value)}
          data-testid={`${name}-${opt.value}`}
        >
          {opt.label}
        </button>
      );
    })}
  </div>
);

// ─── One row of the chase ────────────────────────────────────────────────────
// Bar width is share of the LEADER's points, not share of the total. On a live
// board the useful question is how close the chase is, and a leader-relative
// bar answers it at a glance. An entry with no points shows a blank rather
// than a "0" — a blank reads as "nothing scored yet", a zero reads as a figure
// worth comparing. The cell keeps its width so rows stay aligned.
const ChaseRow = ({ item, share, index, onOpen, onPlay }) => {
  const hasPoints = item.votes > 0;

  return (
    <li className="lb-chase-row" style={{ '--row-delay': `${index * 45}ms` }}>
      <span className="lb-chase-rank" aria-hidden="true">{item.rank}</span>

      <button
        type="button"
        className="lb-chase-main"
        onClick={() => onOpen(item)}
        aria-label={`Open ${item.title}`}
      >
        <img
          src={item.artwork}
          alt=""
          className="lb-chase-art"
          onError={(e) => { e.target.src = backimage; }}
        />
        <span className="lb-chase-text">
          <span className="lb-chase-title">{item.title}</span>
          {item.type === 'song' && (
            <span className="lb-chase-artist">{item.artist}</span>
          )}
        </span>
      </button>

      <span className="lb-chase-bar" aria-hidden="true">
        {hasPoints && (
          <span className="lb-chase-fill" style={{ width: `${share}%` }} />
        )}
      </span>

      <span className="lb-chase-points">
        {hasPoints && (
          <>
            {formatNumber(item.votes)}
            <span className="lb-chase-unit">pts</span>
          </>
        )}
      </span>

      <button
        type="button"
        className="lb-chase-play"
        onClick={() => onPlay(item)}
        aria-label={`Listen to ${item.title}`}
      >
        <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
          <path d="M8 5v14l11-7z" fill="currentColor" />
        </svg>
      </button>
    </li>
  );
};

const LeaderboardsPage = () => {
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);

  const [jurisdiction, setJurisdiction] = useState('downtown-harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('artist');
  // NOTE: named intervalKey (not `interval`) — a state variable called
  // `interval` shadows window.setInterval inside the component scope.
  const [intervalKey, setIntervalKey] = useState('daily');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handlePlay = async (media) => {
    // Song row with a real file → play it directly.
    if (media.fileUrl) {
      requestPlay({
        type: 'song',
        id: media.id,
        songId: media.id,
        url: media.fileUrl,
        fileUrl: media.fileUrl,
        title: media.title,
        artist: media.artist,
        artistId: media.artistId,
        artwork: media.artwork,
        artworkUrl: media.artwork,
        source: 'leaderboards',
      });
      return;
    }

    // Artist row → fetch their default song, then play it.
    if (media.type === 'artist' && media.id) {
      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/users/${media.id}/default-song`,
        });
        const defaultSong = response.data;

        if (!defaultSong?.fileUrl) return; // artist has no playable song

        const fullUrl = buildUrl(defaultSong.fileUrl);
        const fullArtwork = buildUrl(defaultSong.artworkUrl) || media.artwork;

        requestPlay({
          type: 'song',
          id: defaultSong.songId,
          songId: defaultSong.songId,
          url: fullUrl,
          fileUrl: fullUrl,
          title: defaultSong.title,
          artist: media.name,
          artistId: media.id,
          artwork: fullArtwork,
          artworkUrl: fullArtwork,
          source: 'leaderboards',
        });
      } catch (err) {
        console.error('Leaderboards: default song fetch failed:', err);
      }
    }
    // No fileUrl and not an artist → nothing playable; do nothing rather
    // than falling back to a bundled sample MP3 (removed for production).
  };

  const handleView = () => {
    setIsLoading(true);
    setError(null);
    setResults([]);
    setHasSearched(true);

    const jurId = JURISDICTION_IDS[jurisdiction];
    const genreId = GENRE_IDS[genre];
    const intervalId = INTERVAL_IDS[intervalKey];
    const type = category;

    apiCall({
      method: 'get',
      url: `/v1/vote/leaderboards?jurisdictionId=${jurId}&genreId=${genreId}&targetType=${type}&intervalId=${intervalId}&limit=50`,
    })
      .then((response) => {
        const rawResults = response.data;

        if (!rawResults || rawResults.length === 0) {
          setError('Nothing has scored in this scope yet. Try a wider jurisdiction or a longer period.');
          return;
        }

        const normalized = rawResults.map((item, i) => {
          if (type === 'artist') {
            return {
              id: item.targetId,
              type: 'artist',
              rank: item.rank || (i + 1),
              name: item.name || 'Unknown Artist',
              title: item.name || 'Unknown Artist',
              artist: item.name || 'Unknown Artist',
              votes: item.votes || 0,
              artwork: item.artwork ? buildUrl(item.artwork) : backimage,
              fileUrl: null,
            };
          }
          return {
            id: item.targetId,
            type: 'song',
            rank: item.rank || (i + 1),
            title: item.name || 'Unknown Song',
            artist: item.artist || 'Unknown',
            votes: item.votes || 0,
            fileUrl: item.fileUrl ? buildUrl(item.fileUrl) : null,
            artwork: item.artwork ? buildUrl(item.artwork) : backimage,
          };
        });

        setResults(normalized);
      })
      .catch((err) => {
        console.error('Leaderboards fetch error:', err);
        setError("Couldn't load the standings. Check your connection and try again.");
      })
      .finally(() => {
        setIsLoading(false);
      });
  };

  const handleOpen = (item) => {
    navigate(item.type === 'artist' ? `/artist/${item.id}` : `/song/${item.id}`);
  };

  // ── Derived: leader, chase, margin ────────────────────────────────────────
  const leader = results[0] || null;
  const chase = results.slice(1);
  const runnerUp = results[1] || null;

  // The margin is the live board's whole point — how safe is the lead.
  let marginLabel = null;
  if (leader) {
    if (!runnerUp) {
      marginLabel = 'Uncontested so far';
    } else if (leader.votes === runnerUp.votes) {
      marginLabel = `Tied with ${runnerUp.title}`;
    } else {
      const gap = leader.votes - runnerUp.votes;
      marginLabel = `Ahead by ${formatNumber(gap)} ${gap === 1 ? 'point' : 'points'}`;
    }
  }

  const scopeLabel = [
    JURISDICTIONS.find((o) => o.value === jurisdiction)?.label,
    GENRES.find((o) => o.value === genre)?.label,
  ].join(' · ');

  return (
    <Layout backgroundImage={backimage}>
      <div className="lb-page">
        <div className="lb-shell">
          <header className="lb-masthead">
            <p className="lb-eyebrow">Live standings</p>
            <h1 className="lb-wordmark">Leaderboards</h1>
            <p className="lb-lede">Who's ahead right now, and by how much.</p>
          </header>

          {/* ── Controls ─────────────────────────────────────────────────── */}
          <section className="lb-controls" aria-label="Choose a leaderboard">
            <div className="lb-control-row">
              <Segmented
                name="jurisdiction"
                label="Jurisdiction"
                options={JURISDICTIONS}
                value={jurisdiction}
                onChange={setJurisdiction}
              />
              <Segmented
                name="genre"
                label="Genre"
                options={GENRES}
                value={genre}
                onChange={setGenre}
              />
              <Segmented
                name="category"
                label="Category"
                options={CATEGORIES}
                value={category}
                onChange={setCategory}
              />
            </div>

            <div className="lb-control-row lb-control-row--period">
              <Segmented
                name="interval"
                label="Time period"
                options={INTERVAL_OPTIONS}
                value={intervalKey}
                onChange={setIntervalKey}
              />
              <button
                type="button"
                className="lb-submit"
                onClick={handleView}
                disabled={isLoading}
              >
                {isLoading ? 'Loading' : 'Show standings'}
              </button>
            </div>
          </section>

          {/* ── Results ──────────────────────────────────────────────────── */}
          {isLoading ? (
            <div className="lb-state" role="status" aria-live="polite">
              <p className="lb-state-title">Counting the votes and plays…</p>
            </div>
          ) : error ? (
            <div className="lb-state" role="alert">
              <p className="lb-state-title">No standings yet</p>
              <p className="lb-state-body">{error}</p>
            </div>
          ) : leader ? (
            <>
              {/* Leader plate */}
              <section className="lb-leader" aria-label="Current leader">
                <div className="lb-leader-glow" aria-hidden="true">
                  <img src={leader.artwork} alt="" />
                </div>

                <img
                  src={leader.artwork}
                  alt={leader.type === 'artist' ? `${leader.title} photo` : `${leader.title} artwork`}
                  className="lb-leader-art"
                  onError={(e) => { e.target.src = backimage; }}
                />

                <div className="lb-leader-body">
                  <p className="lb-leader-eyebrow">
                    Leading · {scopeLabel}
                  </p>
                  <h2 className="lb-leader-title">{leader.title}</h2>
                  {leader.type === 'song' && (
                    <p className="lb-leader-artist">{leader.artist}</p>
                  )}

                  <div className="lb-leader-actions">
                    <button
                      type="button"
                      className="lb-btn lb-btn--primary"
                      onClick={() => handlePlay(leader)}
                    >
                      Listen
                    </button>
                    <button
                      type="button"
                      className="lb-btn"
                      onClick={() => handleOpen(leader)}
                    >
                      {leader.type === 'artist' ? 'View artist' : 'View song'}
                    </button>
                  </div>
                </div>

                <div className="lb-leader-tally">
                  <p className="lb-leader-score">
                    <span className="lb-leader-figure">{formatNumber(leader.votes)}</span>
                    <span className="lb-leader-unit">points</span>
                  </p>
                  <p className="lb-leader-margin">{marginLabel}</p>
                </div>
              </section>

              {/* Chase rail */}
              {chase.length > 0 && (
                <section className="lb-chase" aria-label="The chase">
                  <div className="lb-chase-head">
                    <h3 className="lb-chase-heading">The chase</h3>
                    <span className="lb-chase-meta">
                      Bars show each entry against the leader
                    </span>
                  </div>

                  <ol className="lb-chase-list">
                    {chase.map((item, i) => (
                      <ChaseRow
                        key={`${item.type}-${item.id}`}
                        item={item}
                        share={leader.votes > 0
                          ? Math.max(2, Math.round((item.votes / leader.votes) * 100))
                          : 0}
                        index={i}
                        onOpen={handleOpen}
                        onPlay={handlePlay}
                      />
                    ))}
                  </ol>
                </section>
              )}
            </>
          ) : (
            <div className="lb-state">
              <p className="lb-state-title">
                {hasSearched ? 'No standings yet' : 'Pick a scope'}
              </p>
              <p className="lb-state-body">
                Choose a jurisdiction, genre and period, then show the standings.
              </p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default LeaderboardsPage;