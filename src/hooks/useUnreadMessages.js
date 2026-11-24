import { useEffect, useState } from 'react';
import { apiCall } from '../components/axiosInstance';

// Unread chats for the Messages badge (the phone header shows it now that
// Messages left the menu for the header, Nov 2026). Chats only: a message
// request never adds to the badge. Same source and refresh triggers as the
// sidebar's badge.
export default function useUnreadMessages(signedIn) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!signedIn) { setUnread(0); return undefined; }
    let alive = true;
    const load = async () => {
      try {
        const res = await apiCall({ url: '/v1/conversations/summary', useCache: false });
        if (alive) setUnread(Number(res.data?.unread) || 0);
      } catch (err) {
        console.error('[Header] message count failed (badge hidden):', err?.message || err);
      }
    };
    load();
    window.addEventListener('unis:messages-updated', load);
    window.addEventListener('focus', load);
    return () => {
      alive = false;
      window.removeEventListener('unis:messages-updated', load);
      window.removeEventListener('focus', load);
    };
  }, [signedIn]);

  return unread;
}
