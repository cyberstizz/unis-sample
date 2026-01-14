import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlayerContext } from './context/playercontext';
import { apiCall } from './components/axiosInstance';
import './voteawards.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import VotingWizard from './votingWizard';
import { GENRE_IDS, JURISDICTION_IDS, INTERVAL_IDS } from './utils/idMappings';
import { Trophy, Play } from 'lucide-react';

const VoteAwards = () => {
  const navigate = useNavigate();
  const { playMedia } = useContext(PlayerContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('rap');
  const [selectedType, setSelectedType] = useState('artist');
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('harlem-wide');
  const [nominees, setNominees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);
  const [userId, setUserId] = useState(null);



  const buildUrl = (url) => {
        if (!url) return backimage;  // Fallback
        return url.startsWith('http://') || url.startsWith('https://') 
          ? url  // Absolute (R2/prod)—use as-is
          : `${API_BASE_URL}${url}`;  // Relative (local)—prepend base
      };

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

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
    { value: 'harlem-wide', label: 'Harlem' },
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
            genreKey: selectedGenre,
            imageUrl: buildUrl(nominee.photoUrl),  // ← Uses helper
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

  const handlePlaySong = async (nominee) => {
      if (nominee.type === 'song' && nominee.mediaUrl) {
        // Play the song
        playMedia(
          {
            type: 'song',
            url: buildUrl(nominee.mediaUrl),
            title: nominee.name,
            artist: nominee.artist,
            artwork: buildUrl(nominee.imageUrl),
          },
          [{
            type: 'song',
            url: buildUrl(nominee.mediaUrl),
            title: nominee.name,
            artist: nominee.artist,
            artwork: buildUrl(nominee.imageUrl),
          }]
        );

        // Track the play
        if (nominee.id && userId) {
          try {
            const endpoint = `/v1/media/song/${nominee.id}/play?userId=${userId}`;
            console.log('Tracking song play:', { endpoint, songId: nominee.id, userId });
            await apiCall({ method: 'post', url: endpoint });
            console.log('Song play tracked successfully');
          } catch (err) {
            console.error('Failed to track song play:', err);
          }
        } else {
          console.warn('Could not track play - missing nominee.id or userId');
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

  // Format jurisdiction name for display
  const jurisdictionLabel = jurisdictions.find(j => j.value === selectedJurisdiction)?.label || 'Unknown';


  const handlePlayArtistDefault = async (nominee) => {
      let trackingSongId = null;

      try {
        const response = await apiCall({
          method: 'get',
          url: `/v1/users/${nominee.id}/default-song`,
        });
        const defaultSong = response.data;

        let playData;
        let queue = [];

        if (defaultSong?.fileUrl) {
          // Use default song
          playData = {
            type: 'default-song',
            url: `${API_BASE_URL}${defaultSong.fileUrl}`,
            title: defaultSong.title || `${nominee.name}'s Default Track`,
            artist: nominee.name,
            artwork: buildUrl(defaultSong.artworkUrl),
          };

          // Save the song ID for tracking
          trackingSongId = defaultSong.songId;

          queue = [playData];
          playMedia(playData, queue);

          // Track the play
          if (trackingSongId && userId) {
            try {
              const endpoint = `/v1/media/song/${trackingSongId}/play?userId=${userId}`;
              console.log('Tracking artist default song play:', { endpoint, songId: trackingSongId, userId });
              await apiCall({ method: 'post', url: endpoint });
              console.log('Artist default song play tracked successfully');
            } catch (err) {
              console.error('Failed to track artist default song play:', err);
            }
          } else {
            console.warn('Could not track play - missing songId or userId');
          }
        } else {
          // Fallback: No default song
          console.warn('No default song found for artist:', nominee.name);
          alert(`${nominee.name} has not set a default song yet.`);
          return; // Don't track sample plays
        }
      } catch (err) {
        console.error('Failed to fetch/play default song:', err);
        alert('Could not load artist\'s song.');
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
              <option key={int.value} value={int.value}>
                {int.label}
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
          <h2 className='intervalDeclaration'>
            {selectedGenre.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('/')}{' '}
            {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} of the{' '}
            {intervals.find(i => i.value === selectedInterval)?.label || selectedInterval}{' '}
            in <br /><span className='jurisdictionLabel'>{jurisdictionLabel}</span>
          </h2>

          <form className="search-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search for ${selectedType}s to vote for`}
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
                      <p className="voteawards-jurisdiction-label">
                        {nominee.jurisdiction}
                      </p>
                      {nominee.type === 'song' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#60a5fa', fontSize: '0.85rem' }}>
                        <Play size={14} />
                        <span>{nominee.plays} Plays</span>
                      </div>
                    )}
                      {nominee.type === 'artist' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', color: '#fbbf24', fontSize: '0.85rem' }}>
                        <Trophy size={14} />
                        <span>{nominee.totalLifetimeVotes} Votes</span>
                      </div>
                      )}                   
                       </div>
                       <div className='the_buttons'>
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
                     </div>
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