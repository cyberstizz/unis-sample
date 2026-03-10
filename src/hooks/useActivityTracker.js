import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { apiCall } from '../components/axiosInstance';

const useActivityTracker = () => {
  const location = useLocation();

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      apiCall({
        url: '/v1/activity/track',
        method: 'post',
        data: {
          activityType: 'page_view',
          page: location.pathname
        }
      }).catch(() => {}); // fire-and-forget
    }
  }, [location.pathname]);
};

export default useActivityTracker;