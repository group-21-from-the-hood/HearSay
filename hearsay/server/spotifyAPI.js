// Server-side Spotify API helper: caches app access token and performs requests
import 'dotenv/config';

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.error('[Spotify] Missing SPOTIFY_CLIENT_ID/SPOTIFY_CLIENT_SECRET');
}

// Simple in-memory token cache
let _cached = { token: null, expiresAt: 0 };
export function _debugTokenCache() {
  return { ..._cached };
}

async function fetchAppToken() {
  const now = Date.now();
  if (_cached.token && _cached.expiresAt > now + 5000) {
    return _cached.token;
  }
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error('spotify_credentials_missing');
  }
  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: SPOTIFY_CLIENT_ID,
    client_secret: SPOTIFY_CLIENT_SECRET,
  });
  const resp = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!resp.ok) {
    const txt = await resp.text();
    throw new Error('spotify_token_failed ' + resp.status + ' ' + txt.slice(0, 300));
  }
  const data = await resp.json();
  _cached.token = data.access_token;
  _cached.expiresAt = now + (data.expires_in * 1000);
  return _cached.token;
}

async function spotifyGet(url) {
  try {
    const token = await fetchAppToken();
    const resp = await fetch(url, {
      headers: { Authorization: 'Bearer ' + token },
    });
    const txt = await resp.text();
    let json;
    try { json = JSON.parse(txt); } catch { json = txt; }
    if (!resp.ok) {
      return { error: 'spotify_request_failed', status: resp.status, data: json };
    }
    return { data: json };
  } catch (e) {
    return { error: String(e.message || e), status: 500 };
  }
}

// Exported helpers (wrap existing logic)
export async function getTrack(id) {
  return spotifyGet(`https://api.spotify.com/v1/tracks/${id}`);
}
export async function getSeveralTracks(ids, market) {
  const list = Array.isArray(ids) ? ids.join(',') : '';
  const params = new URLSearchParams({ ids: list });
  if (market) params.set('market', market);
  return spotifyGet(`https://api.spotify.com/v1/tracks?${params.toString()}`);
}
export async function getAlbum(id) {
  return spotifyGet(`https://api.spotify.com/v1/albums/${id}`);
}
export async function getSeveralAlbums(ids, market) {
  const list = Array.isArray(ids) ? ids.join(',') : '';
  const params = new URLSearchParams({ ids: list });
  if (market) params.set('market', market);
  return spotifyGet(`https://api.spotify.com/v1/albums?${params.toString()}`);
}
export async function getArtist(id) {
  return spotifyGet(`https://api.spotify.com/v1/artists/${id}`);
}
export async function getArtistAlbums(id, { include_groups, limit, market } = {}) {
  const params = new URLSearchParams();
  if (include_groups) params.set('include_groups', include_groups);
  if (limit) params.set('limit', limit);
  if (market) params.set('market', market);
  return spotifyGet(`https://api.spotify.com/v1/artists/${id}/albums?${params.toString()}`);
}
export async function getNewReleases({ country = 'US', limit = 20 } = {}) {
  const params = new URLSearchParams({ country, limit });
  return spotifyGet(`https://api.spotify.com/v1/browse/new-releases?${params.toString()}`);
}
export async function getRecommendations(paramsObj = {}) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(paramsObj)) if (v) params.set(k, v);
  return spotifyGet(`https://api.spotify.com/v1/recommendations?${params.toString()}`);
}
export async function search(q, type = 'track', limit = 10, market) {
  if (!q || typeof q !== 'string') return { error: 'missing_query', status: 400 };
  const params = new URLSearchParams();
  params.set('q', q);
  params.set('type', type);
  params.set('limit', String(limit));
  if (market) params.set('market', market);
  return spotifyGet(`https://api.spotify.com/v1/search?${params.toString()}`);
}