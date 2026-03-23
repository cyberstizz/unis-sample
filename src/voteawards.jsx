import React, { useState, useContext, useEffect, useRef } from 'react';
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
  const { playMedia } = useContext(PlayerContext);
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
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

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

  // Countdown timer — resets at midnight EST daily
  useEffect(() => {
    const calcTimeLeft = () => {
      const now = new Date();
      const estString = now.toLocaleString('en-US', { timeZone: 'America/New_York' });
      const estNow = new Date(estString);

      const nextMidnight = new Date(estString);
      nextMidnight.setDate(nextMidnight.getDate() + 1);
      nextMidnight.setHours(0, 0, 0, 0);

      const diff = nextMidnight - estNow;
      return {
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      };
    };

    setCountdown(calcTimeLeft());
    const timer = setInterval(() => setCountdown(calcTimeLeft()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (searchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [searchOpen]);

  // Get userId on mount
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

  // Fetch nominees whenever filters change
  useEffect(() => {
    if (userId) {
      fetchNominees();
    }
  }, [selectedGenre, selectedType, selectedInterval, selectedJurisdiction, userId]);

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
      console.log('Raw backend response:', response.data);
      console.log('Normalized nominees:', normalized);
    } catch (err) {
      console.error('Failed to fetch nominees:', err);
      setError('Failed to load nominees. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredNominees = nominees.filter((nominee) => {
    if (searchQuery.length === 0) return true;
    return nominee.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleVoteClick = (nominee) => {
    setSelectedNominee(nominee);
    setShowVotingWizard(true);
  };

  const handleVoteSuccess = async (nomineeId) => {
    console.log(`Vote confirmed for nominee: ${nomineeId}`);
    setShowVotingWizard(false);
    setSelectedNominee(null);
    await fetchNominees();
  };

  const handlePlaySong = async (nominee) => {
    if (nominee.type === 'song' && nominee.mediaUrl) {
      playMedia(
        {
          type: 'song',
          url: nominee.mediaUrl,
          title: nominee.name,
          artist: nominee.artist,
          artwork: nominee.imageUrl,
        },
        [{
          type: 'song',
          url: nominee.mediaUrl,
          title: nominee.name,
          artist: nominee.artist,
          artwork: nominee.imageUrl,
        }]
      );

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

  const handlePlayArtistDefault = async (nominee) => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/users/${nominee.id}/default-song`,
      });
      const defaultSong = response.data;

      if (defaultSong?.fileUrl) {
        const playData = {
          type: 'default-song',
          url: buildUrl(defaultSong.fileUrl),
          title: defaultSong.title || `${nominee.name}'s Default Track`,
          artist: nominee.name,
          artwork: buildUrl(defaultSong.artworkUrl),
        };

        playMedia(playData, [playData]);

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
            <span className="va-countdown-label"><span className="va-live-badge"><span className="va-live-dot" />LIVE</span>  Poll ends in</span>
            <span className="va-countdown-time">
              {pad(countdown.hours)}:{pad(countdown.minutes)}:{pad(countdown.seconds)}
            </span>
          </div>
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
                        <button onClick={() => handleVoteClick(nominee)} className="va-btn-vote">
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
        filters={{
          selectedGenre,
          selectedType,
          selectedInterval,
          selectedJurisdiction,
        }}
      />
    </Layout>
  );
};

export default VoteAwards;