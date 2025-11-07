import { useState, useEffect } from 'react';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function DiscoverPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold">Discover</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Recommendations will be mapped here */}
        </div>
      </main>
    </div>
  );
}
