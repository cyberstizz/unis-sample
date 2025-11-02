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

// Dummy arrays (match your assets—expand as needed)
const getDummyTrending = () => [
  { id: '1', title: 'Tony Fadd - Paranoid', artist: 'Tony Fadd', artworkUrl: songArtOne, mediaUrl: song1, type: 'song' },
  { id: '2', title: 'SD Boomin - Waited All Night', artist: 'SD Boomin', artworkUrl: songArtTwo, mediaUrl: song2, type: 'song' },
  { id: '3', title: 'Bad Video', artist: 'some guy', artworkUrl: songArtThree, mediaUrl: video1, type: 'video' },
  { id: '4', title: 'Song 4', artist: 'Artist 4', artworkUrl: songArtNine, mediaUrl: song1, type: 'song' }
];

const getDummyNew = () => [
  { id: '5', title: 'The Outside', artist: 'Artist Five', artworkUrl: songArtFive, mediaUrl: song2, type: 'song' },
  { id: '6', title: 'Original Man', artist: 'Artist Six', artworkUrl: songArtSix, mediaUrl: song1, type: 'song' },
  { id: '10', title: 'flavorfall', artist: 'Artist Ten', artworkUrl: songArtTen, mediaUrl: song2, type: 'song' },
  { id: '11', title: 'Golden Son', artist: 'Artist Eleven', artworkUrl: songArtEleven, mediaUrl: song1, type: 'song' }
];

const getDummyAwards = () => ['Award 1', 'Award 2', 'Award 3', 'Award 4', 'Award 5'];

const getDummyArtists = () => ['Artist 1', 'Artist 2', 'Artist 3', 'Artist 4', 'Artist 5'];

const getDummyPosts = () => ['Follower Post 1', 'Follower Post 2', 'Follower Post 3'];

export default axiosInstance;