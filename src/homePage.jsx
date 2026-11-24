// src/homePage.jsx — Home (/), Nov 2026
//
// Scout → Sketch → Ship (canvas "Unis Home & bottom bar"). The Feed keeps its
// own page at /feed; Home is short and about you:
//   1. What's [your area] playing — today's song race, top 3, live, with Vote
//      right under it. The card takes the #1 song's artwork colours.
//   2. Jump back in — your playlists and the ones you saved.
//   3. New from artists you follow (signed in, when there are any).
//   4. New in [your area].
//   5. Artists near you — this week's top artists.
//   6. One ad.
// Signed out: the race, a card to sign in or join, New in [area], Artists.
//
// Rules from the research: one tile size per row, nothing plays by itself,
// no sections Unis doesn't have. Every section uses data the app already
// loads elsewhere (live standings, vote history, PlayerContext playlists,
// following drops, new releases), so Home needs no backend work.

import React, { useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ALERTS_CHANGED, fetchAlertSummary } from './utils/releaseAlerts';
import './releaseAlerts.scss';
import Layout from './layout';
import AdSlot from './components/AdSlot';
import { PlayerContext } from './context/playercontext';
import { useAuth } from './context/AuthContext';
import { useFeedback } from './context/FeedbackContext';
import LastWonNotification from './LastWonNotification';
import AuthGateSheet, { useAuthGate, incrementGateSongCount } from './AuthGateSheet';
import { apiCall } from './components/axiosInstance';
import { buildUrl } from './utils/buildUrl';
import { fetchStandings, formatCloseTime, describeBoard, playEntry } from './utils/standings';
import { toLocalISO } from './utils/periodBounds';
import { JURISDICTION_NAMES } from './utils/idMappings';
import './homePage.scss';

// Launch area for signed-out visitors and accounts without one yet.
const DEFAULT_JURISDICTION = { id: '1cf6ceb1-aae6-4113-98c0-d9fe8ad8b5e3', name: 'Harlem' };

const PlayIcon = ({ size = 18 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="currentColor">
    <path d="M8.6 6.32v11.36a1.3 1.3 0 001.97 1.11l9.27-5.68a1.3 1.3 0 000-2.22L10.57 5.21A1.3 1.3 0 008.6 6.32z" />
  </svg>
);
const VoteGlyph = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="4.5" width="16" height="15" rx="3.4" />
    <path d="M8.4 12l2.4 2.4L15.6 9.4" />
  </svg>
);
const CheckGlyph = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
const ChevronGlyph = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5l7 7-7 7" />
  </svg>
);
const NoteGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

// Media rows (new releases, following drops) → what Home renders and plays.
const toSong = (item) => ({
  id: item.songId || item.id,
  songId: item.songId || item.id,
  type: 'song',
  title: item.title || 'Untitled',
  artist: item.artist?.username || item.artistName || 'Unknown artist',
  artistId: item.artist?.userId || item.artistId || null,
  artwork: buildUrl(item.artworkUrl),
  artworkUrl: buildUrl(item.artworkUrl),
  url: buildUrl(item.fileUrl),
  fileUrl: buildUrl(item.fileUrl),
  createdAt: item.createdAt || null,
});

// A playlist's cover: its own image, else the first song's artwork.
const playlistCover = (pl) => buildUrl(pl.coverImageUrl) || buildUrl((pl.firstFourArtworks || []).find(Boolean)) || null;

