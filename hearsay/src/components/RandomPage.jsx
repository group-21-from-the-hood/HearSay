import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import { useTheme } from '../context/ThemeContext';

export default function RandomPage() {
  const [randomItem, setRandomItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [itemType, setItemType] = useState(null); // 'song' or 'album'
  const navigate = useNavigate();
  const { theme } = useTheme();
  const resultsRef = useRef(null);

  // Scroll to results when randomItem changes
  useEffect(() => {
    if (randomItem && resultsRef.current) {
      resultsRef.current.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'center' 
      });
    }
  }, [randomItem]);

  const fetchRandomMusic = async (type) => {
    try {
      setLoading(true);
      setError(null);
      const token = await getAccessToken();
      spotifyApi.setAccessToken(token);

      if (type === 'album') {
        const response = await spotifyApi.getNewReleases({ 
          limit: 50,
          country: 'US' 
        });
        
        // Filter out single-track albums
        const multiTrackAlbums = response.body.albums.items.filter(
          album => album.total_tracks > 1
        );
        
        if (multiTrackAlbums.length === 0) {
          setError('No multi-track albums found. Please try again.');
          setLoading(false);
          return;
        }
        
        const randomAlbum = multiTrackAlbums[Math.floor(Math.random() * multiTrackAlbums.length)];
        
        setRandomItem({
          id: randomAlbum.id,
          title: randomAlbum.name,
          artist: randomAlbum.artists[0]?.name,
          albumArtist: randomAlbum.artists[0]?.name,
          coverArt: randomAlbum.images?.[0]?.url,
          releaseDate: randomAlbum.release_date,
          totalTracks: randomAlbum.total_tracks,
          spotifyUrl: randomAlbum.external_urls.spotify
        });
      } else {
        setRandomItem(null);
        setLoading(true);
        setError(null);
        setItemType('song');
        
        const token = await getAccessToken();
        spotifyApi.setAccessToken(token);

        const randomChars = 'abcdefghijklmnopqrstuvwxyz';
        let track = null;
        let attempts = 0;
        const maxAttempts = 10;

        while (!track && attempts < maxAttempts) {
          attempts++;
          const randomChar = randomChars[Math.floor(Math.random() * randomChars.length)];
          const randomOffset = Math.floor(Math.random() * 100);

          try {
            const response = await spotifyApi.searchTracks(`${randomChar}*`, {
              limit: 1,
              offset: randomOffset,
              market: 'US'
            });

            if (response.body.tracks.items.length > 0) {
              track = response.body.tracks.items[0];
              break;
            }
          } catch (searchError) {
            console.warn(`Attempt ${attempts} failed:`, searchError);
          }
        }

        if (track) {
          setRandomItem({
            id: track.id,
            title: track.name,
            artist: track.artists[0].name,
            coverArt: track.album?.images?.[0]?.url,
            album: track.album.name,
            albumArtist: track.album.artists[0].name,
            releaseDate: track.album.release_date,
            trackNumber: track.track_number,
            totalTracks: track.album.total_tracks,
            spotifyUrl: track.external_urls.spotify
          });
        } else {
          setError('Unable to find a random song. Please try again.');
        }
      }      
      setItemType(type);
    } catch (error) {
      console.error('Error fetching random music:', error);
      setError('Failed to fetch random music. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">
          <span className="text-black dark:text-white">Random Generator</span>
        </h1>
        <div className="flex flex-wrap gap-4">
          <button 
            className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            onClick={() => fetchRandomMusic('song')}
            disabled={loading}
          >
            {loading && itemType === 'song' ? 'Loading...' : 'Random Song'}
          </button>
          <button 
            className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
            onClick={() => fetchRandomMusic('album')}
            disabled={loading}
          >
            {loading && itemType === 'album' ? 'Loading...' : 'Random Album'}
          </button>
        </div>
      </div>

      {error && (
        <div className="border-2 border-red-500 bg-white dark:bg-gray-900 p-6 text-red-500">
          {error}
        </div>
      )}
      
      {randomItem && (
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left: Cover Art */}
            <div className="border-2 border-black dark:border-white flex items-start">
              {randomItem.coverArt ? (
                <img 
                  src={randomItem.coverArt} 
                  alt={randomItem.title} 
                  className="w-full h-auto object-contain"
                />
              ) : (
                <div className="w-full aspect-square bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                  No Image
                </div>
              )}
            </div>

            {/* Right: Player and Info */}
            <div className="flex flex-col gap-6">
              {/* Embed Player */}
              <div className="border-2 border-black dark:border-white overflow-hidden" style={{ backgroundColor: theme === 'dark' ? '#121212' : '#ffffff' }}>
                <iframe
                  key={randomItem.id}
                  style={{ borderRadius: '0' }}
                  src={`https://open.spotify.com/embed/${itemType === 'album' ? 'album' : 'track'}/${randomItem.id}?utm_source=generator`}
                  width="100%"
                  height="152"
                  frameBorder="0"
                  allowFullScreen=""
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="w-full"
                />
              </div>

              {/* Album Information */}
              <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-6 flex-1">
                <div className="space-y-4 text-base">
                  <p className="text-black dark:text-white">
                    <span className="font-semibold">{itemType === 'album' ? 'Album' : 'Album'}:</span> {randomItem.album}
                  </p>
                  <p className="text-black dark:text-white">
                    <span className="font-semibold">Artist:</span> {randomItem.albumArtist}
                  </p>
                  <p className="text-black dark:text-white">
                    <span className="font-semibold">Release Date:</span> {randomItem.releaseDate}
                  </p>
                  {itemType === 'song' && (
                    <p className="text-black dark:text-white">
                      <span className="font-semibold">Track:</span> {randomItem.trackNumber} of {randomItem.totalTracks}
                    </p>
                  )}
                  {itemType === 'album' && (
                    <p className="text-black dark:text-white">
                      <span className="font-semibold">Total Tracks:</span> {randomItem.totalTracks}
                    </p>
                  )}
                </div>
              </div>

              {/* Buttons */}
              <div className="space-y-3">
                <button 
                  className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => navigate(itemType === 'album' ? `/album/${randomItem.id}` : `/song/${randomItem.id}`)}
                >
                  Rate This {itemType === 'album' ? 'Album' : 'Song'}
                </button>
                
                <a
                  href={randomItem.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-4 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Open in Spotify
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
