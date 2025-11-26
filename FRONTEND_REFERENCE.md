# HearSay Frontend Reference

**Technology Stack:** React + Vite, React Router, Tailwind CSS, Context API (Theme, Toast, Auth)

---

## Architecture Overview

The frontend is a single-page React app (`/hearsay/src`) that communicates with the backend via fetch requests (credentials included). Users authenticate via Google OAuth, browse Spotify music catalog, and write reviews/ratings. All API calls go through thin wrapper functions in `/src/config/` (spotify.js, reviews.js). Session state is managed via backend cookies; UI state uses React hooks and Context.

---

## Page Components & Functionality

### 1. **LandingPage** (`/`)
- **Purpose:** Home page showing popular albums and songs
- **Data Sources:**
  - Backend: `/api/spotify/new-releases` (albums), `/api/spotify/search` (tracks)
  - User selects locale (country code) → stored in localStorage → passed to Spotify requests
- **Features:**
  - Locale filter dropdown (persists choice)
  - Refresh button to fetch new random items
  - Click album/song → navigate to rating page
- **API Calls:** `getSpotifyNewReleases()`, `searchSpotify()` with year filter

---

### 2. **SearchPage** (`/search?q=<query>`)
- **Purpose:** Search for artists, albums, tracks by keyword
- **Data Sources:** Backend `/api/spotify/search?q=<query>&type=artist,album,track`
- **Features:**
  - Search bar in Header → redirects here with query param
  - Results grouped by type (artists, albums, tracks)
  - "Show All" toggle to expand beyond initial 10 results
  - Click result → navigate to artist/album/song page
- **API Calls:** `searchSpotify(query, 'artist,album,track')`

---

### 3. **ArtistPage** (`/artist/:artistId`)
- **Purpose:** View artist bio, top songs, albums, and write/edit artist review
- **Data Sources:**
  - Backend: `/api/spotify/artist/:id`, `/api/spotify/artist/:id/albums`, `/api/artists/:id` (cached)
  - Reviews: `/api/reviews/my?type=artist&oid=<id>`, `/api/reviews/upsert`
- **Features:**
  - Displays artist image, genres, follower count
  - Lists top tracks (playable links to Spotify)
  - Shows albums and singles (navigate to album page on click)
  - Review section: text (1000 word limit) + 1-5 star rating
  - Edit/delete review if already exists
- **API Calls:** `getSpotifyArtist()`, `getSpotifyArtistAlbums()`, `getMyReview()`, `upsertReview()`, `deleteMyReview()`

---

### 4. **AlbumRatingPage** (`/album/:albumId`)
- **Purpose:** View album details, tracks, and write/edit album review
- **Data Sources:**
  - Backend: `/api/spotify/album/:id`, `/api/spotify/albums?ids=<...>` (related albums)
  - Reviews: `/api/reviews/my?type=album&oid=<id>`, `/api/reviews/upsert`
