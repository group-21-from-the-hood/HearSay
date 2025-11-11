import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function RandomPage() {
  const [randomItem, setRandomItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getRandomSong = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      spotifyApi.setAccessToken(token);

      const randomChars = 'abcdefghijklmnopqrstuvwxyz';
      const randomChar = randomChars[Math.floor(Math.random() * randomChars.length)];
      const randomOffset = Math.floor(Math.random() * 1000);

      const response = await spotifyApi.searchTracks(`${randomChar}*`, {
        limit: 1,
        offset: randomOffset,
        market: 'US'
      });

      if (response.body.tracks.items.length > 0) {
        const track = response.body.tracks.items[0];
        setRandomItem({
          id: track.id,
          title: track.name,
          artist: track.artists[0].name,
          coverArt: track.album?.images?.[0]?.url,
          album: track.album.name
        });
      }
    } catch (error) {
      console.error('Error fetching random song:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-12">
        <h1 className="text-2xl font-bold mb-4 text-black dark:text-white">Random Song</h1>
        <button 
          className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 transition-colors"
          onClick={getRandomSong}
          disabled={loading}
        >
          {loading ? 'Loading...' : 'Get Random Song'}
        </button>
      </div>
      
      {randomItem && (
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-6">
          <div className="flex gap-8">
            <div className="w-64 h-64 flex-shrink-0 border-2 border-black dark:border-white">
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
            <div className="flex-1">
              <h2 className="text-3xl font-bold mb-2 text-black dark:text-white">{randomItem.title}</h2>
              <p className="text-xl mb-2 text-black dark:text-white">{randomItem.artist}</p>
              <p className="text-gray-600 dark:text-gray-400 mb-6">Album: {randomItem.album}</p>
              <button 
                className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white px-6 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                onClick={() => navigate('/song-rating', { state: { item: randomItem } })}
              >
                Rate This Song
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
