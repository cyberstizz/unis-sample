// src/services/playlistService.test.js
//
// Unit tests for playlistService — a thin axios wrapper for playlist CRUD,
// track management, and reordering. Verifies correct HTTP verbs, URLs,
// payloads, and return values.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import playlistService from './playlistService';

// Mock the axios instance before importing the service
const mockGet = vi.fn();
const mockPost = vi.fn();
const mockPut = vi.fn();
const mockDelete = vi.fn();

vi.mock('./components/axiosInstance', () => ({
  default: {
    get: (...args) => mockGet(...args),
    post: (...args) => mockPost(...args),
    put: (...args) => mockPut(...args),
    delete: (...args) => mockDelete(...args),
  },
}));

describe('playlistService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================================
  // getUserPlaylists
  // ========================================================================
  describe('getUserPlaylists', () => {
    it('calls GET /playlists and returns response data', async () => {
      const mockData = [
        { id: 'pl-1', name: 'My Favorites' },
        { id: 'pl-2', name: 'Workout' },
      ];
      mockGet.mockResolvedValue({ data: mockData });

      const result = await playlistService.getUserPlaylists();

      expect(mockGet).toHaveBeenCalledWith('/playlists');
      expect(result).toEqual(mockData);
    });
  });

  // ========================================================================
  // getPlaylistById
  // ========================================================================
  describe('getPlaylistById', () => {
    it('calls GET /playlists/:id and returns response data', async () => {
      const mockData = { id: 'pl-1', name: 'My Favorites', tracks: [] };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await playlistService.getPlaylistById('pl-1');

      expect(mockGet).toHaveBeenCalledWith('/playlists/pl-1');
      expect(result).toEqual(mockData);
    });
  });

  // ========================================================================
  // createPlaylist
  // ========================================================================
  describe('createPlaylist', () => {
    it('calls POST /playlists with name payload and returns response data', async () => {
      const mockData = { id: 'pl-new', name: 'New Playlist' };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await playlistService.createPlaylist('New Playlist');

      expect(mockPost).toHaveBeenCalledWith('/playlists', { name: 'New Playlist' });
      expect(result).toEqual(mockData);
    });
  });

  // ========================================================================
  // updatePlaylist
  // ========================================================================
  describe('updatePlaylist', () => {
    it('calls PUT /playlists/:id with name payload and returns response data', async () => {
      const mockData = { id: 'pl-1', name: 'Updated Name' };
      mockPut.mockResolvedValue({ data: mockData });

      const result = await playlistService.updatePlaylist('pl-1', 'Updated Name');

      expect(mockPut).toHaveBeenCalledWith('/playlists/pl-1', { name: 'Updated Name' });
      expect(result).toEqual(mockData);
    });
  });

  // ========================================================================
  // deletePlaylist
  // ========================================================================
  describe('deletePlaylist', () => {
    it('calls DELETE /playlists/:id with no return value', async () => {
      mockDelete.mockResolvedValue({});

      const result = await playlistService.deletePlaylist('pl-1');

      expect(mockDelete).toHaveBeenCalledWith('/playlists/pl-1');
      expect(result).toBeUndefined();
    });
  });

  // ========================================================================
  // addTrackToPlaylist
  // ========================================================================
  describe('addTrackToPlaylist', () => {
    it('calls POST /playlists/:id/tracks with songId payload and returns response data', async () => {
      const mockData = { playlistItemId: 'item-1', songId: 'song-001' };
      mockPost.mockResolvedValue({ data: mockData });

      const result = await playlistService.addTrackToPlaylist('pl-1', 'song-001');

      expect(mockPost).toHaveBeenCalledWith('/playlists/pl-1/tracks', { songId: 'song-001' });
      expect(result).toEqual(mockData);
    });
  });

  // ========================================================================
  // removeTrackFromPlaylist
  // ========================================================================
  describe('removeTrackFromPlaylist', () => {
    it('calls DELETE /playlists/:id/tracks/:playlistItemId with no return value', async () => {
      mockDelete.mockResolvedValue({});

      const result = await playlistService.removeTrackFromPlaylist('pl-1', 'item-1');

      expect(mockDelete).toHaveBeenCalledWith('/playlists/pl-1/tracks/item-1');
      expect(result).toBeUndefined();
    });
  });

  // ========================================================================
  // reorderPlaylist
  // ========================================================================
  describe('reorderPlaylist', () => {
    it('calls PUT /playlists/:id/reorder with ordered item IDs and returns response data', async () => {
      const orderedIds = ['item-3', 'item-1', 'item-2'];
      const mockData = { success: true };
      mockPut.mockResolvedValue({ data: mockData });

      const result = await playlistService.reorderPlaylist('pl-1', orderedIds);

      expect(mockPut).toHaveBeenCalledWith('/playlists/pl-1/reorder', orderedIds);
      expect(result).toEqual(mockData);
    });
  });
});