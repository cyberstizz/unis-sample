// How close a city is to opening: GET /v1/waitlist/region-progress (public).
// Returns { loading, progress } where progress is
// { signupCount, threshold, progressPercent, readyToActivate } or null.
// Used by the visitor banner, the visitor lock sheet and the waitlist form.
import { useEffect, useState } from 'react';
import { apiCall } from '../components/axiosInstance';

const useRegionProgress = (stateCode, city, { fresh = false } = {}) => {
  const [state, setState] = useState({ loading: false, progress: null });

  useEffect(() => {
    if (!stateCode || !city) {
      setState({ loading: false, progress: null });
      return undefined;
    }
    let cancelled = false;
    setState((prev) => ({ loading: true, progress: prev.progress }));
    apiCall({
      method: 'get',
      url: `/v1/waitlist/region-progress?state=${encodeURIComponent(stateCode)}&metro=${encodeURIComponent(city)}`,
      useCache: !fresh,
    })
      .then((res) => {
        const d = res?.data;
        if (cancelled) return;
        setState({ loading: false, progress: d && typeof d === 'object' && 'threshold' in d ? d : null });
      })
      .catch((err) => {
        if (cancelled) return;
        console.error('[RegionProgress] load failed:', err?.response?.status, err?.message);
        setState({ loading: false, progress: null });
      });
    return () => { cancelled = true; };
  }, [stateCode, city, fresh]);

  return state;
};

export default useRegionProgress;
