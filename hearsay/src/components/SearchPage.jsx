import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function SearchPage() {
  const [searchParams] = useSearchParams();
  const query = searchParams.get('q');
  const navigate = useNavigate();
  
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

  useEffect(() => {
    const performSearch = async () => {
      if (!query) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const token = await getAccessToken();
        spotifyApi.setAccessToken(token);

        const response = await spotifyApi.search(query, ['artist', 'album', 'track'], {
          limit: 50,
          market: 'US'
        });

        setResults({
          artists: response.body.artists?.items.map(artist => ({
            id: artist.id,
            name: artist.name,
            image: artist.images?.[0]?.url,
            followers: artist.followers?.total,
            spotifyUrl: artist.external_urls.spotify
          })) || [],
          albums: response.body.albums?.items.map(album => ({
            id: album.id,
            title: album.name,
            artist: album.artists[0]?.name,
            coverArt: album.images?.[0]?.url,
            releaseDate: album.release_date,
            spotifyUrl: album.external_urls.spotify
          })) || [],
          tracks: response.body.tracks?.items.map(track => ({
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

    performSearch();
    // Reset showAll when query changes
    setShowAll({ artists: false, albums: false, tracks: false });
  }, [query]);

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
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        <span className="text-black dark:text-white">Search Results for "{query}"</span>
      </h1>

      {error && (
        <div className="border-2 border-red-500 bg-white dark:bg-gray-900 p-6 text-red-500 mb-6">
          {error}
        </div>
      )}

      {/* Artists */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            <span className="text-black dark:text-white">Artists ({results.artists.length})</span>
          </h2>
          {results.artists.length > 10 && (
            <button
              onClick={() => toggleShowAll('artists')}
              className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {showAll.artists ? 'Show Less' : 'See All'}
            </button>
          )}
        </div>
        {results.artists.length > 0 ? (
          <div className="grid grid-cols-5 gap-4">
            {getDisplayedItems(results.artists, 'artists').map(artist => (
              <div
                key={artist.id}
                className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => navigate(`/artist/${artist.id}`, { state: { artist } })}
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
      </section>

      {/* Albums */}
      <section className="mb-12">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            <span className="text-black dark:text-white">Albums ({results.albums.length})</span>
          </h2>
          {results.albums.length > 10 && (
            <button
              onClick={() => toggleShowAll('albums')}
              className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {showAll.albums ? 'Show Less' : 'See All'}
            </button>
          )}
        </div>
        {results.albums.length > 0 ? (
          <div className="grid grid-cols-5 gap-4">
            {getDisplayedItems(results.albums, 'albums').map(album => (
              <div
                key={album.id}
                className="cursor-pointer"
                onClick={() => navigate('/album-rating', { state: { item: album } })}
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
      </section>

      {/* Tracks */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            <span className="text-black dark:text-white">Tracks ({results.tracks.length})</span>
          </h2>
          {results.tracks.length > 10 && (
            <button
              onClick={() => toggleShowAll('tracks')}
              className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-1 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {showAll.tracks ? 'Show Less' : 'See All'}
            </button>
          )}
        </div>
        {results.tracks.length > 0 ? (
          <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900">
            {getDisplayedItems(results.tracks, 'tracks').map((track, index, array) => (
              <div
                key={track.id}
                className={`flex items-center gap-4 p-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${
                  index !== array.length - 1 ? 'border-b-2 border-black dark:border-white' : ''
                }`}
                onClick={() => navigate('/song-rating', { state: { item: track } })}
              >
                <div className="w-16 h-16 flex-shrink-0 border-2 border-black dark:border-white">
                  {track.coverArt ? (
                    <img src={track.coverArt} alt={track.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700"></div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate text-black dark:text-white">{track.title}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{track.artist}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 truncate">{track.album}</p>
                </div>
                <div className="text-gray-600 dark:text-gray-400 text-sm">
                  {formatDuration(track.duration)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No tracks found</p>
        )}
      </section>
    </main>
  );
}
