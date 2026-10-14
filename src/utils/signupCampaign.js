// Remembers the campaign a visitor arrived through, so a signup can be
// credited to it in the admin metrics ("signup source").
//
// Campaign links look like  https://unismusic.com/?c=harlem-flyers
// (utm_campaign or utm_source work too). The code is kept for 30 days in
// this browser; a newer campaign link replaces it.
const KEY = 'unis_signup_campaign';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export function captureSignupCampaign() {
  try {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get('c') || params.get('utm_campaign') || params.get('utm_source');
    if (!raw) return;
    const code = raw.trim().replace(/[^A-Za-z0-9_.-]/g, '').slice(0, 80);
    if (!code) return;
    localStorage.setItem(KEY, JSON.stringify({ code, at: Date.now() }));
  } catch {
    // Storage blocked: the signup just won't carry a campaign.
  }
}

export function getSignupCampaign() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!saved?.code || Date.now() - saved.at > MAX_AGE_MS) return null;
    return saved.code;
  } catch {
    return null;
  }
}
