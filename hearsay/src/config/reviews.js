// Client-side wrappers for Reviews API (uses central API base for cross-origin dev)

const RAW_BASE = import.meta.env.VITE_API_BASE || '/api';
// Remove any trailing slash for consistent joining
const API_BASE = RAW_BASE.replace(/\/$/, '');

function buildUrl(pathAndQuery) {
  // If API_BASE is absolute (http://...) use that; else rely on current origin prefix
  if (/^https?:/i.test(API_BASE)) return `${API_BASE}${pathAndQuery}`;
  return `${API_BASE}${pathAndQuery}`; // relative base like '/api'
}

async function apiJson(method, pathAndQuery, body) {
  const endpoint = buildUrl(pathAndQuery);
  const res = await fetch(endpoint, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    // Preserve specific server error codes
    const message = data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`;
    throw new Error(`Reviews request failed: ${message}`);
  }
  return data;
}

export async function upsertReview({ type, oid, rating, text }) {
  const payload = { type, oid };
  if (typeof rating !== 'undefined') payload.rating = rating;
  if (typeof text !== 'undefined') payload.text = text;
  const { review } = await apiJson('POST', '/reviews/upsert', payload);
  return review;
}

export async function getMyReview(type, oid) {
  const path = `/reviews/my?type=${encodeURIComponent(type)}&oid=${encodeURIComponent(oid)}`;
  try {
    const data = await apiJson('GET', path);
    return data.review || null;
  } catch (e) {
    if (String(e.message).includes('unauthorized')) return null;
    throw e;
  }
}

export async function deleteMyReview(type, oid) {
  const path = `/reviews/my?type=${encodeURIComponent(type)}&oid=${encodeURIComponent(oid)}`;
  const data = await apiJson('DELETE', path);
  return Boolean(data.deleted);
}

export async function listMyReviews({ limit = 5, offset = 0 } = {}) {
  const path = `/reviews/my/list?limit=${encodeURIComponent(String(limit))}&offset=${encodeURIComponent(String(offset))}`;
  const data = await apiJson('GET', path);
  return { items: data.items || [], nextOffset: data.nextOffset };
}

export default { upsertReview, getMyReview, deleteMyReview, listMyReviews };
