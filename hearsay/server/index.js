import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// Load .env in development so server can read GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5174;

app.use(cors({ origin: true }));
app.use(express.json());

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

    return res.json(data);
  } catch (err) {
    console.error('Exchange error', err);
    return res.status(500).json({ error: 'exchange_failed', message: String(err) });
  }
});

app.listen(PORT, () => {
  console.log(`Google auth proxy listening on http://localhost:${PORT}`);
});
