import React, { useState } from 'react';
import './milestonesPage.scss';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';


const MilestonesPage = () => {
  const [location, setLocation] = useState('downtown_harlem');
  const [genre, setGenre] = useState('rap');
  const [category, setCategory] = useState('song_of_the_month');
  const [selectedDate, setSelectedDate] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Dummy winners list
  const dummyResults = [
    {
      rank: 1,
      title: "Orange cup",
      artist: 'Aks da Bully',
      jurisdiction: 'Downtown Harlem',
      votes: 1500,
      artwork: songArtFour,
      caption: 'This win means everything to me. Harlem stand up!'
    },
    {
      rank: 2,
      title: 'City Lights',
      artist: 'Artist B',
      jurisdiction: 'Downtown Harlem',
      votes: 1200,
      artwork: 'https://placehold.co/200x200/1a1a1a/ffffff?text=B'
    },
    {
      rank: 3,
      title: 'Midnight Hustle',
      artist: 'Artist C',
      jurisdiction: 'Downtown Harlem',
      votes: 1150,
      artwork: 'https://placehold.co/200x200/1a1a1a/ffffff?text=C'
    }
  ];

  const [results, setResults] = useState(dummyResults);

  const handleView = () => {
    setIsLoading(true);
    setTimeout(() => {
      setResults(dummyResults); // always dummy data for MVP
      setIsLoading(false);
    }, 800);
  };

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const maxDate = yesterday.toISOString().split('T')[0];

  // Winner highlight is always the first entry
  const winner = results[0];

  return (
    <Layout backgroundImage={backimage}>
      <div className="milestones-page-container">
        <header className="header" id="milestonesHeader">
          <h1>Milestones</h1>
        </header>

        <main className="content-wrapper">
          {/* Filter bar */}
          <section className="filter-card">
            <div className="filter-controls">
              <select
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="filter-select"
              >
                <option value="downtown_harlem">Downtown Harlem</option>
                <option value="uptown_harlem">Uptown Harlem</option>
                <option value="harlem_wide">Harlem</option>
              </select>

              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="filter-select"
              >
                <option value="rap">Rap/Hip-Hop</option>
                <option value="rock">Rock</option>
                <option value="pop">Pop</option>
              </select>

              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="filter-select"
              >
                <option value="artist_of_the_interval">Artist</option>
                <option value="song_of_the_interval">Song</option>
              </select>

              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="filter-select"
                max={maxDate}
              />

              <button
                onClick={handleView}
                className="view-button"
                disabled={isLoading}
              >
                {isLoading ? 'Loading…' : 'View'}
              </button>
            </div>
          </section>

          {/* --- Winner Highlight Block --- */}
          {winner && (
            <section className="winner-highlight">
              <div className="winner-title">{winner.title}</div>
              <div className="winner-artist">{winner.artist}</div>
              <div className="winner-jurisdiction">{winner.jurisdiction}</div>
              <img
                src={songArtFour}
                alt={`${winner.title} artwork`}
                className="winner-artwork"
              />
              <div className="winner-caption">“{winner.caption}”</div>
            </section>
          )}

          {/* Results list */}
          <section className="results-section">
            {isLoading ? (
              <div className="loading-message">Loading milestones…</div>
            ) : (
              <ul className="results-list">
                {results.map((item, idx) => (
                  <li key={item.rank} className="result-item">
                    <div className="rank">#{item.rank}</div>
                    <img
                      src={item.artwork}
                      alt={`${item.title} artwork`}
                      className="item-artwork"
                    />
                    <div className="item-info">
                      <div className="item-title">{item.title}</div>
                      <div className="item-artist">{item.artist}</div>
                    </div>
                    <div className="item-votes">
                      <span>{item.votes} Votes</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </main>
      </div>
    </Layout>
  );
};

export default MilestonesPage;
