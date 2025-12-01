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

### 2. **SearchPage** (`/search?q=<query>`)
- **Purpose:** Search for artists, albums, tracks by keyword
- **Data Sources:** Backend `/api/spotify/search?q=<query>&type=artist,album,track`
- **Features:**
  - Search bar in Header → redirects here with query param
  - Results grouped by type (artists, albums, tracks)
  - "Show All" toggle to expand beyond initial 10 results
  - Click result → navigate to artist/album/song page
  - Input sanitized (max 200 chars)
- **API Calls:** `searchSpotify(query, 'artist,album,track')`

### 3. **ArtistPage** (`/artist/:artistId`)
- **Purpose:** View artist bio, top songs, albums, and write/edit artist review
- **Data Sources:**
  - Backend: `/api/spotify/artist/:id`, `/api/spotify/artist/:id/albums`, `/api/artists/:id` (cached)
  - Reviews: `/api/reviews/my?type=artist&oid=<id>`, `/api/reviews/upsert`
- **Features:**
  - Displays artist image, genres, follower count
  - Lists top tracks (playable links to Spotify)
  - Shows albums and singles (navigate to album page on click)
  - Review section: text (1000 word limit) + 0.5-5 star rating (0.5 increments)
  - Edit/delete review if already exists
- **API Calls:** `getSpotifyArtist()`, `getSpotifyArtistAlbums()`, `getMyReview()`, `upsertReview()`, `deleteMyReview()`

### 4. **AlbumRatingPage** (`/album/:albumId`)
- **Purpose:** View album details, tracks, and write/edit album review
- **Data Sources:**
  - Backend: `/api/spotify/album/:id`, `/api/spotify/albums?ids=<...>` (related albums)
  - Reviews: `/api/reviews/my?type=album&oid=<id>`, `/api/reviews/upsert`
