import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { ObjectId } from 'mongodb';
import * as db from './dbAPI.js';

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