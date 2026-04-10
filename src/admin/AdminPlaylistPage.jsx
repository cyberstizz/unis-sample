import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';
import { useAuth } from '../context/AuthContext';
import Layout from '../layout';
import {
  Music, Plus, Search, X, Trash2, Image as ImageIcon,
  TrendingUp, ArrowLeft, Check
} from 'lucide-react';
import buildUrl from '../utils/buildUrl';
import './admin.scss';

const AdminPlaylistPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Top-level state
  const [view, setView] = useState('list'); // 'list' | 'create' | 'edit'
  const [officialPlaylists, setOfficialPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit state
  const [editingPlaylist, setEditingPlaylist] = useState(null);
  const [editingTracks, setEditingTracks] = useState([]);

  // Create form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState(null);
  const [creating, setCreating] = useState(false);
  const coverInputRef = useRef(null);

  // Song picker state
  const [pickerMode, setPickerMode] = useState('leaderboard'); // 'leaderboard' | 'search'
  const [leaderboardSongs, setLeaderboardSongs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);

  // ─── Load official playlists on mount ───
  useEffect(() => {
    loadOfficialPlaylists();
  }, []);

  const loadOfficialPlaylists = async () => {
    setLoading(true);
    try {
      const res = await apiCall({ url: '/v1/playlists/official', method: 'get' });
      setOfficialPlaylists(res.data || []);
    } catch (err) {
      console.error('Failed to load official playlists:', err);
    } finally {
      setLoading(false);
    }
  };

  // ─── Load leaderboard songs when picker is shown ───
  useEffect(() => {
    if ((view === 'create' || view === 'edit') && pickerMode === 'leaderboard' && leaderboardSongs.length === 0) {
      loadLeaderboard();
    }
  }, [view, pickerMode]);

  const loadLeaderboard = async () => {
    setPickerLoading(true);
    try {
      // Use trending or top songs endpoint — adjust to whatever your codebase uses
      const res = await apiCall({
        url: '/v1/media/song/trending?limit=50',
        method: 'get'
      });
      setLeaderboardSongs(res.data || []);
    } catch (err) {
      console.error('Failed to load leaderboard:', err);
      // Fall back to a simpler endpoint if trending isn't available
      try {
        const fallback = await apiCall({ url: '/v1/search?q=&type=song&limit=50', method: 'get' });
        setLeaderboardSongs(fallback.data?.songs || fallback.data || []);
      } catch (e) {
        setLeaderboardSongs([]);
      }
    } finally {
      setPickerLoading(false);
    }
  };

  const handleSearch = async (q) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await apiCall({
        url: `/v1/search?q=${encodeURIComponent(q.trim())}&type=song`,
        method: 'get'
      });
      setSearchResults(res.data?.songs || res.data || []);
    } catch (err) {
      console.error('Search failed:', err);
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  // ─── Create playlist ───
  const handleCoverSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('Cover image must be under 5MB');
      return;
    }
    setCoverFile(file);
    const reader = new FileReader();
    reader.onload = () => setCoverPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleCreate = async () => {
    if (!name.trim()) return alert('Playlist name is required');
    setCreating(true);

    try {
      // Upload cover first if provided
      let coverUrl = null;
      if (coverFile) {
        const formData = new FormData();
        formData.append('cover', coverFile);
        const coverRes = await apiCall({
          url: '/v1/playlists/cover',
          method: 'post',
          data: formData,
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        coverUrl = coverRes.data?.coverImageUrl;
      }

      // Create the official playlist
      const createRes = await apiCall({
        url: '/v1/playlists',
        method: 'post',
        data: {
          name: name.trim(),
          type: 'official',
          visibility: 'public',
          description: description.trim() || null,
          coverImageUrl: coverUrl,
        }
      });

      // Move into edit mode so admin can add songs immediately
      setEditingPlaylist(createRes.data);
      setEditingTracks(createRes.data.tracks || []);
      setView('edit');

      // Reset create form
      setName('');
      setDescription('');
      setCoverFile(null);
      setCoverPreview(null);
    } catch (err) {
      console.error('Failed to create playlist:', err);
      alert('Failed to create playlist: ' + (err.response?.data?.message || err.message));
    } finally {
      setCreating(false);
    }
  };

  // ─── Edit existing playlist ───
  const openEditPlaylist = async (playlistId) => {
    try {
      const res = await apiCall({ url: `/v1/playlists/${playlistId}`, method: 'get' });
      setEditingPlaylist(res.data);
      setEditingTracks(res.data.tracks || []);
      setView('edit');
    } catch (err) {
      console.error('Failed to load playlist:', err);
      alert('Failed to load playlist');
    }
  };

  const handleAddSong = async (song) => {
    if (!editingPlaylist) return;

    const songId = song.songId || song.id;
    if (editingTracks.some(t => t.songId === songId)) {
      return; // already added
    }

    try {
      const res = await apiCall({
        url: `/v1/playlists/${editingPlaylist.playlistId}/tracks`,
        method: 'post',
        data: { songId }
      });
      setEditingTracks(res.data.tracks || []);
    } catch (err) {
      console.error('Failed to add song:', err);
      alert('Failed to add song');
    }
  };

  const handleRemoveSong = async (track) => {
    if (!editingPlaylist) return;
    if (!confirm(`Remove "${track.title}" from this playlist?`)) return;

    try {
      const res = await apiCall({
        url: `/v1/playlists/${editingPlaylist.playlistId}/tracks/${track.playlistItemId}`,
        method: 'delete'
      });
      setEditingTracks(res.data.tracks || []);
    } catch (err) {
      console.error('Failed to remove song:', err);
      alert('Failed to remove song');
    }
  };

  const handleDeletePlaylist = async (playlistId, name) => {
    if (!confirm(`Delete playlist "${name}"? This cannot be undone.`)) return;

    try {
      await apiCall({ url: `/v1/playlists/${playlistId}`, method: 'delete' });
      await loadOfficialPlaylists();
      if (editingPlaylist?.playlistId === playlistId) {
        setView('list');
        setEditingPlaylist(null);
      }
    } catch (err) {
      console.error('Failed to delete playlist:', err);
      alert('Failed to delete playlist');
    }
  };

  const handleBackToList = () => {
    setView('list');
    setEditingPlaylist(null);
    setEditingTracks([]);
    loadOfficialPlaylists();
  };

  // ─── Inline button styles matching admin dashboard ───
  const btnPrimary = {
    padding: '10px 20px',
    background: '#163387',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '600',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  };

  const btnSecondary = {
    padding: '10px 20px',
    background: 'rgba(255,255,255,0.1)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.2)',
    borderRadius: '8px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: '500',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
  };

  const card = {
    background: 'rgba(26, 26, 26, 0.85)',
    borderRadius: '12px',
    padding: '24px',
    border: '1px solid rgba(255,255,255,0.1)',
  };

  // ────────────────────────────────────────────────
  // RENDER
  // ────────────────────────────────────────────────

  if (loading) {
    return (
      <Layout>
        <div style={{ padding: '40px', color: '#A9A9A9', textAlign: 'center' }}>
          Loading playlists...
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="admin-page">

        {/* HEADER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '30px' }}>
          {view !== 'list' && (
            <button onClick={handleBackToList} style={{
              ...btnSecondary,
              padding: '8px 14px',
            }}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          <div>
            <h1 style={{ color: '#fff', fontSize: '28px', margin: 0 }}>
              {view === 'list' && 'Official Playlists'}
              {view === 'create' && 'Create Official Playlist'}
              {view === 'edit' && (editingPlaylist?.name || 'Edit Playlist')}
            </h1>
            <p style={{ color: '#A9A9A9', margin: '4px 0 0' }}>
              {view === 'list' && 'Manage Unis editorial playlists'}
              {view === 'create' && 'New playlist will be visible to all users'}
              {view === 'edit' && `${editingTracks.length} song${editingTracks.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {/* ════════════════════════════ */}
        {/*       LIST VIEW              */}
        {/* ════════════════════════════ */}
        {view === 'list' && (
          <>
            <div style={{ marginBottom: '24px' }}>
              <button onClick={() => setView('create')} style={btnPrimary}>
                <Plus size={18} /> Create New Playlist
              </button>
            </div>

            {officialPlaylists.length === 0 ? (
              <div style={{ ...card, textAlign: 'center', padding: '60px' }}>
                <Music size={48} style={{ color: '#444', marginBottom: '16px' }} />
                <h3 style={{ color: '#fff', marginBottom: '8px' }}>No official playlists yet</h3>
                <p style={{ color: '#A9A9A9', marginBottom: '20px' }}>
                  Create the first one to feature on the Official tab.
                </p>
                <button onClick={() => setView('create')} style={btnPrimary}>
                  <Plus size={18} /> Create First Playlist
                </button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                gap: '16px',
              }}>
                {officialPlaylists.map(pl => (
                  <div key={pl.playlistId} style={{
                    ...card,
                    padding: '0',
                    overflow: 'hidden',
                    cursor: 'pointer',
                    transition: 'transform 0.15s, border-color 0.15s',
                  }}
                  onClick={() => openEditPlaylist(pl.playlistId)}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(22,51,135,0.5)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'}
                  >
                    <div style={{
                      width: '100%',
                      aspectRatio: '1',
                      background: '#0a0a0c',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                    }}>
                      {pl.coverImageUrl ? (
                        <img src={buildUrl(pl.coverImageUrl)} alt="" style={{
                          width: '100%', height: '100%', objectFit: 'cover'
                        }} />
                      ) : (
                        <Music size={48} style={{ color: '#333' }} />
                      )}
                    </div>
                    <div style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                        <div style={{ color: '#fff', fontSize: '15px', fontWeight: '600', flex: 1 }}>
                          {pl.name}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeletePlaylist(pl.playlistId, pl.name); }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: '#666',
                            cursor: 'pointer',
                            padding: '4px',
                          }}
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div style={{ color: '#A9A9A9', fontSize: '12px' }}>
                        {pl.songCount || 0} songs
                        {pl.followerCount > 0 && ` · ${pl.followerCount} followers`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ════════════════════════════ */}
        {/*       CREATE VIEW            */}
        {/* ════════════════════════════ */}
        {view === 'create' && (
          <div style={{ ...card, maxWidth: '600px' }}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#A9A9A9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Name
              </label>
              <input
                type="text"
                placeholder="e.g. Harlem's Best of 2026"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={100}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#0a0a0c',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#A9A9A9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Description
              </label>
              <textarea
                placeholder="What is this playlist about?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
                rows={3}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: '#0a0a0c',
                  border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#A9A9A9', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                Cover Image
              </label>
              <input
                ref={coverInputRef}
                type="file"
                accept="image/*"
                onChange={handleCoverSelect}
                style={{ display: 'none' }}
              />
              <div
                onClick={() => coverInputRef.current?.click()}
                style={{
                  width: '160px',
                  height: '160px',
                  background: '#0a0a0c',
                  border: '2px dashed rgba(255,255,255,0.15)',
                  borderRadius: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  position: 'relative',
                }}
              >
                {coverPreview ? (
                  <img src={coverPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ textAlign: 'center', color: '#666' }}>
                    <ImageIcon size={32} />
                    <div style={{ fontSize: '11px', marginTop: '6px' }}>Click to upload</div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleBackToList} style={btnSecondary}>Cancel</button>
              <button
                onClick={handleCreate}
                disabled={!name.trim() || creating}
                style={{ ...btnPrimary, opacity: (!name.trim() || creating) ? 0.5 : 1 }}
              >
                {creating ? 'Creating...' : 'Create & Add Songs'}
              </button>
            </div>
          </div>
        )}

        {/* ════════════════════════════ */}
        {/*       EDIT VIEW              */}
        {/* ════════════════════════════ */}
        {view === 'edit' && editingPlaylist && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>

            {/* LEFT: Current tracks */}
            <div style={card}>
              <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '16px' }}>
                Tracks in Playlist ({editingTracks.length})
              </h3>

              {editingTracks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#666' }}>
                  <Music size={32} style={{ marginBottom: '12px', opacity: 0.5 }} />
                  <p>No tracks yet. Add some from the right →</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '600px', overflowY: 'auto' }}>
                  {editingTracks.map((track, idx) => (
                    <div key={track.playlistItemId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px',
                      background: 'rgba(255,255,255,0.03)',
                      borderRadius: '8px',
                    }}>
                      <span style={{ color: '#666', fontSize: '12px', width: '20px', textAlign: 'center' }}>
                        {idx + 1}
                      </span>
                      {track.artworkUrl && (
                        <img src={buildUrl(track.artworkUrl)} alt="" style={{
                          width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover'
                        }} />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {track.title}
                        </div>
                        <div style={{ color: '#888', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {track.artistName}
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveSong(track)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#666',
                          cursor: 'pointer',
                          padding: '4px',
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT: Song picker */}
            <div style={card}>
              <h3 style={{ color: '#fff', marginTop: 0, marginBottom: '16px' }}>Add Songs</h3>

              {/* Mode toggle */}
              <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#0a0a0c', borderRadius: '8px', padding: '4px' }}>
                <button
                  onClick={() => setPickerMode('leaderboard')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: pickerMode === 'leaderboard' ? '#163387' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <TrendingUp size={14} /> Trending
                </button>
                <button
                  onClick={() => setPickerMode('search')}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    background: pickerMode === 'search' ? '#163387' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                  }}
                >
                  <Search size={14} /> Search
                </button>
              </div>

              {/* Search input (only in search mode) */}
              {pickerMode === 'search' && (
                <input
                  type="text"
                  placeholder="Search by song or artist..."
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    background: '#0a0a0c',
                    border: '1px solid rgba(255,255,255,0.15)',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '14px',
                    boxSizing: 'border-box',
                    outline: 'none',
                    marginBottom: '12px',
                  }}
                />
              )}

              {/* Song list */}
              <div style={{ maxHeight: '550px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {pickerMode === 'leaderboard' ? (
                  pickerLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Loading...</div>
                  ) : leaderboardSongs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>No songs found</div>
                  ) : (
                    leaderboardSongs.map(song => {
                      const songId = song.songId || song.id;
                      const alreadyAdded = editingTracks.some(t => t.songId === songId);
                      return (
                        <div key={songId} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                        }}>
                          {song.artworkUrl && (
                            <img src={buildUrl(song.artworkUrl)} alt="" style={{
                              width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover'
                            }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {song.title}
                            </div>
                            <div style={{ color: '#888', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {song.artistName || song.artist?.username || 'Unknown'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddSong(song)}
                            disabled={alreadyAdded}
                            style={{
                              background: alreadyAdded ? 'rgba(34,197,94,0.15)' : '#163387',
                              color: alreadyAdded ? '#22c55e' : '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              cursor: alreadyAdded ? 'default' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {alreadyAdded ? <><Check size={12} /> Added</> : <><Plus size={12} /> Add</>}
                          </button>
                        </div>
                      );
                    })
                  )
                ) : (
                  searchLoading ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Searching...</div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: '#666' }}>
                      {searchQuery ? 'No results' : 'Type to search'}
                    </div>
                  ) : (
                    searchResults.map(song => {
                      const songId = song.songId || song.id;
                      const alreadyAdded = editingTracks.some(t => t.songId === songId);
                      return (
                        <div key={songId} style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px',
                          background: 'rgba(255,255,255,0.03)',
                          borderRadius: '8px',
                        }}>
                          {song.artworkUrl && (
                            <img src={buildUrl(song.artworkUrl)} alt="" style={{
                              width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover'
                            }} />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#fff', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {song.title}
                            </div>
                            <div style={{ color: '#888', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {song.artistName || song.artist?.username || 'Unknown'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleAddSong(song)}
                            disabled={alreadyAdded}
                            style={{
                              background: alreadyAdded ? 'rgba(34,197,94,0.15)' : '#163387',
                              color: alreadyAdded ? '#22c55e' : '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              padding: '6px 10px',
                              cursor: alreadyAdded ? 'default' : 'pointer',
                              fontSize: '12px',
                              fontWeight: '600',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            {alreadyAdded ? <><Check size={12} /> Added</> : <><Plus size={12} /> Add</>}
                          </button>
                        </div>
                      );
                    })
                  )
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default AdminPlaylistPage;