// netlify/edge-functions/link-preview.js
//
// Link previews for shared Unis links (WhatsApp, iMessage, Instagram,
// X, Facebook, Slack, Discord, Telegram, LinkedIn…). Those apps don't run
// the site's JavaScript, so the preview tags must be in the HTML itself.
//
// For a link-preview bot asking for a song, artist, playlist, release or
// award page, this adds Open Graph and Twitter tags (title, description,
// a 1200x630 card image) to the page's <head>. Everyone else gets the page
// untouched.
//
// It reads the public API (VITE_API_BASE_URL, the same one the site uses).
// Images over 600 KB are left out, because WhatsApp won't show them.
// Private playlists only ever show "A playlist on Unis".
/* global Netlify */

const BOTS = /(facebookexternalhit|facebot|whatsapp|twitterbot|slackbot|discordbot|telegrambot|linkedinbot|skypeuripreview|applebot|iframely|embedly|pinterest|redditbot|vkshare|w3c_validator|googlebot|bingbot|snapchat|signal|discord|imessage|bytespider|tiktok)/i;
const MAX_IMAGE = 600 * 1024;

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function getJson(url) {
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

async function imageOk(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { method: 'HEAD' });
    if (!res.ok) return null;
    const len = Number(res.headers.get('content-length') || 0);
    return len && len > MAX_IMAGE ? null : url;
  } catch {
    return url;   // can't tell: let the app try
  }
}

async function describe(kind, id, api) {
  if (kind === 'song') {
    const s = await getJson(`${api}/api/v1/media/song/${id}`);
    if (!s) return null;
    const artist = s.artist?.username || 'an artist';
    const place = s.jurisdiction?.name ? ` from ${s.jurisdiction.name}` : '';
    return { title: `${s.title} · ${artist}`, desc: `Listen to ${s.title} by ${artist}${place} on Unis, and vote for it.`, image: s.artworkUrl, type: 'music.song' };
  }
  if (kind === 'artist') {
    const a = await getJson(`${api}/api/v1/users/artist/${id}`) || await getJson(`${api}/api/v1/users/profile/${id}`);
    if (!a) return null;
    const name = a.username || a.displayName || 'An artist';
    const place = a.jurisdiction?.name || a.jurisdictionName;
    return { title: `${name} on Unis`, desc: a.bio ? String(a.bio).slice(0, 180) : `Hear ${name}${place ? ` from ${place}` : ''} on Unis.`, image: a.photoUrl, type: 'profile' };
  }
  if (kind === 'playlist') {
    const p = await getJson(`${api}/api/v1/playlists/${id}`);
    if (!p || p.visibility === 'private') return { title: 'A playlist on Unis', desc: 'Music from your neighborhood, on Unis.', image: null, type: 'music.playlist' };
    return { title: `${p.name} · playlist`, desc: `${p.songCount || 0} songs${p.creatorName ? ` · by ${p.creatorName}` : ''} on Unis.`, image: p.coverImageUrl, type: 'music.playlist' };
  }
  if (kind === 'release') {
    const r = await getJson(`${api}/api/v1/releases/${id}`);
    if (!r) return null;
    const artist = r.artistName || r.artist?.username || '';
    return { title: `${r.title}${artist ? ` · ${artist}` : ''}`, desc: `${r.type || 'Release'} on Unis.`, image: r.coverUrl, type: 'music.album' };
  }
  if (kind === 'award') {
    const w = await getJson(`${api}/api/v1/awards/${id}`);
    if (!w) return null;
    return { title: w.title || 'A Unis award', desc: w.description || 'Voted by the neighborhood on Unis.', image: w.artworkUrl || w.imageUrl, type: 'website' };
  }
  return null;
}

export default async (request, context) => {
  const ua = request.headers.get('user-agent') || '';
  if (!BOTS.test(ua)) return context.next();

  const url = new URL(request.url);
  const m = url.pathname.match(/^\/(song|artist|playlist|release|award)\/([0-9a-fA-F-]{8,})/);
  if (!m) return context.next();

  const api = (Netlify.env.get('VITE_API_BASE_URL') || '').replace(/\/+$/, '');
  const page = await context.next();
  if (!api) return page;
  const info = await describe(m[1], m[2], api);
  if (!info) return page;
  const image = await imageOk(info.image && info.image.startsWith('http') ? info.image : (info.image ? `${api}${info.image}` : null));

  const canonical = `${url.origin}${url.pathname}`;
  const tags = [
    `<meta property="og:site_name" content="Unis" />`,
    `<meta property="og:type" content="${esc(info.type)}" />`,
    `<meta property="og:title" content="${esc(info.title)}" />`,
    `<meta property="og:description" content="${esc(info.desc)}" />`,
    `<meta property="og:url" content="${esc(canonical)}" />`,
    image ? `<meta property="og:image" content="${esc(image)}" />` : '',
    image ? `<meta property="og:image:width" content="1200" /><meta property="og:image:height" content="630" />` : '',
    `<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}" />`,
    `<meta name="twitter:title" content="${esc(info.title)}" />`,
    `<meta name="twitter:description" content="${esc(info.desc)}" />`,
    image ? `<meta name="twitter:image" content="${esc(image)}" />` : '',
  ].filter(Boolean).join('\n    ');

  const html = await page.text();
  const out = html
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(info.title)}</title>`)
    .replace('</head>', `    ${tags}\n  </head>`);
  const headers = new Headers(page.headers);
  headers.delete('content-length');
  headers.set('content-type', 'text/html; charset=utf-8');
  return new Response(out, { status: page.status, headers });
};

export const config = {
  path: ['/song/*', '/artist/*', '/playlist/*', '/release/*', '/award/*'],
};
