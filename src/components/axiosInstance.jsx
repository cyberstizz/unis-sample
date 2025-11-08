import axios from 'axios';
import randomRapper from '../assets/randomrapper.jpeg';
import song1 from '../assets/tonyfadd_paranoidbuy1get1free.mp3';
import song2 from '../assets/sdboomin_waitedallnight.mp3';
import video1 from '../assets/badVideo.mp4';
import songArtOne from '../assets/songartworkONe.jpeg';
import songArtTwo from '../assets/songartworktwo.jpeg';
import songArtThree from '../assets/songartworkthree.jpeg';
import songArtFour from '../assets/songartworkfour.jpeg';
import songArtFive from '../assets/songartfive.jpg';
import songArtSix from '../assets/songarteight.png';
import songArtNine from '../assets/albumartnine.jpg';
import songArtTen from '../assets/albumartten.jpeg';
import songArtEleven from '../assets/rapperphotoOne.jpg';

const API_BASE_URL = 'http://localhost:8080/api';
const USE_REAL_API = import.meta.env.VITE_USE_REAL_API === 'true';  // .env toggle: true=real, false=mock

const axiosInstance = axios.create({
  baseURL: USE_REAL_API ? API_BASE_URL : null,  // No base if mock
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// Request interceptor: Attach token
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: 401 → logout
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// New: Fallback wrapper (mocks on !USE_REAL_API or error)
export const apiCall = async (config) => {
  if (!USE_REAL_API) {
    console.log('Using mock data (backend offline/Netlify)');
    return getMockResponse(config.url, config.method);
  }
  try {
    return await axiosInstance(config);
  } catch (error) {
    console.warn('API fallback to mock:', error);
    return getMockResponse(config.url, config.method);
  }
};

// Mock helper (expand per endpoint)
const getMockResponse = (url, method) => {
  // Login example (for completeness)
  if (url.includes('/auth/login') && method === 'post') {
    return { data: { token: 'mock-jwt-for-demo' } };
  }
  // Feed endpoints (your dummies)
  if (url.includes('/v1/users/profile')) {
    return { data: { userId: 'dummy', jurisdiction: { jurisdictionId: '00000000-0000-0000-0000-000000000002' }, supportedArtistId: null } };
  }
  if (url.includes('/v1/media/trending')) {
    return { data: getDummyTrending() };
  }
  if (url.includes('/v1/media/new')) {
    return { data: getDummyNew() };
  }
  if (url.includes('/v1/awards/leaderboards')) {
    return { data: getDummyAwards() };
  }
  if (url.includes('/v1/users/artist/top')) {
    return { data: getDummyArtists() };
  }
  if (url.includes('/v1/media/supported')) {
    return { data: getDummyPosts() };
  }
  // Default empty
  return { data: [] };
};

export const logoutUser = async () => {
  try {
    await axiosInstance.post('/auth/logout');
  } catch (err) {
    console.warn('Logout request failed (likely offline or mock mode)', err);
  } finally {
    localStorage.removeItem('token');
    window.location.href = '/login';
  }
};

const getDummyTrending = () => [
  { 
    songId: '1', 
    title: 'Tony Fadd - Paranoid', 
    artist: { userId: 'user1', username: 'Tony Fadd' }, 
    artworkUrl: songArtOne, 
    fileUrl: song1, 
    score: 100 
  },
  { 
    songId: '2', 
    title: 'SD Boomin - Waited All Night', 
    artist: { userId: 'user2', username: 'SD Boomin' }, 
    artworkUrl: songArtTwo, 
    fileUrl: song2, 
    score: 80 
  },
  { 
    videoId: '3', 
    title: 'Bad Video', 
    artist: { userId: 'user3', username: 'some guy' }, 
    artworkUrl: songArtThree, 
    fileUrl: video1, 
    score: 60 
  },
  { 
    songId: '4', 
    title: 'Song 4', 
    artist: { userId: 'user4', username: 'Artist 4' }, 
    artworkUrl: songArtFour, 
    fileUrl: song1, 
    score: 50 
  }
];

const getDummyNew = () => [
  { 
    songId: '5', 
    title: 'The Outside', 
    artist: { userId: 'user5', username: 'Artist Five' }, 
    artworkUrl: songArtFive, 
    fileUrl: song2, 
    score: 30 
  },
  { 
    songId: '6', 
    title: 'Original Man', 
    artist: { userId: 'user6', username: 'Artist Six' }, 
    artworkUrl: songArtSix, 
    fileUrl: song1, 
    score: 25 
  },
  { 
    songId: '10', 
    title: 'flavorfall', 
    artist: { userId: 'user10', username: 'Artist Ten' }, 
    artworkUrl: songArtTen, 
    fileUrl: song2, 
    score: 20 
  },
  { 
    songId: '11', 
    title: 'Golden Son', 
    artist: { userId: 'user11', username: 'Artist Eleven' }, 
    artworkUrl: songArtEleven, 
    fileUrl: song1, 
    score: 15 
  }
];

const getDummyAwards = () => [
  { id: 'award1', name: 'Best Rap Song', winner: { id: 'winner1', username: 'Tony Fadd' } },
  { id: 'award2', name: 'Top Video', winner: { id: 'winner2', username: 'SD Boomin' } },
  { id: 'award3', name: 'Rising Artist', winner: { id: 'winner3', username: 'Artist Three' } },
  { id: 'award4', name: 'Fan Favorite', winner: { id: 'winner4', username: 'Artist Four' } },
  { id: 'award5', name: 'Breakthrough Track', winner: { id: 'winner5', username: 'Artist Five' } }
];

const getDummyArtists = () => [
  { userId: 'artist1', username: 'Tony Fadd', photoUrl: songArtOne, score: 100 },
  { userId: 'artist2', username: 'SD Boomin', photoUrl: songArtTwo, score: 80 },
  { userId: 'artist3', username: 'Artist Three', photoUrl: songArtThree, score: 60 },
  { userId: 'artist4', username: 'Artist Four', photoUrl: songArtFour, score: 50 },
  { userId: 'artist5', username: 'Artist Five', photoUrl: songArtFive, score: 40 }
];

const getDummyPosts = () => ['Follower Post 1', 'Follower Post 2', 'Follower Post 3'];

export default axiosInstance;