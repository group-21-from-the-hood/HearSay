// Client-side wrappers for Reviews API

async function apiJson(method, path, body) {
  const res = await fetch(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    const message = data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`;
    throw new Error(`Reviews request failed: ${message}`);
  }
  return data;
}

export async function upsertReview({ type, oid, rating, text }) {
  const payload = { type, oid };
  if (typeof rating !== 'undefined') payload.rating = rating;
  if (typeof text !== 'undefined') payload.text = text;
  const { review } = await apiJson('POST', '/api/reviews/upsert', payload);
  return review;
}

export async function getMyReview(type, oid) {
  const url = new URL('/api/reviews/my', window.location.origin);
  url.searchParams.set('type', type);
  url.searchParams.set('oid', oid);
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    if (res.status === 401) return null; // Not logged in
    const message = data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`;
    throw new Error(`Reviews request failed: ${message}`);
  }
  return data.review || null;
}

export async function deleteMyReview(type, oid) {
  const url = new URL('/api/reviews/my', window.location.origin);
  url.searchParams.set('type', type);
  url.searchParams.set('oid', oid);
  const res = await fetch(url.toString(), { method: 'DELETE', credentials: 'include' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    if (res.status === 401) throw new Error('unauthorized');
    const message = data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`;
    throw new Error(`Reviews request failed: ${message}`);
  }
  return Boolean(data.deleted);
}

export async function listMyReviews({ limit = 5, offset = 0 } = {}) {
  const url = new URL('/api/reviews/my/list', window.location.origin);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('offset', String(offset));
  const res = await fetch(url.toString(), { credentials: 'include' });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.ok) {
    if (res.status === 401) throw new Error('unauthorized');
    const message = data?.error ? JSON.stringify(data.error) : `HTTP ${res.status}`;
    throw new Error(`Reviews request failed: ${message}`);
  }
  return { items: data.items || [], nextOffset: data.nextOffset };
}

export default { upsertReview, getMyReview, deleteMyReview, listMyReviews };
