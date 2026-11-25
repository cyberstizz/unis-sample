// src/utils/shareLink.js
//
// Share links: always the clean page address (never the address bar, which
// can carry someone else's ?ref=), plus the sharer's own referral code when
// they're signed in, so anyone who joins from the link is credited to them.
// Link previews (cover card) come from netlify/edge-functions/link-preview.js.

import { apiCall } from '../components/axiosInstance';

let codeCache = { userId: null, code: null, at: 0 };

const userIdFromToken = () => {
  try {
    const token = localStorage.getItem('token');
    if (!token) return null;
    return JSON.parse(atob(token.split('.')[1])).userId ?? null;
  } catch {
    return null;
  }
};

async function myCode() {
  const userId = userIdFromToken();
  if (!userId) return null;
  if (codeCache.userId === userId && codeCache.code && Date.now() - codeCache.at < 3600000) return codeCache.code;
  try {
    const res = await apiCall({ method: 'get', url: `/v1/users/profile-summary/${userId}` });
    const code = res.data?.referralCode || null;
    codeCache = { userId, code, at: Date.now() };
    return code;
  } catch {
    return null;
  }
}

/** `${origin}/${kind}/${id}` with ?ref=YOURCODE when signed in. */
export async function shareUrl(kind, id) {
  const base = `${window.location.origin}/${kind}/${id}`;
  const code = await myCode();
  return code ? `${base}?ref=${encodeURIComponent(code)}` : base;
}

// Fetch the code ahead of time, so sharing doesn't wait on the network (some
// phones only allow the share sheet right after a tap).
if (typeof window !== 'undefined') setTimeout(() => { myCode(); }, 4000);
