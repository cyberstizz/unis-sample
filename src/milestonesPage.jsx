import React, { useState } from 'react';
import { apiCall } from './components/axiosInstance';
import './milestonesPage.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
import IntervalDatePicker from './intervalDatePicker';
import './intervalDatePicker.scss';

const MilestonesPage = () => {
  // ─── Input state (changes immediately on user toggle) ───────────────────
  const [location, setLocation] = useState('downtown-harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('song');
  const [selectedDate, setSelectedDate] = useState('');
  const [interval, setInterval] = useState('daily');

  // ─── Display state (only updates on successful "View") ──────────────────
  const [displayedContext, setDisplayedContext] = useState(null);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState([]);
  const [totalVotes, setTotalVotes] = useState(0);
  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  // ─── Formatting helpers (unchanged from original) ───────────────────────
  const formatLocation = (loc) =>
    loc.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').toUpperCase();

  const formatGenre = (g) => (g === 'rap' ? 'RAP' : g.toUpperCase());
  const formatCategory = (cat) => cat.toUpperCase();

  const getIntervalText = (int) => ({
    daily: 'OF THE DAY',
    weekly: 'OF THE WEEK',
    monthly: 'OF THE MONTH',
    quarterly: 'OF THE QUARTER',
    midterm: 'OF THE MIDTERM',
    annual: 'OF THE YEAR',
  }[int] || 'OF THE DAY');

  const formatDateDisplay = (dateString, intervalType) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    switch (intervalType) {
      case 'daily':
        return `${days[date.getDay()]}, ${months[month - 1]} ${day}, ${year}`;
      case 'weekly': {
        const dow = date.getDay();
        const daysToMonday = dow === 0 ? 6 : dow - 1;
        const monday = new Date(year, month - 1, day - daysToMonday);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        return `Week of ${months[monday.getMonth()]} ${monday.getDate()} - ${sunday.getDate()}, ${monday.getFullYear()}`;
      }
      case 'monthly':
        return `${months[month - 1]} ${year}`;
      case 'quarterly': {
        const q = Math.floor((month - 1) / 3) + 1;
        return `Q${q} ${year}`;
      }
      case 'midterm': {
        const h = month <= 6 ? 1 : 2;
        return `${h === 1 ? 'First' : 'Second'} Half of ${year}`;
      }
      case 'annual':
        return `Year ${year}`;
      default:
        return `${months[month - 1]} ${day}, ${year}`;
    }
  };

  const getDateRangeForInterval = (sel, intervalType) => {
    if (!sel) return { startDate: null, endDate: null };
    const [year, month, day] = sel.split('-').map(Number);
    const endDate = new Date(year, month - 1, day);
    const startDate = new Date(year, month - 1, day);

    switch (intervalType) {
      case 'daily': break;
      case 'weekly': {
        const dow = startDate.getDay();
        const daysToMonday = dow === 0 ? 6 : dow - 1;
        startDate.setDate(startDate.getDate() - daysToMonday);
        endDate.setDate(startDate.getDate() + 6);
        break;
      }
      case 'monthly':
        startDate.setDate(1);
        endDate.setDate(new Date(year, month, 0).getDate());
        break;
      case 'quarterly': {
        const qStart = Math.floor((month - 1) / 3) * 3;
        startDate.setMonth(qStart); startDate.setDate(1);
        endDate.setMonth(qStart + 2);
        endDate.setDate(new Date(year, qStart + 3, 0).getDate());
        break;
      }
      case 'midterm':
        if (month <= 6) {
          startDate.setMonth(0); startDate.setDate(1);
          endDate.setMonth(5); endDate.setDate(30);
        } else {
          startDate.setMonth(6); startDate.setDate(1);
          endDate.setMonth(11); endDate.setDate(31);
        }
        break;
      case 'annual':
        startDate.setMonth(0); startDate.setDate(1);
        endDate.setMonth(11); endDate.setDate(31);
        break;
      default: break;
    }

    const fmt = (d) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { startDate: fmt(startDate), endDate: fmt(endDate) };
  };

  // ─── Caption (uses frozen displayedContext, not live input) ─────────────
  const generateCaption = () => {
    if (!displayedContext || results.length === 0) return null;
    const dc = displayedContext;
    return (
      <div className="caption-container">
        <div className="caption-top">{formatLocation(dc.location)} {formatGenre(dc.genre)}</div>
        <div className="caption-headline">{formatCategory(dc.category)} {getIntervalText(dc.interval)}</div>
        <div className="caption-date">{formatDateDisplay(dc.selectedDate, dc.interval)}</div>
      </div>
    );
  };

  const generateWinnerCaption = (award) => {
    const m = award.determinationMethod;
    if (!m || m === 'WEIGHTED_VOTES') return `Winner with ${award.weightedPoints || 0} points`;
    return 'Winner';
  };

  // ─── Fetch handler ──────────────────────────────────────────────────────
  const handleView = async () => {
    if (!selectedDate) {
      setError('Select a date.');
      return;
    }
    setIsLoading(true);
    setError(null);
    setResults([]);
    setTotalVotes(0);

    try {
      const jurId = JURISDICTION_IDS[location];
      const genreId = GENRE_IDS[genre];
      const intervalId = INTERVAL_IDS[interval];
      const type = category;

      if (!jurId) throw new Error('Invalid location');
      if (!genreId) throw new Error('Invalid genre');
      if (!intervalId) throw new Error('Invalid interval');

      const { startDate, endDate } = getDateRangeForInterval(selectedDate, interval);

      const response = await apiCall({
        method: 'get',
        url: `/v1/awards/period-leaderboard?type=${type}&startDate=${startDate}&endDate=${endDate}&jurisdictionId=${jurId}&genreId=${genreId}&intervalId=${intervalId}&limit=5`,
      });

      // Support BOTH response shapes:
      //   1. Current backend: bare array of Award entities.
      //   2. Future backend: { winner, leaderboard, totalVotes }
      const payload = response.data;
      const rawArray = Array.isArray(payload) ? payload : (payload.leaderboard || [payload.winner].filter(Boolean));
      const apiTotalVotes = Array.isArray(payload) ? null : payload.totalVotes;

      if (!rawArray || rawArray.length === 0) {
        setError('No awards found for this period. Try a different date.');
        setResults([]);
        return;
      }

      const normalized = rawArray.map((award, i) => {
        let title, artist, artwork;
        if (award.targetType === 'artist') {
          title = award.user?.username || award.title || 'Unknown Artist';
          artist = award.user?.username || award.artist || 'Unknown Artist';
          const ph = award.user?.photoUrl || award.artwork;
          artwork = ph
            ? (ph.startsWith('http') ? ph : `${API_BASE_URL}${ph}`)
            : rapperOne;
        } else {
          title = award.song?.title || award.title || 'Unknown Song';
          artist = award.song?.artist?.username || award.artist || 'Unknown Artist';
          const aw = award.song?.artworkUrl || award.artwork;
          artwork = aw
            ? (aw.startsWith('http') ? aw : `${API_BASE_URL}${aw}`)
            : songArtFour;
        }

        return {
          rank: award.rank || i + 1,
          id: award.targetId,
          targetType: award.targetType,
          title,
          artist,
          jurisdiction: award.jurisdiction?.name || location,
          votes: award.votesCount || award.votes || 0,
          weightedPoints: award.weightedPoints || 0,
          playsCount: award.playsCount || 0,
          likesCount: award.likesCount || 0,
          artwork,
          determinationMethod: award.determinationMethod,
          tiedCandidatesCount: award.tiedCandidatesCount || 0,
          caption: award.caption || (i === 0 ? generateWinnerCaption(award) : null),
        };
      });

      setResults(normalized);
      setTotalVotes(
        apiTotalVotes != null
          ? apiTotalVotes
          : normalized.reduce((sum, item) => sum + (item.votes || 0), 0)
      );

      // Freeze displayed context — caption stays in sync with what's shown.
      setDisplayedContext({ location, genre, category, interval, selectedDate });
    } catch (err) {
      console.error('Milestones fetch error:', err);
      setError(err.message || 'Failed to load milestones.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Max date logic ─────────────────────────────────────────────────────
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  let currentMaxDate = yesterday.toISOString().split('T')[0];
  if (interval === 'annual') {
    const cy = new Date().getFullYear();
    currentMaxDate = `${cy - 1}-12-31`;
  }
  const minDate = '2025-10-26';

  const winner = results[0];
  const caption = generateCaption();

  const getDeterminationBadge = (method, tiedCount) => {
    if (!method) return null;
    switch (method) {
      case 'WEIGHTED_VOTES':
        return null; // no badge needed; points already shown prominently
      case 'PLAYS':
        return <span className="badge tiebreaker plays">Tie broken by {tiedCount} plays</span>;
      case 'LIKES':
        return <span className="badge tiebreaker likes">Tie broken by likes</span>;
      case 'SCORE':
        return <span className="badge tiebreaker score">Tie broken by score</span>;
      case 'SENIORITY':
        return <span className="badge tiebreaker seniority">Tie broken by seniority</span>;
      case 'FALLBACK':
        return <span className="badge fallback">No votes cast</span>;
      default:
        return null;
    }
  };

  const formatNumber = (n) => (n || 0).toLocaleString('en-US');
  // Always render the chart when we have a winner. With one row it shows just rank 1
  // (highlighted); with more rows it fills out the top 5. No empty/hidden states.
  const showLeaderboard = results.length > 0;

  return (
    <Layout backgroundImage={backimage}>
      <div className="milestones-page-container">
        <main className="content-wrapper">

          {/* ─── Filter bar ─────────────────────────────────────────── */}
          <section className="filter-bar">
            <div className="filter-pills">
              <select value={location} onChange={(e) => setLocation(e.target.value)} className="filter-select">
                <option value="downtown-harlem">Downtown Harlem</option>
                <option value="uptown-harlem">Uptown Harlem</option>
                <option value="harlem">Harlem (All)</option>
              </select>
              <select value={genre} onChange={(e) => setGenre(e.target.value)} className="filter-select">
                <option value="rap">Rap</option>
                <option value="rock">Rock</option>
                <option value="pop">Pop</option>
              </select>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="filter-select">
                <option value="artist">Artist</option>
                <option value="song">Song</option>
              </select>
              <select value={interval} onChange={(e) => setInterval(e.target.value)} className="filter-select">
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
                <option value="midterm">Midterm</option>
                <option value="annual">Annual</option>
              </select>
              <IntervalDatePicker
                interval={interval}
                value={selectedDate}
                onChange={setSelectedDate}
                maxDate={currentMaxDate}
                minDate={minDate}
              />
            </div>
            <button onClick={handleView} className="view-button" disabled={isLoading}>
              {isLoading ? 'Loading…' : 'View'}
            </button>
          </section>

          {/* ─── Caption ────────────────────────────────────────────── */}
          {caption && (
            <section className="milestone-caption">
              {caption}
            </section>
          )}

          {/* ─── Showcase: winner + leaderboard ─────────────────────── */}
          {winner && (
            <section
              className={`showcase ${showLeaderboard ? 'has-leaderboard' : 'winner-only'}`}
              key={`${winner.id}-${displayedContext?.selectedDate}`}
            >
              {/* Winner card */}
              <article className="winner-card prestige-animate">
                <div
                  className="ambient-glow"
                  style={{ backgroundImage: `url(${winner.artwork})` }}
                />
                <div className="winner-content">
                  <div className="winner-artwork-wrapper">
                    <img
                      src={winner.artwork}
                      alt={`${winner.title} artwork`}
                      className="winner-artwork"
                    />
                    <div className="artwork-shine" />
                  </div>

                  <div className="winner-meta">
                    <div className="winner-eyebrow">
                      #1 · {displayedContext && formatLocation(displayedContext.location)}
                    </div>
                    <h3 className="winner-title">{winner.title}</h3>
                    <p className="winner-artist">{winner.artist}</p>
                  </div>

                  <div className="winner-stats">
                    <div className="stat">
                      <span className="stat-value">{formatNumber(winner.weightedPoints)}</span>
                      <span className="stat-label">Points</span>
                    </div>
                    <div className="stat-divider" />
                    <div className="stat">
                      <span className="stat-value">{formatNumber(winner.votes)}</span>
                      <span className="stat-label">Votes</span>
                    </div>
                    <div className="stat-divider" />
                    <div className="stat">
                      <span className="stat-value">{formatNumber(winner.playsCount)}</span>
                      <span className="stat-label">Plays</span>
                    </div>
                    <div className="stat-divider" />
                    <div className="stat">
                      <span className="stat-value">{formatNumber(winner.likesCount)}</span>
                      <span className="stat-label">Likes</span>
                    </div>
                  </div>

                  {getDeterminationBadge(winner.determinationMethod, winner.tiedCandidatesCount)}

                  {winner.caption && winner.determinationMethod !== 'WEIGHTED_VOTES' && (
                    <div className="winner-caption">{winner.caption}</div>
                  )}
                </div>
              </article>

              {/* Leaderboard card */}
              {showLeaderboard && (
                <article className="leaderboard-card">
                  <header className="leaderboard-header">
                    <div className="leaderboard-label">
                      <span className="label-eyebrow">
                        {displayedContext && formatCategory(displayedContext.category)}{' '}
                        {displayedContext && getIntervalText(displayedContext.interval)}
                      </span>
                      <span className="label-meta">
                        {totalVotes > 0
                          ? `Decided by ${formatNumber(totalVotes)} votes`
                          : 'Top performers'}
                      </span>
                    </div>
                    <span className="leaderboard-region">
                      Live · {displayedContext && formatLocation(displayedContext.location).split(' ')[0]}
                    </span>
                  </header>

                  <ul className="leaderboard-list">
                    {results.slice(0, 5).map((item, idx) => (
                      <li
                        key={item.id || item.rank}
                        className={`leaderboard-row ${idx === 0 ? 'is-winner' : ''}`}
                        style={{ animationDelay: `${idx * 0.08}s` }}
                      >
                        <span className="row-rank">{item.rank}</span>
                        <div className="row-info">
                          <span className="row-title">{item.title}</span>
                          <span className="row-subtitle">{item.artist}</span>
                        </div>
                        <div className="row-metric">
                          <span className="metric-value">{formatNumber(item.weightedPoints)}</span>
                          <span className="metric-label">Points</span>
                        </div>
                      </li>
                    ))}
                  </ul>
                </article>
              )}
            </section>
          )}

          {/* ─── States ─────────────────────────────────────────────── */}
          <section className="state-section">
            {isLoading && <div className="loading-message">Loading milestones…</div>}
            {!isLoading && error && <div className="error-message">{error}</div>}
          </section>

        </main>
      </div>
    </Layout>
  );
};

export default MilestonesPage;