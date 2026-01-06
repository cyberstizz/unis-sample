import React from 'react';
import { X, History, Music, User } from 'lucide-react';
import './voteHistoryModal.scss';

// Dummy images for preview - DELETE AFTER TESTING
import rapperOne from './assets/rapperphotoOne.jpg';
import rapperTwo from './assets/rapperphototwo.jpg';
import rapperThree from './assets/rapperphotothree.jpg';
import rapperFour from './assets/rapperphotofour.jpg';
import songArtOne from './assets/songartworkONe.jpeg';
import songArtTwo from './assets/songartworktwo.jpeg';
import songArtThree from './assets/songartworkthree.jpeg';
import songArtFour from './assets/songartworkfour.jpeg';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

// DUMMY DATA - DELETE AFTER TESTING
const DUMMY_VOTES = [
  {
    voteId: '1',
    targetType: 'artist',
    nomineeName: 'Harlem Heat',
    nomineeImage: rapperOne,
    voteDate: '2024-03-04',
    interval: 'week'
  },
  {
    voteId: '2',
    targetType: 'song',
    nomineeName: 'Streets of 125th',
    nomineeImage: songArtOne,
    voteDate: '2024-02-28',
    interval: 'month'
  },
  {
    voteId: '3',
    targetType: 'artist',
    nomineeName: 'Apollo Dreams',
    nomineeImage: rapperTwo,
    voteDate: '2024-02-15',
    interval: 'day'
  },
  {
    voteId: '4',
    targetType: 'song',
    nomineeName: 'Uptown Vibes',
    nomineeImage: songArtTwo,
    voteDate: '2024-01-22',
    interval: 'quarter'
  },
  {
    voteId: '5',
    targetType: 'artist',
    nomineeName: 'Lenox Ave Legend',
    nomineeImage: rapperThree,
    voteDate: '2024-01-10',
    interval: 'midterm'
  },
  {
    voteId: '6',
    targetType: 'song',
    nomineeName: 'Midnight at Rucker',
    nomineeImage: songArtThree,
    voteDate: '2023-12-31',
    interval: 'year'
  },
  {
    voteId: '7',
    targetType: 'artist',
    nomineeName: 'Sugar Hill Sound',
    nomineeImage: rapperFour,
    voteDate: '2023-12-15',
    interval: 'week'
  },
  {
    voteId: '8',
    targetType: 'song',
    nomineeName: 'Block Party Anthem',
    nomineeImage: songArtFour,
    voteDate: '2023-11-28',
    interval: 'month'
  }
];

const VoteHistoryModal = ({ show, onClose, votes = [], useDummyData = true }) => {
  if (!show) return null;

  // Use dummy data if flag is true or no real votes
  const displayVotes = useDummyData || votes.length === 0 ? DUMMY_VOTES : votes;

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const month = date.getMonth() + 1;
    const day = String(date.getDate()).padStart(2, '0');
    const year = String(date.getFullYear()).slice(-2);
    return `${month}/${day}/${year}`;
  };

  const getIntervalLabel = (interval) => {
    const labels = {
      day: 'Daily',
      week: 'Weekly',
      month: 'Monthly',
      quarter: 'Quarterly',
      midterm: 'Midterm',
      year: 'Yearly'
    };
    return labels[interval?.toLowerCase()] || interval || 'Daily';
  };

  const buildImageUrl = (vote) => {
    // For dummy data, use the imported image directly
    if (vote.nomineeImage && typeof vote.nomineeImage === 'string' && !vote.nomineeImage.startsWith('http') && !vote.nomineeImage.startsWith('/')) {
      return vote.nomineeImage;
    }
    // For real data
    if (vote.nomineeImage) {
      return vote.nomineeImage.startsWith('http') ? vote.nomineeImage : `${API_BASE_URL}${vote.nomineeImage}`;
    }
    return null;
  };

  return (
    <div className="vote-history-modal-overlay" onClick={onClose}>
      <div className="vote-history-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          <X size={24} />
        </button>

        <div className="modal-header">
          <div className="header-icon">
            <History size={28} />
          </div>
          <h2>Vote History</h2>
          <p className="modal-subtitle">{displayVotes.length} votes cast <br /><span style={{color: "green"}}>You voted for</span></p>
        </div>

        <div className="votes-container">
          {displayVotes.length > 0 ? (
            displayVotes.map((vote) => (
              <div key={vote.voteId} className="vote-row">
                <div className="vote-left">
                  <div className="nominee-image-wrapper">
                    {buildImageUrl(vote) ? (
                      <img
                        src={buildImageUrl(vote)}
                        alt={vote.nomineeName}
                        className="nominee-image"
                      />
                    ) : (
                      <div className="nominee-placeholder">
                        {vote.targetType === 'artist' ? (
                          <User size={24} />
                        ) : (
                          <Music size={24} />
                        )}
                      </div>
                    )}
                  </div>
                  <div className="nominee-info">
                    <span className="nominee-name">{vote.nomineeName || 'Unknown'}</span>
                    <span className="nominee-type">
                      {vote.targetType === 'artist' ? 'Artist' : 'Song'}
                    </span>
                  </div>
                </div>
                <div className="vote-right">
                  <span className="vote-date">{formatDate(vote.voteDate)}</span>
                  <span className="vote-interval">{getIntervalLabel(vote.interval)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">
              <History size={48} />
              <p>No votes yet</p>
              <span>Go support your favorite artists and songs!</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VoteHistoryModal;
