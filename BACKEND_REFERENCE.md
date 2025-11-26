# HearSay Backend API Reference

**Technology Stack:** Node.js + Express, MongoDB, Session-based Authentication

---

## Architecture Overview

The backend (`/server/index.js`) serves as a proxy between the frontend and external APIs (Google OAuth, Spotify), manages user sessions in MongoDB, and stores user-generated content (reviews, ratings). All endpoints use JSON, credentials are handled via httpOnly session cookies, and CORS is configured for the frontend origin.

---

## Endpoint Groups

### 1. **Health & Utility**
- **`GET /api/health`** — Health check; returns `{ ok: true }`
- **`GET /api/test`** — Database connectivity test; pings MongoDB
- **`GET /api/debug/routes`** — Lists all registered routes (methods and paths)

### 2. **Session Management**
- **`GET /api/me`** — Returns current authenticated user from session or `null`
- **`GET /api/session`** — Ensures session exists; returns session metadata (includes visit count)
- **`POST /api/logout`** — Destroys session (logout); returns `{ ok: true }`

**Data Flow:** Sessions stored in MongoDB (`expressSessions` collection) with TTL; session ID rotated every `SESSION_ROTATE_MS` to prevent fixation.

---

### 3. **Authentication**

#### **Google OAuth2**
- **`POST /api/auth/google/exchange`**
  - **Purpose:** Exchange Google authorization code for user tokens and upsert user profile
  - **Requires:** `{ code, redirect_uri, code_verifier }` (PKCE)
  - **Returns:** `{ ok: true, user: { name, email, picture, firstname, lastname, ... } }`
  - **Side Effects:** Creates/updates user in `Users` collection; sets session cookie; stores OAuth tokens in session

**Flow:** Frontend redirects to Google → Google redirects to `/auth/callback` with code → Frontend posts code to this endpoint → Backend exchanges code for tokens, verifies JWT, upserts user, creates session.

#### **Local Authentication (Email + Password)**
- **`POST /api/auth/local/signup`**
  - **Purpose:** Create new local account or link password to existing Google-only account
  - **Requires:** `{ email, password }` (password min 6 chars)
  - **Returns:** `{ ok: true, user: { ... }, linked: boolean, created: boolean }`
  - **Side Effects:** Hashes password with bcrypt; creates user doc or adds Local account to existing user

- **`POST /api/auth/local/login`**
  - **Purpose:** Authenticate user with email and password
  - **Requires:** `{ email, password }`
  - **Returns:** `{ ok: true, user: { ... } }`
  - **Side Effects:** Sets session cookie on successful authentication

- **`POST /api/auth/local/set-password`**
  - **Purpose:** Set or change password for currently logged-in user
  - **Requires:** Session + `{ password }` (min 6 chars)
  - **Returns:** `{ ok: true, linked: true }`
  - **Side Effects:** Adds Local account type to user if not present

---

### 4. **User Profile**
- **`GET /api/profile`**
  - **Purpose:** Fetch current user's full profile from DB
  - **Requires:** Authenticated session
  - **Returns:** `{ ok: true, profile: { _id, email, firstname, lastname, name, picture, accounts: [{ kind }] } }`
  - **Note:** `name` and `picture` come from session (Google OAuth), accounts array only shows kinds (Google/Local)

- **`POST /api/profile/update`**
  - **Purpose:** Update user's firstname and lastname
  - **Requires:** Authenticated session + `{ firstname?, lastname? }` (max 100 chars each)
  - **Returns:** `{ ok: true, profile: { _id, email, firstname, lastname, accounts } }`
  - **Side Effects:** Updates user document and session; email remains immutable

---

### 5. **Reviews & Ratings**

#### **User Reviews (Authenticated)**
All require authentication (session cookie).

- **`POST /api/reviews/upsert`**
  - **Purpose:** Create or update a review/rating for a song, album, or artist
  - **Body:** `{ type: 'song'|'album'|'artist', oid: '<spotify_id>', rating?: 0.5-5 (0.5 increments), text?: string (max 1000 words), trackRatings?: object }`
  - **Returns:** `{ ok: true, review: { _id, user: { oid }, item: { type, oid }, rating, text, trackRatings?, createdAt, updatedAt, likes, dislikes, comments } }`
  - **Side Effects:** 
    - Ensures artist/album/song document exists in DB with full metadata from Spotify
    - Adds review reference to media document
    - Adds reviewId to user's profile
    - For albums: backfills album.songs[] array and creates missing track documents
    - For songs: adds song to album.songs[] and artist.songs[]/albums[] arrays
    - Ratings stored as Int32 (value * 2) internally; returned as 0.5-5 scale
  - **Unique Constraint:** One review per user per item (enforced by compound index on user.oid + item.type + item.oid)

- **`GET /api/reviews/my?type=<type>&oid=<id>`**
  - **Purpose:** Get current user's review for a specific item
  - **Returns:** `{ ok: true, review: { _id, user, item, rating, text, trackRatings?, createdAt, updatedAt } }` or `{ ok: true, review: null }`