const HomePage = () => {
  const navigate = useNavigate();
  const { user, isGuest } = useAuth();
  const { requestPlay, playlists = [], followedPlaylists = [] } = useContext(PlayerContext) || {};
  const feedback = useFeedback();
  const { triggerGate, gateProps } = useAuthGate();

  const signedIn = !!user && !isGuest;
  const userId = user?.userId;
  const area = user?.jurisdiction?.jurisdictionId
    ? { id: user.jurisdiction.jurisdictionId, name: user.jurisdiction.name || DEFAULT_JURISDICTION.name }
    : DEFAULT_JURISDICTION;
  const placeKey = JURISDICTION_NAMES[area.id] || 'harlem';

  const [race, setRace] = useState(null);          // today's song board
  const [raceFailed, setRaceFailed] = useState(false);
  const [artists, setArtists] = useState([]);      // this week's top artists
  const [fresh, setFresh] = useState([]);          // new in the area
  const [following, setFollowing] = useState([]);  // new from artists you follow
  // ★ Release alerts: songs newer than the last look at New releases get NEW.
  const [alertSeen, setAlertSeen] = useState({ on: false, seenAt: null });
  const [voteHistory, setVoteHistory] = useState([]);

  // ── Today's race (top 3) ──
  useEffect(() => {
    let alive = true;
    setRace(null);
    setRaceFailed(false);
    fetchStandings({ type: 'song', jurisdictionId: area.id, genre: 'all', period: 'daily', limit: 3 })
      .then((board) => { if (alive) setRace(board); })
      .catch((err) => {
        console.error('[Home] race load failed:', err?.message || err);
        if (alive) setRaceFailed(true);
      });
    return () => { alive = false; };
  }, [area.id]);

  // ── Artists near you + new in the area ──
  useEffect(() => {
    let alive = true;
    fetchStandings({ type: 'artist', jurisdictionId: area.id, genre: 'all', period: 'weekly', limit: 8 })
      .then((board) => { if (alive) setArtists(board.entries); })
      .catch((err) => {
        console.error('[Home] top artists load failed (row hidden):', err?.message || err);
        if (alive) setArtists([]);
      });
    apiCall({ method: 'get', url: `/v1/media/new?jurisdictionId=${area.id}&limit=8` })
      .then((res) => { if (alive) setFresh((Array.isArray(res.data) ? res.data : []).map(toSong)); })
      .catch((err) => {
        console.error('[Home] new releases load failed (row hidden):', err?.message || err);
        if (alive) setFresh([]);
      });
    return () => { alive = false; };
  }, [area.id]);

  // ── Signed in: what you voted today, and new songs from people you follow ──
  useEffect(() => {
    if (!signedIn) { setVoteHistory([]); setFollowing([]); return undefined; }
    let alive = true;
    apiCall({ method: 'get', url: '/v1/vote/history?limit=20', useCache: false })
      .then((res) => { if (alive) setVoteHistory(Array.isArray(res.data) ? res.data : []); })
      .catch((err) => {
        console.error('[Home] vote history load failed:', err?.message || err);
        if (alive) setVoteHistory([]);
      });
    apiCall({ method: 'get', url: '/v1/media/following/new?days=7&limit=12', useCache: false })
      .then((res) => { if (alive) setFollowing((Array.isArray(res.data) ? res.data : []).map(toSong)); })
      .catch((err) => {
        console.error('[Home] following drops load failed (row hidden):', err?.message || err);
        if (alive) setFollowing([]);
      });
    const loadSeen = () => fetchAlertSummary()
      .then((sum) => { if (alive) setAlertSeen({ on: !!sum?.inApp, seenAt: sum?.seenAt || null }); })
      .catch((err) => console.error('[Home] release alert summary failed (no NEW tags):', err?.message || err));
    loadSeen();
    window.addEventListener(ALERTS_CHANGED, loadSeen);
    return () => { alive = false; window.removeEventListener(ALERTS_CHANGED, loadSeen); };
  }, [signedIn, userId]);

  const isNewToYou = (s) => {
    if (!alertSeen.on || !s.createdAt) return false;
    if (!alertSeen.seenAt) return true;
    const made = Date.parse(s.createdAt);
    const seen = Date.parse(alertSeen.seenAt);
    return !Number.isNaN(made) && !Number.isNaN(seen) && made > seen;
  };

  // Same rule as the feed: a daily song vote cast today, in this area.
  const votedToday = useMemo(() => {
    const today = toLocalISO(new Date());
    return voteHistory.some((v) => v?.voteDate === today
      && /^(dai|day)/i.test(v?.interval || 'day')
      && String(v?.targetType || '').toLowerCase() === 'song'
      && (!v?.jurisdictionId || v.jurisdictionId === area.id));
  }, [voteHistory, area.id]);

  // Your playlists first, then saved ones, never twice.
  const library = useMemo(() => {
    const seen = new Set();
    const out = [];
    [...(playlists || []), ...(followedPlaylists || [])].forEach((pl) => {
      const id = pl?.playlistId || pl?.id;
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({ ...pl, id });
    });
    return out.slice(0, 8);
  }, [playlists, followedPlaylists]);

  // ── Actions ──
  const play = useCallback((song) => {
    if (isGuest) incrementGateSongCount();
    if (!song?.url) { feedback.info('This song is unavailable right now'); return; }
    requestPlay(song);
  }, [isGuest, requestPlay, feedback]);

  const playRaceEntry = useCallback(async (entry) => {
    if (isGuest) incrementGateSongCount();
    const ok = await playEntry(entry, requestPlay, 'home');
    if (!ok) feedback.info('This song is unavailable right now');
  }, [isGuest, requestPlay, feedback]);

  const vote = () => {
    if (isGuest || !user) { triggerGate('vote'); return; }
    navigate('/voteawards');
  };

  const openRace = () => navigate(`/charts?type=song&period=daily&genre=all&place=${placeKey}`);

  // ── Race card words ──
  const entries = (race?.entries || []).filter((e) => e.points > 0).slice(0, 3);
  const leadArt = entries[0]?.artwork || null;
  let liveLine = 'Live today';
  if (race) {
    if (race.state === 'LIVE') {
      const t = formatCloseTime(race.closesAt);
      liveLine = t ? `Live · closes ${/^12:00\s?AM$/i.test(t) ? 'at midnight' : `at ${t}`}` : 'Live today';
    } else {
      liveLine = describeBoard(race).title;
    }
  }

  const songCard = (s) => (
    <div key={s.id} className="hm-card">
      <button type="button" className="hm-card__art" onClick={() => play(s)} aria-label={`Play ${s.title} by ${s.artist}`}>
        {s.artwork ? <img src={s.artwork} alt="" loading="lazy" /> : <span className="hm-card__empty"><NoteGlyph /></span>}
        <span className="hm-card__play" aria-hidden="true"><PlayIcon size={18} /></span>
        {s.isNew && <span className="hm-card__new">New</span>}
      </button>
      <button type="button" className="hm-card__title" onClick={() => navigate(`/song/${s.id}`)}>{s.title}</button>
      <button type="button" className="hm-card__sub" onClick={() => s.artistId && navigate(`/artist/${s.artistId}`)}>{s.artist}</button>
    </div>
  );

  return (
    <Layout>
      <div className="hm">
        {/* ── WHAT'S [AREA] PLAYING ── */}
        <section className={`hm-race ${entries.length ? '' : 'is-quiet'}`} aria-label="Today's race">
          {leadArt && <div className="hm-race__wash" style={{ backgroundImage: `url("${leadArt}")` }} aria-hidden="true" />}
          <div className="hm-race__shade" aria-hidden="true" />

          <div className="hm-race__intro">
            <div className="hm-live"><span className="hm-live__dot" aria-hidden="true" />{liveLine}</div>
            <h1 className="hm-race__title">What&rsquo;s <em>{area.name}</em> playing</h1>
            <p className="hm-race__lede">Today&rsquo;s song race, live. One vote a day decides who tops it at midnight.</p>
          </div>

          {!race && !raceFailed ? (
            <ol className="hm-race__list" aria-busy="true">
              {[0, 1, 2].map((i) => <li key={i} className="hm-entry hm-entry--ghost" />)}
            </ol>
          ) : entries.length > 0 ? (
            <ol className="hm-race__list">
              {entries.map((e, i) => (
                <li key={e.id} className="hm-entry">
                  <span className={`hm-entry__rank ${i === 0 ? 'is-first' : ''}`}>{i + 1}</span>
                  <button type="button" className="hm-entry__art" onClick={() => navigate(`/song/${e.id}`)} aria-label={`Open ${e.name}`}>
                    {e.artwork ? <img src={e.artwork} alt="" /> : <span className="hm-card__empty"><NoteGlyph /></span>}
                    <span className="hm-entry__big" aria-hidden="true">{i + 1}</span>
                  </button>
                  <button type="button" className="hm-entry__text" onClick={() => navigate(`/song/${e.id}`)}>
                    <span className="hm-entry__name">{e.name}</span>
                    <span className="hm-entry__sub">{e.artistName} · {e.points.toLocaleString('en-US')} pts</span>
                  </button>
                  <button type="button" className="hm-entry__play" onClick={() => playRaceEntry(e)} aria-label={`Play ${e.name}`}>
                    <PlayIcon size={18} />
                  </button>
                </li>
              ))}
            </ol>
          ) : null}

          {race && entries.length < 3 && (
            <p className="hm-race__note">
              {entries.length === 0
                ? 'No votes yet today. Your vote could put the first song on this list.'
                : `Only ${entries.length === 1 ? 'one song has' : 'two songs have'} points so far today. Your vote could put a new song on this list.`}
            </p>
          )}
          {raceFailed && <p className="hm-race__note">Today&rsquo;s race couldn&rsquo;t load. The full race is one tap away.</p>}

          <div className="hm-race__cta">
            {signedIn && votedToday ? (
              <div className="hm-voted" role="status">
                <span className="hm-voted__tick" aria-hidden="true"><CheckGlyph /></span>
                You voted today · next race at midnight
              </div>
            ) : (
              <button type="button" className="hm-vote" onClick={vote}>
                <VoteGlyph />
                {signedIn ? 'Vote in today’s race' : 'Sign in to vote'}
              </button>
            )}
            <button type="button" className="hm-race__more" onClick={openRace}>
              See the full race <ChevronGlyph />
            </button>
          </div>
        </section>

        {/* ── SIGNED OUT: join ── */}
        {!signedIn && (
          <section className="hm-join">
            <h2>Your city, your charts</h2>
            <p>Sign in to vote, save playlists and follow artists near you.</p>
            <button type="button" onClick={() => navigate('/login')}>Sign in or join</button>
          </section>
        )}

        {/* ── JUMP BACK IN ── */}
        {signedIn && library.length > 0 && (
          <section aria-labelledby="hm-jump">
            <h2 className="hm-h2" id="hm-jump">Jump back in</h2>
            <div className="hm-jump">
              {library.map((pl) => {
                const cover = playlistCover(pl);
                return (
                  <button key={pl.id} type="button" className="hm-tile" onClick={() => navigate(`/playlist/${pl.id}`)}>
                    <span className="hm-tile__cover">{cover ? <img src={cover} alt="" loading="lazy" /> : <NoteGlyph />}</span>
                    <span className="hm-tile__name">{pl.name || 'Playlist'}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* ── NEW FROM ARTISTS YOU FOLLOW ── */}
        {signedIn && following.length > 0 && (
          <section aria-labelledby="hm-follow">
            <h2 className="hm-h2" id="hm-follow">New from artists you follow</h2>
            <div className="hm-shelf">{following.map((s) => songCard({ ...s, isNew: isNewToYou(s) }))}</div>
          </section>
        )}

        {/* ── NEW IN [AREA] ── */}
        {fresh.length > 0 && (
          <section aria-labelledby="hm-fresh">
            <h2 className="hm-h2" id="hm-fresh">New in <em>{area.name}</em></h2>
            <div className="hm-shelf">{fresh.map(songCard)}</div>
          </section>
        )}

        {/* ── ARTISTS NEAR YOU ── */}
        {artists.length > 0 && (
          <section aria-labelledby="hm-near">
            <h2 className="hm-h2" id="hm-near">Artists near you</h2>
            <div className="hm-shelf hm-shelf--artists">
              {artists.map((a) => (
                <button key={a.id} type="button" className="hm-artist" onClick={() => navigate(`/artist/${a.id}`)}>
                  <span className="hm-artist__photo">
                    {a.artwork ? <img src={a.artwork} alt="" loading="lazy" /> : <span>{(a.name || '?').charAt(0).toUpperCase()}</span>}
                  </span>
                  <span className="hm-artist__name">{a.name}</span>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ── AD SPACE (none for Unis Plus) ── */}
        <div className="hm-ad"><AdSlot placement="feed" /></div>
      </div>
      {/* Yesterday's winner, announced once per award */}
      {signedIn && <LastWonNotification />}
      <AuthGateSheet {...gateProps} />
    </Layout>
  );
};

export default HomePage;
