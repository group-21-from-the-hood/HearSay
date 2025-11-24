import dotenv from 'dotenv';

const envFile =
  process.env.NODE_ENV === 'production'
    ? '.env.production'
    : '.env.development';

dotenv.config({ path: envFile });

console.log('[CONFIG] Loaded env file:', envFile);

import bcrypt from 'bcryptjs';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { ObjectId, Int32 } from 'mongodb';
import crypto from 'node:crypto';
import * as db from './dbAPI.js';
import * as spotify from './spotifyAPI.js';

// Load .env in development so server can read GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
dotenv.config();
// Add env extraction
const {
  SESSION_NAME = 'hsid',
  SESSION_SECRET,
  SESSION_TTL_SECONDS = '3600',
  SESSION_ROTATE_MS = '3600000',
  SESSIONS_COLLECTION = 'expressSessions',
  MONGO_DB_NAME,
} = process.env;

const EFFECTIVE_SESSION_SECRET = SESSION_SECRET || crypto.randomBytes(48).toString('hex');
if (!SESSION_SECRET) {
  console.warn('[CONFIG] Using generated session secret (provide SESSION_SECRET for persistence)');
}

// Fallbacks for Google & Spotify env moved off VITE_ prefix
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || process.env.VITE_GOOGLE_CLIENT_SECRET;
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || process.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || process.env.VITE_SPOTIFY_CLIENT_SECRET;

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.warn('[CONFIG] Google OAuth env incomplete');
}
if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
  console.warn('[CONFIG] Spotify credentials missing; Spotify endpoints will fail');
}

// Coerce numeric env
const SESSION_TTL_NUM = parseInt(SESSION_TTL_SECONDS, 10) || 3600;
const SESSION_ROTATE_MS_NUM = parseInt(SESSION_ROTATE_MS, 10) || 3600000;

const app = express();
const PORT = process.env.PORT || 5174;

// Frontend origin for CORS (cookies), session cookie name/secret and timings
//const ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
const SESSION_NAME = process.env.SESSION_NAME || 'hsid';
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-insecure-secret';
const SESSION_TTL_SECONDS = parseInt(process.env.SESSION_TTL_SECONDS || '3600', 10); // 1 hour
const SESSION_ROTATE_MS = parseInt(process.env.SESSION_ROTATE_MS || String(60 * 60 * 1000), 10);
const MONGO_DB = process.env.MONGO_DB_NAME || process.env.VITE_MONGO_DB_NAME || 'HearSay';
const SESSIONS_COLLECTION = process.env.SESSIONS_COLLECTION || 'expressSessions';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);


// Trust proxy when behind one (must be set before CORS and session middleware)
app.set('trust proxy', 1);

// REPLACE old CORS block (origins / app.use(cors({...}))) with:
const origins = (process.env.API_ORIGIN || '')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin: (origin, cb) => {
    // Allow requests with no origin (server-to-server) and same-origin
    if (!origin) return cb(null, true);
    if (origins.includes(origin)) return cb(null, true);
    console.warn('[CORS] Blocked origin:', origin, 'Allowed:', origins);
    return cb(new Error('CORS blocked: ' + origin));
  },
  credentials: true,
}));

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json());

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
    secret: EFFECTIVE_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // Changed to 'lax' for both dev and prod
      maxAge: SESSION_TTL_NUM * 1000,
      path: '/',
    },
    store: MongoStore.create({
      client: db.getClient(),
      dbName: MONGO_DB_NAME,
      collectionName: SESSIONS_COLLECTION,
      ttl: SESSION_TTL_NUM,
      stringify: false,
      autoRemove: 'native',
    }),
  })
);

