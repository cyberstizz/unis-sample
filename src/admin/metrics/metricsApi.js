// Calls to /api/v1/admin/metrics. Every response has already been through the
// server's privacy rules (groups under 10 hidden, under-18s only as a headcount).
import { apiCall } from '../../components/axiosInstance';

const get = (url) => apiCall({ url, method: 'get', useCache: false }).then((r) => r.data);

export const fetchStatus = () => get('/v1/admin/metrics/status');
export const fetchDefinitions = () => get('/v1/admin/metrics/definitions');
export const fetchMonth = (month) => get(`/v1/admin/metrics/month?month=${encodeURIComponent(month)}`);
export const fetchRange = (from, to) =>
  get(`/v1/admin/metrics/range?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
export const fetchDaily = (from, to, keys, segmentType = 'all') =>
  get(`/v1/admin/metrics/daily?from=${from}&to=${to}&keys=${keys.join(',')}&segmentType=${segmentType}`);
export const fetchCohorts = (segmentType = 'all', segmentValue = 'all') =>
  get(`/v1/admin/metrics/cohorts?segmentType=${segmentType}&segmentValue=${encodeURIComponent(segmentValue)}`);

export const rebuildDays = (from, to) =>
  apiCall({ url: '/v1/admin/metrics/rebuild', method: 'post', data: { from, to } }).then((r) => r.data);
export const lockMonth = (month, reason) =>
  apiCall({ url: '/v1/admin/metrics/close', method: 'post', data: { month, reason: reason || null } }).then((r) => r.data);
