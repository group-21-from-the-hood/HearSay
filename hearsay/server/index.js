import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { ObjectId, Int32 } from 'mongodb';
import * as db from './dbAPI.js';
import * as spotify from './spotifyAPI.js';

// Load .env in development so server can read GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5174;

// Frontend origin for CORS (cookies), session cookie name/secret and timings
const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SESSION_NAME = process.env.SESSION_NAME || 'hsid';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret';
const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10); // 1 hour
const SESSION_ROTATE_MS = parseInt(process.env.SESSION_ROTATE_MS || String(60 * 60 * 1000), 10);
const MONGO_DB = process.env.MONGO_DB_NAME || process.env.VITE_MONGO_DB_NAME || 'HearSay';
const SESSIONS_COLLECTION = process.env.SESSIONS_COLLECTION || 'expressSessions';

// Allow cookies from the frontend app
app.use(cors({ origin: ORIGIN, credentials: true }));
app.use(express.json());
// Trust proxy when behind one (uncomment if deploying behind reverse proxy)
// app.set('trust proxy', 1);

// Ensure DB is connected before wiring sessions so the store uses auth'd client
await db.connectMongo().catch((err) => {
  console.error('[DB] Initial connection failed for sessions:', err);
  process.exit(1);
});

// Try to ensure user uniqueness constraints; if this fails due to existing duplicates,
// we'll log a helpful message but won't crash the server.
try {
  await db.ensureUserIndexes();
  await db.ensureReviewIndexes();
} catch (e) {
  console.warn('[DB] Could not ensure user indexes (likely due to duplicates).', e?.message || e);
  console.warn('[DB] To fix duplicates, run: npm run db:dedupe-users');
}

// Sessions backed by MongoDB
app.use(
  session({
    name: SESSION_NAME,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true, // refresh cookie expiration on every response
    cookie: {
      httpOnly: true,
      sameSite: 'lax', // set 'none' + secure true if cross-site over HTTPS
      secure: false, // set to true when serving over HTTPS in prod
      maxAge: SESSION_TTL_SECONDS * 1000,
    },
    store: MongoStore.create({
      // Reuse our authenticated client (uses creds/URI from dbAPI)
      client: db.getClient(),
      dbName: MONGO_DB,
      // Use a dedicated collection to avoid clashing with your app's "sessions" schema
      collectionName: SESSIONS_COLLECTION,
      ttl: SESSION_TTL_SECONDS,
      stringify: false,
      autoRemove: 'native',
    }),
  })
);

// Rotate session id every SESSION_ROTATE_MS to mitigate fixation
app.use((req, res, next) => {
  if (!req.session) return next();
  const now = Date.now();
  const last = req.session.__lastRotated || 0;
  if (now - last > SESSION_ROTATE_MS) {
    const preserve = { ...req.session };
    req.session.regenerate((err) => {
      if (err) return next(err);
      Object.assign(req.session, preserve);
      req.session.__lastRotated = now;
      next();
    });
  } else {
    if (!req.session.__lastRotated) req.session.__lastRotated = now;
    next();
  }
});

// Simple request logging to help diagnose requests from the frontend (method, url, small body preview)
app.use((req, res, next) => {
  try {
    const previewBody = req.body && Object.keys(req.body).length ? JSON.stringify(req.body).slice(0, 100) : '';
    console.log('[SERVER] Incoming', req.method, req.originalUrl, previewBody ? `body=${previewBody}` : '');
  } catch (e) {
    console.log('[SERVER] Incoming', req.method, req.originalUrl);
  }
  next();
});

// Health check
app.get('/', (req, res) => res.json({ ok: true }));

// Session info endpoint: ensures a session exists and returns basic details
app.get('/api/session', (req, res) => {
  req.session.visits = (req.session.visits || 0) + 1;
  if (!req.session.createdAt) req.session.createdAt = new Date().toISOString();
  return res.json({
    ok: true,
    id: req.sessionID,
    createdAt: req.session.createdAt,
    visits: req.session.visits,
  });
});

