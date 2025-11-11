import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import Header from './Header';

export default function RandomPage() {
  const [randomItem, setRandomItem] = useState(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const getRandomSong = async () => {
    try {
      setLoading(true);
      const token = await getAccessToken();
      spotifyApi.setAccessToken(token);

      // Generate random search query using common words/letters
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
    <div className="min-h-screen bg-white pt-16">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-12">
          <h1 className="text-2xl font-bold mb-4">Random Song Generator</h1>
          <button 
            className="border-2 border-black px-6 py-2 hover:bg-gray-100 disabled:opacity-50"
            onClick={getRandomSong}
            disabled={loading}
          >
            {loading ? 'Loading...' : 'Get Random Song'}
          </button>
        </div>
        
        {randomItem && (
          <div className="border-2 border-black p-6">
            <div className="flex gap-8">
              <div className="w-64 h-64 flex-shrink-0 border-2 border-black">
                {randomItem.coverArt ? (
                  <img 
                    src={randomItem.coverArt} 
                    alt={randomItem.title} 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                    No Image
                  </div>
                )}
              </div>
              <div className="flex-1">
                <h2 className="text-3xl font-bold mb-2">{randomItem.title}</h2>
                <p className="text-xl text-gray-600 mb-1">{randomItem.artist}</p>
                <p className="text-gray-500 mb-6">Album: {randomItem.album}</p>
                <button 
                  className="border-2 border-black px-6 py-2 hover:bg-gray-100"
                  onClick={() => navigate('/song-rating', { state: { item: randomItem } })}
                >
                  Rate This Song
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
