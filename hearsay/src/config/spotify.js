// Client-side thin wrappers that call backend Spotify proxy endpoints.
// The server holds and refreshes the app access token; no secrets live here.

async function apiGet(path, params = {}) {
  const url = new URL(path, window.location.origin);
  Object.entries(params).forEach(([k,v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
  });
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const message = data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`;
    throw new Error(`Spotify request failed: ${message}`);
  }
  return data.data;
}

export async function searchSpotify(q, type = 'track', limit = 10, market) {
  return apiGet('/api/spotify/search', { q, type, limit, market });
}
export async function getSpotifyTrack(id) { return apiGet(`/api/spotify/track/${id}`); }
export async function getSpotifyAlbum(id) { return apiGet(`/api/spotify/album/${id}`); }
export async function getSpotifyArtist(id) { return apiGet(`/api/spotify/artist/${id}`); }
export async function getSpotifyArtistAlbums(id, params = {}) { return apiGet(`/api/spotify/artist/${id}/albums`, params); }
export async function getSpotifyNewReleases(params = {}) { return apiGet('/api/spotify/new-releases', params); }
export async function getSpotifyRecommendations(params = {}) { return apiGet('/api/spotify/recommendations', params); }

export default {
  searchSpotify,
  getSpotifyTrack,
  getSpotifyAlbum,
  getSpotifyArtist,
  getSpotifyArtistAlbums,
  getSpotifyNewReleases,
  getSpotifyRecommendations,
};