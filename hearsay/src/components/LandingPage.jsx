import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import { useTheme } from '../context/ThemeContext';

const MIN_LOADING_TIME = 1000;
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Multiple search terms for more variety
const ALBUM_SEARCH_TERMS = ['album', 'music', 'new', 'best', 'top'];
const TRACK_SEARCH_TERMS = ['track', 'song', 'hit', 'popular', 'new'];

const LOCALES = [
  { label: 'United States', code: 'US' },
  { label: 'United Kingdom', code: 'GB' },
  { label: 'Canada', code: 'CA' },
  { label: 'Australia', code: 'AU' },
  { label: 'Germany', code: 'DE' },
  { label: 'France', code: 'FR' },
  { label: 'Spain', code: 'ES' },
  { label: 'Italy', code: 'IT' },
  { label: 'Japan', code: 'JP' },
  { label: 'Brazil', code: 'BR' },
  { label: 'Mexico', code: 'MX' }
];

export default function LandingPage() {
  const { theme } = useTheme();
  const [albums, setAlbums] = useState([]);
  const [songs, setSongs] = useState([]);
  const [albumsLoading, setAlbumsLoading] = useState(true);
  const [songsLoading, setSongsLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  // Filter states - get from localStorage or use default
  const getInitialLocale = () => {
    const savedLocale = localStorage.getItem('hearsay_selected_locale');
    if (savedLocale) {
      return savedLocale;
    }
    return navigator.language?.split('-')[1] || 'US';
  };

  const [selectedLocale, setSelectedLocale] = useState(getInitialLocale());

  // Save locale to localStorage whenever it changes
  const handleLocaleChange = (e) => {
    const newLocale = e.target.value;
    setSelectedLocale(newLocale);
    localStorage.setItem('hearsay_selected_locale', newLocale);
  };

  const fetchPopularMusic = async () => {
    try {
      setAlbumsLoading(true);
      setSongsLoading(true);
      setError(null);

      const loadingStartTime = Date.now();

      const token = await getAccessToken();
      spotifyApi.setAccessToken(token);

      // Randomly select search terms for more variety
      const randomAlbumTerm = ALBUM_SEARCH_TERMS[Math.floor(Math.random() * ALBUM_SEARCH_TERMS.length)];
      const randomTrackTerm = TRACK_SEARCH_TERMS[Math.floor(Math.random() * TRACK_SEARCH_TERMS.length)];

      // Fetch multiple queries to get a larger, more diverse pool
      const [albumsResponse1, albumsResponse2, tracksResponse1, tracksResponse2] = await Promise.all([
        spotifyApi.searchAlbums(randomAlbumTerm, { limit: 50, market: selectedLocale }),
        spotifyApi.searchAlbums(ALBUM_SEARCH_TERMS[(ALBUM_SEARCH_TERMS.indexOf(randomAlbumTerm) + 1) % ALBUM_SEARCH_TERMS.length], { 
          limit: 50, 
          market: selectedLocale 
        }),
        spotifyApi.searchTracks(randomTrackTerm, { limit: 50, market: selectedLocale }),
        spotifyApi.searchTracks(TRACK_SEARCH_TERMS[(TRACK_SEARCH_TERMS.indexOf(randomTrackTerm) + 1) % TRACK_SEARCH_TERMS.length], { 
          limit: 50, 
          market: selectedLocale 
        })
      ]);

      // Combine albums from both searches
      const allAlbums = [
        ...albumsResponse1.body.albums.items,
        ...albumsResponse2.body.albums.items
      ];

      // Remove album duplicates and filter
      const uniqueAlbumsMap = new Map();
      allAlbums.forEach(album => {
        if (album && album.id && album.total_tracks > 1 && !uniqueAlbumsMap.has(album.id)) {
          uniqueAlbumsMap.set(album.id, album);
        }
      });
      const uniqueAlbums = Array.from(uniqueAlbumsMap.values());

      // More aggressive randomization for albums
      const randomAlbums = uniqueAlbums
        .sort(() => Math.random() - 0.5) // First shuffle
        .slice(0, 50) // Take 50 random
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)) // Sort by popularity
        .slice(0, 30) // Take top 30
        .sort(() => Math.random() - 0.5) // Shuffle again
        .slice(0, 5) // Take final 5
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)) // Final sort for display
        .map(album => ({
          id: album.id,
          title: album.name,
          artist: album.artists[0].name,
          coverArt: album.images?.[0]?.url,
          popularity: album.popularity
        }));

      // Combine tracks from both searches
      const allTracks = [
        ...tracksResponse1.body.tracks.items,
        ...tracksResponse2.body.tracks.items
      ];

      // Remove track duplicates
      const uniqueTracksMap = new Map();
      allTracks.forEach(track => {
        if (track && track.id && !uniqueTracksMap.has(track.id)) {
          uniqueTracksMap.set(track.id, track);
        }
      });
      const uniqueTracks = Array.from(uniqueTracksMap.values());

      // More aggressive randomization for tracks
      const randomSongs = uniqueTracks
        .sort(() => Math.random() - 0.5) // First shuffle
        .slice(0, 50) // Take 50 random
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)) // Sort by popularity
        .slice(0, 30) // Take top 30
        .sort(() => Math.random() - 0.5) // Shuffle again
        .slice(0, 5) // Take final 5
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0)) // Final sort for display
        .map(track => ({
          id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          coverArt: track.album?.images?.[0]?.url,
          popularity: track.popularity
        }));

      // Calculate remaining delay needed
      const elapsed = Date.now() - loadingStartTime;
      const remainingDelay = Math.max(0, MIN_LOADING_TIME - elapsed);
      
      await delay(remainingDelay);

      setAlbums(randomAlbums);
      setSongs(randomSongs);
      setAlbumsLoading(false);
      setSongsLoading(false);
    } catch (error) {
      console.error('Error fetching music:', error);
      setError(error.message);
      setAlbumsLoading(false);
      setSongsLoading(false);
    }
  };

  useEffect(() => {
    fetchPopularMusic();
  }, [selectedLocale]);

  const handleRefresh = () => {
    fetchPopularMusic();
  };

  return (
    <main className="container mx-auto px-4 py-8">
      {error && (
        <div className="text-red-500 mb-4 p-4 border-2 border-red-500">
          {error}
        </div>
      )}

      {/* Popular Albums */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-xl font-semibold">
            <span className="text-black dark:text-white">Popular Albums</span>
          </h2>
          {/* Locale Filter - Small and subtle with globe icon */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              className="hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-1 transition-colors"
              aria-label="Refresh music"
              title="Refresh music"
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="text-gray-600 dark:text-gray-400"
              >
                <circle cx="12" cy="12" r="10"/>
                <line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
            </button>
            <select
              value={selectedLocale}
              onChange={handleLocaleChange}
              className="text-sm h-8 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 px-2 rounded-none"
              aria-label="Select region"
            >
              {LOCALES.map(locale => (
                <option key={locale.code} value={locale.code}>
                  {locale.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="p-4">
          {albumsLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-lg text-black dark:text-white">Loading albums...</div>
            </div>
          ) : albums.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {albums.map(album => (
                <div
                  key={album.id}
                  className="flex flex-col cursor-pointer group"
                  onClick={() => navigate(`/album/${album.id}`)}
                >
                  <div className="aspect-square mb-2 border-2 border-black dark:border-white bg-white">
                    {album.coverArt ? (
                      <img
                        src={album.coverArt}
                        alt={album.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-medium group-hover:underline truncate text-black dark:text-white">{album.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{album.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No albums found for the selected region. Try selecting a different region.
            </div>
          )}
        </div>
      </section>

      {/* Popular Songs */}
      <section>
        <h2 className="text-xl font-semibold mb-2">
          <span className="text-black dark:text-white">Popular Songs</span>
        </h2>
        <div className="p-4">
          {songsLoading ? (
            <div className="h-64 flex items-center justify-center">
              <div className="text-lg text-black dark:text-white">Loading songs...</div>
            </div>
          ) : songs.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {songs.map(song => (
                <div
                  key={song.id}
                  className="flex flex-col cursor-pointer group"
                  onClick={() => navigate(`/song/${song.id}`)}
                >
                  <div className="aspect-square mb-2 border-2 border-black dark:border-white bg-white">
                    {song.coverArt ? (
                      <img
                        src={song.coverArt}
                        alt={song.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                        No Image
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="font-medium group-hover:underline truncate text-black dark:text-white">{song.title}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{song.artist}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-gray-400 py-8">
              No songs found for the selected region. Try selecting a different region.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}