- **Features:**
  - Displays album cover, artist, release date, track list (with durations)
  - Review section: text (1000 word limit) + 0.5-5 star rating (0.5 increments)
  - Individual track ratings (0.5-5 stars) stored in `trackRatings` object
  - Edit/delete review if already exists
  - Shows related albums (artist's other releases)
  - Click track → navigate to song page
- **API Calls:** `getSpotifyAlbum()`, `getSpotifyAlbums()`, `getMyReview()`, `upsertReview()`, `deleteMyReview()`

### 5. **SongRatingPage** (`/song/:songId`)
- **Purpose:** View song details and write/edit song review
- **Data Sources:**
  - Backend: `/api/spotify/track/:id`
  - Reviews: `/api/reviews/my?type=song&oid=<id>`, `/api/reviews/upsert`
- **Features:**
  - Displays track cover, artist, album, duration, preview URL (if available)
  - Review section: text (1000 word limit) + 0.5-5 star rating (0.5 increments)
  - Edit/delete review if already exists
  - Click album/artist → navigate to respective page
- **API Calls:** `getSpotifyTrack()`, `getMyReview()`, `upsertReview()`, `deleteMyReview()`

### 6. **MyReviewsPage** (`/my-reviews`) **[Protected Route]**
- **Purpose:** View and manage all reviews written by current user (paginated)
- **Data Sources:** Backend `/api/reviews/my/list?limit=5&offset=<n>`
- **Features:**
  - Lists reviews sorted newest-first (song/album/artist)
  - Shows item thumbnail, title, type, user's rating/text
  - Inline edit: update review text or rating
  - Load more button (pagination)
  - Displays track ratings for album reviews
- **API Calls:** `listMyReviews()`, `upsertReview()` (on edit)

### 7. **RecentReviewsPage** (`/recent-reviews`) **[Public]**
- **Purpose:** Browse recent reviews from all users (community feed)
- **Data Sources:** Backend `/api/reviews/recent?limit=5&offset=<n>&type=<song|album>`
- **Features:**
  - Two-column layout: Songs (left) | Albums (right)
  - Each review shows: cover art, title, username, rating, text preview, date
  - Click review card → navigate to full review page
  - Separate pagination for songs and albums
  - Auto-scrolling text for long reviews
- **API Calls:** `fetch('/api/reviews/recent?...')`

### 8. **ReviewPage** (`/review/:reviewId`) **[Public]**
- **Purpose:** View full details of a single review
- **Data Sources:** Backend `/api/reviews/:reviewId`
- **Features:**
  - Shows media artwork, title, type
  - Displays reviewer name, date, rating, full review text
  - Edit button (only if current user is review author)
  - Inline editing: update rating/text, save or cancel
  - Links to media page (artist/album/song)
- **API Calls:** `fetch('/api/reviews/:reviewId')`, `fetch('/api/reviews/upsert')` (on edit)

### 9. **ProfilePage** (`/profile`) **[Protected Route]**
- **Purpose:** View and edit current user's profile details
- **Data Sources:** Backend `/api/profile`, `/api/profile/update`
- **Features:**
  - Displays user's email (immutable), firstname, lastname, profile picture (from Google)
  - Shows linked accounts (Google/Local badges)
  - Edit mode: update firstname/lastname (max 100 chars each)
  - Shows account creation date if available
- **API Calls:** `fetch('/api/profile')`, `fetch('/api/profile/update', { method: 'POST', body: { firstname, lastname } })`

### 10. **AuthPage** (`/auth`)
- **Purpose:** Authentication page supporting both Google OAuth and local email/password login
- **Flow:**
  1. **Google OAuth:**
     - User clicks "Login with Google" button
     - Generate PKCE code verifier → store in localStorage
     - Redirect to Google OAuth URL with code challenge
     - Google redirects to `/auth/callback` with authorization code
  2. **Local Login:**
     - User enters email + password
     - POST to `/api/auth/local/login`
     - On success, redirects to home
  3. **Local Signup:**
     - User enters email + password (min 6 chars)
     - POST to `/api/auth/local/signup`
     - Creates new account or links password to existing Google account
- **Backend Calls:** `fetch('/api/auth/local/login')`, `fetch('/api/auth/local/signup')`

### 11. **AuthCallback** (`/auth/callback`)
- **Purpose:** Handle OAuth callback and exchange code for session (Google only)
- **Flow:**
  1. Extract `code` from URL query params
  2. Retrieve PKCE verifier from localStorage
  3. POST to `/api/auth/google/exchange` with `{ code, redirect_uri, code_verifier }`
  4. Backend sets session cookie, returns user profile
  5. Store user in localStorage for UI convenience
  6. Emit auth event → update Header state
  7. Redirect to home page
- **API Calls:** `fetch('/api/auth/google/exchange', { method: 'POST', body: { code, redirect_uri, code_verifier } })`

### 12. **RandomPage** (`/random`)
- **Purpose:** Display a random song, album, or artist (future feature placeholder)
- **Status:** Not fully implemented yet

## Shared Components

### **Header**
- **Purpose:** Global navigation bar with responsive mobile menu
- **Features:**
  - Logo (click → home)
  - Navigation links: Recent Reviews, My Reviews, Random
  - Search bar → redirects to `/search?q=<query>` (max 200 chars, sanitized)
  - Theme toggle (light/dark mode via ThemeContext)
  - User menu:
    - If logged in: Avatar, username/email, Logout button
    - If not logged in: Login/Register button
  - Mobile hamburger menu (collapsible nav + search)
  - Auto-refreshes on window focus (useful after OAuth flow)
- **API Calls:** `fetch('/api/me')` on mount and focus, `fetch('/api/logout')` on logout
- **Auth Events:** Listens to `authBus` for login/logout notifications

### **HeadphoneRating**
- **Purpose:** Custom star rating component using headphone icons
- **Features:**
  - Supports 0.5-5 rating scale (0.5 increments)
  - Three sizes: small, medium, large
  - Interactive (clickable) or read-only
  - Visual: filled/half-filled/empty headphone icons
- **Props:** `value` (number), `onChange` (function), `size` (string)

### **Avatar**
- **Purpose:** Display user profile picture with fallback to initials
- **Features:**
  - Shows Google profile picture if available
  - Falls back to colored circle with initials (first char of name/email)
  - Configurable size (px)
- **Props:** `src` (image URL), `name` (fallback text), `size` (number)

### **ProtectedRoute**
- **Purpose:** Wrapper component that checks authentication before rendering child
- **Logic:**
  - Calls `/api/me` to verify session
  - If authenticated → render child component
  - If not → redirect to `/auth`
  - Shows loading state during auth check
- **Used For:** `/my-reviews`, `/profile`

## API Client Wrappers

### **`/src/config/spotify.js`**
All functions call backend Spotify proxy endpoints (not Spotify directly). Uses configurable API base from `VITE_API_BASE` env var (defaults to `/api`).

- `searchSpotify(q, type, limit, market)` → `/api/spotify/search`
- `getSpotifyTrack(id)` → `/api/spotify/track/:id`
- `getSpotifyAlbum(id)` → `/api/spotify/album/:id`
- `getSpotifyAlbums(ids, market)` → `/api/spotify/albums?ids=<...>`
- `getSpotifyArtist(id)` → `/api/spotify/artist/:id`
- `getSpotifyArtistAlbums(id, params)` → `/api/spotify/artist/:id/albums`
- `getSpotifyNewReleases(params)` → `/api/spotify/new-releases`
- `getSavedArtist(id)` → `/api/artists/:id` (DB cache)

**Configuration:** All requests include `credentials: 'include'` for session cookies.

### **`/src/config/reviews.js`**
All functions call backend review endpoints with automatic credential handling.

- `upsertReview({ type, oid, rating, text, trackRatings? })` → `POST /api/reviews/upsert`
  - `rating`: 0.5-5 (optional)
  - `text`: string, max 1000 words (optional)
  - `trackRatings`: object mapping track IDs to ratings (albums only)
- `getMyReview(type, oid)` → `GET /api/reviews/my?type=<>&oid=<>`
  - Returns review object or null
  - Returns null if 401 (unauthorized)
- `deleteMyReview(type, oid)` → `DELETE /api/reviews/my?type=<>&oid=<>`
  - Returns boolean (success/failure)
- `listMyReviews({ limit, offset })` → `GET /api/reviews/my/list?limit=<>&offset=<>`
  - Returns `{ items: [...], nextOffset: number|null }`
  - Default: `limit=5`, `offset=0`

**Error Handling:** All functions throw on network/server errors with descriptive messages.

## State Management

### **Context Providers** (wrap entire app in `/src/main.jsx`)
1. **ThemeContext** (`/src/context/ThemeContext.jsx`)
   - Manages light/dark theme (stored in localStorage as `hs_theme`)
   - Provides `{ theme, toggleTheme }` to all components
   - Syncs with system `prefers-color-scheme` on mount

2. **ToastContext** (`/src/context/ToastContext.jsx`)
   - Displays temporary success/error notifications (auto-dismiss after 3s)
   - Provides `{ success(message), error(message) }` functions to all components
   - Toast appears in top-right corner with slide-in animation

3. **Auth State Management**
   - **AuthContext** (`/src/contexts/AuthContext.jsx`): Centralized auth state provider (if used)
   - **authBus** (`/src/utils/authBus.js`): Event emitter for auth state changes
     - `emitAuthChange({ authenticated, user })` → notify subscribers
     - `onAuthChange(callback)` → listen for auth changes
     - Used by Header and ProtectedRoute to sync auth state
     - Allows decoupled login/logout notifications from anywhere in app

### **Local Storage Keys**
- `hs_user`: Cached user object (convenience only; session cookie is source of truth)
- `hs_theme`: User's theme preference (`light` or `dark`)
- `hs_locale`: Selected country code for Spotify requests (e.g., `US`, `GB`)
- PKCE code verifier (temporary during OAuth flow)

## Routing

| Route | Component | Protected? | Purpose |
|-------|-----------|------------|---------|
| `/` | LandingPage | No | Home page with popular music |
| `/search` | SearchPage | No | Search results for artists/albums/songs |
| `/artist/:artistId` | ArtistPage | No | Artist details + review |
| `/album/:albumId` | AlbumRatingPage | No | Album details + review |
| `/song/:songId` | SongRatingPage | No | Song details + review |
| `/my-reviews` | MyReviewsPage | **Yes** | User's review history |
| `/recent-reviews` | RecentReviewsPage | No | Community review feed |
| `/review/:reviewId` | ReviewPage | No | Single review detail page |
| `/profile` | ProfilePage | **Yes** | User profile (view/edit) |
| `/random` | RandomPage | No | Random item (WIP) |
| `/auth` | AuthPage | No | Google OAuth + Local login/signup |
| `/auth/callback` | AuthCallback | No | OAuth redirect handler |

**Protected Routes:** Redirect to `/auth` if user not authenticated (checked via `/api/me`).

## Key User Flows

### **Login Flow (Google OAuth)**
1. User clicks "Login with Google" in Header or Auth page
2. Redirect to `/auth` → click "Login with Google" button
3. Generate PKCE verifier → store in localStorage
4. Redirect to Google OAuth URL with code challenge
5. Google redirects to `/auth/callback?code=<...>`
6. Frontend POSTs code + verifier to `/api/auth/google/exchange`
7. Backend sets session cookie → returns user profile
8. Frontend stores user in localStorage → emits auth event
9. Header refreshes → shows logged-in state
10. Redirect to `/`

### **Login Flow (Local)**
1. User navigates to `/auth`
2. Enters email + password (min 6 chars)
3. Clicks "Login" → POST to `/api/auth/local/login`
4. Backend validates credentials, sets session cookie
5. Frontend stores user → emits auth event
6. Redirect to `/`

### **Signup Flow (Local)**
1. User navigates to `/auth`
2. Enters email + password (min 6 chars)
3. Clicks "Sign Up" → POST to `/api/auth/local/signup`
4. Backend creates user (or links to existing Google account), sets session
5. Frontend stores user → emits auth event
6. Redirect to `/`

### **Write Review Flow**
1. User navigates to artist/album/song page
2. If logged in, review section is functional (otherwise shows login prompt)
3. User enters text (word count enforced, max 1000) and/or rating (0.5-5 stars, 0.5 increments)
4. For albums: optionally rate individual tracks
5. Click "Submit" → `POST /api/reviews/upsert` with `{ type, oid, rating, text, trackRatings? }`
6. Backend upserts review (unique per user+item)
7. Backend ensures media doc exists, adds review reference, backfills related data
8. UI shows "Saved" state → review displayed with current data

### **Edit/Delete Review Flow**
1. Page loads existing review via `GET /api/reviews/my?type=<>&oid=<>`
2. If review exists, show "Edit" button
3. User clicks Edit → text/rating become editable
4. User modifies → click "Save" → `POST /api/reviews/upsert` (update)
5. OR user clicks Delete → confirm → `DELETE /api/reviews/my?type=<>&oid=<>`
6. Backend removes review, cleans up references
7. UI updates to reflect changes

### **View Recent Reviews Flow**
1. User navigates to `/recent-reviews`
2. Page loads song and album reviews in parallel via `/api/reviews/recent?type=song&limit=5` and `type=album`
3. Displays reviews in two-column layout
4. Click review card → navigate to `/review/:reviewId`
5. Click "Load More" → fetch next batch with updated offset

## Environment Variables (Frontend)

```bash
# Google OAuth (public client ID only)
VITE_GOOGLE_CLIENT_ID=<your_google_client_id>
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
```

**Notes:**
- All `VITE_*` vars are public (embedded in build)
- Backend credentials (Google secret, Spotify secret) never exposed to client
- `VITE_API_BASE` supports cross-origin dev (e.g., `http://localhost:5174/api`)

---

## Build & Dev Scripts

```bash
# Development
npm run dev:backend     # Start backend with auto-reload (port 5174)
npm run dev:frontend    # Start frontend with Vite (port 5173)
npm run dev:all         # Run both concurrently (recommended)

# Production
npm run build           # Build frontend for production
npm run start:backend   # Start production backend

# Database Maintenance
npm run db:dedupe-users # Remove duplicate user documents

# Other
npm run lint            # ESLint check
npm run preview         # Preview production build locally
```

## Styling & UI

- **Framework:** Tailwind CSS v4 (utility-first) with Vite plugin
- **Theme:** 
  - Dark mode support via ThemeContext (toggles `dark:` classes on `<html>`)
  - Light: white backgrounds, black text/borders
  - Dark: gray-900 backgrounds, white text/borders
- **Design System:**
  - **Cards:** 2px black/white borders, minimal padding, sharp corners (no rounded)
  - **Buttons:** 2px borders, hover effects (bg-gray-100/bg-gray-800)
  - **Forms:** 2px border inputs, textareas with word counters
  - **Ratings:** Custom headphone icon component (0.5-5 scale)
  - **Avatars:** Circle with profile pic or colored initials
- **Typography:**
  - Headings: bold, black/white text
  - Body: standard weight, black/white text
  - Links: hover underline
- **Layout:**
  - Container max-width with horizontal padding
  - Grid/Flexbox for responsive layouts
  - 2-column layout for Recent Reviews (desktop)
- **Responsive:** 
  - Mobile-first approach
  - Hamburger menu below `md` breakpoint
  - Collapsible navigation on mobile
  - Touch-friendly button sizes
- **Accessibility:**
  - Semantic HTML
  - ARIA labels on icon buttons
  - Keyboard navigation support
  - Color contrast meets WCAG AA standards

## Error Handling

- **401 Unauthorized:** 
  - Protected routes redirect to `/auth` (handled by ProtectedRoute)
  - API calls return `authenticated: false` → trigger login flow
- **404 Not Found:**
  - Reviews: "Review not found" message
  - Media: "Item not found" message with retry option
- **Network Errors:** 
  - Toast notification with error message
  - Retry button where appropriate
- **Validation Errors:**
  - Client-side: word count, character limits, email format
  - Server errors (400): show specific error message from API response
- **Empty States:** 
  - "No results found" on search with no matches
  - "No reviews yet" on My Reviews when empty
  - "No album reviews" / "No song reviews" on Recent Reviews
- **Loading States:** 
  - Skeleton loaders or "Loading..." text while fetching data
  - Disabled buttons during save operations ("Saving...")
  - Spinner on initial page load for protected routes
- **Session Expiry:**
  - `/api/me` returns `authenticated: false` → redirect to login
  - Auto-refresh on window focus to catch session renewal