app.post('/api/auth/google/exchange', async (req, res) => {
  try {
    const { code, redirect_uri, code_verifier } = req.body;
    if (!code || !redirect_uri || !code_verifier) {
      return res.status(400).json({ error: 'missing_parameters' });
    }

    const client_id = process.env.VITE_GOOGLE_CLIENT_ID;
    const client_secret = process.env.VITE_GOOGLE_CLIENT_SECRET;
    if (!client_id || !client_secret) {
      return res.status(500).json({ error: 'server_misconfigured', message: 'Missing VITE_GOOGLE_CLIENT_ID or VITE_GOOGLE_CLIENT_SECRET on server.' });
    }

    const body = new URLSearchParams({
      client_id,
      client_secret,
      grant_type: 'authorization_code',
      code,
      redirect_uri,
      code_verifier,
    });

    // Perform token exchange with Google and log the raw response for debugging
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const dataText = await tokenRes.text();
    let data;
    try {
      data = JSON.parse(dataText);
    } catch (e) {
      data = dataText;
    }
    console.log('[SERVER] Google token response', tokenRes.status, typeof data === 'string' ? data.slice(0, 1000) : data);

    if (!tokenRes.ok) {
      // Forward Google's exact response status and body to the client for easier debugging
      return res.status(tokenRes.status).json(data);
    }

    // Fetch basic profile using access_token to bind to session
    let profile = null;
    try {
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });
      if (userRes.ok) profile = await userRes.json();
    } catch (e) {
      console.warn('[SERVER] Failed to fetch Google userinfo', e);
    }

    // Upsert application user following your Users schema
    let firstname = profile?.given_name || '';
    let lastname = profile?.family_name || '';
    if ((!firstname || !lastname) && profile?.name) {
      const parts = String(profile.name).trim().split(' ');
      if (!firstname && parts.length) firstname = parts[0];
      if (!lastname && parts.length > 1) lastname = parts.slice(1).join(' ');
    }

    const usersCol = db.Users.collection();
    const filter = {
      $or: [
        { email: profile?.email || null },
        { 'accounts.kind': 'Google', 'accounts.uid': profile?.sub || null },
      ],
    };

    const googleAccount = { kind: 'Google', uid: profile?.sub || '' };

    // Atomic upsert to avoid duplicate inserts under concurrent requests.
    let userDoc = null;
    try {
      const res = await usersCol.findOneAndUpdate(
        filter,
        {
          $set: {
            email: profile?.email || '',
            firstname: firstname || '',
            lastname: lastname || '',
          },
          // Add Google account if not already present. Safe for existing docs.
          $addToSet: { accounts: googleAccount },
          // Only set defaults on first insert; don't duplicate any fields set above
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true, returnDocument: 'after' }
      );
      userDoc = res.value;
      if (!userDoc) {
        // In rare cases, attempt a direct read using the same filter
        userDoc = await usersCol.findOne(filter);
      }
    } catch (e) {
      // If uniqueness constraints triggered during a race, read the existing doc
      if (e && (e.code === 11000 || /duplicate key/i.test(String(e)))) {
        userDoc = await usersCol.findOne(filter);
      } else {
        throw e;
      }
    }

    // Attach to session (minimal fields + DB id)
    req.session.user = {
      oid: userDoc?._id?.toString?.(),
      provider: 'google',
      sub: profile?.sub,
      email: userDoc?.email || profile?.email,
      name: profile?.name,
      picture: profile?.picture,
      firstname: userDoc?.firstname || firstname,
      lastname: userDoc?.lastname || lastname,
    };
    req.session.oauth = {
      provider: 'google',
      access_token: data.access_token,
      expires_in: data.expires_in,
      token_type: data.token_type,
      scope: data.scope,
      refresh_token: data.refresh_token,
      received_at: Date.now(),
    };

    // Persist session then respond with a trimmed payload
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));

    return res.json({ ok: true, user: req.session.user });
  } catch (err) {
    console.error('Exchange error', err);
    return res.status(500).json({ error: 'exchange_failed', message: String(err) });
  }
});

// Returns the current authenticated user from the session
app.get('/api/me', (req, res) => {
  if (req.session?.user) return res.json({ authenticated: true, user: req.session.user });
  return res.json({ authenticated: false });
});

// Destroy session (logout)
app.post('/api/logout', (req, res) => {
  if (!req.session) return res.json({ ok: true });
  req.session.destroy(err => {
    if (err) return res.status(500).json({ ok: false, error: String(err) });
    res.clearCookie(SESSION_NAME);
    return res.json({ ok: true });
  });
});

