// src/components/PlaylistManager.jsx
import React, { useContext, useState, useEffect } from 'react';
import { PlayerContext } from './context/playercontext';
import { X, Music, Users, Award, Globe, Search } from 'lucide-react';
import axiosInstance from './components/axiosInstance';
import PlaylistViewer from './playlistViewer';
import './playlistManager.scss';

const TABS = [
  { key: 'mine', label: 'My Playlists', icon: Music },
  { key: 'following', label: 'Following', icon: Users },
  { key: 'community', label: 'Community', icon: Globe },
  { key: 'official', label: 'Official', icon: Award },
];

const PlaylistManager = ({ open, onClose }) => {
  const { playlists, followedPlaylists, loading, refreshPlaylists, loadFollowedPlaylists } = useContext(PlayerContext);

  const [activeTab, setActiveTab] = useState('mine');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [communityPlaylists, setCommunityPlaylists] = useState([]);
  const [officialPlaylists, setOfficialPlaylists] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Load community/official playlists when those tabs are selected
  useEffect(() => {
    if (!open) return;

    if (activeTab === 'community') {
      loadCommunityPlaylists();
    } else if (activeTab === 'official') {
      loadOfficialPlaylists();
    } else if (activeTab === 'following') {
      loadFollowedPlaylists();
    }
  }, [activeTab, open]);

  const loadCommunityPlaylists = async () => {
    try {
      // Get user's jurisdiction from their profile
      const token = localStorage.getItem('token');
      if (!token) return;
      const payload = JSON.parse(atob(token.split('.')[1]));
      const profileRes = await axiosInstance.get(`/v1/users/profile/${payload.userId}`);
      const jurisdictionId = profileRes.data?.jurisdiction?.jurisdictionId;

      if (jurisdictionId) {
        const res = await axiosInstance.get(`/v1/playlists/community/${jurisdictionId}`);
        setCommunityPlaylists(res.data || []);
      }
    } catch (error) {
      console.error('Failed to load community playlists:', error);
      setCommunityPlaylists([]);
    }
  };

  const loadOfficialPlaylists = async () => {
    try {
      const res = await axiosInstance.get('/v1/playlists/official');
      setOfficialPlaylists(res.data || []);
    } catch (error) {
      console.error('Failed to load official playlists:', error);
      setOfficialPlaylists([]);
    }
  };

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await axiosInstance.get(`/v1/playlists/search?q=${encodeURIComponent(query.trim())}`);
      setSearchResults(res.data || []);
    } catch (error) {
      console.error('Search failed:', error);
      setSearchResults([]);
    }
  };

  if (!open) return null;

  const getActiveList = () => {
    if (isSearching && searchQuery.trim()) return searchResults;

    switch (activeTab) {
      case 'mine': return playlists;
      case 'following': return followedPlaylists;
      case 'community': return communityPlaylists;
      case 'official': return officialPlaylists;
      default: return [];
    }
  };

  const activeList = getActiveList();

  const getEmptyMessage = () => {
    if (isSearching) return 'No playlists found';
    switch (activeTab) {
      case 'mine': return 'No playlists yet. Click the + button on the player to create one!';
      case 'following': return "You're not following any playlists yet.";
      case 'community': return 'No community playlists in your area yet. Be the first to create one!';
      case 'official': return 'Official playlists coming soon.';
      default: return 'No playlists found';
    }
  };

  // Build cover image: use coverImageUrl, then mosaic from first 4 artworks, then fallback
  const getCoverDisplay = (pl) => {
    if (pl.coverImageUrl) {
      return <img src={pl.coverImageUrl} alt="" />;
    }

    const artworks = pl.firstFourArtworks || [];
    if (artworks.length >= 4) {
      return (
        <div className="pm-card-mosaic">
          {artworks.slice(0, 4).map((url, i) => (
            <img key={i} src={url} alt="" />
          ))}
        </div>
      );
    }

    if (artworks.length > 0) {
      return <img src={artworks[0]} alt="" />;
    }

    // Check legacy tracks array
    if (pl.tracks && pl.tracks.length > 0 && pl.tracks[0].artworkUrl) {
      return <img src={pl.tracks[0].artworkUrl} alt="" />;
    }

    return (
      <div className="pm-card-empty">
        <Music size={32} />
      </div>
    );
  };

  const getTypeBadge = (pl) => {
    if (pl.type === 'community') return <span className="pm-badge pm-badge-community">Community</span>;
    if (pl.type === 'official') return <span className="pm-badge pm-badge-official">Official</span>;
    if (pl.visibility === 'public') return <span className="pm-badge pm-badge-public">Public</span>;
    return null;
  };

  return (
    <>
      <div className="pm-overlay" onClick={onClose}>
        <div className="pm-container" onClick={(e) => e.stopPropagation()}>

          {/* Header */}
          <div className="pm-header">
            <h3>Playlists</h3>
            <button className="pm-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="pm-tabs">
            {TABS.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  className={`pm-tab ${activeTab === tab.key ? 'pm-tab-active' : ''}`}
                  onClick={() => { setActiveTab(tab.key); setIsSearching(false); setSearchQuery(''); }}
                >
                  <Icon size={16} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search (visible on community and official tabs) */}
          {(activeTab === 'community' || activeTab === 'official') && (
            <div className="pm-search">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search playlists..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
              />
              {searchQuery && (
                <button
                  className="pm-search-clear"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); setIsSearching(false); }}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="pm-body">
            {loading ? (
              <div className="pm-loading">Loading playlists...</div>
            ) : activeList.length === 0 ? (
              <div className="pm-empty">
                <Music size={48} />
                <p>{getEmptyMessage()}</p>
              </div>
            ) : (
              <div className="pm-grid">
                {activeList.map((pl) => (
                  <button
                    key={pl.playlistId || pl.id}
                    className="pm-playlist-card"
                    onClick={() => setSelectedPlaylistId(pl.playlistId || pl.id)}
                  >
                    <div className="pm-card-artwork">
                      {getCoverDisplay(pl)}
                    </div>
                    <div className="pm-card-info">
                      <div className="pm-card-name">{pl.name}</div>
                      <div className="pm-card-meta">
                        <span>{pl.songCount || pl.tracks?.length || 0} songs</span>
                        {pl.followerCount > 0 && (
                          <span> · {pl.followerCount} follower{pl.followerCount !== 1 ? 's' : ''}</span>
                        )}
                        {pl.creatorName && activeTab !== 'mine' && (
                          <span> · by {pl.creatorName}</span>
                        )}
                      </div>
                      {getTypeBadge(pl)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedPlaylistId && (
        <PlaylistViewer
          playlistId={selectedPlaylistId}
          onClose={() => setSelectedPlaylistId(null)}
        />
      )}
    </>
  );
};

export default PlaylistManager;