import { useState, useEffect } from 'react';
import { getSpotifyRecommendations } from '../config/spotify';

export default function DiscoverPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        const data = await getSpotifyRecommendations({ seed_genres: 'pop,rock', limit: 20 });
        // Spotify recommendations response has "tracks" array
        setRecommendations(data.tracks || []);
      } catch (e) {
        console.error('Recommendations error', e);
        setRecommendations([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRecommendations();
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        <span className="text-black dark:text-white">Discover</span>
      </h1>
      
      <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-4">
        {loading ? (
          <div className="text-center py-8 text-black dark:text-white">Loading recommendations...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recommendations.map(item => (
              <div key={item.id} className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-4 flex gap-4">
                <div className="w-20 h-20 border-2 border-black dark:border-white flex-shrink-0">
                  {item.album?.images?.[0]?.url ? (
                    <img src={item.album.images[0].url} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs text-black dark:text-white">No Image</div>
                  )}
                </div>
                <div className="flex-1 text-black dark:text-white">
                  <p className="font-semibold truncate">{item.name}</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{item.artists?.[0]?.name}</p>
                  {item.popularity !== undefined && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">Popularity: {item.popularity}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
