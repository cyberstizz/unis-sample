// src/context/TeamContext.jsx — artist teams on the web.
//
// For the signed-in person: the artist pages they help run (managing), the
// team invites waiting for them (invites), and which page they're working on
// right now (acting; see utils/teamActing.js).
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';
import { apiCall } from '../components/axiosInstance';
import cacheService from '../services/cacheService';
import { getActing, setActing, subscribeActing } from '../utils/teamActing';

const noop = async () => null;

const TeamContext = createContext({
  managing: [],
  invites: [],
  acting: null,
  loaded: false,
  refresh: noop,
  acceptInvite: noop,
  declineInvite: noop,
  startActing: () => {},
  stopActing: () => {},
});

export const TeamProvider = ({ children }) => {
  const { user, isGuest } = useAuth();
  const userId = !isGuest ? user?.userId : null;

  const [managing, setManaging] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [acting, setActingState] = useState(getActing());

  useEffect(() => subscribeActing(setActingState), []);

  // A different account (or signed out): forget the page we were working on.
  useEffect(() => {
    const a = getActing();
    if (a && a.memberId !== userId) setActing(null);
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!userId) {
      setManaging([]);
      setInvites([]);
      setLoaded(true);
      return null;
    }
    try {
      const res = await apiCall({ url: '/v1/artist-team/mine', method: 'get', useCache: false });
      const m = Array.isArray(res.data?.managing) ? res.data.managing : [];
      setManaging(m);
      setInvites(Array.isArray(res.data?.invites) ? res.data.invites : []);
      // Removed from the team we were acting for: stop acting.
      const a = getActing();
      if (a && !m.some((x) => x.artistId === a.artistId)) setActing(null);
      else if (a) {
        const fresh = m.find((x) => x.artistId === a.artistId);
        if (fresh && fresh.role !== a.role) setActing({ ...a, role: fresh.role });
      }
      return res.data;
    } catch (err) {
      console.error('Team list failed to load:', err);
      return null;
    } finally {
      setLoaded(true);
    }
  }, [userId]);

  useEffect(() => {
    refresh();
    if (!userId) return undefined;
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [refresh, userId]);

  const startActing = useCallback((m) => {
    if (!m || !userId) return;
    cacheService.clearAll?.();
    setActing({ artistId: m.artistId, username: m.username, photoUrl: m.photoUrl || null, role: m.role, memberId: userId });
  }, [userId]);

  const stopActing = useCallback(() => {
    if (!getActing()) return;
    cacheService.clearAll?.();
    setActing(null);
  }, []);

  const acceptInvite = useCallback(async (invite) => {
    const res = await apiCall({ url: `/v1/artist-team/invites/${invite.inviteId}/accept`, method: 'post' });
    await refresh();
    return res.data;
  }, [refresh]);

  const declineInvite = useCallback(async (invite) => {
    await apiCall({ url: `/v1/artist-team/invites/${invite.inviteId}/decline`, method: 'post' });
    setInvites((list) => list.filter((i) => i.inviteId !== invite.inviteId));
    return true;
  }, []);

  const value = useMemo(() => ({
    managing, invites, acting, loaded, refresh, acceptInvite, declineInvite, startActing, stopActing,
  }), [managing, invites, acting, loaded, refresh, acceptInvite, declineInvite, startActing, stopActing]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
};

export const useTeam = () => useContext(TeamContext);

export default TeamContext;
