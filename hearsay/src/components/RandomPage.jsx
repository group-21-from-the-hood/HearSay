import { useState } from 'react';
import { spotifyApi, getAccessToken } from '../config/spotify';

export default function RandomPage() {
  const [randomItem, setRandomItem] = useState(null);
  const [loading, setLoading] = useState(false);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold">Random Pick</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        <div className="text-center">
          <button 
            className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-800"
            onClick={() => {/* Random selection logic will go here */}}
          >
            Get Random Music
          </button>
        </div>
        
        <div className="mt-8">
          {/* Random item display will go here */}
        </div>
      </main>
    </div>
  );
}