- **`DELETE /api/reviews/my?type=<type>&oid=<id>`**
  - **Purpose:** Delete current user's review for a specific item
  - **Returns:** `{ ok: true, deleted: true }` or `{ ok: true, deleted: false }` if not found
  - **Side Effects:** Removes reviewId from user profile; removes review reference from media document

- **`GET /api/reviews/my/list?limit=<n>&offset=<n>`**
  - **Purpose:** Paginated list of all reviews by current user (newest first)
  - **Returns:** `{ ok: true, items: [{ id, type, oid, rating, text, trackRatings?, createdAt, updatedAt }], nextOffset: <number|null> }`
  - **Limits:** limit max 20, default 5

#### **Public Reviews**
- **`GET /api/reviews/recent?limit=<n>&offset=<n>&type=<song|album|artist>`**
  - **Purpose:** Get recent reviews from all users (public feed)
  - **Query Params:** `limit` (1-50, default 20), `offset` (default 0), `type` (optional filter)
  - **Returns:** `{ ok: true, items: [{ id, type, oid, rating, text, createdAt, updatedAt, userName, media: { title, coverArt, route } }], nextOffset: <number|null> }`
  - **Note:** Fetches media metadata from DB first, falls back to Spotify API; userName derived from user firstname/lastname/email

- **`GET /api/reviews/:reviewId`**
  - **Purpose:** Get a single review by its MongoDB ObjectId (public)
  - **Returns:** `{ ok: true, review: { id, type, oid, rating, text, createdAt, updatedAt, userName, userOid, canEdit: boolean, media: { title, coverArt, route } } }`
  - **Note:** `canEdit` is true only if current session user matches review author

#### **Debug Endpoints**
- **`GET /api/reviews/debug/find?type=<>&oid=<>`** — Raw review doc for current user + item
- **`GET /api/reviews/debug/list`** — All raw review docs for current user

---

### 6. **Spotify Proxy Endpoints**
All Spotify endpoints use server-side app access token (client credentials flow cached in memory). Token automatically refreshed when expired.

- **`GET /api/spotify/search?q=<query>&type=<type>&limit=<n>&market=<code>`**
  - Proxies Spotify search API; returns artists/albums/tracks matching query
  - Default: `type=track`, `limit=10`

- **`GET /api/spotify/track/:id`** — Get track details by Spotify ID
- **`GET /api/spotify/tracks?ids=<comma_separated>&market=<code>`** — Batch fetch tracks (up to 50 per request, auto-chunks larger requests)
- **`GET /api/spotify/album/:id`** — Get album details (includes tracks)
- **`GET /api/spotify/albums?ids=<comma_separated>&market=<code>`** — Batch fetch albums (up to 20 per request, auto-chunks larger requests)
- **`GET /api/spotify/artist/:id`** — Get artist details
- **`GET /api/spotify/artist/:id/albums?include_groups=<types>&limit=<n>&market=<code>`** — Artist's discography
  - Default: `include_groups=album,single`, `limit=50`
- **`GET /api/spotify/new-releases?country=<code>&limit=<n>`** — New album releases
  - Default: `country=US`, `limit=50`
- **`GET /api/spotify/recommendations?seed_*=<...>&limit=<n>&market=<code>`** — Recommendations based on seeds
  - Default seeds: `seed_genres=pop,rock` if none provided

**Debug:**
- **`GET /api/spotify/debug/token`** — View cached token status and test with lightweight Spotify request

**Authentication:** Server holds Spotify client secret; frontend never sees it. Token refreshed automatically when expired.

---

### 7. **Database Cache Endpoints**
These endpoints return data from MongoDB (not Spotify API), reducing external API calls.

- **`GET /api/artists/:id`**
  - **Purpose:** Fetch artist document from DB by Spotify artist ID
  - **Returns:** `{ ok: true, data: { name, image, followers, genres, popularity, spotifyUrl, spotifyArtistId, likes, dislikes, rating, reviews: [{ review_oid, user_oid }], albums: [{ name, oid }], songs: [{ name, oid }], createdAt, updatedAt } }` or `{ ok: true, data: null }`
  - **Note:** Returns null if not in cache; artist docs created automatically on first review

- **`GET /api/albums/:id`**
  - **Purpose:** Fetch album document from DB by Spotify album ID
  - **Returns:** `{ ok: true, data: { name, spotifyAlbumId, artist: { name, oid }, genre, likes, dislikes, rating, releaseDate, image, songs: [{ name, oid }], reviews: [{ review_oid, user_oid }], createdAt, updatedAt } }` or `{ ok: true, data: null }`
  - **Note:** Album docs created automatically on first review; songs array populated from Spotify API tracks

---

## Database Collections

