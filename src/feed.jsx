import React, { useState, useContext, useEffect } from 'react';
import { PlayerContext } from './context/playercontext'; 
import { useNavigate } from 'react-router-dom';
import axiosInstance, { apiCall } from './components/axiosInstance';
import Layout from './layout';
import randomRapper from './assets/randomrapper.jpeg';
import song1 from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import song2 from './assets/sdboomin_waitedallnight.mp3';
import video1 from './assets/badVideo.mp4';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';
import songArtFive from './assets/songartfive.jpg';
import songArtSix from './assets/songarteight.png';
import songArtNine from './assets/albumartnine.jpg';
import songArtTen from './assets/albumartten.jpeg';
import songArtEleven from './assets/rapperphotoOne.jpg';
import './feed.scss';

const Feed = () => {
  const { playMedia } = useContext(PlayerContext);
  const [animate, setAnimate] = useState(false);
  const [userId, setUserId] = useState(null);
  const [jurisdictionId, setJurisdictionId] = useState('00000000-0000-0000-0000-000000000002');  // Default; update from profile
  const [supportedArtistId, setSupportedArtistId] = useState(null);  // For posts
  const [trendingMedia, setTrendingMedia] = useState([]);  // {id, title, artist, artworkUrl, mediaUrl, type: 'song'|'video'}
  const [newMedia, setNewMedia] = useState([]);
  const [awards, setAwards] = useState([]);  // {id, name, winner}
  const [popularArtists, setPopularArtists] = useState([]);  // {id, username, photoUrl}
  const [followedPosts, setFollowedPosts] = useState([]);  // {id, content/media, artist}
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setAnimate(true);
    fetchFeedData();
  }, []);

  const fetchFeedData = async () => {
    setLoading(true);
    setError('');
    try {
      // 1. Fetch user profile for jurisdiction + supported artist
      const profileRes = await apiCall({ method: 'get', url: '/v1/users/profile' });
      const { userId: uid, jurisdiction, supportedArtistId: suppId } = profileRes.data;
      setUserId(uid);
      setJurisdictionId(jurisdiction.jurisdictionId);
      setSupportedArtistId(suppId);

      // 2. Parallel fetches with params
      const [trendingRes, newRes, awardsRes, popularRes, postsRes] = await Promise.all([
        apiCall({ method: 'get', url: `/v1/media/trending?jurisdictionId=${jurisdiction.jurisdictionId}` }),
        apiCall({ method: 'get', url: `/v1/media/new?jurisdictionId=${jurisdiction.jurisdictionId}` }),
        apiCall({ method: 'get', url: `/v1/awards/leaderboards?jurisdictionId=${jurisdiction.jurisdictionId}` }),
        apiCall({ method: 'get', url: `/v1/users/artist/top?jurisdictionId=${jurisdiction.jurisdictionId}` }),
        suppId ? apiCall({ method: 'get', url: `/v1/media/supported?userId=${uid}` })  // Followed artist's posts/media
              : Promise.resolve({ data: [] })  // No follows → empty
      ]);

      setTrendingMedia(trendingRes.data || []);
      setNewMedia(newRes.data || []);
      setAwards(awardsRes.data || []);
      setPopularArtists(popularRes.data || []);
      setFollowedPosts(postsRes.data || []);
    } catch (err) {
      console.error('Feed load error:', err);
      setError('Feed unavailable—showing demo content.');
      // apiCall fallback auto-uses mocks
    } finally {
      setLoading(false);
    }
  };

  const navigate = useNavigate();

  // Nav handlers (uniform by ID)
  const handleSongNav = (mediaId, type = 'song') => navigate(`/${type}/${mediaId}`);
  const handleArtistNav = (artistId) => navigate(`/artist/${artistId}`);

  // Play handler (immediate, uses data—no refetch)
  const handlePlayMedia = (e, media) => {
    e.stopPropagation();
    const playlist = [media, ...newMedia.slice(0, 2).filter(m => m.id !== media.id)];  // Dynamic, dedup
    playMedia(media, playlist);  // {type, url: mediaUrl, title, artist, artwork: artworkUrl}
  };

  // Dummies (env fallback or error)
  const getDummyTrending = () => [
    { id: 'dummy1', title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artworkUrl: songArtOne, mediaUrl: song1, type: 'song' },
    { id: 'dummy2', title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artworkUrl: songArtTwo, mediaUrl: song2, type: 'song' },
    { id: 'dummy3', title: 'Bad Video', artist: 'some guy', artworkUrl: songArtThree, mediaUrl: video1, type: 'video' },
    { id: 'dummy4', title: 'Song 4', artist: 'Artist 4', artworkUrl: songArtNine, mediaUrl: song1, type: 'song' }
  ];
  const getDummyNew = () => [
    { id: 'dummy5', title: 'The Outside', artist: 'Artist Five', artworkUrl: songArtFive, mediaUrl: song2, type: 'song' },
    { id: 'dummy6', title: 'Original Man', artist: 'Artist Six', artworkUrl: songArtSix, mediaUrl: song1, type: 'song' },
    { id: 'dummy10', title: 'flavorfall', artist: 'Artist Ten', artworkUrl: songArtTen, mediaUrl: song2, type: 'song' },
    { id: 'dummy11', title: 'Golden Son', artist: 'Artist Eleven', artworkUrl: songArtEleven, mediaUrl: song1, type: 'song' }
  ];
  const getDummyAwards = () => [{ id: 'a1', name: 'Award 1' }, { id: 'a2', name: 'Award 2' }, { id: 'a3', name: 'Award 3' }, { id: 'a4', name: 'Award 4' }, { id: 'a5', name: 'Award 5' }];
  const getDummyArtists = () => [{ id: 'art1', username: 'Artist 1' }, { id: 'art2', username: 'Artist 2' }, { id: 'art3', username: 'Artist 3' }, { id: 'art4', username: 'Artist 4' }, { id: 'art5', username: 'Artist 5' }];
  const getDummyPosts = () => [{ id: 'p1', content: 'Follower Post 1' }, { id: 'p2', content: 'Follower Post 2' }, { id: 'p3', content: 'Follower Post 3' }];

  // Data with fallbacks
  const trending = trendingMedia.length ? trendingMedia : getDummyTrending();
  const newMediaList = newMedia.length ? newMedia : getDummyNew();
  const awardsList = awards.length ? awards : getDummyAwards();
  const artistsList = popularArtists.length ? popularArtists : getDummyArtists();
  const postsList = followedPosts.length ? followedPosts : getDummyPosts();

  if (loading) return <div className="loading-feed" style={{ textAlign: 'center', padding: '50px' }}>Loading your feed...</div>;

  return (
    <Layout backgroundImage={randomRapper}>
      <div className="feed-content-wrapper">
        {error && <div className="feed-error" style={{ color: 'orange', padding: '10px', textAlign: 'center' }}>{error}</div>}
        <main className="feed">
          {/* Trending Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>Trending in {jurisdictionId === '00000000-0000-0000-0000-000000000002' ? 'Uptown Harlem' : 'Your Area'}</h2>
            <div className="carousel-items">
              {trending.map((item) => (
                <div key={item.id} className="item-wrapper">
                  <div 
                    className="item" 
                    style={{ backgroundImage: `url(${item.artworkUrl || '/default-art.jpg'})` }}
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                    <button className="play-icon" onClick={(e) => handlePlayMedia(e, item)}>▶</button>
                  </div>
                  <div className="item-title">{item.title} by {item.artist}</div>
                </div>
              ))}
            </div>
          </section>

          {/* New Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>New Releases</h2>
            <div className="carousel-items">
              {newMediaList.map((item) => (
                <div key={item.id} className="item-wrapper">
                  <div 
                    className="item" 
                    style={{ backgroundImage: `url(${item.artworkUrl || '/default-art.jpg'})` }}
                    onClick={() => handleSongNav(item.id, item.type)}
                  >
                    <button className="play-icon" onClick={(e) => handlePlayMedia(e, item)}>▶</button>
                  </div>
                  <div className="item-title">{item.title} by {item.artist}</div>
                </div>
              ))}
            </div>
          </section>

          {/* My Home (Awards) */}
          <section className={`feed-section list ${animate ? "animate" : ""}`}>
            <h2>My Home</h2>
            <ol>
              {awardsList.map((award) => <li key={award.id}>{award.name}</li>)}
            </ol>
          </section>

          {/* Popular (Artists) */}
          <section className={`feed-section list ${animate ? "animate" : ""}`}>
            <h2>Popular Artists</h2>
            <ol>
              {artistsList.map((artist) => (
                <li key={artist.id} onClick={() => handleArtistNav(artist.id)} style={{ cursor: 'pointer' }}>
                  {artist.username || artist.name}
                </li>
              ))}
            </ol>
          </section>

          {/* Posts (Followed) */}
          <section className={`feed-section posts ${animate ? "animate" : ""}`}>
            <h2>From Artists You Follow</h2>
            {postsList.map((post) => (
              <div key={post.id} className="post" onClick={() => handleSongNav(post.id, post.type || 'song')}>
                {post.content || `${post.title} by ${post.artist}`}
              </div>
            ))}
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default Feed;