// Current user's full profile from DB
app.get('/api/profile', async (req, res) => {
  try {
    const oid = req.session?.user?.oid;
    if (!oid) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const users = db.Users.collection();
    const doc = await users.findOne(
      { _id: new ObjectId(oid) },
      { projection: { email: 1, firstname: 1, lastname: 1, accounts: 1 } }
    );
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });

    // Build a safe profile without sensitive IDs (like Google UID)
    const safeAccounts = Array.isArray(doc.accounts)
      ? doc.accounts.map(a => ({ kind: a?.kind })).filter(a => a.kind)
      : [];
    const safe = {
      _id: doc._id,
      email: doc.email || '',
      firstname: doc.firstname || '',
      lastname: doc.lastname || '',
      name: req.session?.user?.name || undefined,
      picture: req.session?.user?.picture || undefined,
      accounts: safeAccounts,
    };
    return res.json({ ok: true, profile: safe });
  } catch (e) {
    console.error('[SERVER] /api/profile error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.listen(PORT, () => {
  console.log(`Google auth proxy listening on http://localhost:${PORT}`);
});

// DB connectivity test: attempts to connect and ping the database
app.get('/api/test', async (req, res) => {
  try {
    await db.connectMongo();
    const ping = await db.getDb().command({ ping: 1 });
    console.log('[DB] Connection OK. Ping result:', ping);
    return res.json({ ok: true, ping });
  } catch (err) {
    console.error('[DB] Connection FAILED:', err);
    return res.status(500).json({ ok: false, error: String(err) });
  }
});

