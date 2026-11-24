import { useEffect, useState } from 'react';
import { apiCall } from '../components/axiosInstance';
import { ALERTS_CHANGED } from '../utils/releaseAlerts';

// Unread chats for the Messages badge (the phone header shows it now that
// Messages left the menu for the header, Nov 2026). Chats only: a message
// request never adds to the badge. Same source and refresh triggers as the
// sidebar's badge.
//
// ★ Release alerts (Nov 2026): unseen "New releases" count toward the badge
//   too, since they live in Messages. Zero when In Unis alerts are off.
export default function useUnreadMessages(signedIn) {
  const [unread, setUnread] = useState(0);
  const [alerts, setAlerts] = useState(0);

  useEffect(() => {
    if (!signedIn) { setUnread(0); setAlerts(0); return undefined; }
    let alive = true;
    const load = async () => {
      try {
        const res = await apiCall({ url: '/v1/conversations/summary', useCache: false });
        if (alive) setUnread(Number(res.data?.unread) || 0);
      } catch (err) {
        console.error('[Header] message count failed (badge hidden):', err?.message || err);
      }
    };
    const loadAlerts = async () => {
      try {
        const res = await apiCall({ url: '/v1/release-alerts/summary', useCache: false });
        if (alive) setAlerts(Number(res.data?.unseen) || 0);
      } catch (err) {
        console.error('[Header] release alert count failed (not counted):', err?.message || err);
      }
    };
    const loadAll = () => {
      load();
      loadAlerts();
    };
    loadAll();
    window.addEventListener('unis:messages-updated', load);
    window.addEventListener(ALERTS_CHANGED, loadAlerts);
    window.addEventListener('focus', loadAll);
    return () => {
      alive = false;
      window.removeEventListener('unis:messages-updated', load);
      window.removeEventListener(ALERTS_CHANGED, loadAlerts);
      window.removeEventListener('focus', loadAll);
    };
  }, [signedIn]);

  return signedIn ? unread + alerts : 0;
}
