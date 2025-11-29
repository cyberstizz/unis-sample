// src/services/playlistService.js
import axiosInstance from './components/axiosInstance';

const playlistService = {
  // Get all playlists for the current user
  getUserPlaylists: async () => {
    const response = await axiosInstance.get('/playlists');
    return response.data;
  },

  // Get a specific playlist with all its tracks
  getPlaylistById: async (playlistId) => {
    const response = await axiosInstance.get(`/playlists/${playlistId}`);
    return response.data;
  },

  // Create a new playlist
  createPlaylist: async (name) => {
    const response = await axiosInstance.post('/playlists', { name });
    return response.data;
  },

  // Update playlist name
  updatePlaylist: async (playlistId, name) => {
    const response = await axiosInstance.put(`/playlists/${playlistId}`, { name });
    return response.data;
  },

  // Delete a playlist
  deletePlaylist: async (playlistId) => {
    await axiosInstance.delete(`/playlists/${playlistId}`);
  },

  // Add a track to a playlist
  addTrackToPlaylist: async (playlistId, songId) => {
    const response = await axiosInstance.post(`/playlists/${playlistId}/tracks`, { songId });
    return response.data;
  },

  // Remove a track from a playlist
  removeTrackFromPlaylist: async (playlistId, playlistItemId) => {
    await axiosInstance.delete(`/api/playlists/${playlistId}/tracks/${playlistItemId}`);
  },

  // Reorder tracks in a playlist
  reorderPlaylist: async (playlistId, orderedItemIds) => {
    const response = await axiosInstance.put(`/api/playlists/${playlistId}/reorder`, orderedItemIds);
    return response.data;
  }
};

export default playlistService;