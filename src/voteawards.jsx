import React, { useState, useContext, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import './voteawards.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import VotingWizard from './votingWizard';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
import { Search, X } from 'lucide-react';
import { buildUrl } from './utils/buildUrl';
import RankMove from './components/RankMove';
import { fetchStandings, describeBoard, playEntry, formatCount, periodByKey } from './utils/standings';

// Nominees come from /v1/awards/standings (utils/standings.js), ranked by the
// same formula that decides the award, for the period this voter's vote counts
// toward. Before anyone scores in a new period they're ordered by how the last
// one finished — the status line above the grid says which.
const NOMINEE_PAGE = 48;

const VoteAwards = () => {
  const navigate = useNavigate();
  const { requestPlay } = useContext(PlayerContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef(null);
  const [selectedGenre, setSelectedGenre] = useState('rap');
  const [selectedType, setSelectedType] = useState('artist');
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('harlem');
  const [nominees, setNominees] = useState([]);
  const [board, setBoard] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [userId, setUserId] = useState(null);
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });
  const [lastWinner, setLastWinner] = useState(null);
  const [winnerLoading, setWinnerLoading] = useState(false);

  const intervals = [
    { value: 'daily', label: 'Day' },
    { value: 'weekly', label: 'Week' },
    { value: 'monthly', label: 'Month' },
    { value: 'quarterly', label: 'Quarter' },
    { value: 'annual', label: 'Year' },
  ];
  const genres = ['rap', 'rock', 'pop'];
  const types = ['artist', 'song'];
  const jurisdictions = [
    { value: 'uptown-harlem', label: 'Uptown Harlem' },
    { value: 'downtown-harlem', label: 'Downtown Harlem' },
    { value: 'harlem', label: 'Harlem' },
  ];

  useEffect(() => {
    const trackAdView = async () => {
      try {
        await apiCall({ url: '/v1/earnings/track-view', method: 'post' });
      } catch (err) {
        // Silent
      }
    };
    trackAdView();
  }, []);

  // Countdown timer — follows the selected poll interval in America/New_York.
  // This re-renders VoteAwards every second, which is exactly why the
  // VotingWizard filters prop MUST be memoized below — otherwise the wizard
  // saw a fresh object every render and reset itself to step 1.
  useEffect(() => {
    const getNewYorkNow = () => {
      const nyString = new Date().toLocaleString('en-US', {
        timeZone: 'America/New_York',
      });

      return new Date(nyString);
    };

    const getPollEndDate = (interval) => {
      const now = getNewYorkNow();
      const end = new Date(now);

      if (interval === 'daily') {
        end.setDate(end.getDate() + 1);
        end.setHours(0, 0, 0, 0);
        return end;
      }

      if (interval === 'weekly') {
        const day = end.getDay();
        const daysUntilMonday = day === 0 ? 1 : 8 - day;

        end.setDate(end.getDate() + daysUntilMonday);
        end.setHours(0, 0, 0, 0);
        return end;
      }

      if (interval === 'monthly') {
        end.setMonth(end.getMonth() + 1, 1);
        end.setHours(0, 0, 0, 0);
        return end;
      }

      if (interval === 'quarterly') {
        const currentMonth = end.getMonth();
        const currentQuarter = Math.floor(currentMonth / 3);
        const nextQuarterStartMonth = (currentQuarter + 1) * 3;

        if (nextQuarterStartMonth >= 12) {
          end.setFullYear(end.getFullYear() + 1, 0, 1);
        } else {
          end.setMonth(nextQuarterStartMonth, 1);
        }

        end.setHours(0, 0, 0, 0);
        return end;
      }

      if (interval === 'annual') {
        end.setFullYear(end.getFullYear() + 1, 0, 1);
        end.setHours(0, 0, 0, 0);
        return end;
      }

      end.setDate(end.getDate() + 1);
      end.setHours(0, 0, 0, 0);
      return end;
    };

    const calcTimeLeft = () => {
      const now = getNewYorkNow();
      const pollEnd = getPollEndDate(selectedInterval);
      const diff = Math.max(0, pollEnd - now);

      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };
    };

    setCountdown(calcTimeLeft());
    const timer = setInterval(() => setCountdown(calcTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, [selectedInterval]);

  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setUserId(payload.userId);
      } catch (e) {
        console.error('Failed to decode token:', e);
      }
    }
  }, []);

  useEffect(() => {
    fetchNominees();
  }, [selectedGenre, selectedType, selectedInterval, selectedJurisdiction, userId]);

  const getNewYorkNow = () => {
    const nyString = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
    });

    return new Date(nyString);
  };

  // ── Winner lookup window ──────────────────────────────────────────────
  // We want the MOST RECENT winner for the selected interval, not an award
  // dated one exact day. The old logic asked for exactly "yesterday", so any
  // jurisdiction whose cron row landed on a slightly different date (a missed
  // run, a backfill, a timezone edge) showed "pending" despite having awards.
  //
  // The backend filters by intervalId and returns newest-first
  // (ORDER BY award_date DESC), and fetchLastWinner takes [0], so a wide
  // lookback per cadence reliably surfaces the current winner while a single
  // missed cron day can no longer blank the card. The displayed "Won <date>"
  // still comes from the award's own awardDate, so it stays accurate.
  const getWinnerLookbackWindow = (interval) => {
    const end = getNewYorkNow();
    end.setHours(0, 0, 0, 0);
    end.setDate(end.getDate() - 1);   

    const lookbackDays = {
      daily: 30,
      weekly: 90,
      monthly: 400,
      quarterly: 500,
      annual: 800,
    }[interval] ?? 30;

    const start = new Date(end);
    start.setDate(start.getDate() - lookbackDays);
    start.setHours(0, 0, 0, 0);

    return { startDate: start, endDate: end };
  };

  const toApiDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const formatAwardDate = (dateString) => {
    if (!dateString) return '';

    const date = new Date(`${dateString}T00:00:00`);

    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(date);
  };

  const getWinnerImage = (award) => {
    const imagePath = selectedType === 'artist'
      ? (
          award?.winner?.photoUrl ||
          award?.artist?.photoUrl ||
          award?.user?.photoUrl ||
          award?.target?.photoUrl
        )
      : (
          award?.song?.artworkUrl ||
          award?.winner?.artworkUrl ||
          award?.target?.artworkUrl
        );

    return imagePath ? buildUrl(imagePath) : null;
  };

  const getWinnerName = (award) => {
    if (selectedType === 'artist') {
      return (
        award?.winner?.username ||
        award?.artist?.username ||
        award?.user?.username ||
        award?.target?.username ||
        'Unknown Artist'
      );
    }

    return (
      award?.song?.title ||
      award?.winner?.title ||
      award?.target?.title ||
      'Unknown Song'
    );
  };

  const getWinnerArtistName = (award) => {
    if (selectedType === 'artist') return null;

    return (
      award?.song?.artist?.username ||
      award?.winner?.artist?.username ||
      award?.target?.artist?.username ||
      'Unknown Artist'
    );
  };

  const getWinnerTargetId = (award) => {
    if (selectedType === 'artist') {
      return (
        award?.winner?.userId ||
        award?.artist?.userId ||
        award?.user?.userId ||
        award?.target?.userId ||
        award?.targetId
      );
    }

    return (
      award?.song?.songId ||
      award?.winner?.songId ||
      award?.target?.songId ||
      award?.targetId
    );
  };

  const toNominee = (e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    genreKey: selectedGenre,
    artist: e.type === 'song' ? (e.artistName || 'Unknown Artist') : undefined,
    artistId: e.artistId,
    imageUrl: e.artwork || backimage,
    artwork: e.artwork,
    mediaUrl: e.fileUrl,
    fileUrl: e.fileUrl,
    rank: e.rank,
    points: e.points,
    votes: e.votes,
    plays: e.plays,
    movement: e.movement,
    isNew: e.isNew,
    jurisdiction: e.homeJurisdictionName || '',
    jurisdictionId: e.homeJurisdictionId || null,
  });

  const fetchNominees = async () => {
    setLoading(true);
    setError('');
    try {
      const b = await fetchStandings({
        type: selectedType,
        jurisdictionId: JURISDICTION_IDS[selectedJurisdiction],
        genre: selectedGenre,
        period: selectedInterval,
        limit: NOMINEE_PAGE,
        offset: 0,
      });
      setBoard(b);
      setNominees(b.entries.map(toNominee));
    } catch (err) {
      console.error('Failed to fetch nominees:', err);
      setError('Failed to load nominees. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadMoreNominees = async () => {
    if (!board || loadingMore) return;
    setLoadingMore(true);
    try {
      const b = await fetchStandings({
        type: selectedType,
        jurisdictionId: JURISDICTION_IDS[selectedJurisdiction],
        genre: selectedGenre,
        period: selectedInterval,
        limit: NOMINEE_PAGE,
        offset: nominees.length,
      });
      setNominees((prev) => {
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...b.entries.filter((e) => !seen.has(e.id)).map(toNominee)];
      });
      setBoard((prev) => ({ ...prev, total: b.total }));
    } catch (err) {
      console.error('Failed to load more nominees:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    const fetchLastWinner = async () => {
      const genreId = GENRE_IDS[selectedGenre];
      const jurisdictionId = JURISDICTION_IDS[selectedJurisdiction];
      const intervalId = INTERVAL_IDS[selectedInterval];

      if (!genreId || !jurisdictionId || !intervalId) {
        setLastWinner(null);
        return;
      }

      setWinnerLoading(true);

      const { startDate, endDate } = getWinnerLookbackWindow(selectedInterval);

      try {
        const res = await apiCall({
          method: 'get',
          url:
            `/v1/awards/past?type=${selectedType}` +
            `&startDate=${toApiDate(startDate)}` +
            `&endDate=${toApiDate(endDate)}` +
            `&jurisdictionId=${jurisdictionId}` +
            `&intervalId=${intervalId}` +
            `&genreId=${genreId}`,
        });

        // Keep any award with a resolvable target. We deliberately do NOT
        // require award.awardId here: with the backend now pure-read, this is
        // just defensive — a valid target is the real signal that a row is a
        // usable winner.
        const awards = (res.data || [])
          .filter((award) => getWinnerTargetId(award))
          .sort((a, b) => {
            const aTime = new Date(a.awardDate || 0).getTime();
            const bTime = new Date(b.awardDate || 0).getTime();
            return bTime - aTime;
          });

        if (awards.length === 0) {
          setLastWinner(null);
          return;
        }

        const award = awards[0];

        setLastWinner({
          id: getWinnerTargetId(award),
          name: getWinnerName(award),
          artistName: getWinnerArtistName(award),
          imageUrl: getWinnerImage(award),
          awardDate: award.awardDate,
        });
      } catch (err) {
        console.error('Failed to fetch last winner:', err);
        setLastWinner(null);
      } finally {
        setWinnerLoading(false);
      }
    };

    fetchLastWinner();
  }, [selectedGenre, selectedType, selectedInterval, selectedJurisdiction]);

  const filteredNominees = nominees.filter((nominee) => {
    if (searchQuery.length === 0) return true;
    return nominee.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleVoteClick = (nominee) => {
    setSelectedNominee(nominee);
    setShowVotingWizard(true);
  };

  const handleVoteSuccess = async (nomineeId) => {
    setShowVotingWizard(false);
    setSelectedNominee(null);
    await fetchNominees();
  };

  // Plays are counted by the Player after real listening — never here.
  const handlePlaySong = (nominee) => playEntry({
    type: 'song',
    id: nominee.id,
    name: nominee.name,
    artistName: nominee.artist,
    artistId: nominee.artistId,
    fileUrl: nominee.mediaUrl,
    artwork: nominee.artwork,
  }, requestPlay, 'voteawards');

  const handleNomineeClick = (nominee) => {
    if (nominee.type === 'artist') {
      navigate(`/artist/${nominee.id}`);
    } else {
      navigate(`/song/${nominee.id}`);
    }
  };

  const handleWinnerClick = () => {
    if (!lastWinner?.id) return;

    if (selectedType === 'artist') {
      navigate(`/artist/${lastWinner.id}`);
    } else {
      navigate(`/song/${lastWinner.id}`);
    }
  };

  const handlePlayArtistDefault = async (nominee) => {
    const played = await playEntry({
      type: 'artist',
      id: nominee.id,
      name: nominee.name,
      artwork: nominee.artwork,
    }, requestPlay, 'voteawards');
    if (!played) alert(`${nominee.name} has not set a default song yet.`);
  };

  const jurisdictionLabel = jurisdictions.find(j => j.value === selectedJurisdiction)?.label || 'Unknown';
  const intervalLabel = intervals.find(i => i.value === selectedInterval)?.label || selectedInterval;
  const genreLabel = selectedGenre.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('/');
  const typeLabel = selectedType.charAt(0).toUpperCase() + selectedType.slice(1);

  const pad = (n) => String(n).padStart(2, '0');
  const boardStatus = board ? describeBoard(board) : null;
  const pointsLabel = board?.state === 'LIVE'
    ? `Points ${periodByKey(selectedInterval).current}`
    : `Points ${periodByKey(selectedInterval).previous.toLowerCase()}`;

  // ── Memoize the filters object passed to VotingWizard ─────────────────
  // Without this, the inline object literal `{ selectedGenre, selectedType, ... }`
  // would be a new reference on EVERY parent render — including the per-second
  // countdown tick — which would trigger reset effects inside the wizard.
  const wizardFilters = useMemo(
    () => ({
      selectedGenre,
      selectedType,
      selectedInterval,
      selectedJurisdiction,
    }),
    [selectedGenre, selectedType, selectedInterval, selectedJurisdiction]
  );

  // Distinguish "no eligible content in this category/jurisdiction" from
  // "content exists but no winner has been computed yet". When there are no
  // nominees at all for the selected filters, telling the user to "vote to
  // crown the first winner" is misleading — there is nothing to vote for here.
  const hasNoEligibleContent = !loading && !error && filteredNominees.length === 0 && searchQuery.length === 0;

  // Shared last-winner card. Rendered inside .va-hero-meta so it sits beside
  // the countdown (same level on mobile, stacked beneath it on desktop).
  const lastWinnerCard = (
    <div
      className={`va-last-winner ${lastWinner ? 'has-winner' : 'is-empty'}`}
      onClick={lastWinner ? handleWinnerClick : undefined}
      role={lastWinner ? 'button' : 'status'}
      tabIndex={lastWinner ? 0 : -1}
      onKeyDown={(e) => {
        if (!lastWinner) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleWinnerClick();
        }
      }}
    >
      <div className="va-last-winner-copy">
        <span className="va-last-winner-kicker">
          <span className="va-last-winner-dot" />
          {lastWinner ? `Current` : 'First winner pending'}
        </span>

        {lastWinner ? (
          <>
            <strong className="va-last-winner-name">{lastWinner.name}</strong>

            {lastWinner.artistName && (
              <span className="va-last-winner-artist">by {lastWinner.artistName}</span>
            )}

            {lastWinner.awardDate && (
              <span className="va-last-winner-date">
                Won {formatAwardDate(lastWinner.awardDate)}
              </span>
            )}
          </>
        ) : (
          <span className="va-last-winner-empty">
            {winnerLoading
              ? 'Checking recent winners...'
              : hasNoEligibleContent
                ? `No ${genreLabel} ${selectedType}s in ${jurisdictionLabel} yet.`
                : `Vote to crown the first ${typeLabel} of the ${intervalLabel}.`}
          </span>
        )}
      </div>

      {lastWinner?.imageUrl && (
        <div className="va-last-winner-thumb">
          <img src={lastWinner.imageUrl} alt={`${lastWinner.name} winner artwork`} />
        </div>
      )}
    </div>
  );

  return (
    <Layout backgroundImage={backimage}>
      <div className="va-container">
        {/* ── Filters ── */}
        <div className="va-filters">
          <div className="va-pill">
            <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)}>
              {genres.map((g) => (
                <option key={g} value={g}>
                  {g.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('/')}
                </option>
              ))}
            </select>
          </div>

          <div className="va-pill">
            <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
              {types.map((t) => (
                <option key={t} value={t}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </option>
              ))}
            </select>
          </div>

          <div className="va-pill">
            <select value={selectedInterval} onChange={(e) => setSelectedInterval(e.target.value)}>
              {intervals.map((int) => (
                <option key={int.value} value={int.value}>
                  {int.label}
                </option>
              ))}
            </select>
          </div>

          <div className="va-pill">
            <select value={selectedJurisdiction} onChange={(e) => setSelectedJurisdiction(e.target.value)}>
              {jurisdictions.map((jur) => (
                <option key={jur.value} value={jur.value}>
                  {jur.label}
                </option>
              ))}
            </select>
          </div>

          <button
            className={`va-search-toggle ${searchOpen ? 'active' : ''}`}
            onClick={() => {
              setSearchOpen(!searchOpen);
              if (searchOpen) setSearchQuery('');
            }}
            aria-label="Toggle search"
          >
            {searchOpen ? <X size={15} /> : <Search size={15} />}
          </button>
        </div>

        {/* ── Expandable search ── */}
        {searchOpen && (
          <div className="va-search-expand">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${selectedType}s...`}
              className="va-search-input"
            />
          </div>
        )}

        {/* ── Hero: headline (left) + meta cluster (countdown + last winner) ──
             On desktop .va-hero-meta is a column on the right (countdown over
             winner). On mobile it flips to a row so the countdown and winner
             sit on the same level. See voteawards.scss. */}
        <div className="va-hero">
          <div className="va-hero-text">
            <span className="va-active-poll">Active poll</span>
            <h1 className="va-headline">
              {genreLabel} {typeLabel}{' '}
              <span className="va-headline-accent">of the {intervalLabel}</span>
              <br />
              in {jurisdictionLabel}
            </h1>
          </div>

          <div className="va-hero-meta">
            <div className="va-countdown">
              <span className="va-countdown-label"><span className="va-live-badge">LIVE</span>  Poll ends in</span>
              <span className="va-countdown-time">
                {countdown.days > 0 && (
                  <span className="va-countdown-days">{countdown.days}D&nbsp;</span>
                )}
                {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
              </span>
            </div>

            {lastWinnerCard}
          </div>
        </div>

        {/* ── Nominees grid ── */}
        <section className="va-grid-section">
          {boardStatus && !loading && !error && (
            <p className={`va-board-status va-board-status--${boardStatus.tone}`} role="status">
              <span className="va-board-dot" aria-hidden="true" />
              <strong>{boardStatus.title}.</strong> {boardStatus.detail}
              {board?.state !== 'LIVE' && ' Nominees are in that order until then.'}
            </p>
          )}
          {loading && (
            <div className="va-loading">Loading nominees...</div>
          )}

          {error && (
            <div className="va-error">{error}</div>
          )}

          {!loading && !error && (
            <div className="va-grid">
              {filteredNominees.length > 0 ? (
                filteredNominees.map((nominee, index) => (
                  <div key={nominee.id} className="va-card">
                    <div className="va-card-visual">
                      <div
                        className="va-card-image"
                        style={{ backgroundImage: `url(${nominee.imageUrl})` }}
                        onClick={() => handleNomineeClick(nominee)}
                      />
                      {nominee.points > 0 && (
                        <span className="va-card-rank" aria-label={`Ranked ${nominee.rank}`}>
                          <span className="va-card-rank-num">#{nominee.rank}</span>
                          <RankMove movement={nominee.movement} isNew={nominee.isNew} />
                        </span>
                      )}
                      <div className="va-card-overlay" onClick={() => handleNomineeClick(nominee)}>
                        <h3 className="va-card-name">{nominee.name}</h3>
                        {nominee.type === 'song' && (
                          <p className="va-card-artist">by {nominee.artist}</p>
                        )}
                        <div className="va-card-jurisdiction">
                          <span className="va-jurisdiction-dot" />
                          {nominee.jurisdiction}
                        </div>
                      </div>
                    </div>

                    <div className="va-card-footer">
                     <div className="va-card-ambient" style={{ backgroundImage: `url(${nominee.imageUrl})` }} />
                      <div className="va-card-stats">
                        <div className="va-stat">
                          <span className="va-stat-label">{pointsLabel}</span>
                          <span className="va-stat-value">
                            {formatCount(nominee.points)}
                            {nominee.votes > 0 && (
                              <span className="va-stat-badge">
                                {formatCount(nominee.votes)} vote{nominee.votes === 1 ? '' : 's'}
                              </span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="va-card-buttons">
                        {nominee.type === 'song' && nominee.mediaUrl && (
                          <button onClick={() => handlePlaySong(nominee)} className="va-btn-listen">
                            Listen
                          </button>
                        )}
                        {nominee.type === 'artist' && (
                          <button onClick={() => handlePlayArtistDefault(nominee)} className="va-btn-listen">
                            Listen
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (!userId) {
                              alert('Sign up or log in to vote.');
                              return;
                            }
                            handleVoteClick(nominee);
                          }}
                          className="va-btn-vote"
                        >
                          Vote
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="va-no-nominees">
                  {searchQuery
                    ? 'No nominees match your search.'
                    : `No ${genreLabel} ${selectedType}s in ${jurisdictionLabel} yet.`}
                </p>
              )}
            </div>
          )}

          {!loading && !error && board && nominees.length < board.total && (
            <div className="va-more">
              <button type="button" className="va-more-btn" onClick={loadMoreNominees} disabled={loadingMore}>
                {loadingMore ? 'Loading…' : `Show more nominees (${formatCount(board.total - nominees.length)} more)`}
              </button>
            </div>
          )}
        </section>
      </div>

      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        userId={userId}
        filters={wizardFilters}
      />
    </Layout>
  );
};

export default VoteAwards;