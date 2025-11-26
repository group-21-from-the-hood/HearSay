// Server-side Spotify API helper: caches app access token and performs requests
import 'dotenv/config';

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.warn('[Spotify] Missing SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET env vars. Endpoints will error.');
}

let tokenCache = {
  access_token: null,
  expires_at: 0, // epoch ms
};

async function getAppAccessToken() {
  const now = Date.now();
  if (tokenCache.access_token && now < tokenCache.expires_at - 5000) {
    return tokenCache.access_token;
  }
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error('Spotify credentials not configured');
  const basic = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basic}`,
    },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Spotify token error ${res.status}: ${txt}`);
  }
  const data = await res.json();
  tokenCache.access_token = data.access_token;
  tokenCache.expires_at = now + (data.expires_in * 1000);
  return tokenCache.access_token;
}

function buildUrl(path, params = {}) {
  const u = new URL(`https://api.spotify.com/v1${path}`);
  Object.entries(params).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== '') u.searchParams.set(k, v);
  });
  return u.toString();
}

export async function spotifyGet(path, params = {}) {
  const token = await getAppAccessToken();
  const url = buildUrl(path, params);
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.status === 429) {
    const retry = res.headers.get('Retry-After');
    return { status: 429, error: 'rate_limited', retryAfter: retry };
  }
  const bodyText = await res.text();
  let json; try { json = JSON.parse(bodyText); } catch { json = bodyText; }
  if (!res.ok) {
    return { status: res.status, error: json };
  }
  return { status: res.status, data: json };
}

export async function search(q, type = 'track', limit = 10, market, offset) {
  const params = { q, type, limit };
  if (market) params.market = market;
  if (offset !== undefined) params.offset = offset;
  return spotifyGet('/search', params);
}

export async function getArtistAlbums(id, { include_groups = 'album,single', limit = 50, market } = {}) {
  const params = { include_groups, limit };
  if (market) params.market = market;
  return spotifyGet(`/artists/${id}/albums`, params);
}

export async function getNewReleases({ country = 'US', limit = 50 } = {}) {
  return spotifyGet('/browse/new-releases', { country, limit });
}

export async function getRecommendations(params = {}) {
  // params may include seed_artists, seed_genres, seed_tracks, limit, market
  return spotifyGet('/recommendations', params);
}

export async function getTrack(id) { return spotifyGet(`/tracks/${id}`); }
export async function getAlbum(id) { return spotifyGet(`/albums/${id}`); }
export async function getSeveralTracks(ids = [], market) {
  const arr = Array.isArray(ids) ? ids.filter(Boolean) : String(ids || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!arr.length) return { status: 400, error: 'no_ids' };
  const params = { ids: arr.join(',') };
  if (market) params.market = market;
  return spotifyGet('/tracks', params);
}
export async function getSeveralAlbums(ids = [], market) {
  const arr = Array.isArray(ids) ? ids.filter(Boolean) : String(ids || '').split(',').map(s => s.trim()).filter(Boolean);
  if (!arr.length) return { status: 400, error: 'no_ids' };
  const params = { ids: arr.join(',') };
  if (market) params.market = market;
  return spotifyGet('/albums', params);
}
export async function getArtist(id) { return spotifyGet(`/artists/${id}`); }

export function _debugTokenCache() { return { ...tokenCache }; }

export default { search, getTrack, getSeveralTracks, getAlbum, getSeveralAlbums, getArtist, getArtistAlbums, getNewReleases, getRecommendations };