import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import { searchSpotify } from '../config/spotify';
import { sanitizeSearchQuery } from '../utils/sanitize';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const navigate = useNavigate();
  const location = useLocation();
  
  const [results, setResults] = useState({
    artists: [],
    albums: [],
    tracks: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAll, setShowAll] = useState({
    artists: false,
    albums: false,
    tracks: false
  });
  const [searchQuery, setSearchQuery] = useState(query || '');

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const query = searchParams.get('q');
    
    if (query) {
      const sanitizedQuery = sanitizeSearchQuery(query);
      setSearchQuery(sanitizedQuery);
      performSearch(sanitizedQuery);
    }
  }, [location.search]);

  const performSearch = async (query) => {
    const sanitizedQuery = sanitizeSearchQuery(query);
    
    if (!sanitizedQuery.trim()) {
      setError('Please enter a search term');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      
      // Use server proxy wrapper; request all three categories in one call
      const response = await searchSpotify(sanitizedQuery, 'artist,album,track', 50, 'US');

      setResults({
        artists: response.artists?.items.map(artist => ({
          id: artist.id,
          name: artist.name,
          image: artist.images?.[0]?.url,
          followers: artist.followers?.total,
          spotifyUrl: artist.external_urls.spotify
        })) || [],
        albums: response.albums?.items.map(album => ({
          id: album.id,
          title: album.name,
          artist: album.artists[0]?.name,
          coverArt: album.images?.[0]?.url,
          releaseDate: album.release_date,
          spotifyUrl: album.external_urls.spotify
        })) || [],
        tracks: response.tracks?.items.map(track => ({
          id: track.id,
          title: track.name,
          artist: track.artists[0]?.name,
          album: track.album?.name,
          coverArt: track.album?.images?.[0]?.url,
          duration: track.duration_ms,
          spotifyUrl: track.external_urls.spotify
        })) || []
      });
    } catch (error) {
      console.error('Search error:', error);
      setError('An error occurred while searching. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  const toggleShowAll = (category) => {
    setShowAll(prev => ({ ...prev, [category]: !prev[category] }));
  };

  const getDisplayedItems = (items, category, defaultLimit = 10) => {
    return showAll[category] ? items : items.slice(0, defaultLimit);
  };

  const onCardKey = (e, path) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      navigate(path);
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-xl text-black dark:text-white">Searching...</div>
      </main>
    );
  }

  if (!query) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-xl text-black dark:text-white">Enter a search query</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8" role="main">
      <h1 className="text-2xl font-bold mb-6">
        <span className="text-black dark:text-white">Search Results for "{query}"</span>
      </h1>

      {/* Artists */}
      {results.artists.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {getDisplayedItems(results.artists, 'artists').map(artist => (
            <div
              key={artist.id}
              className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/artist/${artist.id}`)}
              onKeyDown={(e) => onCardKey(e, `/artist/${artist.id}`)}
            >
              <div className="aspect-square mb-2">
                {artist.image ? (
                  <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                    No Image
                  </div>
                )}
              </div>
              <p className="font-semibold text-center truncate text-black dark:text-white">{artist.name}</p>
              <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                {artist.followers?.toLocaleString()} followers
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">No artists found</p>
      )}

      {/* Albums */}
      {results.albums.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {getDisplayedItems(results.albums, 'albums').map(album => (
            <div
              key={album.id}
              className="cursor-pointer"
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/album/${album.id}`)}
              onKeyDown={(e) => onCardKey(e, `/album/${album.id}`)}
            >
              <div className="aspect-square mb-2 border-2 border-black dark:border-white">
                {album.coverArt ? (
                  <img src={album.coverArt} alt={album.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                    No Image
                  </div>
                )}
              </div>
              <p className="font-medium text-center truncate text-black dark:text-white">{album.title}</p>
              <p className="text-sm text-center text-gray-600 dark:text-gray-400 truncate">{album.artist}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">No albums found</p>
      )}

      {/* Tracks */}
      {results.tracks.length > 0 ? (
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900">
          {getDisplayedItems(results.tracks, 'tracks').map((track, index, array) => (
            <div
              key={track.id}
              className={`flex items-center gap-2 sm:gap-4 p-2 sm:p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${index !== array.length - 1 ? 'border-b-2 border-black dark:border-white' : ''}`}
              role="link"
              tabIndex={0}
              onClick={() => navigate(`/song/${track.id}`)}
              onKeyDown={(e) => onCardKey(e, `/song/${track.id}`)}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 flex-shrink-0 border-2 border-black dark:border-white">
                {track.coverArt ? (
                  <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700"></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate text-black dark:text-white text-sm sm:text-base">{track.title}</p>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{track.artist}</p>
                <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{track.album}</p>
              </div>
              <div className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
                {formatDuration(track.duration)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-gray-600 dark:text-gray-400">No tracks found</p>
      )}

    </main>
  );
}
