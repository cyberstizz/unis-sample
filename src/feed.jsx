// src/components/Feed.js
import React, { useState, useContext, useEffect } from 'react';
import { PlayerContext } from './context/playercontext'; 
import { useNavigate } from 'react-router-dom';
import Layout from './layout';
import song1 from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import song2 from './assets/sdboomin_waitedallnight.mp3';
import video1 from './assets/badVideo.mp4'
import art1 from './assets/unisLogo1.jpg'; 
import art2 from './assets/theQuiet.jpg';
import './feed.scss';
import randomRapper from './assets/randomrapper.jpeg';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';
import songArtFive from './assets/songartfive.jpg';
import songArtSix from './assets/songarteight.png';


const Feed = () => {
  const { playMedia } = useContext(PlayerContext);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
  }, []);

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const navigate = useNavigate();

  const handleClick = () => {
    navigate('/voteawards');
  };

  const handleLeaderboards = () => {
    navigate('/leaderboards'); 
  };

  const handleMilestones = () => {
    navigate('/milestones'); 
  };

  const handleArtist = () => {
    navigate('/artist'); 
  };

  const handleSong = () => {
    navigate('/song'); 
  };

  const handleProfile = () => {
    navigate('/profile'); 
  };

  return (
    <Layout backgroundImage={randomRapper}>
      <div className="feed-content-wrapper">
        <main className="feed">
          {/* Trending Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>Trending</h2>
            <div className="carousel-items">

              <div className="item-wrapper">
                <div 
                  className="item" 
                  style={{ backgroundImage: `url(${songArtOne})` }}
                  onClick={() => {
                    playMedia(
                      { type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: songArtOne },
                      [
                        { type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: songArtTwo },
                        { type: 'song', url: song2, title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artwork: songArtFour },
                      ]
                    );
                  }}
                />
                <div className="item-title">Tony Fadd - Paranoid</div>
              </div>

              <div className="item-wrapper">
                <div 
                  className="item" 
                  style={{ backgroundImage: `url(${songArtTwo})` }}
                  onClick={() => {
                    playMedia(
                      { type: 'song', url: song2, title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artwork: songArtTwo },
                      [
                        { type: 'song', url: song2, title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artwork: songArtThree },
                        { type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: songArtFour },
                      ]
                    );
                  }}
                />
                <div className="item-title">SD Boomin - Waited All Night</div>
              </div>

              <div className="item-wrapper">
                <div 
                  className="item" 
                  style={{ backgroundImage: `url(${songArtThree})` }}
                  onClick={() => {
                    playMedia(
                      { type: 'video', url: video1, title: 'badVideo', artist: 'some guy', artwork: art2 },
                      [
                        { type: 'song', url: song2, title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artwork: art2 },
                        { type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: art1 },
                      ]
                    );
                  }}
                />
                <div className="item-title">Bad Video</div>
              </div>

              <div className="item-wrapper">
                <div className="item"
                     style={{ backgroundImage: `url(${art2})`, backgroundSize: "contain", backgroundRepeat: "no-repeat" }}
               />
                <div className="item-title">Song 4</div>
              </div>

            </div>
          </section>

          {/* New Carousel */}
          <section className={`feed-section carousel ${animate ? "animate" : ""}`}>
            <h2>New</h2>
            <div className="carousel-items">
              <div className="item-wrapper">
                <div className="item" 
                     style={{ backgroundImage: `url(${songArtFive})` }}
                onClick={handleSong} />
                <div className="item-title"
                >New Song A</div>
              </div>
              <div className="item-wrapper">
                <div className="item" 
                     style={{ backgroundImage: `url(${songArtSix})` }}
                />
                <div className="item-title">New Song B</div>
              </div>
              <div className="item-wrapper">
                <div className="item" />
                <div className="item-title">New Song C</div>
              </div>
              <div className="item-wrapper">
                <div className="item" />
                <div className="item-title">New Song D</div>
              </div>
            </div>
          </section>

          {/* My Home List */}
          <section className={`feed-section list ${animate ? "animate" : ""}`}>
            <h2>My Home</h2>
            <ol>
              <li>Award 1</li>
              <li>Award 2</li>
              <li>Award 3</li>
              <li>Award 4</li>
              <li>Award 5</li>
            </ol>
          </section>

          {/* Popular List */}
          <section className={`feed-section list ${animate ? "animate" : ""}`}>
            <h2>Popular</h2>
            <ol>
              <li>Artist 1</li>
              <li>Artist 2</li>
              <li>Artist 3</li>
              <li>Artist 4</li>
              <li>Artist 5</li>
            </ol>
          </section>

          {/* Posts Section */}
          <section className={`feed-section posts ${animate ? "animate" : ""}`}>
            <h2>Posts</h2>
            <div className="post">Follower Post 1</div>
            <div className="post">Follower Post 2</div>
            <div className="post">Follower Post 3</div>
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default Feed;