// Rotate session id every SESSION_ROTATE_MS to mitigate fixation
app.use((req, res, next) => {
  // rotate session using coerced numeric value
  if (!req.session) return next();
  const now = Date.now();
  const last = req.session.__lastRotated || 0;
  if (now - last > SESSION_ROTATE_MS_NUM) {
    const preserve = { ...req.session };
    req.session.regenerate(err => {
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
app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---------------- Local Auth (Email + Password) ----------------
// Helper: normalize email
function normalizeEmail(e) {
  return String(e || '').trim().toLowerCase();
}

// Helper: basic password validation (min length)
function validatePassword(pw) {
  if (typeof pw !== 'string') return false;
  const trimmed = pw.trim();
  return trimmed.length >= 6;
}

// Signup or link local password (if Google-only user adds a password)
app.post('/api/auth/local/signup', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const em = normalizeEmail(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return res.status(400).json({ ok: false, error: 'invalid_email' });
    if (!validatePassword(password)) return res.status(400).json({ ok: false, error: 'weak_password', minLength: 6 });

    const usersCol = db.Users.collection();
    const existing = await usersCol.findOne({ email: em });
    const hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    const nowIso = new Date().toISOString();

    if (!existing) {
      const newDoc = {
        email: em,
        passwordHash: hash,
        firstname: '',
        lastname: '',
        accounts: [{ kind: 'Local', uid: em }],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      const ins = await usersCol.insertOne(newDoc);
      const userDoc = { ...newDoc, _id: ins.insertedId };
      req.session.user = {
        oid: userDoc._id.toString(),
        provider: 'local',
        email: userDoc.email,
        firstname: userDoc.firstname,
        lastname: userDoc.lastname,
      };
      await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
      return res.json({ ok: true, user: req.session.user, linked: false, created: true });
    }

    // Existing user: if already has local password, block; else link
    if (existing.passwordHash) {
      return res.status(409).json({ ok: false, error: 'email_in_use' });
    }

    await usersCol.updateOne(
      { _id: existing._id },
      {
        $set: { passwordHash: hash, updatedAt: nowIso },
        $addToSet: { accounts: { kind: 'Local', uid: em } },
      }
    );
    const linkedDoc = await usersCol.findOne({ _id: existing._id });
    req.session.user = {
      oid: linkedDoc._id.toString(),
      provider: 'local',
      email: linkedDoc.email,
      firstname: linkedDoc.firstname || '',
      lastname: linkedDoc.lastname || '',
    };
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    return res.json({ ok: true, user: req.session.user, linked: true, created: false });
  } catch (e) {
    console.error('[AuthLocal] signup error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Local login
app.post('/api/auth/local/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    const em = normalizeEmail(email);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return res.status(400).json({ ok: false, error: 'invalid_email' });
    const usersCol = db.Users.collection();
    const user = await usersCol.findOne({ email: em });
    if (!user || !user.passwordHash) return res.status(404).json({ ok: false, error: 'no_local_account' });
    const match = await bcrypt.compare(String(password || ''), user.passwordHash);
    if (!match) return res.status(401).json({ ok: false, error: 'invalid_credentials' });
    req.session.user = {
      oid: user._id.toString(),
      provider: 'local',
      email: user.email,
      firstname: user.firstname || '',
      lastname: user.lastname || '',
    };
    await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    return res.json({ ok: true, user: req.session.user });
  } catch (e) {
    console.error('[AuthLocal] login error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Set or change password for logged-in user (linking when Google-only)
app.post('/api/auth/local/set-password', async (req, res) => {
  try {
    const userOid = req.session?.user?.oid;
    if (!userOid) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const { password } = req.body || {};
    if (!validatePassword(password)) return res.status(400).json({ ok: false, error: 'weak_password', minLength: 6 });
    const usersCol = db.Users.collection();
    const userDoc = await usersCol.findOne({ _id: new ObjectId(userOid) });
    if (!userDoc) return res.status(404).json({ ok: false, error: 'not_found' });
    const hash = await bcrypt.hash(String(password), BCRYPT_ROUNDS);
    await usersCol.updateOne(
      { _id: userDoc._id },
      {
        $set: { passwordHash: hash, updatedAt: new Date().toISOString() },
        $addToSet: { accounts: { kind: 'Local', uid: userDoc.email } },
      }
    );
    return res.json({ ok: true, linked: true });
  } catch (e) {
    console.error('[AuthLocal] set-password error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Debug: list registered routes (helps verify local auth endpoints mounted)
app.get('/api/debug/routes', (req, res) => {
  const routes = [];
  app._router.stack.forEach(layer => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods).filter(m => layer.route.methods[m]);
      routes.push({ path: layer.route.path, methods });
    }
  });
  return res.json({ ok: true, routes });
});

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

    const client_id = GOOGLE_CLIENT_ID;
    const client_secret = GOOGLE_CLIENT_SECRET;
    if (!client_id || !client_secret) {
      return res.status(500).json({ error: 'server_misconfigured', message: 'Missing GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET' });
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
      // If user has a local passwordHash but Local account not present, ensure it
      if (userDoc?.passwordHash) {
        const hasLocal = Array.isArray(userDoc.accounts) && userDoc.accounts.some(a => a?.kind === 'Local');
        if (!hasLocal && userDoc.email) {
          await usersCol.updateOne({ _id: userDoc._id }, { $addToSet: { accounts: { kind: 'Local', uid: userDoc.email } } });
          userDoc = await usersCol.findOne({ _id: userDoc._id });
        }
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

    console.log('[AUTH] Session saved. SessionID:', req.sessionID, 'Cookie will be:', SESSION_NAME);

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

app.listen(PORT, '0.0.0.0', () => {
  console.log('Backend listening on', PORT);
// Update profile (firstname, lastname). Keeps email immutable for now.
app.post('/api/profile/update', async (req, res) => {
  try {
    const oid = req.session?.user?.oid;
    if (!oid) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const { firstname, lastname } = req.body || {};
    const fn = typeof firstname === 'string' ? firstname.trim() : undefined;
    const ln = typeof lastname === 'string' ? lastname.trim() : undefined;
    const tooLong = (s) => s && s.length > 100;
    if (tooLong(fn) || tooLong(ln)) return res.status(400).json({ ok: false, error: 'field_too_long', max: 100 });
    const users = db.Users.collection();
    const updates = { updatedAt: new Date().toISOString() };
    if (fn !== undefined) updates.firstname = fn;
    if (ln !== undefined) updates.lastname = ln;
    await users.updateOne({ _id: new ObjectId(oid) }, { $set: updates });
    const doc = await users.findOne(
      { _id: new ObjectId(oid) },
      { projection: { email: 1, firstname: 1, lastname: 1, accounts: 1 } }
    );
    if (!doc) return res.status(404).json({ ok: false, error: 'not_found' });
    // Update session user for immediate reflection
    if (req.session?.user) {
      if (fn !== undefined) req.session.user.firstname = fn;
      if (ln !== undefined) req.session.user.lastname = ln;
      await new Promise((resolve, reject) => req.session.save(err => err ? reject(err) : resolve()));
    }
    const safeAccounts = Array.isArray(doc.accounts)
      ? doc.accounts.map(a => ({ kind: a?.kind })).filter(a => a.kind)
      : [];
    return res.json({ ok: true, profile: {
      _id: doc._id,
      email: doc.email || '',
      firstname: doc.firstname || '',
      lastname: doc.lastname || '',
      accounts: safeAccounts,
    }});
  } catch (e) {
    console.error('[SERVER] /api/profile/update error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});
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
// Debug token cache endpoint to help diagnose credential issues
app.get('/api/spotify/debug/token', async (req, res) => {
  try {
    // Attempt a lightweight request to ensure token validity
    let probe = null;
    try {
      probe = await spotify.getNewReleases({ country: 'US', limit: 1 });
    } catch (e) {
      probe = { error: e?.message || String(e) };
    }
    const cache = spotify._debugTokenCache ? spotify._debugTokenCache() : {};
    return res.json({ ok: true, cache, probe });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e?.message || 'debug_failed' });
  }
});
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
    return res.status(500).json({ ok: false, error: 'server_error', message: e?.message });
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
    return res.status(500).json({ ok: false, error: 'server_error', message: e?.message });
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
    return res.status(500).json({ ok: false, error: 'server_error', message: e?.message });
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
    return res.status(500).json({ ok: false, error: 'server_error', message: e?.message });
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
    return res.status(500).json({ ok: false, error: 'server_error', message: e?.message });
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
    return res.status(500).json({ ok: false, error: 'server_error', message: e?.message });
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

    const { type, oid, rating, text, trackRatings } = req.body || {};
    const allowed = new Set(['song', 'album', 'artist']);
    if (!allowed.has(String(type))) return res.status(400).json({ ok: false, error: 'invalid_type' });
    if (!oid || typeof oid !== 'string') return res.status(400).json({ ok: false, error: 'invalid_oid' });

    // If this is the first artist review/rating, ensure an Artist document exists
    if (type === 'artist') {
      try {
        const artistsCol = db.Artists.collection();
        const existing = await artistsCol.findOne({ spotifyArtistId: oid });
        if (!existing) {
          const r = await spotify.getArtist(oid);
          const a = r?.data;
          if (a && a.id) {
            const nowIso = new Date().toISOString();
            const doc = {
              name: a.name || '',
              image: a.images?.[0]?.url || '',
              followers: Number.isInteger(a.followers?.total) ? a.followers.total : 0,
              genres: Array.isArray(a.genres) ? a.genres : [],
              popularity: Number.isInteger(a.popularity) ? a.popularity : 0,
              spotifyUrl: a.external_urls?.spotify || '',
              createdAt: nowIso,
              updatedAt: nowIso,
              // Required fields
              spotifyArtistId: a.id,
              likes: '0',
              dislikes: '0',
              rating: '0',
              reviews: [],
              albums: [],
              songs: [],
            };
            await artistsCol.updateOne(
              { spotifyArtistId: a.id },
              { $setOnInsert: doc },
              { upsert: true }
            );
          }
        }
      } catch (eEnsure) {
        console.warn('[Artists] ensure artist doc failed', eEnsure?.message || eEnsure);
      }
    }

    // Normalize inputs (support 0.5 increments). incoming rating expected 0.5..5
    let normRating = Number.isFinite(rating) ? Number(rating) : undefined;
    if (!(normRating >= 0.5 && normRating <= 5)) normRating = undefined;
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
    const setFields = { updatedAt: nowIso };
    if (normRating !== undefined) setFields.rating = new Int32(Math.round(normRating * 2));
    if (normText !== undefined) setFields.text = normText;
    
    // Store trackRatings for albums
    if (type === 'album' && trackRatings && typeof trackRatings === 'object') {
      setFields.trackRatings = trackRatings;
    }
    
    const setOnInsertFields = {
      createdAt: nowIso,
      user: { oid: userOid },
      item: { type, oid },
      likes: new Int32(0),
      dislikes: new Int32(0),
      comments: [],
      // Root-level type represents document kind; keep item.type for media kind
      type: 'review',
      itemType: String(type),
    };
    if (normText === undefined) setOnInsertFields.text = '';
    if (normRating === undefined) setOnInsertFields.rating = new Int32(0);
    const update = { $set: setFields, $setOnInsert: setOnInsertFields };

    // Debug instrumentation: log intent prior to upsert
    try {
      console.log('[Reviews][Upsert][DEBUG] filter=', filter,
        'set=', setFields,
        'onInsert=', setOnInsertFields);
    } catch {}

    const result = await reviews.findOneAndUpdate(filter, update, { upsert: true, returnDocument: 'after' });
    const doc = result.value || (await reviews.findOne(filter));

    try {
      console.log('[Reviews][Upsert][DEBUG] upsert doc id=', doc?._id?.toString?.() || null,
        'rating(raw)=', doc?.rating,
        'text.len=', typeof doc?.text === 'string' ? doc.text.length : null);
      console.log('[Reviews][Upsert][DEBUG] result.lastErrorObject=', result?.lastErrorObject || null);
    } catch {}
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

    // Also add a reference to this review on the corresponding media document
    try {
      const reviewIdStr = doc?._id?.toString?.();
      if (reviewIdStr) {
        if (type === 'artist') {
          const artistsCol = db.Artists.collection();
          // Normalize existing artist doc to satisfy schema before adding review reference
          const existingArtist = await artistsCol.findOne({ spotifyArtistId: oid }) || await artistsCol.findOne({ oid });
          const normalizedSet = {};
          if (existingArtist) {
            // Coerce types required by validator
            normalizedSet.image = typeof existingArtist.image === 'string' ? existingArtist.image : '';
            normalizedSet.followers = Number.isInteger(existingArtist.followers) ? existingArtist.followers : 0;
            normalizedSet.popularity = Number.isInteger(existingArtist.popularity) ? existingArtist.popularity : 0;
            normalizedSet.likes = typeof existingArtist.likes === 'string' ? existingArtist.likes : '0';
            normalizedSet.dislikes = typeof existingArtist.dislikes === 'string' ? existingArtist.dislikes : '0';
            normalizedSet.rating = typeof existingArtist.rating === 'string' ? existingArtist.rating : '0';
            normalizedSet.spotifyUrl = typeof existingArtist.spotifyUrl === 'string' ? existingArtist.spotifyUrl : '';
            normalizedSet.spotifyArtistId = typeof existingArtist.spotifyArtistId === 'string' ? existingArtist.spotifyArtistId : oid;
            normalizedSet.genres = Array.isArray(existingArtist.genres) ? existingArtist.genres : [];
            normalizedSet.albums = Array.isArray(existingArtist.albums) ? existingArtist.albums : [];
            normalizedSet.songs = Array.isArray(existingArtist.songs) ? existingArtist.songs : [];
            normalizedSet.createdAt = typeof existingArtist.createdAt === 'string' ? existingArtist.createdAt : new Date().toISOString();
          } else {
            // If somehow missing, minimally seed required fields
            normalizedSet.image = '';
            normalizedSet.followers = 0;
            normalizedSet.popularity = 0;
            normalizedSet.likes = '0';
            normalizedSet.dislikes = '0';
            normalizedSet.rating = '0';
            normalizedSet.spotifyUrl = '';
            normalizedSet.spotifyArtistId = oid;
            normalizedSet.genres = [];
            normalizedSet.albums = [];
            normalizedSet.songs = [];
            normalizedSet.createdAt = new Date().toISOString();
          }
          normalizedSet.updatedAt = nowIso;
          await artistsCol.updateOne(
            { $or: [{ spotifyArtistId: oid }, { oid }] },
            {
              $set: normalizedSet,
              $addToSet: { reviews: { review_oid: reviewIdStr, user_oid: userOid } },
            },
            { upsert: true }
          );
        } else if (type === 'album') {
          const albumsCol = db.Albums.collection();
          // Atomic creation + normalization + review reference insertion
          try {
            const existingAlbum = await albumsCol.findOne({ spotifyAlbumId: oid });
            let spotifyAlbumData = null;
            if (!existingAlbum) {
              try {
                const ar = await spotify.getAlbum(oid);
                spotifyAlbumData = ar?.data || null;
              } catch (eAlbFetch) {
                console.warn('[Albums] Spotify fetch failed for', oid, eAlbFetch?.message || eAlbFetch);
              }
            }
            // Ensure artist doc (from album data if available)
            let artistObjRaw = spotifyAlbumData && Array.isArray(spotifyAlbumData.artists) && spotifyAlbumData.artists[0] ? spotifyAlbumData.artists[0] : {};
            let albumArtistDoc = artistObjRaw.id ? await db.Artists.collection().findOne({ spotifyArtistId: artistObjRaw.id }) : null;
            if (!albumArtistDoc && artistObjRaw.id) {
              try {
                const aRes = await spotify.getArtist(artistObjRaw.id);
                const a = aRes?.data;
                if (a && a.id) {
                  const nowIsoArtist = new Date().toISOString();
                  await db.Artists.collection().updateOne(
                    { spotifyArtistId: a.id },
                    {
                      $setOnInsert: {
                        name: a.name || '',
                        image: a.images?.[0]?.url || '',
                        followers: Number.isInteger(a.followers?.total) ? a.followers.total : 0,
                        genres: Array.isArray(a.genres) ? a.genres : [],
                        popularity: Number.isInteger(a.popularity) ? a.popularity : 0,
                        spotifyUrl: a.external_urls?.spotify || '',
                        createdAt: nowIsoArtist,
                        updatedAt: nowIsoArtist,
                        spotifyArtistId: a.id,
                        likes: '0',
                        dislikes: '0',
                        rating: '0',
                        reviews: [],
                        albums: [],
                        songs: [],
                      },
                    },
                    { upsert: true }
                  );
                  albumArtistDoc = await db.Artists.collection().findOne({ spotifyArtistId: a.id });
                }
              } catch (eEnsureArtist) {
                console.warn('[Albums] ensure artist failed', eEnsureArtist?.message || eEnsureArtist);
              }
            }
            const artistIdRef = albumArtistDoc?._id?.toString?.() || '';
            // Build normalized fields (both for existing or new)
            const normalized = {};
            if (existingAlbum) {
              normalized.name = typeof existingAlbum.name === 'string' ? existingAlbum.name : (spotifyAlbumData?.name || '');
              normalized.spotifyAlbumId = typeof existingAlbum.spotifyAlbumId === 'string' ? existingAlbum.spotifyAlbumId : oid;
              const artistObj = existingAlbum.artist && typeof existingAlbum.artist === 'object' ? existingAlbum.artist : {};
              normalized.artist = {
                name: typeof artistObj.name === 'string' ? artistObj.name : (artistObjRaw.name || albumArtistDoc?.name || ''),
                oid: typeof artistObj.oid === 'string' ? artistObj.oid : artistIdRef,
              };
              normalized.genre = Array.isArray(existingAlbum.genre) ? existingAlbum.genre : (Array.isArray(spotifyAlbumData?.genres) ? spotifyAlbumData.genres : []);
              normalized.likes = typeof existingAlbum.likes === 'string' ? existingAlbum.likes : '0';
              normalized.dislikes = typeof existingAlbum.dislikes === 'string' ? existingAlbum.dislikes : '0';
              normalized.rating = typeof existingAlbum.rating === 'string' ? existingAlbum.rating : '0';
              normalized.releaseDate = typeof existingAlbum.releaseDate === 'string' ? existingAlbum.releaseDate : (spotifyAlbumData?.release_date || '');
              normalized.image = typeof existingAlbum.image === 'string' ? existingAlbum.image : (spotifyAlbumData?.images?.[0]?.url || '');
              // Do not set createdAt here; only update updatedAt
              normalized.updatedAt = nowIso;
              const songsArr = Array.isArray(existingAlbum.songs) ? existingAlbum.songs : [];
              normalized.songs = songsArr.filter(s => s && typeof s === 'object').map(s => ({ name: typeof s.name === 'string' ? s.name : '', oid: typeof s.oid === 'string' ? s.oid : '' })).filter(s => s.name && s.oid);
              // For existing albums, do NOT overwrite createdAt; only refresh updatedAt
              if (typeof existingAlbum.createdAt === 'string') {
                // leave createdAt untouched by excluding it from $set
              }
              normalized.updatedAt = nowIso;
            } else {
              normalized.name = spotifyAlbumData?.name || '';
              normalized.spotifyAlbumId = oid;
              normalized.artist = { name: artistObjRaw.name || albumArtistDoc?.name || '', oid: artistIdRef };
              normalized.genre = Array.isArray(spotifyAlbumData?.genres) ? spotifyAlbumData.genres : [];
              normalized.likes = '0';
              normalized.dislikes = '0';
              normalized.rating = '0';
              normalized.releaseDate = spotifyAlbumData?.release_date || '';
              normalized.image = spotifyAlbumData?.images?.[0]?.url || '';
              normalized.songs = [];
              // Exclude reviews & createdAt from $set to avoid conflicts with $addToSet/$setOnInsert
              normalized.updatedAt = nowIso;
            }
            // Perform atomic upsert with review reference (avoid duplicate field conflicts)
            const albumUpdate = {
              $set: normalized, // no reviews/createdAt here to avoid path conflicts
              $setOnInsert: { createdAt: nowIso },
              $addToSet: { reviews: { review_oid: reviewIdStr, user_oid: userOid } },
            };
            const albumResult = await albumsCol.updateOne(
              { spotifyAlbumId: oid },
              albumUpdate,
              { upsert: true }
            );
            try {
              console.log('[Albums][UpsertReviewRef][DEBUG] oid=', oid, 'matched=', albumResult.matchedCount, 'modified=', albumResult.modifiedCount, 'upserted=', albumResult.upsertedId);
            } catch {}
          } catch (albumReviewRefErr) {
            console.warn('[Albums] failed album atomic upsert (validation?)', albumReviewRefErr?.message || albumReviewRefErr);
          }
          // Ensure Artist.albums[] contains this album { name, oid }
          try {
            const albumDocForRef = await albumsCol.findOne(
              { spotifyAlbumId: oid },
              { projection: { _id: 1, name: 1, artist: 1 } }
            );
            const albumIdStr = albumDocForRef?._id?.toString?.();
            const albumName = albumDocForRef?.name || '';
            const artistOidMaybe = albumDocForRef?.artist?.oid;
            if (albumIdStr && artistOidMaybe) {
              const artistsCol2 = db.Artists.collection();
              const match = ObjectId.isValid(artistOidMaybe)
                ? { _id: new ObjectId(artistOidMaybe) }
                : { spotifyArtistId: String(artistOidMaybe) };
              await artistsCol2.updateOne(
                match,
                { $addToSet: { albums: { name: albumName, oid: albumIdStr } }, $set: { updatedAt: nowIso } }
              );
            }
          } catch (eArtistAlbums) {
            console.warn('[Artists] failed to add album to artist.albums[]', eArtistAlbums?.message || eArtistAlbums);
          }
          // Backfill album.songs[] with existing songs and create missing tracks
          try {
            const albumDoc = await albumsCol.findOne({ spotifyAlbumId: oid });
            const albumIdStr = albumDoc?._id?.toString?.();
            const albumName = albumDoc?.name || '';

            // Add existing song docs referencing this album
            if (albumIdStr) {
              const songsCol = db.Songs.collection();
              const existingSongs = await songsCol
                .find({ $or: [{ 'album.spotifyAlbumId': oid }, { 'album.oid': albumIdStr }] })
                .project({ _id: 1, title: 1 })
                .toArray();
              for (const s of existingSongs) {
                await albumsCol.updateOne(
                  { spotifyAlbumId: oid },
                  { $addToSet: { songs: { name: s.title || '', oid: s._id.toString() } }, $set: { updatedAt: nowIso } }
                );
              }
            }

            // Fetch latest album from Spotify and iterate tracks
            const arFull = await spotify.getAlbum(oid);
            const alFull = arFull?.data;
            const trackItems = Array.isArray(alFull?.tracks?.items) ? alFull.tracks.items : [];
            const songsCol = db.Songs.collection();

            for (const t of trackItems) {
              if (!t?.id) continue;

              const artist0t = Array.isArray(t.artists) && t.artists[0] ? t.artists[0] : {};
              // Ensure artist doc
              let artistDoc = artist0t.id ? await db.Artists.collection().findOne({ spotifyArtistId: artist0t.id }) : null;
              if (!artistDoc && artist0t.id) {
                try {
                  const aRes = await spotify.getArtist(artist0t.id);
                  const a = aRes?.data;
                  if (a?.id) {
                    const nowIsoArtist = new Date().toISOString();
                    await db.Artists.collection().updateOne(
                      { spotifyArtistId: a.id },
                      {
                        $setOnInsert: {
                          name: a.name || '',
                          image: a.images?.[0]?.url || '',
                          followers: Number.isInteger(a.followers?.total) ? a.followers.total : 0,
                          genres: Array.isArray(a.genres) ? a.genres : [],
                          popularity: Number.isInteger(a.popularity) ? a.popularity : 0,
                          spotifyUrl: a.external_urls?.spotify || '',
                          createdAt: nowIsoArtist,
                          updatedAt: nowIsoArtist,
                          spotifyArtistId: a.id,
                          likes: '0',
                          dislikes: '0',
                          rating: '0',
                          reviews: [],
                          albums: [],
                          songs: [],
                        },
                      },
                      { upsert: true }
                    );
                    artistDoc = await db.Artists.collection().findOne({ spotifyArtistId: a.id });
                  }
                } catch {}
              }

              const artistOidRef = artistDoc?._id?.toString?.() || '';
              // Derive genres from artist
              let genresList = [];
              if (artistDoc?.spotifyArtistId) {
                try {
                  const artistRes = await spotify.getArtist(artistDoc.spotifyArtistId);
                  const aData = artistRes?.data;
                  if (Array.isArray(aData?.genres)) genresList = aData.genres.slice(0, 20);
                } catch {}
              }

              const songSeed = {
                title: t.name || '',
                spotifyTrackID: t.id,
                date: alFull?.release_date || '',
                genres: genresList,
                image: Array.isArray(alFull?.images) && alFull.images[0] ? alFull.images[0].url : '',
                likes: '0',
                dislikes: '0',
                rating: '0',
                artist: { name: artistDoc?.name || artist0t.name || '', oid: artistOidRef, spotifyArtistId: artistDoc?.spotifyArtistId || artist0t.id || '' },
                album: { name: albumName, oid: albumIdStr || '', spotifyAlbumId: oid },
                reviews: [],
              };

              let songDoc = null;
              try {
                const up = await songsCol.findOneAndUpdate(
                  { spotifyTrackID: t.id },
                  { $setOnInsert: songSeed },
                  { upsert: true, returnDocument: 'after', projection: { _id: 1, title: 1 } }
                );
                songDoc = up?.value || null;
              } catch (dupErr) {
                if (dupErr && (dupErr.code === 11000 || /duplicate key/i.test(String(dupErr)))) {
                  songDoc = await songsCol.findOne(
                    { spotifyTrackID: t.id },
                    { projection: { _id: 1, title: 1 } }
                  );
                } else {
                  console.warn('[Songs] upsert failed', dupErr?.message || dupErr);
                }
              }

              if (songDoc) {
                await albumsCol.updateOne(
                  { spotifyAlbumId: oid },
                  { $addToSet: { songs: { name: songDoc.title || '', oid: songDoc._id.toString() } }, $set: { updatedAt: nowIso } }
                );
                if (artistDoc?._id) {
                  await db.Artists.collection().updateOne(
                    { _id: artistDoc._id },
                    {
                      $addToSet: {
                        songs: { name: songDoc.title || '', oid: songDoc._id.toString() },
                        albums: { name: albumName, oid: albumIdStr || '' },
                      },
                      $set: { updatedAt: nowIso },
                    }
                  );
                }
              }
            }
          } catch (eBackfillAlbumSongs) {
            console.warn('[Albums] backfill songs failed', eBackfillAlbumSongs?.message || eBackfillAlbumSongs);
          }
        } else if (type === 'song') {
          const songsCol = db.Songs.collection();
          // Ensure song doc exists with minimal required fields
          const songExisting = await songsCol.findOne({ spotifyTrackID: oid });
          if (!songExisting) {
            try {
              const tr = await spotify.getTrack(oid);
              const t = tr?.data;
              if (t && t.id) {
                const artist0 = Array.isArray(t.artists) && t.artists[0] ? t.artists[0] : {};
                const album = t.album || {};
                // Derive genres from the first artist (Spotify track object does not include genres)
                let genresList = [];
                if (artist0?.id) {
                  try {
                    const artistRes = await spotify.getArtist(artist0.id);
                    const artistData = artistRes?.data;
                    if (artistData && Array.isArray(artistData.genres)) {
                      genresList = artistData.genres.slice(0, 20);
                    }
                  } catch (eArtist) {
                    console.warn('[Songs] could not fetch artist genres', eArtist?.message || eArtist);
                  }
                }
                // Resolve artist & album docs for internal oid references
                let artistDoc = artist0.id ? await db.Artists.collection().findOne({ spotifyArtistId: artist0.id }) : null;
                if (!artistDoc && artist0.id) {
                  try {
                    const aRes = await spotify.getArtist(artist0.id);
                    const a = aRes?.data;
                    if (a?.id) {
                      const nowIsoArtist = new Date().toISOString();
                      await db.Artists.collection().updateOne(
                        { spotifyArtistId: a.id },
                        {
                          $setOnInsert: {
                            name: a.name || '',
                            image: a.images?.[0]?.url || '',
                            followers: Number.isInteger(a.followers?.total) ? a.followers.total : 0,
                            genres: Array.isArray(a.genres) ? a.genres : [],
                            popularity: Number.isInteger(a.popularity) ? a.popularity : 0,
                            spotifyUrl: a.external_urls?.spotify || '',
                            createdAt: nowIsoArtist,
                            updatedAt: nowIsoArtist,
                            spotifyArtistId: a.id,
                            likes: '0',
                            dislikes: '0',
                            rating: '0',
                            reviews: [],
                            albums: [],
                            songs: [],
                          },
                        },
                        { upsert: true }
                      );
                      artistDoc = await db.Artists.collection().findOne({ spotifyArtistId: a.id });
                    }
                  } catch {}
                }
                if (artistDoc && artistDoc._id && artistDoc.oid !== artistDoc._id.toString()) {
                  await db.Artists.collection().updateOne({ _id: artistDoc._id }, { $set: { oid: artistDoc._id.toString() } });
                }
                const artistOidRef = artistDoc?._id?.toString?.() || artist0.id || '';
                let albumDoc = album.id ? await db.Albums.collection().findOne({ spotifyAlbumId: album.id }) : null;
                if (!albumDoc && album.id) {
                  const albumSeed = {
                    name: album.name || '',
                    spotifyAlbumId: album.id,
                    artist: { name: artist0.name || '', oid: artistOidRef },
                    genre: [],
                    likes: '0',
                    dislikes: '0',
                    rating: '0',
                    releaseDate: album.release_date || '',
                    image: album.images?.[0]?.url || '',
                    songs: [],
                    reviews: [],
                  };
                  await db.Albums.collection().updateOne(
                    { spotifyAlbumId: albumSeed.spotifyAlbumId },
                    { $setOnInsert: albumSeed },
                    { upsert: true }
                  );
                  albumDoc = await db.Albums.collection().findOne({ spotifyAlbumId: album.id });
                }
                const albumOidRef = albumDoc?._id?.toString?.() || album.id || '';
                const seed = {
                  title: t.name || '',
                  spotifyTrackID: t.id,
                  date: album.release_date || '',
                  genres: genresList,
                  image: album.images?.[0]?.url || '',
                  likes: '0',
                  dislikes: '0',
                  rating: '0',
                  artist: { name: artist0.name || '', oid: artistOidRef, spotifyArtistId: artist0.id || '' },
                  album: { name: album.name || '', oid: albumOidRef, spotifyAlbumId: album.id || '' },
                  reviews: [],
                };
                await songsCol.updateOne(
                  { spotifyTrackID: t.id },
                  { $setOnInsert: seed },
                  { upsert: true }
                );
              }
            } catch (eSong) {
              console.warn('[Songs] ensure song doc failed', eSong?.message || eSong);
            }
          }
          // If existing song lacks genres, attempt a lightweight genre backfill
          if (songExisting && (!Array.isArray(songExisting.genres) || songExisting.genres.length === 0)) {
            try {
              const artistSpotifyId = songExisting.artist?.spotifyArtistId;
              let genresList = [];
              if (artistSpotifyId) {
                const artistRes = await spotify.getArtist(artistSpotifyId);
                const artistData = artistRes?.data;
                if (artistData && Array.isArray(artistData.genres)) genresList = artistData.genres.slice(0, 20);
              }
              if (genresList.length) {
                await songsCol.updateOne(
                  { spotifyTrackID: oid },
                  { $set: { genres: genresList } }
                );
              }
            } catch (eGenres) {
              console.warn('[Songs] genre backfill failed', eGenres?.message || eGenres);
            }
          }
          await songsCol.updateOne(
            { spotifyTrackID: oid },
            { $addToSet: { reviews: { review_oid: reviewIdStr, user_oid: userOid } } },
          );
          // CRITICAL FIX: Ensure the song is added to album.songs[] and artist.songs[]/albums[]
          try {
            const songDocForRef = await songsCol.findOne(
              { spotifyTrackID: oid },
              { projection: { _id: 1, title: 1, artist: 1, album: 1 } }
            );
            const songIdStr = songDocForRef?._id?.toString?.();
            const songTitle = songDocForRef?.title || '';
            const artistOidMaybe = songDocForRef?.artist?.oid;
            const albumOidMaybe = songDocForRef?.album?.oid;
            const albumSpotifyId = songDocForRef?.album?.spotifyAlbumId;
            const albumNameMaybe = songDocForRef?.album?.name || '';
            
            // Add this song to the album's songs array
            if (songIdStr && albumSpotifyId) {
              const albumsCol = db.Albums.collection();
              await albumsCol.updateOne(
                { spotifyAlbumId: albumSpotifyId },
                { 
                  $addToSet: { songs: { name: songTitle, oid: songIdStr } },
                  $set: { updatedAt: nowIso }
                }
              );
            }
            
            // Add this song and album to the artist's arrays
            if (songIdStr && artistOidMaybe) {
              const artistsCol2 = db.Artists.collection();
              const match = ObjectId.isValid(artistOidMaybe)
                ? { _id: new ObjectId(artistOidMaybe) }
                : { spotifyArtistId: String(artistOidMaybe) };
              const updateOps = { $set: { updatedAt: nowIso }, $addToSet: { songs: { name: songTitle, oid: songIdStr } } };
              if (albumOidMaybe) {
                updateOps.$addToSet.albums = { name: albumNameMaybe, oid: String(albumOidMaybe) };
              }
              await artistsCol2.updateOne(match, updateOps);
            }
          } catch (eArtistSongs) {
            console.warn('[Artists] failed to add song/album to artist arrays', eArtistSongs?.message || eArtistSongs);
          }
        }
      }
    } catch (eref) {
      console.warn('[Reviews] Failed to add media review reference', eref?.message || eref);
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
        // Add media review reference on retry path as well
        try {
          const reviewIdStr = doc?._id?.toString?.();
          if (reviewIdStr) {
            if (type === 'artist') {
              const artistsCol = db.Artists.collection();
              const existingArtist = await artistsCol.findOne({ spotifyArtistId: oid }) || await artistsCol.findOne({ oid });
              const normalizedSet = {};
              if (existingArtist) {
                normalizedSet.image = typeof existingArtist.image === 'string' ? existingArtist.image : '';
                normalizedSet.followers = Number.isInteger(existingArtist.followers) ? existingArtist.followers : 0;
                normalizedSet.popularity = Number.isInteger(existingArtist.popularity) ? existingArtist.popularity : 0;
                normalizedSet.likes = typeof existingArtist.likes === 'string' ? existingArtist.likes : '0';
                normalizedSet.dislikes = typeof existingArtist.dislikes === 'string' ? existingArtist.dislikes : '0';
                normalizedSet.rating = typeof existingArtist.rating === 'string' ? existingArtist.rating : '0';
                normalizedSet.spotifyUrl = typeof existingArtist.spotifyUrl === 'string' ? existingArtist.spotifyUrl : '';
                normalizedSet.spotifyArtistId = typeof existingArtist.spotifyArtistId === 'string' ? existingArtist.spotifyArtistId : oid;
                normalizedSet.genres = Array.isArray(existingArtist.genres) ? existingArtist.genres : [];
                normalizedSet.albums = Array.isArray(existingArtist.albums) ? existingArtist.albums : [];
                normalizedSet.songs = Array.isArray(existingArtist.songs) ? existingArtist.songs : [];
                normalizedSet.createdAt = typeof existingArtist.createdAt === 'string' ? existingArtist.createdAt : new Date().toISOString();
              } else {
                normalizedSet.image = '';
                normalizedSet.followers = 0;
                normalizedSet.popularity = 0;
                normalizedSet.likes = '0';
                normalizedSet.dislikes = '0';
                normalizedSet.rating = '0';
                normalizedSet.spotifyUrl = '';
                normalizedSet.spotifyArtistId = oid;
                normalizedSet.genres = [];
                normalizedSet.albums = [];
                normalizedSet.songs = [];
                normalizedSet.createdAt = new Date().toISOString();
              }
              normalizedSet.updatedAt = new Date().toISOString();
              await artistsCol.updateOne(
                { $or: [{ spotifyArtistId: oid }, { oid }] },
                {
                  $set: normalizedSet,
                  $addToSet: { reviews: { review_oid: reviewIdStr, user_oid: userOid } },
                },
                { upsert: true }
              );
            } else if (type === 'album') {
              const albumsCol = db.Albums.collection();
              await albumsCol.updateOne(
                { spotifyAlbumId: oid },
                { $addToSet: { reviews: { review_oid: reviewIdStr, user_oid: userOid } } },
              );
              // Retry path: ensure Artist.albums[] contains this album
              try {
                const albumDocForRef = await albumsCol.findOne(
                  { spotifyAlbumId: oid },
                  { projection: { _id: 1, name: 1, artist: 1 } }
                );
                const albumIdStr = albumDocForRef?._id?.toString?.();
                const albumName = albumDocForRef?.name || '';
                const artistOidMaybe = albumDocForRef?.artist?.oid;
                if (albumIdStr && artistOidMaybe) {
                  const artistsCol2 = db.Artists.collection();
                  const match = ObjectId.isValid(artistOidMaybe)
                    ? { _id: new ObjectId(artistOidMaybe) }
                    : { spotifyArtistId: String(artistOidMaybe) };
                  await artistsCol2.updateOne(
                    match,
                    { $addToSet: { albums: { name: albumName, oid: albumIdStr } }, $set: { updatedAt: new Date().toISOString() } }
                  );
                }
              } catch (eArtistAlbumsRetry) {
                console.warn('[Artists] retry: failed to add album to artist.albums[]', eArtistAlbumsRetry?.message || eArtistAlbumsRetry);
              }
              // Retry path: backfill album.songs[] with existing and newly created songs
              try {
                // Ensure album doc exists with artist reference
                let albumDocEnsure = await albumsCol.findOne({ spotifyAlbumId: oid });
                if (!albumDocEnsure) {
                  try {
                    const ar = await spotify.getAlbum(oid);
                    const al = ar?.data;
                    if (al && al.id) {
                      const artist0 = Array.isArray(al.artists) && al.artists[0] ? al.artists[0] : {};
                      // Ensure artist doc exists to capture internal oid
                      let albumArtistDoc = artist0.id ? await db.Artists.collection().findOne({ spotifyArtistId: artist0.id }) : null;
                      if (!albumArtistDoc && artist0.id) {
                        try {
                          const aRes = await spotify.getArtist(artist0.id);
                          const a = aRes?.data;
                          if (a && a.id) {
                            const nowIsoArtist = new Date().toISOString();
                            const aDoc = {
                              name: a.name || '',
                              image: a.images?.[0]?.url || '',
                              followers: Number.isInteger(a.followers?.total) ? a.followers.total : 0,
                              genres: Array.isArray(a.genres) ? a.genres : [],
                              popularity: Number.isInteger(a.popularity) ? a.popularity : 0,
                              spotifyUrl: a.external_urls?.spotify || '',
                              createdAt: nowIsoArtist,
                              updatedAt: nowIsoArtist,
                              spotifyArtistId: a.id,
                              likes: '0',
                              dislikes: '0',
                              rating: '0',
                              reviews: [],
                              albums: [],
                              songs: [],
                            };
                            await db.Artists.collection().updateOne(
                              { spotifyArtistId: a.id },
                              { $setOnInsert: aDoc },
                              { upsert: true }
                            );
                            albumArtistDoc = await db.Artists.collection().findOne({ spotifyArtistId: a.id });
                          }
                        } catch {}
                      }
                      const albumArtistOidRef = albumArtistDoc?._id?.toString?.() || '';
                      const seed = {
                        name: al.name || '',
                        spotifyAlbumId: al.id,
                        artist: { name: artist0.name || albumArtistDoc?.name || '', oid: albumArtistOidRef },
                        genre: Array.isArray(al.genres) ? al.genres : [],
                        likes: '0',
                        dislikes: '0',
                        rating: '0',
                        releaseDate: al.release_date || '',
                        image: al.images?.[0]?.url || '',
                        songs: [],
                        reviews: [],
                      };
                      await albumsCol.updateOne(
                        { spotifyAlbumId: al.id },
                        { $setOnInsert: seed },
                        { upsert: true }
                      );
                      albumDocEnsure = await albumsCol.findOne({ spotifyAlbumId: oid });
                    }
                  } catch (eAlbRetryEnsure) {
                    console.warn('[Albums] retry: ensure album doc failed', eAlbRetryEnsure?.message || eAlbRetryEnsure);
                  }
                }
                const albumDoc = albumDocEnsure || await albumsCol.findOne({ spotifyAlbumId: oid });
                const albumIdStr2 = albumDoc?._id?.toString?.();
                const albumName2 = albumDoc?.name || '';
                // Add existing songs referencing this album
                if (albumIdStr2) {
                  const songsCol = db.Songs.collection();
                  const existingSongs = await songsCol
                    .find({ $or: [{ 'album.spotifyAlbumId': oid }, { 'album.oid': albumIdStr2 }] })
                    .project({ _id: 1, title: 1 })
                    .toArray();
                  for (const s of existingSongs) {
                    await albumsCol.updateOne(
                      { spotifyAlbumId: oid },
                      { $addToSet: { songs: { name: s.title || '', oid: s._id.toString() } }, $set: { updatedAt: nowIso } }
                    );
                  }
                }
                // Create missing tracks and attach to album
                const arFull = await spotify.getAlbum(oid);
                const alFull = arFull?.data;
                const trackItems = Array.isArray(alFull?.tracks?.items) ? alFull.tracks.items : [];
                if (trackItems.length && albumIdStr2) {
                  const songsCol = db.Songs.collection();
                  for (const t of trackItems) {
                    if (!t || !t.id) continue;
                    const artist0t = Array.isArray(t.artists) && t.artists[0] ? t.artists[0] : {};
                    // Ensure artist doc
                    let artistDoc = artist0t.id ? await db.Artists.collection().findOne({ spotifyArtistId: artist0t.id }) : null;
                    if (!artistDoc && artist0t.id) {
                      try {
                        const aRes = await spotify.getArtist(artist0t.id);
                        const a = aRes?.data;
                        if (a && a.id) {
                          const nowIsoArtist = new Date().toISOString();
                          await db.Artists.collection().updateOne(
                            { spotifyArtistId: a.id },
                            {
                              $setOnInsert: {
                                name: a.name || '',
                                image: a.images?.[0]?.url || '',
                                followers: Number.isInteger(a.followers?.total) ? a.followers.total : 0,
                                genres: Array.isArray(a.genres) ? a.genres : [],
                                popularity: Number.isInteger(a.popularity) ? a.popularity : 0,
                                spotifyUrl: a.external_urls?.spotify || '',
                                createdAt: nowIsoArtist,
                                updatedAt: nowIsoArtist,
                                spotifyArtistId: a.id,
                                likes: '0',
                                dislikes: '0',
                                rating: '0',
                                reviews: [],
                                albums: [],
                                songs: [],
                              },
                            },
                            { upsert: true }
                          );
                          artistDoc = await db.Artists.collection().findOne({ spotifyArtistId: a.id });
                        }
                      } catch {}
                    }
                    const artistOidRef = artistDoc?._id?.toString?.() || '';
                    // Derive genres from the artist
                    let genresList = [];
                    if (artistDoc?.spotifyArtistId) {
                      try {
                        const artistRes = await spotify.getArtist(artistDoc.spotifyArtistId);
                        const aData = artistRes?.data;
                        if (aData && Array.isArray(aData.genres)) genresList = aData.genres.slice(0, 20);
                      } catch {}
                    }
                    const songSeed = {
                      title: t.name || '',
                      spotifyTrackID: t.id,
                      date: alFull?.release_date || '',
                      genres: genresList,
                      image: Array.isArray(alFull?.images) && alFull.images[0] ? alFull.images[0].url : '',
                      likes: '0',
                      dislikes: '0',
                      rating: '0',
                      artist: { name: artistDoc?.name || artist0t.name || '', oid: artistOidRef, spotifyArtistId: artistDoc?.spotifyArtistId || artist0t.id || '' },
                      album: { name: albumName2, oid: albumIdStr2, spotifyAlbumId: oid },
                      reviews: [],
                    };
                    let songDoc = null;
                    try {
                      const up = await songsCol.findOneAndUpdate(
                        { spotifyTrackID: t.id },
                        { $setOnInsert: songSeed },
                        { upsert: true, returnDocument: 'after', projection: { _id: 1, title: 1 } }
                      );
                      songDoc = up?.value || null;
                    } catch (dupErr) {
                      if (dupErr && (dupErr.code === 11000 || /duplicate key/i.test(String(dupErr)))) {
                        songDoc = await songsCol.findOne(
                          { spotifyTrackID: t.id },
                          { projection: { _id: 1, title: 1 } }
                        );
                      } else {
                        console.warn('[Songs] retry upsert failed', dupErr?.message || dupErr);
                      }
                    }
                    if (songDoc) {
                      await albumsCol.updateOne(
                        { spotifyAlbumId: oid },
                        { $addToSet: { songs: { name: songDoc.title || '', oid: songDoc._id.toString() } }, $set: { updatedAt: nowIso } }
                      );
                      if (artistDoc && artistDoc._id) {
                        await db.Artists.collection().updateOne(
                          { _id: artistDoc._id },
                          {
                            $addToSet: {
                              songs: { name: songDoc.title || '', oid: songDoc._id.toString() },
                              albums: { name: albumName2, oid: albumIdStr2 },
                            },
                            $set: { updatedAt: nowIso },
                          }
                        );
                      }
                    }
                  }
                }
              } catch (retryBackfillErr) {
                console.warn('[Albums] retry: backfill songs failed', retryBackfillErr?.message || retryBackfillErr);
              }
            } else if (type === 'song') {
              const songsCol = db.Songs.collection();
              // Retry path: add missing genres if absent
              const existingSong = await songsCol.findOne({ spotifyTrackID: oid });
              if (existingSong && (!Array.isArray(existingSong.genres) || existingSong.genres.length === 0)) {
                try {
                  const firstArtistId = existingSong.artist?.oid;
                  let genresList = [];
                  if (firstArtistId) {
                    const artistRes = await spotify.getArtist(firstArtistId);
                    const artistData = artistRes?.data;
                    if (artistData && Array.isArray(artistData.genres)) genresList = artistData.genres.slice(0, 20);
                  }
                  if (genresList.length) {
                    await songsCol.updateOne(
                      { spotifyTrackID: oid },
                      { $set: { genres: genresList } }
                    );
                  }
                } catch (eGenresRetry) {
                  console.warn('[Songs] retry path genre backfill failed', eGenresRetry?.message || eGenresRetry);
                }
              }
              await songsCol.updateOne(
                { spotifyTrackID: oid },
                { $addToSet: { reviews: { review_oid: reviewIdStr, user_oid: userOid } } },
              );
              // Retry path: ensure Artist.songs[] and Artist.albums[] are updated
              try {
                const songDocForRef = await songsCol.findOne(
                  { spotifyTrackID: oid },
                  { projection: { _id: 1, title: 1, artist: 1, album: 1 } }
                );
                const songIdStr = songDocForRef?._id?.toString?.();
                const songTitle = songDocForRef?.title || '';
                const artistOidMaybe = songDocForRef?.artist?.oid;
                const albumOidMaybe = songDocForRef?.album?.oid;
                const albumNameMaybe = songDocForRef?.album?.name || '';
                if (songIdStr && artistOidMaybe) {
                  const artistsCol2 = db.Artists.collection();
                  const match = ObjectId.isValid(artistOidMaybe)
                    ? { _id: new ObjectId(artistOidMaybe) }
                    : { spotifyArtistId: String(artistOidMaybe) };
                  const updateOps = { $set: { updatedAt: new Date().toISOString() }, $addToSet: { songs: { name: songTitle, oid: songIdStr } } };
                  if (albumOidMaybe) {
                    updateOps.$addToSet.albums = { name: albumNameMaybe, oid: String(albumOidMaybe) };
                  }
                  await artistsCol2.updateOne(match, updateOps);
                }
              } catch (eArtistSongsRetry) {
                console.warn('[Artists] retry: failed to add song/album to artist arrays', eArtistSongsRetry?.message || eArtistSongsRetry);
              }
            }
          }
        } catch (eref2) {
          console.warn('[Reviews] Retry path: failed to add media review reference', eref2?.message || eref2);
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
    
    // If no document was found/deleted, return deleted: false
    if (!deletedDoc) {
      return res.json({ ok: true, deleted: false });
    }

    // Document was successfully deleted - clean up references
    try {
      const usersCol = db.Users.collection();
      await usersCol.updateOne(
        { _id: new ObjectId(userOid) },
        { $pull: { reviewIds: deletedDoc._id } }
      );
    } catch (e) {
      console.warn('[Reviews] Failed to pull reviewId from user profile on delete', e?.message || e);
    }

    // Also remove reference from corresponding media document
    try {
      const reviewIdStr = deletedDoc?._id?.toString?.();
      if (reviewIdStr) {
        if (type === 'artist') {
          const artistsCol = db.Artists.collection();
          await artistsCol.updateOne(
            { $or: [{ spotifyArtistId: oid }, { oid }] },
            { $pull: { reviews: { review_oid: reviewIdStr, user_oid: userOid } }, $set: { updatedAt: new Date().toISOString() } },
          );
        } else if (type === 'album') {
          const albumsCol = db.Albums.collection();
          await albumsCol.updateOne(
            { spotifyAlbumId: oid },
            { $pull: { reviews: { review_oid: reviewIdStr, user_oid: userOid } } },
          );
        } else if (type === 'song') {
          const songsCol = db.Songs.collection();
          await songsCol.updateOne(
            { spotifyTrackID: oid },
            { $pull: { reviews: { review_oid: reviewIdStr, user_oid: userOid } } },
          );
        }
      }
    } catch (eref) {
      console.warn('[Reviews] Failed to remove media review reference on delete', eref?.message || eref);
    }
    
    // Return deleted: true since we successfully deleted the document
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
    const query = { 'user.oid': userOid, 'item.type': type, 'item.oid': oid };
    const doc = await reviews.findOne(query);
    try {
      console.log('[Reviews][my][DEBUG] query=', query, 'found=', !!doc, 'id=', doc?._id?.toString?.() || null);
    } catch {}
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
      .project({ item: 1, text: 1, rating: 1, createdAt: 1, updatedAt: 1, trackRatings: 1 })
      .sort({ updatedAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit);

    const docs = await cursor.toArray();
    if (!docs.length) return res.json({ ok: true, total: 0, items: [], nextOffset: null });

    const items = docs.map(d => {
      const type = d?.item?.type;
      const id = d?.item?.oid;
      const rating = typeof d.rating === 'number' ? d.rating / 2 : 0;
      const trackRatings = d.trackRatings || null;

      return {
        id: d._id?.toString?.(),
        type,
        oid: id,
        rating,
        text: d.text || '',
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
        trackRatings, // Include individual track ratings for albums
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

// Get top-level artist data (public)
app.get('/api/artists/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== 'string') return res.status(400).json({ ok: false, error: 'invalid_artist' });
    const artistsCol = db.Artists.collection();
    // Artists are uniquely identified by their spotifyArtistId for external calls
    const artist = await artistsCol.findOne({ spotifyArtistId: id }, { projection: { _id: 0 } });
    return res.json({ ok: true, data: artist || null });
  } catch (e) {
    console.error('[Artists] get saved artist error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Return saved album document if present (prefer this before hitting Spotify)
app.get('/api/albums/:id', async (req, res) => {
  try {
    const id = req.params.id;
    if (!id || typeof id !== 'string') return res.status(400).json({ ok: false, error: 'invalid_album' });
    const albumsCol = db.Albums.collection();
    // Stored by spotifyAlbumId
    const album = await albumsCol.findOne({ spotifyAlbumId: id }, { projection: { _id: 0 } });
    return res.json({ ok: true, data: album || null });
  } catch (e) {
    console.error('[Albums] get saved album error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Get a single review by ID (public)
app.get('/api/reviews/:reviewId', async (req, res) => {
  try {
    const { reviewId } = req.params;
    if (!reviewId || !ObjectId.isValid(reviewId)) {
      return res.status(400).json({ ok: false, error: 'invalid_review_id' });
    }

    const reviewsCol = db.Reviews.collection();
    const usersCol = db.Users.collection();

    const review = await reviewsCol.findOne({ _id: new ObjectId(reviewId) });
    if (!review) return res.status(404).json({ ok: false, error: 'review_not_found' });

    // Fetch user info
    const userDoc = review.user?.oid ? await usersCol.findOne(
      { _id: new ObjectId(review.user.oid) },
      { projection: { firstname: 1, lastname: 1, email: 1 } }
    ) : null;
    const userName = userDoc ? [userDoc.firstname, userDoc.lastname].filter(Boolean).join(' ') || userDoc.email : 'Anonymous';

    // Fetch media info
    const type = review.item?.type;
    const oid = review.item?.oid;
    let media = null;

    if (type === 'song' && oid) {
      const r = await spotify.getTrack(oid);
      const t = r?.data;
      if (t) {
        media = {
          title: t.name,
          coverArt: t.album?.images?.[0]?.url,
          route: `/song/${t.id}`,
        };
      }
    } else if (type === 'album' && oid) {
      const r = await spotify.getAlbum(oid);
      const a = r?.data;
      if (a) {
        media = {
          title: a.name,
          coverArt: a.images?.[0]?.url,
          route: `/album/${a.id}`,
        };
      }
    } else if (type === 'artist' && oid) {
      const r = await spotify.getArtist(oid);
      const a = r?.data;
      if (a) {
        media = {
          title: a.name,
          coverArt: a.images?.[0]?.url,
          route: `/artist/${a.id}`,
        };
      }
    }

    const reviewData = {
      id: review._id.toString(),
      type,
      oid,
      rating: typeof review.rating === 'number' ? review.rating / 2 : 0,
      text: review.text || '',
      createdAt: review.createdAt,
      updatedAt: review.updatedAt,
      userName,
      media,
    };

    return res.json({ ok: true, review: reviewData });
  } catch (e) {
    console.error('[Reviews] get review by id error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// List recent reviews from all users (public, paginated)
app.get('/api/reviews/recent', async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 20, 50));
    const offset = Math.max(0, parseInt(req.query.offset, 10) || 0);

    const reviewsCol = db.Reviews.collection();
    const usersCol = db.Users.collection();

    // Fetch reviews - include all reviews (not just those with ratings > 0)
    // Sort by createdAt descending to get most recent first
    const cursor = reviewsCol
      .find({})
      .sort({ createdAt: -1, _id: -1 })
      .skip(offset)
      .limit(limit);

    const docs = await cursor.toArray();
    if (!docs.length) return res.json({ ok: true, items: [], nextOffset: null });

    // Get unique user OIDs to fetch user info
    const userOids = [...new Set(docs.map(d => d.user?.oid).filter(Boolean))];
    const users = await usersCol
      .find({ _id: { $in: userOids.map(id => new ObjectId(id)) } })
      .project({ _id: 1, firstname: 1, lastname: 1, email: 1 })
      .toArray();
    const userMap = new Map(users.map(u => [u._id.toString(), u]));

    // Collect media IDs
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

      const userDoc = userMap.get(d.user?.oid);
      const userName = userDoc ? [userDoc.firstname, userDoc.lastname].filter(Boolean).join(' ') || userDoc.email : 'Anonymous';

      return {
        id: d._id?.toString?.(),
        type,
        oid: id,
        rating: typeof d.rating === 'number' ? d.rating / 2 : 0,
        text: d.text || '',
        createdAt: d.createdAt || d.updatedAt || new Date().toISOString(),
        updatedAt: d.updatedAt || d.createdAt || new Date().toISOString(),
        userName,
        media,
      };
    });

    const nextOffset = items.length < limit ? null : offset + items.length;
    return res.json({ ok: true, items, nextOffset });
  } catch (e) {
    console.error('[Reviews] recent reviews error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Debug: fetch raw review doc for current user & item (no media mutations)
app.get('/api/reviews/debug/find', async (req, res) => {
  try {
    const userOid = req.session?.user?.oid;
    if (!userOid) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const { type, oid } = req.query || {};
    const allowed = new Set(['song', 'album', 'artist']);
    if (!allowed.has(String(type))) return res.status(400).json({ ok: false, error: 'invalid_type' });
    if (!oid || typeof oid !== 'string') return res.status(400).json({ ok: false, error: 'invalid_oid' });
    const reviewsCol = db.Reviews.collection();
    const doc = await reviewsCol.findOne({ 'user.oid': userOid, 'item.type': type, 'item.oid': oid });
    return res.json({ ok: true, found: !!doc, doc });
  } catch (e) {
    console.error('[Reviews][debug/find] error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});

// Debug: list all reviews for current user (raw docs)
app.get('/api/reviews/debug/list', async (req, res) => {
  try {
    const userOid = req.session?.user?.oid;
    if (!userOid) return res.status(401).json({ ok: false, error: 'unauthorized' });
    const reviewsCol = db.Reviews.collection();
    const cursor = reviewsCol.find({ 'user.oid': userOid }).project({ text: 1, rating: 1, item: 1, type: 1, itemType: 1, createdAt: 1, updatedAt: 1 });
    const docs = await cursor.toArray();
    return res.json({ ok: true, count: docs.length, docs });
  } catch (e) {
    console.error('[Reviews][debug/list] error', e);
    return res.status(500).json({ ok: false, error: 'server_error' });
  }
});