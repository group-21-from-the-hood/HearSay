import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function RandomPage() {
  const [randomItem, setRandomItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const getRandomSong = async () => {
    try {
      // Clear the current song immediately when button is pressed
      setRandomItem(null);
      setLoading(true);
      setError(null);
      
      const token = await getAccessToken();
      spotifyApi.setAccessToken(token);

      const randomChars = 'abcdefghijklmnopqrstuvwxyz';
      let track = null;
      let attempts = 0;
      const maxAttempts = 10;

      // Keep trying until we get a result or hit max attempts
      while (!track && attempts < maxAttempts) {
        attempts++;
        const randomChar = randomChars[Math.floor(Math.random() * randomChars.length)];
        // Use smaller offset to increase chances of getting results
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
          // Continue to next attempt
        }
      }

      if (track) {
        setRandomItem({
          id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          coverArt: track.album?.images?.[0]?.url,
          album: track.album.name,
          spotifyUrl: track.external_urls.spotify // Add Spotify URL
        });
      } else {
        setError('Unable to find a random song. Please try again.');
      }
    } catch (error) {
      console.error('Error fetching random song:', error);
      setError('An error occurred while fetching a random song. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-4">
          <span className="text-black dark:text-white">Random Song Generator</span>
        </h1>
        <button 
          className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          onClick={getRandomSong}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get Random Song'}
        </button>
      </div>

      {error && (
        <div className="border-2 border-red-500 bg-white dark:bg-gray-900 p-6 text-red-500">
          {error}
        </div>
      )}
      
      {randomItem && (
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-8">
          {/* Main Grid: 3 equal columns */}
          <div className="grid grid-cols-3 gap-8">
            {/* Left: Cover Art */}
            <div className="col-span-1">
              <div className="aspect-square border-2 border-black dark:border-white">
                {randomItem.coverArt ? (
                  <img 
                    src={randomItem.coverArt} 
                    alt={randomItem.title} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                    No Image
                  </div>
                )}
              </div>
            </div>

            {/* Middle: Song Info */}
            <div className="col-span-1 flex flex-col justify-start">
              <h2 className="text-3xl font-bold mb-4">
                <span className="text-black dark:text-white">{randomItem.title}</span>
              </h2>
              <p className="text-xl mb-3 text-black dark:text-white">{randomItem.artist}</p>
              <p className="text-base text-gray-600 dark:text-gray-400">
                Album: {randomItem.album}
              </p>
              
              {/* Action Buttons Below Info */}
              <div className="mt-8 space-y-3">
                <button 
                  className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                  onClick={() => navigate('/song-rating', { state: { item: randomItem } })}
                >
                  Rate This Song
                </button>
                
                <a
                  href={randomItem.spotifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/>
                  </svg>
                  Open in Spotify
                </a>
              </div>
            </div>

            {/* Right: Spotify Embed Player - Centered */}
            <div className="col-span-1 flex items-center justify-center">
              <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 overflow-hidden w-full">
                <iframe
                  style={{ borderRadius: '0' }}
                  src={`https://open.spotify.com/embed/track/${randomItem.id}?utm_source=generator&theme=0`}
                  width="100%"
                  height="352"
                  frameBorder="0"
                  allowFullScreen=""
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
