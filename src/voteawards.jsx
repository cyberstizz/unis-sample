import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import './voteawards.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import VotingWizard from './votingWizard';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';

const VoteAwards = () => {
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('rap-hiphop');
  const [selectedType, setSelectedType] = useState('artist');
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('harlem-wide');
  const [nominees, setNominees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [userId, setUserId] = useState(null);

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

  const intervals = ['daily', 'weekly', 'monthly', 'quarterly', 'annual'];
  const genres = ['rap-hiphop', 'rock', 'pop'];
  const types = ['artist', 'song'];
  const jurisdictions = [
    { value: 'uptown-harlem', label: 'Uptown Harlem' },
    { value: 'downtown-harlem', label: 'Downtown Harlem' },
    { value: 'harlem-wide', label: 'Harlem-Wide' },
  ];

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
      
      // Normalize nominees (artists or songs)
      const normalized = nomineesData.map((nominee) => {
        if (selectedType === 'artist') {
          return {
            id: nominee.userId,
            name: nominee.username,
            type: 'artist',
            imageUrl: nominee.photoUrl ? `${API_BASE_URL}${nominee.photoUrl}` : backimage,
            votes: nominee.voteCount || 0,
            jurisdiction: nominee.jurisdiction?.name || 'Unknown',
            genre: nominee.genre?.name || 'Unknown',
          };
        } else {
          return {
            id: nominee.songId,
            name: nominee.title,
            type: 'song',
            artist: nominee.artist?.username || 'Unknown Artist',
            artistId: nominee.artist?.userId,
            imageUrl: nominee.artworkUrl ? `${API_BASE_URL}${nominee.artworkUrl}` : backimage,
            mediaUrl: nominee.fileUrl ? `${API_BASE_URL}${nominee.fileUrl}` : null,
            votes: nominee.voteCount || 0,
            jurisdiction: nominee.jurisdiction?.name || 'Unknown',
            genre: nominee.genre?.name || 'Unknown',
          };
        }
      });

      setNominees(normalized);
      console.log('Raw backend response:', response.data);  // []? Check logs above
      console.log('Normalized nominees:', normalized);  // Empty → backend issue

    } catch (err) {
      console.error('Failed to fetch nominees:', err);
      setError('Failed to load nominees. Please try again.');
    } finally {
      setLoading(false);
    }

  };


  // Client-side search filtering
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
    // Refresh nominees to show updated vote counts
    await fetchNominees();
  };

  const handlePlaySong = (nominee) => {
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
    }
  };

  const handleNomineeClick = (nominee) => {
    if (nominee.type === 'artist') {
      navigate(`/artist/${nominee.id}`);
    } else {
      navigate(`/song/${nominee.id}`);
    }
  };

  // Format jurisdiction name for display
  const jurisdictionLabel = jurisdictions.find(j => j.value === selectedJurisdiction)?.label || 'Unknown';


  const handlePlayArtistDefault = async (nominee) => {
    try {
      const response = await apiCall({
        method: 'get',
        url: `/v1/users/${nominee.id}/default-song`,  // Your endpoint
      });
      const defaultSong = response.data;  // Assumes { song: { title, fileUrl, artworkUrl } } or direct { title, fileUrl, ... }

      let playData;
      let queue = [];

      if (defaultSong?.fileUrl) {
        // Use default song
        playData = {
          type: 'default-song',
          url: `${API_BASE_URL}${defaultSong.fileUrl}`,
          title: defaultSong.title || `${nominee.name}'s Default Track`,
          artist: nominee.name,
          artwork: defaultSong.artworkUrl ? `${API_BASE_URL}${defaultSong.artworkUrl}` : nominee.imageUrl,
        };
      } else {
        // Fallback: Fetch/play sample song (add /v1/media/sample-song endpoint if needed, or hardcode a URL for MVP)
        const sampleResponse = await apiCall({
          method: 'get',
          url: '/v1/media/sample-song',  // New simple endpoint returning { title: 'Sample', fileUrl: '/uploads/sample.mp3', ... }
        });
        playData = {
          type: 'sample-song',
          url: `${API_BASE_URL}${sampleResponse.data.fileUrl}`,
          title: sampleResponse.data.title || 'Sample Track',
          artist: `${nominee.name} (Sample)`,
          artwork: sampleResponse.data.artworkUrl ? `${API_BASE_URL}${sampleResponse.data.artworkUrl}` : backimage,
        };
      }

      queue = [playData];  // Single-item queue like songs

      playMedia(playData, queue);
    } catch (err) {
      console.error('Failed to fetch/play default song:', err);
      // Optional: Toast/error message to user
    }
  };



  return (
    <Layout backgroundImage={backimage}>
      <div className='voteAwardsContainer'>
        <div className="filters">
          <select 
            value={selectedGenre} 
            onChange={(e) => setSelectedGenre(e.target.value)} 
            className="filter-select"
          >
            {genres.map((g) => (
              <option key={g} value={g}>
                {g.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('/')}
              </option>
            ))}
          </select>

          <select 
            value={selectedType} 
            onChange={(e) => setSelectedType(e.target.value)} 
            className="filter-select"
          >
            {types.map((t) => (
              <option key={t} value={t}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>

          <select 
            value={selectedInterval} 
            onChange={(e) => setSelectedInterval(e.target.value)} 
            className="filter-select"
          >
            {intervals.map((int) => (
              <option key={int} value={int}>
                {int.charAt(0).toUpperCase() + int.slice(1)}
              </option>
            ))}
          </select>

          <select 
            value={selectedJurisdiction} 
            onChange={(e) => setSelectedJurisdiction(e.target.value)} 
            className="filter-select"
          >
            {jurisdictions.map((jur) => (
              <option key={jur.value} value={jur.value}>
                {jur.label}
              </option>
            ))}
          </select>
        </div>

        <section className="nominees">
          <h2>
            {selectedInterval.charAt(0).toUpperCase() + selectedInterval.slice(1)}{' '}
            {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} of{' '}
            {selectedGenre.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('/')}{' '}
            in {jurisdictionLabel}
          </h2>

          <form className="search-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search for a ${selectedType}...`}
              className="search-bar"
            />
          </form>

          {loading && (
            <div style={{ textAlign: 'center', padding: '50px', color: 'white' }}>
              Loading nominees...
            </div>
          )}

          {error && (
            <div style={{ textAlign: 'center', padding: '20px', color: 'red' }}>
              {error}
            </div>
          )}

          {!loading && !error && (
            <ul className="nominee-list">
              {filteredNominees.length > 0 ? (
                filteredNominees.map((nominee) => (
                  <li key={nominee.id} className="nominee-item">
                    <div 
                      className="nominee-image" 
                      style={{ backgroundImage: `url(${nominee.imageUrl})` }}
                      onClick={() => handleNomineeClick(nominee)}
                    />
                    <div className="nominee-info" onClick={() => handleNomineeClick(nominee)}>
                      <h3 id="nominee-name">{nominee.name}</h3>
                      {nominee.type === 'song' && <p className="artist-name">by {nominee.artist}</p>}
                      <p>Votes: {nominee.votes}</p>
                    </div>
                    {nominee.type === 'song' && nominee.mediaUrl && (
                      <button 
                        onClick={() => handlePlaySong(nominee)} 
                        className="listen-button"
                      >
                        Listen
                      </button>
                    )}

                    {nominee.type === 'artist' && (
                    <button 
                        onClick={() => handlePlayArtistDefault(nominee)} 
                        className="listen-button"
                      >
                        Listen
                      </button>
                    )}


                    <button 
                      onClick={() => handleVoteClick(nominee)} 
                      className="vote-button"
                    >
                      Vote
                    </button>
                  </li>
                ))
              ) : (
                <p className="no-nominees">
                  {searchQuery ? 'No nominees match your search.' : 'No nominees found for this category yet.'}
                </p>
              )}
            </ul>
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