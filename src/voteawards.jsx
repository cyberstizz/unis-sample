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

  const getLastCompletedAwardPeriod = (interval) => {
    const now = getNewYorkNow();
    const start = new Date(now);
    const end = new Date(now);

    if (interval === 'daily') {
      start.setDate(now.getDate() - 1);
      start.setHours(0, 0, 0, 0);

      end.setDate(now.getDate() - 1);
      end.setHours(0, 0, 0, 0);

      return { startDate: start, endDate: end };
    }

    if (interval === 'weekly') {
      const day = now.getDay();
      const daysSinceMonday = day === 0 ? 6 : day - 1;

      const currentWeekMonday = new Date(now);
      currentWeekMonday.setDate(now.getDate() - daysSinceMonday);
      currentWeekMonday.setHours(0, 0, 0, 0);

      end.setTime(currentWeekMonday.getTime());
      end.setDate(currentWeekMonday.getDate() - 1);
      end.setHours(0, 0, 0, 0);

      start.setTime(end.getTime());
      start.setDate(end.getDate() - 6);
      start.setHours(0, 0, 0, 0);

      return { startDate: start, endDate: end };
    }

    if (interval === 'monthly') {
      start.setFullYear(now.getFullYear(), now.getMonth() - 1, 1);
      start.setHours(0, 0, 0, 0);

      end.setFullYear(now.getFullYear(), now.getMonth(), 0);
      end.setHours(0, 0, 0, 0);

      return { startDate: start, endDate: end };
    }

    if (interval === 'quarterly') {
      const currentQuarter = Math.floor(now.getMonth() / 3);
      const previousQuarterStartMonth = currentQuarter === 0 ? 9 : (currentQuarter - 1) * 3;
      const previousQuarterYear = currentQuarter === 0 ? now.getFullYear() - 1 : now.getFullYear();

      start.setFullYear(previousQuarterYear, previousQuarterStartMonth, 1);
      start.setHours(0, 0, 0, 0);

      end.setFullYear(previousQuarterYear, previousQuarterStartMonth + 3, 0);
      end.setHours(0, 0, 0, 0);

      return { startDate: start, endDate: end };
    }

    if (interval === 'annual') {
      start.setFullYear(now.getFullYear() - 1, 0, 1);
      start.setHours(0, 0, 0, 0);

      end.setFullYear(now.getFullYear() - 1, 11, 31);
      end.setHours(0, 0, 0, 0);

      return { startDate: start, endDate: end };
    }

    start.setDate(now.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    end.setDate(now.getDate() - 1);
    end.setHours(0, 0, 0, 0);
    return { startDate: start, endDate: end };
  };

  const toApiDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const todayInNewYork = () =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
    }).format(new Date());

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

  const fetchNominees = async () => {
    setLoading(true);
    setError('');
    try {
      const genreId = GENRE_IDS[selectedGenre];
      const jurisdictionId = JURISDICTION_IDS[selectedJurisdiction];
      const intervalId = INTERVAL_IDS[selectedInterval];

      const response = await apiCall({
        method: 'get',
        url: `/v1/vote/nominees?targetType=${selectedType}&genreId=${genreId}&jurisdictionId=${jurisdictionId}&intervalId=${intervalId}&limit=20`
      });

      const nomineesData = response.data || [];

      const normalized = nomineesData.map((nominee) => {
        if (selectedType === 'artist') {
          return {
            id: nominee.userId,
            name: nominee.username,
            type: 'artist',
            genreKey: selectedGenre,
            imageUrl: buildUrl(nominee.photoUrl),
            votes: nominee.voteCount || 0,
            totalLifetimeVotes: nominee.totalVotes || 0,
            jurisdiction: nominee.jurisdiction?.name || 'Unknown',
            genre: nominee.genre?.name || 'Unknown',
          };
        } else {
          return {
            id: nominee.songId,
            name: nominee.title,
            type: 'song',
            genreKey: selectedGenre,
            artist: nominee.artist?.username || 'Unknown Artist',
            artistId: nominee.artist?.userId,
            imageUrl: buildUrl(nominee.artworkUrl),
            mediaUrl: buildUrl(nominee.fileUrl),
            votes: nominee.voteCount || 0,
            plays: nominee.playCount || nominee.totalPlays || 0,
            jurisdiction: nominee.jurisdiction?.name || 'Unknown',
            genre: nominee.genre?.name || 'Unknown',
          };
        }
      });

      setNominees(normalized);
    } catch (err) {
      console.error('Failed to fetch nominees:', err);
      setError('Failed to load nominees. Please try again.');
    } finally {
      setLoading(false);
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

      const { startDate, endDate } = getLastCompletedAwardPeriod(selectedInterval);

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

        const cutoff = todayInNewYork();

        const awards = (res.data || [])
          .filter((award) => award?.awardId)
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

  const handlePlaySong = async (nominee) => {
    if (nominee.type === 'song' && nominee.mediaUrl) {
      requestPlay({
        type: 'song',
        id: nominee.id,
        songId: nominee.id,
        url: nominee.mediaUrl,
        fileUrl: nominee.mediaUrl,
        title: nominee.name,
        artist: nominee.artist,
        artistId: nominee.artistId,
        artwork: nominee.imageUrl,
        artworkUrl: nominee.imageUrl,
      });

      if (nominee.id && userId) {
        try {
          await apiCall({ method: 'post', url: `/v1/media/song/${nominee.id}/play?userId=${userId}` });
        } catch (err) {
          console.error('Failed to track song play:', err);
        }
      }
    }
  };

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
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/users/${nominee.id}/default-song`,
      });
      const defaultSong = response.data;

      if (defaultSong?.fileUrl) {
        const fullUrl = buildUrl(defaultSong.fileUrl);
        const fullArtwork = buildUrl(defaultSong.artworkUrl);

        requestPlay({
          type: 'song',
          id: defaultSong.songId,
          songId: defaultSong.songId,
          url: fullUrl,
          fileUrl: fullUrl,
          title: defaultSong.title || `${nominee.name}'s Default Track`,
          artist: nominee.name,
          artistId: nominee.id,
          artwork: fullArtwork,
          artworkUrl: fullArtwork,
        });

        if (defaultSong.songId && userId) {
          try {
            await apiCall({ method: 'post', url: `/v1/media/song/${defaultSong.songId}/play?userId=${userId}` });
          } catch (err) {
            console.error('Failed to track artist default song play:', err);
          }
        }
      } else {
        alert(`${nominee.name} has not set a default song yet.`);
      }
    } catch (err) {
      console.error('Failed to fetch/play default song:', err);
      alert('Could not load artist\'s song.');
    }
  };

  const jurisdictionLabel = jurisdictions.find(j => j.value === selectedJurisdiction)?.label || 'Unknown';
  const intervalLabel = intervals.find(i => i.value === selectedInterval)?.label || selectedInterval;
  const genreLabel = selectedGenre.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('/');
  const typeLabel = selectedType.charAt(0).toUpperCase() + selectedType.slice(1);

  const pad = (n) => String(n).padStart(2, '0');

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

        {/* ── Hero headline + countdown ── */}
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
          <div className="va-countdown">
            <span className="va-countdown-label"><span className="va-live-badge">LIVE</span>  Poll ends in</span>
            <span className="va-countdown-time">
              {countdown.days > 0 && (
                <span className="va-countdown-days">{countdown.days}D&nbsp;</span>
              )}
              {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
            </span>
          </div>
        </div>

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

        {/* ── Nominees grid ── */}
        <section className="va-grid-section">
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
                        {nominee.type === 'artist' ? (
                          <div className="va-stat">
                            <span className="va-stat-label">Total Votes</span>
                            <span className="va-stat-value">
                              {nominee.totalLifetimeVotes.toLocaleString()}
                              {nominee.votes > 0 && (
                                <span className="va-stat-badge">+{nominee.votes}</span>
                              )}
                            </span>
                          </div>
                        ) : (
                          <div className="va-stat">
                            <span className="va-stat-label">Plays</span>
                            <span className="va-stat-value">
                              {nominee.plays.toLocaleString()}
                              {nominee.votes > 0 && (
                                <span className="va-stat-badge">+{nominee.votes}</span>
                              )}
                            </span>
                          </div>
                        )}
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
                  {searchQuery ? 'No nominees match your search.' : 'No nominees found for this category yet.'}
                </p>
              )}
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