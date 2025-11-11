import { useState, useEffect } from 'react';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function DiscoverPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecommendations = async () => {
      const token = await getAccessToken();
      const response = await spotifyApi.get('/recommendations', { headers: { Authorization: `Bearer ${token}` } });
      setRecommendations(response.data);
      setLoading(false);
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
              <div key={item.id} className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-4">
                {/* Recommendation content */}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
