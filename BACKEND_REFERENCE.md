# HearSay Backend API Reference

**Technology Stack:** Node.js + Express, MongoDB, Session-based Authentication

---

## Architecture Overview

The backend (`/server/index.js`) serves as a proxy between the frontend and external APIs (Google OAuth, Spotify), manages user sessions in MongoDB, and stores user-generated content (reviews, ratings). All endpoints use JSON, credentials are handled via httpOnly session cookies, and CORS is configured for the frontend origin.

---

## Endpoint Groups

### 1. **Health & Utility**
- **`GET /`** — Health check; returns `{ ok: true }`
- **`GET /api/test`** — Database connectivity test; pings MongoDB

### 2. **Session Management**
- **`GET /api/me`** — Returns current authenticated user from session or `null`
- **`GET /api/session`** — Ensures session exists; returns session metadata
- **`POST /api/logout`** — Destroys session (logout); returns `{ ok: true }`

**Data Flow:** Sessions stored in MongoDB (`expressSessions` collection) with TTL; session ID rotated every `SESSION_ROTATE_MS` to prevent fixation.

---

### 3. **Authentication (Google OAuth2)**
- **`POST /api/auth/google/exchange`**
  - **Purpose:** Exchange Google authorization code for user tokens and upsert user profile
  - **Requires:** `{ code, redirect_uri, code_verifier }` (PKCE)
  - **Returns:** `{ ok: true, user: { name, email, picture, ... } }`
  - **Side Effects:** Creates/updates user in `Users` collection; sets session cookie

**Flow:** Frontend redirects to Google → Google redirects to `/auth/callback` with code → Frontend posts code to this endpoint → Backend exchanges code for tokens, verifies JWT, upserts user, creates session.

---

### 4. **User Profile**
- **`GET /api/profile`**
  - **Purpose:** Fetch current user's full profile from DB
  - **Requires:** Authenticated session
  - **Returns:** `{ ok: true, profile: { _id, email, firstname, lastname, accounts, ... } }`

---

### 5. **Reviews & Ratings**
All review endpoints require authentication (session cookie).

- **`POST /api/reviews/upsert`**
  - **Purpose:** Create or update a review/rating for a song, album, or artist
  - **Body:** `{ type: 'song'|'album'|'artist', oid: '<spotify_id>', rating?: 1-5, text?: string }`
  - **Returns:** `{ ok: true, review: { _id, userId, type, oid, rating, text, createdAt, updatedAt } }`
  - **Unique Constraint:** One review per user per item (enforced by compound index)

- **`GET /api/reviews/my?type=<type>&oid=<id>`**
  - **Purpose:** Get current user's review for a specific item
  - **Returns:** `{ ok: true, review: { ... } }` or `{ ok: true, review: null }` if not found

- **`DELETE /api/reviews/my?type=<type>&oid=<id>`**
  - **Purpose:** Delete current user's review for a specific item
  - **Returns:** `{ ok: true, deleted: true }`

- **`GET /api/reviews/my/list?limit=<n>&offset=<n>`**
  - **Purpose:** Paginated list of all reviews by current user (newest first)
  - **Returns:** `{ ok: true, items: [...], nextOffset: <number> }`

---

### 6. **Spotify Proxy Endpoints**
All Spotify endpoints use server-side app access token (client credentials flow cached in memory).

- **`GET /api/spotify/search?q=<query>&type=<type>&limit=<n>&market=<code>`**
  - Proxies Spotify search API; returns artists/albums/tracks matching query

- **`GET /api/spotify/track/:id`** — Get track details by Spotify ID
- **`GET /api/spotify/album/:id`** — Get album details (includes tracks)
- **`GET /api/spotify/albums?ids=<comma_separated>&market=<code>`** — Batch fetch albums
- **`GET /api/spotify/artist/:id`** — Get artist details
- **`GET /api/spotify/artist/:id/albums?include_groups=<types>&limit=<n>&market=<code>`** — Artist's discography
- **`GET /api/spotify/new-releases?country=<code>&limit=<n>`** — New album releases
- **`GET /api/spotify/recommendations?seed_*=<...>&limit=<n>&market=<code>`** — Recommendations based on seeds

**Authentication:** Server holds Spotify client secret; frontend never sees it. Token refreshed automatically when expired.

---

### 7. **Saved Artists (Database Cache)**
- **`GET /api/artists/:id`**
  - **Purpose:** Fetch artist from DB cache or fetch from Spotify and cache
  - **Returns:** `{ ok: true, data: { _id, name, genres, ... } }`
  - **Use Case:** Reduces Spotify API calls for frequently accessed artists

---

## Database Collections

| Collection | Purpose |
|------------|---------|
| `Users` | User profiles (Google OAuth linked accounts, email, name) |
| `Reviews` | User reviews/ratings (song/album/artist); unique index on `{ userId, type, oid }` |
| `Albums`, `Artists`, `Songs` | Cached Spotify metadata (optional; reduces API calls) |
| `expressSessions` | Session storage (managed by `connect-mongo`) |

---

## Error Handling

- **401 Unauthorized:** Missing or invalid session
- **404 Not Found:** Resource doesn't exist (user profile, review)
- **500 Server Error:** Database or external API failure
- **429 Rate Limited:** Spotify API rate limit hit (retried automatically)

All endpoints return `{ ok: false, error: <string> }` on failure.

---

## Environment Variables (Required)

```bash
# Google OAuth
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>

# Spotify API
SPOTIFY_CLIENT_ID=<your_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<your_spotify_client_secret>

# MongoDB
MONGO_USERNAME=<db_user>
MONGO_PASSWORD=<db_password>
MONGO_HOST=127.0.0.1
MONGO_PORT=27017
MONGO_DB_NAME=HearSay

# Session
SESSION_SECRET=<random_secret_string>
SESSION_NAME=hsid
SESSION_TTL_SECONDS=3600
FRONTEND_ORIGIN=http://localhost:5173
```

---

## Security Features

- **PKCE Flow:** Google OAuth uses PKCE (code verifier stored client-side, never sent to backend until exchange)
- **httpOnly Cookies:** Session ID not accessible via JavaScript
- **Session Rotation:** Session ID regenerated periodically to prevent fixation
- **CORS:** Only frontend origin can make credentialed requests
- **No Token Exposure:** Spotify app token lives server-side only; users never see credentials