| Collection | Purpose | Key Fields |
|------------|---------|------------|
| `Users` | User profiles (Google/Local auth) | `email` (unique), `firstname`, `lastname`, `accounts: [{ kind, uid }]`, `passwordHash` (Local auth only), `reviewIds` (references to user's reviews) |
| `Reviews` | User reviews/ratings | `user: { oid }`, `item: { type, oid }`, `rating` (Int32, doubled), `text` (max 1000 words), `trackRatings` (album track ratings), `likes`, `dislikes`, `comments`, `createdAt`, `updatedAt`; **Unique index:** `user.oid + item.type + item.oid` |
| `Artists` | Cached artist metadata | `spotifyArtistId` (unique), `name`, `image`, `followers`, `genres`, `popularity`, `spotifyUrl`, `reviews: [{ review_oid, user_oid }]`, `albums: [{ name, oid }]`, `songs: [{ name, oid }]`, `likes`, `dislikes`, `rating` |
| `Albums` | Cached album metadata | `spotifyAlbumId` (unique), `name`, `artist: { name, oid }`, `genre`, `releaseDate`, `image`, `songs: [{ name, oid }]`, `reviews: [{ review_oid, user_oid }]`, `likes`, `dislikes`, `rating` |
| `Songs` | Cached song metadata | `spotifyTrackID` (unique), `title`, `date`, `genres`, `image`, `artist: { name, oid, spotifyArtistId }`, `album: { name, oid, spotifyAlbumId }`, `reviews: [{ review_oid, user_oid }]`, `likes`, `dislikes`, `rating` |
| `expressSessions` | Session storage (managed by `connect-mongo`) | `expires`, `session` (contains user, oauth, visits, createdAt) |

**Indexes:**
- `Users`: unique on `email` (if string), unique on `accounts.kind + accounts.uid` (if string)
- `Reviews`: unique on `user.oid + item.type + item.oid` (if string)
- `Artists`, `Albums`, `Songs`: unique on respective Spotify ID fields

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
# Node Environment
NODE_ENV=development  # or 'production'

# Google OAuth
GOOGLE_CLIENT_ID=<your_google_client_id>
GOOGLE_CLIENT_SECRET=<your_google_client_secret>

# Spotify API (server-side only)
SPOTIFY_CLIENT_ID=<your_spotify_client_id>
SPOTIFY_CLIENT_SECRET=<your_spotify_client_secret>

# MongoDB Connection
MONGO_URI=mongodb://user:pass@host:port/?authSource=admin  # Full URI (preferred)
# OR individual components:
MONGO_USERNAME=<db_user>
MONGO_PASSWORD=<db_password>
MONGO_HOST=localhost
MONGO_PORT=27017
MONGO_PROTOCOL=mongodb  # or mongodb+srv
MONGO_AUTH_SOURCE=admin
MONGO_DB_NAME=HearSay

# Session Configuration
SESSION_SECRET=<random_secret_string>  # Auto-generated if not provided (non-persistent)
SESSION_NAME=hsid  # Cookie name
SESSION_TTL_SECONDS=3600  # 1 hour
SESSION_ROTATE_MS=3600000  # Session ID rotation interval (1 hour)
SESSIONS_COLLECTION=expressSessions

# CORS & Origin
API_ORIGIN=http://localhost:5173,http://127.0.0.1:5173  # Comma-separated allowed origins (dev auto-allows all)

# Server
PORT=5174  # Backend port

# Local Auth
BCRYPT_ROUNDS=12  # Password hashing cost factor
```

**Fallback Logic:**
- Server tries both `VARIABLE` and `VITE_VARIABLE` formats (for legacy compatibility)
- MongoDB can use explicit `MONGO_URI` or construct from components
- `NODE_ENV !== 'production'` → dev mode (relaxed CORS, auto-allowed origins)
- Missing `SESSION_SECRET` → generates random secret (sessions won't persist across restarts)

---

## Security Features

- **PKCE Flow:** Google OAuth uses PKCE (code verifier stored client-side, never sent to backend until exchange)
- **Password Hashing:** bcrypt with configurable cost factor (default 12 rounds)
- **httpOnly Cookies:** Session ID not accessible via JavaScript
- **Session Security:** 
  - Secure flag enabled in production
  - SameSite=lax for both dev and production
  - Session ID regenerated every `SESSION_ROTATE_MS` to prevent fixation
  - Session data stored in MongoDB with TTL auto-expiry
- **CORS:** 
  - Development: allows all origins (logged for debugging)
  - Production: strict whitelist from `API_ORIGIN` env var
  - Credentials must be included for all authenticated requests
- **Proxy Pattern:** 
  - Spotify app token lives server-side only; users never see credentials
  - All Spotify requests proxied through backend
- **Input Validation:**
  - Email format validation
  - Password minimum length (6 chars)
  - Review text max 1000 words
  - Profile field length limits (100 chars)
- **Sensitive Data Logging:** Password/token fields masked in request logs
- **Unique Constraints:** Prevent duplicate users (email, account kind+uid) and duplicate reviews (user+item)