// ---------------- Spotify Proxy Endpoints ----------------
// All token handling stays server-side; client calls these endpoints.
app.get('/api/spotify/search', async (req, res) => {
  try {
    const { q, type = 'track', limit, market } = req.query;
    if (!q) return res.status(400).json({ ok: false, error: 'missing_query' });
    const lim = limit ? parseInt(limit, 10) : 10;
    const result = await spotify.search(q, type, lim, market);
    if (result.error && !result.data) return res.status(result.status || 500).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.data });
  } catch (e) {
    console.error('[Spotify] search error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/spotify/track/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await spotify.getTrack(id);
    if (result.error && !result.data) return res.status(result.status || 500).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.data });
  } catch (e) {
    console.error('[Spotify] track error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/spotify/album/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await spotify.getAlbum(id);
    if (result.error && !result.data) return res.status(result.status || 500).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.data });
  } catch (e) {
    console.error('[Spotify] album error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Batch several tracks (up to 50 per Spotify request); chunks if more supplied
app.get('/api/spotify/tracks', async (req, res) => {
  try {
    const idsParam = req.query.ids;
    if (!idsParam) return res.status(400).json({ ok: false, error: 'missing_ids' });
    const market = req.query.market;
    const allIds = String(idsParam).split(',').map(s => s.trim()).filter(Boolean);
    if (!allIds.length) return res.status(400).json({ ok: false, error: 'no_ids' });
    const responses = [];
    for (let i = 0; i < allIds.length; i += 50) {
      const chunk = allIds.slice(i, i + 50);
      const r = await spotify.getSeveralTracks(chunk, market);
      if (r.error && !r.data) return res.status(r.status || 500).json({ ok: false, error: r.error });
      const tracks = Array.isArray(r.data?.tracks) ? r.data.tracks : [];
      responses.push(...tracks);
    }
    return res.json({ ok: true, data: { tracks: responses } });
  } catch (e) {
    console.error('[Spotify] several tracks error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Batch several albums (up to 20 per Spotify request); accepts any number by chunking
app.get('/api/spotify/albums', async (req, res) => {
  try {
    const idsParam = req.query.ids;
    if (!idsParam) return res.status(400).json({ ok: false, error: 'missing_ids' });
    const market = req.query.market;
    const allIds = String(idsParam)
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (!allIds.length) return res.status(400).json({ ok: false, error: 'no_ids' });

    // Chunk to 20 per Spotify API limitations
    const chunks = [];
    for (let i = 0; i < allIds.length; i += 20) chunks.push(allIds.slice(i, i + 20));

    const responses = [];
    for (const chunk of chunks) {
      const r = await spotify.getSeveralAlbums(chunk, market);
      if (r.error && !r.data) return res.status(r.status || 500).json({ ok: false, error: r.error });
      const albums = Array.isArray(r.data?.albums) ? r.data.albums : [];
      responses.push(...albums);
    }
    return res.json({ ok: true, data: { albums: responses } });
  } catch (e) {
    console.error('[Spotify] several albums error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/spotify/artist/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await spotify.getArtist(id);
    if (result.error && !result.data) return res.status(result.status || 500).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.data });
  } catch (e) {
    console.error('[Spotify] artist error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/spotify/artist/:id/albums', async (req, res) => {
  try {
    const { id } = req.params;
    const { include_groups = 'album,single', limit = 50, market } = req.query;
    const result = await spotify.getArtistAlbums(id, { include_groups, limit: parseInt(limit, 10) || 50, market });
    if (result.error && !result.data) return res.status(result.status || 500).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.data });
  } catch (e) {
    console.error('[Spotify] artist albums error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/spotify/new-releases', async (req, res) => {
  try {
    const { country = 'US', limit = 50 } = req.query;
    const result = await spotify.getNewReleases({ country, limit: parseInt(limit, 10) || 50 });
    if (result.error && !result.data) return res.status(result.status || 500).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.data });
  } catch (e) {
    console.error('[Spotify] new releases error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

app.get('/api/spotify/recommendations', async (req, res) => {
  try {
    const params = { ...req.query };
    // Provide default seeds if none supplied to avoid API error
    if (!params.seed_genres && !params.seed_artists && !params.seed_tracks) {
      params.seed_genres = 'pop,rock';
    }
    const result = await spotify.getRecommendations(params);
    if (result.error && !result.data) return res.status(result.status || 500).json({ ok: false, error: result.error });
    return res.json({ ok: true, data: result.data });
  } catch (e) {
    console.error('[Spotify] recommendations error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// ---------------- Reviews Endpoints ----------------
// Upsert a review for the current user and item (song/album/artist)
app.post('/api/reviews/upsert', async (req, res) => {
  try {
    const userOid = req.session?.user?.oid;
    if (!userOid) return res.status(401).json({ ok: false, error: 'unauthorized' });

    const { type, oid, rating, text } = req.body || {};
    const allowed = new Set(['song', 'album', 'artist']);
    if (!allowed.has(String(type))) return res.status(400).json({ ok: false, error: 'invalid_type' });
    if (!oid || typeof oid !== 'string') return res.status(400).json({ ok: false, error: 'invalid_oid' });

    // Normalize inputs (support 0.5 increments). incoming rating expected 0.5..5
    let normRating = Number.isFinite(rating) ? Number(rating) : undefined;
    if (!(normRating >= 0.5 && normRating <= 5)) normRating = undefined; // treat out-of-range as undefined
    // Snap to nearest 0.5 step
    if (normRating !== undefined) normRating = Math.round(normRating * 2) / 2;
    let normText = typeof text === 'string' ? String(text).trim() : undefined;

    // Enforce max 1000 words for text if provided
    if (normText) {
      const words = normText.trim().split(/\s+/).filter(Boolean);
      if (words.length > 1000) return res.status(400).json({ ok: false, error: 'text_too_long', maxWords: 1000 });
    }
    if (normRating === undefined && (!normText || normText.length === 0)) {
      return res.status(400).json({ ok: false, error: 'empty_review' });
    }

    const reviews = db.Reviews.collection();
    const filter = { 'user.oid': userOid, 'item.type': type, 'item.oid': oid };
    const nowIso = new Date().toISOString();
    // Build update ensuring we don't overwrite text unless provided.
    const setFields = { updatedAt: nowIso };
    if (normRating !== undefined) setFields.rating = new Int32(Math.round(normRating * 2)); // store scaled (x2)
    if (normText !== undefined) setFields.text = normText;
    const setOnInsertFields = {
      createdAt: nowIso,
      user: { oid: userOid },
      item: { type, oid },
      likes: new Int32(0),
      dislikes: new Int32(0),
      comments: [],
      type: String(type),
    };
    // If inserting without provided text, satisfy schema with empty string
    if (normText === undefined) setOnInsertFields.text = '';
    // If inserting without a provided rating, ensure a default rating field exists
    if (normRating === undefined) setOnInsertFields.rating = new Int32(0); // 0 represents no rating yet
    const update = { $set: setFields, $setOnInsert: setOnInsertFields };

    const result = await reviews.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after' });
    const doc = result.value || (await reviews.findOne(filter));
    // Ensure user's profile records this review's ObjectId
    try {
      const usersCol = db.Users.collection();
      await usersCol.updateOne(
        { _id: new ObjectId(userOid) },
        { $addToSet: { reviewIds: doc?._id } }
      );
    } catch (e) {
      console.warn('[Reviews] Failed to add reviewId to user profile', e?.message || e);
    }
    // Scale rating back down for response
    if (doc && typeof doc.rating === 'number') doc.rating = doc.rating / 2;
    return res.json({ ok: true, review: doc });
  } catch (e) {
    if (e && (e.code === 11000 || /duplicate key/i.test(String(e)))) {
      // Unique index collision under race: retry a simple update
      try {
        const { type, oid, rating, text } = req.body || {};
        const userOid = req.session?.user?.oid;
        const reviews = db.Reviews.collection();
        const filter = { 'user.oid': userOid, 'item.type': type, 'item.oid': oid };
        const nowIso = new Date().toISOString();
        const set = { updatedAt: nowIso };
        if (typeof text === 'string') set.text = String(text).trim();
        if (Number.isFinite(rating) && rating >= 0.5 && rating <= 5) {
          const snapped = Math.round(rating * 2) / 2;
          set.rating = new Int32(Math.round(snapped * 2));
        }
        await reviews.updateOne(filter, { $set: set });
        const doc = await reviews.findOne(filter);
        try {
          const usersCol = db.Users.collection();
          await usersCol.updateOne(
            { _id: new ObjectId(userOid) },
            { $addToSet: { reviewIds: doc?._id } }
          );
        } catch (e3) {
          console.warn('[Reviews] Retry path: failed to add reviewId to user profile', e3?.message || e3);
        }
        if (doc && typeof doc.rating === 'number') doc.rating = doc.rating / 2;
        return res.json({ ok: true, review: doc });
      } catch (e2) {
        console.error('[Reviews] upsert retry failed', e2);
      }
    }
    console.error('[Reviews] upsert error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Delete current user's review for an item and remove from user profile list
app.delete('/api/reviews/my', async (req, res) => {
  try {
    const userOid = req.session?.user?.oid;
    if (!userOid) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const type = req.query?.type || req.body?.type;
    const oid = req.query?.oid || req.body?.oid;
    const allowed = new Set(['song', 'album', 'artist']);
    if (!allowed.has(String(type))) return res.status(400).json({ ok: false, error: 'invalid_type' });
    if (!oid || typeof oid !== 'string') return res.status(400).json({ ok: false, error: 'invalid_oid' });

    const reviews = db.Reviews.collection();
    const filter = { 'user.oid': userOid, 'item.type': type, 'item.oid': oid };
    const deleted = await reviews.findOneAndDelete(filter);
    const deletedDoc = deleted?.value || null;
    if (!deletedDoc) return res.json({ ok: true, deleted: false });

    try {
      const usersCol = db.Users.collection();
      await usersCol.updateOne(
        { _id: new ObjectId(userOid) },
        { $pull: { reviewIds: deletedDoc._id } }
      );
    } catch (e) {
      console.warn('[Reviews] Failed to pull reviewId from user profile on delete', e?.message || e);
    }
    return res.json({ ok: true, deleted: true });
  } catch (e) {
    console.error('[Reviews] delete my review error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Get current user's review for an item
app.get('/api/reviews/my', async (req, res) => {
  try {
    const userOid = req.session?.user?.oid;
    if (!userOid) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const { type, oid } = req.query;
    const allowed = new Set(['song', 'album', 'artist']);
    if (!allowed.has(String(type))) return res.status(400).json({ ok: false, error: 'invalid_type' });
    if (!oid || typeof oid !== 'string') return res.status(400).json({ ok: false, error: 'invalid_oid' });
    const reviews = db.Reviews.collection();
    const doc = await reviews.findOne({ 'user.oid': userOid, 'item.type': type, 'item.oid': oid });
    if (doc && typeof doc.rating === 'number') doc.rating = doc.rating / 2;
    return res.json({ ok: true, review: doc || null });
  } catch (e) {
    console.error('[Reviews] get my error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// List current user's reviews (paginated) with media metadata
app.get('/api/reviews/my/list', async (req, res) => {
  try {
    const userOid = req.session?.user?.oid;
    if (!userOid) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 5, 20));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const reviewsCol = db.Reviews.collection();
    const cursor = reviewsCol
      .find({ 'user.oid': userOid })
      .project({ item: 1, text: 1, rating: 1, createdAt: 1, updatedAt: 1 })
      .sort({ updatedAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit);

    const docs = await cursor.toArray();
    if (!docs.length) return res.json({ ok: true, total: 0, items: [], nextOffset: null });

    const songIds = [];
    const albumIds = [];
    const artistIds = [];
    for (const d of docs) {
      const t = d?.item?.type;
      const id = d?.item?.oid;
      if (!id || !t) continue;
      if (t === 'song') songIds.push(id);
      else if (t === 'album') albumIds.push(id);
      else if (t === 'artist') artistIds.push(id);
    }

    const songMap = new Map();
    const albumMap = new Map();
    const artistMap = new Map();

    if (songIds.length) {
      const r = await spotify.getSeveralTracks(songIds.slice(0, 50));
      if (r?.data?.tracks) {
        for (const t of r.data.tracks) {
          if (!t) continue;
          songMap.set(t.id, {
            title: t.name,
            coverArt: t.album?.images?.[0]?.url,
            route: `/song/${t.id}`,
          });
        }
      }
    }
    if (albumIds.length) {
      const r = await spotify.getSeveralAlbums(albumIds.slice(0, 20));
      if (r?.data?.albums) {
        for (const a of r.data.albums) {
          if (!a) continue;
          albumMap.set(a.id, {
            title: a.name,
            coverArt: a.images?.[0]?.url,
            route: `/album/${a.id}`,
          });
        }
      }
    }
    if (artistIds.length) {
      // No several-artists helper; fetch individually (limit small page size)
      for (const id of artistIds.slice(0, 20)) {
        try {
          const r = await spotify.getArtist(id);
          const a = r?.data;
          if (a) {
            artistMap.set(id, {
              title: a.name,
              coverArt: a.images?.[0]?.url,
              route: `/artist/${id}`,
            });
          }
        } catch {}
      }
    }

    const items = docs.map(d => {
      const type = d?.item?.type;
      const id = d?.item?.oid;
      let media = null;
      if (type === 'song') media = songMap.get(id) || null;
      else if (type === 'album') media = albumMap.get(id) || null;
      else if (type === 'artist') media = artistMap.get(id) || null;
      const rating = typeof d.rating === 'number' ? d.rating / 2 : 0;
      return {
        id: d._id?.toString?.(),
        type,
        oid: id,
        rating,
        text: d.text || '',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        media,
      };
    });

    // Determine if more exist by counting next slice cheaply
    const nextOffset = items.length < limit ? null : offset + items.length;
    return res.json({ ok: true, items, nextOffset });
  } catch (e) {
    console.error('[Reviews] list my reviews error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Top rated songs for an artist (avg rating desc, then review count desc)
app.get('/api/reviews/top-songs-for-artist', async (req, res) => {
  try {
    const { artistId } = req.query;
    const limit = parseInt(req.query.limit, 10) || 5;
    if (!artistId || typeof artistId !== 'string') return res.status(400).json({ ok: false, error: 'invalid_artist' });
    const reviewsCol = db.Reviews.collection();
    // Aggregate ratings for songs; limit candidates to reduce track fetch volume
    const pipeline = [
      { $match: { 'item.type': 'song', rating: { $type: 'int', $gt: 0 } } },
      { $group: { _id: '$item.oid', avgRatingScaled: { $avg: '$rating' }, count: { $sum: 1 } } },
      { $sort: { avgRatingScaled: -1, count: -1 } },
      { $limit: 300 },
    ];
    const aggResults = await reviewsCol.aggregate(pipeline).toArray();
    if (!aggResults.length) return res.json({ ok: true, songs: [] });

    // Fetch track details in batches and filter by artist
    const trackIds = aggResults.map(r => r._id);
    const matched = [];
    for (let i = 0; i < trackIds.length && matched.length < limit; i += 50) {
      const chunk = trackIds.slice(i, i + 50);
      const resp = await spotify.getSeveralTracks(chunk);
      if (resp.error && !resp.data) continue; // skip failures silently
      const tracks = Array.isArray(resp.data?.tracks) ? resp.data.tracks : [];
      for (const t of tracks) {
        if (!t) continue;
        const artistMatches = Array.isArray(t.artists) && t.artists.some(a => a?.id === artistId);
        if (!artistMatches) continue;
        const agg = aggResults.find(r => r._id === t.id);
        if (!agg) continue;
        matched.push({
          id: t.id,
          title: t.name,
          artists: (t.artists || []).map(a => a.name).filter(Boolean),
          coverArt: t.album?.images?.[0]?.url,
          avgRating: Number((agg.avgRatingScaled / 2).toFixed(2)),
          reviewCount: agg.count,
          spotifyUrl: t.external_urls?.spotify,
        });
        if (matched.length >= limit) break;
      }
    }
    return res.json({ ok: true, songs: matched });
  } catch (e) {
    console.error('[Reviews] top songs for artist error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});