- **Features:**
  - Displays album cover, artist, release date, track list (with durations)
  - Review section: text (1000 word limit) + 1-5 star rating
  - Edit/delete review if already exists
  - Shows related albums (artist's other releases)
  - Click track → navigate to song page
- **API Calls:** `getSpotifyAlbum()`, `getSpotifyAlbums()`, `getMyReview()`, `upsertReview()`, `deleteMyReview()`

---

### 5. **SongRatingPage** (`/song/:songId`)
- **Purpose:** View song details and write/edit song review
- **Data Sources:**
  - Backend: `/api/spotify/track/:id`
  - Reviews: `/api/reviews/my?type=song&oid=<id>`, `/api/reviews/upsert`
- **Features:**
  - Displays track cover, artist, album, duration, preview URL (if available)
  - Review section: text (1000 word limit) + 1-5 star rating
  - Edit/delete review if already exists
  - Click album/artist → navigate to respective page
- **API Calls:** `getSpotifyTrack()`, `getMyReview()`, `upsertReview()`, `deleteMyReview()`

---

### 6. **MyReviewsPage** (`/my-reviews`) **[Protected Route]**
- **Purpose:** View and manage all reviews written by current user (paginated)
- **Data Sources:** Backend `/api/reviews/my/list?limit=5&offset=<n>`
- **Features:**
  - Lists reviews sorted newest-first (song/album/artist)
  - Inline edit: update review text or rating
  - Load more button (pagination)
  - Shows item thumbnail, title, artist, user's rating/text
- **API Calls:** `listMyReviews()`, `upsertReview()` (on edit)

---

### 7. **ProfilePage** (`/profile`) **[Protected Route]**
- **Purpose:** View current user's profile details
- **Data Sources:** Backend `/api/profile`
- **Features:**
  - Displays user's email, name, profile picture (from Google)
  - Shows linked accounts (e.g., Google)
  - Future: edit profile, link/unlink accounts
- **API Calls:** `fetch('/api/profile')`

---

### 8. **AuthPage** (`/auth`)
- **Purpose:** Initiate Google OAuth login flow
- **Flow:**
  1. User clicks "Login with Google" button
  2. Generate PKCE code verifier → store in localStorage
  3. Redirect to Google OAuth URL with code challenge
  4. Google redirects to `/auth/callback` with authorization code
- **No Backend Calls:** Pure client-side redirect logic

---

### 9. **AuthCallback** (`/auth/callback`)
- **Purpose:** Handle OAuth callback and exchange code for session
- **Flow:**
  1. Extract `code` from URL query params
  2. Retrieve PKCE verifier from localStorage
  3. POST to `/api/auth/google/exchange` with `{ code, redirect_uri, code_verifier }`
  4. Backend sets session cookie, returns user profile
  5. Store user in localStorage for UI convenience
  6. Emit auth event → update Header state
  7. Redirect to home page
- **API Calls:** `fetch('/api/auth/google/exchange', { method: 'POST', body: { code, ... } })`

---

### 10. **RandomPage** (`/random`)
- **Purpose:** Display a random song, album, or artist (future feature placeholder)
- **Status:** Not fully implemented yet

---

## Shared Components

### **Header**
- **Purpose:** Global navigation bar
- **Features:**
  - Logo (click → home)
  - Search bar → redirects to `/search?q=<query>`
  - Theme toggle (light/dark mode via ThemeContext)
  - User menu (shows profile picture if logged in, login button if not)
  - Logout button (calls `/api/logout` → redirects home)
  - Mobile hamburger menu
- **API Calls:** `fetch('/api/me')` on mount, `fetch('/api/logout')` on logout

### **ProtectedRoute**
- **Purpose:** Wrapper component that checks authentication before rendering child
- **Logic:**
  - Calls `/api/me` to verify session
  - If authenticated → render child
  - If not → redirect to `/auth`
- **Used For:** `/my-reviews`, `/profile`

---

## API Client Wrappers

### **`/src/config/spotify.js`**
All functions call backend Spotify proxy endpoints (not Spotify directly):
- `searchSpotify(q, type, limit, market)` → `/api/spotify/search`
- `getSpotifyTrack(id)` → `/api/spotify/track/:id`
- `getSpotifyAlbum(id)` → `/api/spotify/album/:id`
- `getSpotifyAlbums(ids, market)` → `/api/spotify/albums?ids=<...>`
- `getSpotifyArtist(id)` → `/api/spotify/artist/:id`
- `getSpotifyArtistAlbums(id, params)` → `/api/spotify/artist/:id/albums`
- `getSpotifyNewReleases(params)` → `/api/spotify/new-releases`
- `getSavedArtist(id)` → `/api/artists/:id` (DB cache)

### **`/src/config/reviews.js`**
All functions call backend review endpoints:
- `upsertReview({ type, oid, rating, text })` → `POST /api/reviews/upsert`
- `getMyReview(type, oid)` → `GET /api/reviews/my?type=<>&oid=<>`
- `deleteMyReview(type, oid)` → `DELETE /api/reviews/my?type=<>&oid=<>`
- `listMyReviews({ limit, offset })` → `GET /api/reviews/my/list?limit=<>&offset=<>`

---

## State Management

### **Context Providers** (wrap entire app in `/src/main.jsx`)
1. **ThemeContext** (`/src/context/ThemeContext.jsx`)
   - Manages light/dark theme (stored in localStorage)
   - Provides `{ theme, toggleTheme }` to all components

2. **ToastContext** (`/src/context/ToastContext.jsx`)
   - Displays temporary success/error notifications
   - Provides `{ success, error }` functions to all components

3. **Auth State** (via custom event bus `authBus.js`)
   - `emitAuthChange({ authenticated, user })` → notify Header/ProtectedRoute
   - Allows decoupled auth state updates (login/logout from anywhere)

---

## Routing

| Route | Component | Protected? | Purpose |
|-------|-----------|------------|---------|
| `/` | LandingPage | No | Home page with popular music |
| `/search` | SearchPage | No | Search results |
| `/artist/:artistId` | ArtistPage | No | Artist details + review |
| `/album/:albumId` | AlbumRatingPage | No | Album details + review |
| `/song/:songId` | SongRatingPage | No | Song details + review |
| `/my-reviews` | MyReviewsPage | **Yes** | User's review history |
| `/profile` | ProfilePage | **Yes** | User profile |
| `/random` | RandomPage | No | Random item (WIP) |
| `/auth` | AuthPage | No | Google OAuth login |
| `/auth/callback` | AuthCallback | No | OAuth redirect handler |

---

## Key User Flows

### **Login Flow**
1. User clicks "Login" in Header
2. Redirect to `/auth` → click "Login with Google"
3. Generate PKCE verifier → redirect to Google
4. Google redirects to `/auth/callback?code=<...>`
5. Frontend POSTs code to `/api/auth/google/exchange`
6. Backend sets session cookie → returns user profile
7. Frontend stores user → redirects to `/`

### **Write Review Flow**
1. User navigates to artist/album/song page
2. If logged in, review section is functional
3. User enters text (word count enforced) and/or rating (1-5 stars)
4. Click "Submit" → `POST /api/reviews/upsert` with `{ type, oid, rating, text }`
5. Backend upserts review (unique per user+item)
6. UI shows "saved" state → review displayed

### **Edit/Delete Review Flow**
1. Page loads existing review via `GET /api/reviews/my?type=<>&oid=<>`
2. If review exists, show "Edit" button
3. User clicks Edit → text/rating become editable
4. User modifies → click "Save" → `POST /api/reviews/upsert` (update)
5. User clicks Delete → confirm → `DELETE /api/reviews/my?type=<>&oid=<>`

---

## Environment Variables (Frontend)

```bash
# Google OAuth (public client ID only)
VITE_GOOGLE_CLIENT_ID=<your_google_client_id>
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback

# Spotify (not used client-side; backend proxies all requests)
# VITE_SPOTIFY_CLIENT_ID=<...> (optional; backend prefers non-VITE vars)
```

---

## Styling & UI

- **Framework:** Tailwind CSS (utility-first)
- **Theme:** Dark mode support via ThemeContext (toggles `dark:` classes)
- **Cards:** Black background with white text (albums/songs on landing page)
- **Forms:** Review text areas with word count, star rating pickers
- **Responsive:** Mobile-friendly (hamburger menu, responsive grid layouts)

---

## Error Handling

- **401 Unauthorized:** Redirect to `/auth` (handled by ProtectedRoute and fetch wrappers)
- **Network Errors:** Show toast notification with error message
- **Empty States:** "No results found" messages on search/list pages
- **Loading States:** Skeleton loaders or "Loading..." messages while fetching data
