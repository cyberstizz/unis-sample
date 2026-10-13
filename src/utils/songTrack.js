// Turns a Song as the backend returns it ({songId, title, fileUrl, artist:{...}})
// into the track shape the player expects. Used by the browse shelves and the
// song page's recommended carousel.
import { buildUrl } from './buildUrl';

export function songToTrack(s, source = null) {
  if (!s) return null;
  const url = buildUrl(s.fileUrl) || null;
  const art = buildUrl(s.artworkUrl) || null;
  return {
    type: 'song',
    id: s.songId,
    songId: s.songId,
    url,
    fileUrl: url,
    title: s.title,
    artist: s.artist?.username || 'Unknown artist',
    artistId: s.artist?.userId || null,
    artwork: art,
    artworkUrl: art,
    jurisdiction: s.jurisdiction?.name || null,
    explicit: Boolean(s.explicit),
    source,
  };
}
