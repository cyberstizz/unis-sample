// src/components/VoteAwards.js
import React, { useState, useContext } from 'react';
import { PlayerContext } from './context/playercontext'; 
import unisLogo from './assets/unisLogo.svg';
import './voteawards.scss';
import Header from './header';
import Layout from './layout';
import backimage from './assets/randomrapper.jpeg';
import song1 from './assets/tonyfadd_paranoidbuy1get1free.mp3';
import art1 from './assets/unisLogo1.jpg'; 
import VotingWizard from './votingWizard'; 
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFree from './assets/rapperphotofour.jpg';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';

const dummyData = [
  {
    id: 1, name: 'LyricLoom', type: 'artist', genre: 'rap-hiphop', jurisdiction: 'uptown-harlem', votes: 124, projection: '12th place',
    imageUrl: rapperThree
  },
  {
    id: 2, name: 'The Golden Age', type: 'song', genre: 'rap-hiphop', jurisdiction: 'harlem-wide', votes: 180, projection: 'Top 5',
    imageUrl: rapperOne
  },
  {
    id: 3, name: 'Soulful Serenade', type: 'artist', genre: 'pop', jurisdiction: 'harlem-wide', votes: 98, projection: 'Rising Fast',
    imageUrl: rapperTwo
  },
  {
    id: 4, name: 'Rock Riot', type: 'song', genre: 'rock', jurisdiction: 'downtown-harlem', votes: 210, projection: 'No. 1 Contender',
    imageUrl: rapperOne
  },
  {
    id: 5, name: 'Urban Echo', type: 'artist', genre: 'pop', jurisdiction: 'uptown-harlem', votes: 56, projection: 'Steady climb',
    imageUrl: rapperFree
  },
];

const VoteAwards = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGenre, setSelectedGenre] = useState('rap-hiphop');
  const [selectedType, setSelectedType] = useState('artist');
  const [selectedInterval, setSelectedInterval] = useState('daily');
  const [selectedJurisdiction, setSelectedJurisdiction] = useState('harlem-wide');
  const { playMedia } = useContext(PlayerContext);
  const [showVotingWizard, setShowVotingWizard] = useState(false);
  const [selectedNominee, setSelectedNominee] = useState(null);

  const intervals = ['daily', 'weekly', 'monthly', 'quarterly', 'midterm', 'annual'];
  const genres = ['rap-hiphop', 'rock', 'pop'];
  const types = ['artist', 'song'];
  const jurisdictions = [
    { value: 'uptown-harlem', label: 'Uptown Harlem' },
    { value: 'downtown-harlem', label: 'Downtown Harlem' },
    { value: 'Harlem', label: 'Harlem' },
  ];

  // Corrected filtering logic
  const filteredNominees = dummyData.filter(nominee => {
    // Check if the nominee matches all selected filters
    const passesFilters = (
      nominee.genre === selectedGenre &&
      nominee.type === selectedType &&
      // Corrected jurisdiction logic
      (selectedJurisdiction === 'harlem-wide' || nominee.jurisdiction === selectedJurisdiction)
    );

    const passesSearch = searchQuery.length === 0 || nominee.name.toLowerCase().includes(searchQuery.toLowerCase());
    return passesFilters && passesSearch;
  });

  const handleVoteClick = (nominee) => {
    setSelectedNominee(nominee);
    setShowVotingWizard(true);
  };

  const handleVoteSuccess = (id) => {
    alert(`Vote confirmed for nominee with ID: ${id}!`);
    setShowVotingWizard(false);
    setSelectedNominee(null);
  };

  // Create a single object with all filter states to pass as a prop
  const currentFilters = {
    selectedGenre,
    selectedType,
    selectedInterval,
    selectedJurisdiction,
  };

  return (
    <Layout backgroundImage={backimage}>
      <div className='voteAwardsContainer'>
        <div className="filters">
          <select value={selectedGenre} onChange={(e) => setSelectedGenre(e.target.value)} className="filter-select">
            {genres.map((g) => (
              <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
            ))}
          </select>
          <select value={selectedType} onChange={(e) => setSelectedType(e.target.value)} className="filter-select">
            {types.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
          <select value={selectedInterval} onChange={(e) => setSelectedInterval(e.target.value)} className="filter-select">
            {intervals.map((int) => (
              <option key={int} value={int}>{int.charAt(0).toUpperCase() + int.slice(1)}</option>
            ))}
          </select>
          <select value={selectedJurisdiction} onChange={(e) => setSelectedJurisdiction(e.target.value)} className="filter-select">
            {jurisdictions.map((jur) => (
              <option key={jur.value} value={jur.value}>{jur.label}</option>
            ))}
          </select>
        </div>

        <section className="nominees">
          <h2>{selectedInterval.charAt(0).toUpperCase() + selectedInterval.slice(1)} {selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} of {selectedGenre.toUpperCase()} in {jurisdictions.find(j => j.value === selectedJurisdiction)?.label}</h2>

          <form className="search-form" onSubmit={(e) => e.preventDefault()}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search for a ${selectedType} to vote for...`}
              className="search-bar"
            />
          </form>

          <ul className="nominee-list">
            {filteredNominees.length > 0 ? (
              filteredNominees.map((nominee) => (
                <li key={nominee.id} className="nominee-item">
                  <div className="nominee-image" style={{ backgroundImage: `url(${nominee.imageUrl})` }}></div>
                  <div className="nominee-info">
                    <h3 id="nominee-name">{nominee.name}</h3>
                    <p>Votes: {nominee.votes}</p>
                    <p className="projection">{nominee.projection}</p>
                  </div>
                  <button onClick={() => {playMedia({ type: 'song', url: song1, title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artwork: art1 })}} className="listen-button">Listen</button>
                  <button onClick={() => handleVoteClick(nominee)} className="vote-button">Vote</button>
                </li>
              ))
            ) : (
              <p className="no-nominees">No nominees found. Try a different search or filter combination.</p>
            )}
          </ul>
        </section>
      </div>

      <VotingWizard
        show={showVotingWizard}
        onClose={() => setShowVotingWizard(false)}
        onVoteSuccess={handleVoteSuccess}
        nominee={selectedNominee}
        filters={currentFilters}
      />
    </Layout>
  );
};

export default VoteAwards;