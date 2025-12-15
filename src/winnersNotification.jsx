import React, { useState, useEffect } from 'react';
import { Trophy, TrendingUp, Music, Users } from 'lucide-react';
import { apiCall } from './components/axiosInstance';
import { useAuth } from './context/AuthContext';
import './winnersNotification.scss';

const WinnersNotification = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [notification, setNotification] = useState(null);
  const [hasShownToday, setHasShownToday] = useState(false);

  useEffect(() => {
    // Check if we've already shown notification today
    const lastShown = localStorage.getItem('winnersNotificationShown');
    const today = new Date().toDateString();
    
    if (lastShown === today) {
      setHasShownToday(true);
      return;
    }

    // Fetch notification data when user logs in
    if (user && !hasShownToday) {
      fetchNotificationData();
    }
  }, [user]);

  const fetchNotificationData = async () => {
    try {
      // Get user's jurisdiction and genre for relevant data
      const userJurisdiction = user.jurisdiction?.jurisdictionId || '00000000-0000-0000-0000-000000000003';
      const userGenre = user.genre?.genreId || '00000000-0000-0000-0000-000000000101';

      // Fetch current leaderboard to show who's leading
      const response = await apiCall({
        method: 'get',
        url: `/v1/vote/leaderboards?jurisdictionId=${userJurisdiction}&genreId=${userGenre}&targetType=artist&intervalId=00000000-0000-0000-0000-000000000201&limit=3`
      });

      const leaderboardData = response.data;
      
      if (leaderboardData && leaderboardData.length > 0) {
        const leader = leaderboardData[0];
        const notificationTypes = [
          {
            type: 'leading',
            icon: <Trophy size={24} />,
            title: '🏆 Current Leader',
            message: `${leader.name} is leading for Artist of the Day with ${leader.votes} votes!`,
            color: '#FFD700' // Gold
          },
          {
            type: 'trending',
            icon: <TrendingUp size={24} />,
            title: '📈 Top 3 Artists',
            message: `${leaderboardData.slice(0, 3).map(a => a.name).join(', ')} are battling for the top spot!`,
            color: '#00D4FF' // Cyan
          },
          {
            type: 'community',
            icon: <Users size={24} />,
            title: '👥 Community Pulse',
            message: `${leader.votes} votes cast today in your community. Make yours count!`,
            color: '#9D4EDD' // Purple
          }
        ];

        // Randomly pick one notification type for variety
        const randomNotif = notificationTypes[Math.floor(Math.random() * notificationTypes.length)];
        
        setNotification({
          ...randomNotif,
          artwork: leader.artwork
        });

        setShow(true);
        
        // Mark as shown today
        localStorage.setItem('winnersNotificationShown', new Date().toDateString());
        
        // Auto-hide after 5 seconds
        setTimeout(() => setShow(false), 5000);
      }
    } catch (error) {
      console.error('Failed to fetch notification data:', error);
      
      // Fallback notification if API fails
      setNotification({
        type: 'welcome',
        icon: <Music size={24} />,
        title: '🎵 Welcome to UNIS',
        message: 'Check out today\'s leaderboards and cast your vote!',
        color: '#FF6B6B',
        artwork: null
      });
      setShow(true);
      setTimeout(() => setShow(false), 5000);
    }
  };

  if (!show || !notification) return null;

  return (
    <div className="winners-notification">
      <div className="winners-card" style={{ '--border-color': notification.color }}>
        {notification.artwork && (
          <img 
            src={notification.artwork} 
            alt="Leader" 
            className="notification-artwork" 
          />
        )}
        <div className="notification-content">
          <div className="notification-header">
            <span className="notification-icon" style={{ color: notification.color }}>
              {notification.icon}
            </span>
            <h3>{notification.title}</h3>
          </div>
          <p>{notification.message}</p>
        </div>
      </div>
    </div>
  );
};

export default WinnersNotification;