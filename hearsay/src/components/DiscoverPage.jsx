import { useState, useEffect } from 'react';
import { spotifyApi, getAccessToken } from '../config/spotify';
import Header from './Header';

export default function DiscoverPage() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);

  return (
    <div className="min-h-screen bg-white pt-16">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Discover</h1>
        
        <div className="border-2 border-black p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Recommendations will be mapped here */}
          </div>
        </div>
      </main>
    </div>
  );
}
