import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import { useTheme } from '../context/ThemeContext';

export default function SongRatingPage() {
  const location = useLocation();
  const song = location.state?.item;
  const { theme } = useTheme();
  const [songDetails, setSongDetails] = useState(null);
  const [rating, setRating] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSongData = async () => {
      if (!song?.id) return;

      try {
        setLoading(true);
        const token = await getAccessToken();
        spotifyApi.setAccessToken(token);

        const trackResponse = await spotifyApi.getTrack(song.id);
        
        setSongDetails({
          ...song,
          duration: trackResponse.body.duration_ms,
          album: trackResponse.body.album.name
        });
      } catch (error) {
        console.error('Error fetching song data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSongData();
  }, [song?.id]);

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  return (
    <main className="container mx-auto px-4 py-8">
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-xl text-black dark:text-white">Loading song details...</div>
        </div>
      ) : (
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Cover Art and Player */}
          <div className="col-span-4">
            <div className="aspect-square border-2 border-black dark:border-white bg-white dark:bg-gray-900 mb-4">
              {song?.coverArt && (
                <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Embedded Player */}
            <div className="border-2 border-black dark:border-white overflow-hidden" style={{ backgroundColor: theme === 'dark' ? '#121212' : '#ffffff' }}>
              <iframe
                key={song?.id}
                style={{ borderRadius: '0' }}
                src={`https://open.spotify.com/embed/track/${song?.id}?utm_source=generator`}
                width="100%"
                height="152"
                frameBorder="0"
                allowFullScreen=""
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="w-full"
              />
            </div>
          </div>

          {/* Middle Column - Song Info and Review */}
          <div className="col-span-5">
            <div className="border-2 border-black dark:border-white p-4 mb-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <h1 className="text-2xl font-bold mb-2">
                <span className="text-black dark:text-white">{song?.title}</span>
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-2">{song?.artist}</p>
              <div className="text-sm italic text-gray-600 dark:text-gray-400 space-y-1">
                <p>Album: {songDetails?.album}</p>
                <p>Duration: {formatDuration(songDetails?.duration)}</p>
              </div>
            </div>
            
            {/* Review */}
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <h2 className="font-semibold mb-4">
                <span className="text-black dark:text-white">Review</span>
              </h2>
              <textarea 
                className="w-full h-32 border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-2 resize-none"
                placeholder="Write your review here..."
              />
              <button className="w-full mt-4 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white">
                Submit Review
              </button>
            </div>
          </div>

          {/* Right: Rating */}
          <div className="col-span-3">
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <h2 className="font-semibold mb-4">
                <span className="text-black dark:text-white">Rating</span>
              </h2>
              <select 
                className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-4 py-2 text-xl"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
              >
                <option value="">Select Rating</option>
                {[1,2,3,4,5].map(num => (
                  <option key={num} value={num}>{'★'.repeat(num)}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
