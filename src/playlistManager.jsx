import React, { useContext, useState, useEffect, useRef } from 'react';
import { PlayerContext } from './context/playercontext';
import { X, Music, Users, Award, Globe, Search, Plus, Info, Image as ImageIcon } from 'lucide-react';
import axiosInstance from './components/axiosInstance';
import PlaylistViewer from './playlistViewer';
import './playlistManager.scss';

const TABS = [
  { key: 'mine', label: 'My Playlists', icon: Music },
  { key: 'following', label: 'Following', icon: Users },
  { key: 'community', label: 'Community', icon: Globe },
  { key: 'official', label: 'Official', icon: Award },
];

const TAB_HINTS = {
  mine: 'Your personal song collections. Create playlists for any mood or occasion — only you can see them unless you make them public.',
  following: "Playlists you've followed from other users. Browse Community or Official playlists and hit Follow to save them here.",
  community: "Playlists created by and for your neighborhood. Anyone can suggest songs — the community votes on what stays.",
  official: "Curated by Unis from award winners and staff picks. Follow them to stay in the loop with the best of your area.",
};

const PlaylistManager = ({ open, onClose }) => {
  const {
    playlists, followedPlaylists, loading,
    refreshPlaylists, loadFollowedPlaylists, createPlaylist
  } = useContext(PlayerContext);

  const [activeTab, setActiveTab] = useState('mine');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [communityPlaylists, setCommunityPlaylists] = useState([]);
  const [officialPlaylists, setOfficialPlaylists] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [dismissedHints, setDismissedHints] = useState({});

  // Create community state
  const [showCreateCommunity, setShowCreateCommunity] = useState(false);
  const [communityName, setCommunityName] = useState('');
  const [communityDesc, setCommunityDesc] = useState('');
  const [communityCoverFile, setCommunityCoverFile] = useState(null);
  const [communityCoverPreview, setCommunityCoverPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const [userJurisdictionId, setUserJurisdictionId] = useState(null);
  const [userJurisdictionName, setUserJurisdictionName] = useState(null);
  const communityCoverInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      axiosInstance.get(`/v1/users/profile/${payload.userId}`)
        .then(res => {
          const j = res.data?.jurisdiction;
          if (j) {
            setUserJurisdictionId(j.jurisdictionId);
            setUserJurisdictionName(j.name);
          }
        })
        .catch(() => {});
    } catch (e) {}
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (activeTab === 'community' && userJurisdictionId) {
      loadCommunityPlaylists();
    } else if (activeTab === 'official') {
      loadOfficialPlaylists();
    } else if (activeTab === 'following') {
      loadFollowedPlaylists();
    }
  }, [activeTab, open, userJurisdictionId]);

  const loadCommunityPlaylists = async () => {
    if (!userJurisdictionId) return;
    try {
      const res = await axiosInstance.get(`/v1/playlists/community/${userJurisdictionId}`);
      setCommunityPlaylists(res.data || []);
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

  const handleCommunityCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Cover image must be under 5MB');
      return;
    }
    setCommunityCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCommunityCoverPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreateCommunity = async () => {
    if (!communityName.trim() || !userJurisdictionId) return;
    setCreating(true);
    try {
      // Upload cover first if selected
      let coverUrl = null;
      if (communityCoverFile) {
        const formData = new FormData();
        formData.append('cover', communityCoverFile);
        const res = await axiosInstance.post('/v1/playlists/cover', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        coverUrl = res.data.coverImageUrl;
      }

      await createPlaylist(communityName.trim(), 'community', {
        visibility: 'public',
        description: communityDesc.trim() || null,
        jurisdictionId: userJurisdictionId,
        coverImageUrl: coverUrl,
      });

      setCommunityName('');
      setCommunityDesc('');
      setCommunityCoverFile(null);
      setCommunityCoverPreview(null);
      setShowCreateCommunity(false);
      await loadCommunityPlaylists();
      await refreshPlaylists();
    } catch (error) {
      console.error('Failed to create community playlist:', error);
      alert('Failed to create community playlist');
    } finally {
      setCreating(false);
    }
  };

  const dismissHint = (tab) => {
    setDismissedHints(prev => ({ ...prev, [tab]: true }));
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
      case 'following': return "You're not following any playlists yet. Browse Community or Official playlists and hit Follow!";
      case 'community': return 'No community playlists in your area yet. Be the first to create one!';
      case 'official': return 'Official playlists coming soon.';
      default: return 'No playlists found';
    }
  };

  const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
  const buildUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
  };

  const getCoverDisplay = (pl) => {
    if (pl.coverImageUrl) {
      return <img src={buildUrl(pl.coverImageUrl)} alt="" />;
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
    if (artworks.length > 0) return <img src={artworks[0]} alt="" />;
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

          <div className="pm-header">
            <h3>Playlists</h3>
            <button className="pm-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

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

          {!dismissedHints[activeTab] && TAB_HINTS[activeTab] && (
            <div className="pm-hint-banner">
              <Info size={14} />
              <span>{TAB_HINTS[activeTab]}</span>
              <button onClick={() => dismissHint(activeTab)} className="pm-hint-dismiss">
                <X size={14} />
              </button>
            </div>
          )}

          {(activeTab === 'community' || activeTab === 'official' || activeTab === 'following') && (
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

          {activeTab === 'community' && !showCreateCommunity && (
            <div className="pm-create-community-bar">
              <button className="pm-create-community-btn" onClick={() => setShowCreateCommunity(true)}>
                <Plus size={16} />
                Create Community Playlist{userJurisdictionName ? ` for ${userJurisdictionName}` : ''}
              </button>
            </div>
          )}

          {activeTab === 'community' && showCreateCommunity && (
            <div className="pm-create-community-form">
              <input
                type="text"
                placeholder="Playlist name (e.g. Harlem After Dark)"
                value={communityName}
                onChange={(e) => setCommunityName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !creating && handleCreateCommunity()}
                autoFocus
                maxLength={100}
              />
              <input
                type="text"
                placeholder="Description (optional)"
                value={communityDesc}
                onChange={(e) => setCommunityDesc(e.target.value)}
                maxLength={500}
              />

              {/* Cover upload */}
              <div className="pm-cover-upload-row">
                <input
                  ref={communityCoverInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleCommunityCoverSelect}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="pm-cover-btn"
                  onClick={() => communityCoverInputRef.current?.click()}
                >
                  {communityCoverPreview ? (
                    <img src={communityCoverPreview} alt="" className="pm-cover-preview" />
                  ) : (
                    <>
                      <ImageIcon size={18} />
                      <span>Add cover image</span>
                    </>
                  )}
                </button>
                {communityCoverFile && (
                  <button
                    type="button"
                    className="pm-cover-clear"
                    onClick={() => { setCommunityCoverFile(null); setCommunityCoverPreview(null); }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="pm-create-community-actions">
                <button onClick={() => {
                  setShowCreateCommunity(false);
                  setCommunityName('');
                  setCommunityDesc('');
                  setCommunityCoverFile(null);
                  setCommunityCoverPreview(null);
                }}>
                  Cancel
                </button>
                <button onClick={handleCreateCommunity} disabled={!communityName.trim() || creating}>
                  {creating ? 'Creating...' : 'Create'}
                </button>
              </div>
              <p className="pm-create-community-note">
                This playlist will be public. Anyone in {userJurisdictionName || 'your area'} can suggest songs and vote.
              </p>
            </div>
          )}

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