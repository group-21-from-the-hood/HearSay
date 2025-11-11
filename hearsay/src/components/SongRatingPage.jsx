import { useState, useEffect } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import Header from './Header';

export default function SongRatingPage() {
  const location = useLocation();
  const song = location.state?.item;
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
        <div className="flex gap-8">
          {/* Left: Cover Art */}
          <div className="w-1/2">
            <div className="aspect-square border-2 border-black dark:border-white bg-white dark:bg-gray-900">
              {song?.coverArt && (
                <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
              )}
            </div>
          </div>

          {/* Right: Song Info */}
          <div className="w-1/2">
            <div className="border-2 border-black dark:border-white p-6 bg-white dark:bg-gray-900 text-black dark:text-white">
              <h1 className="text-3xl font-bold mb-2">
                <span className="text-black dark:text-white">{song?.title}</span>
              </h1>
              <p className="text-xl mb-2">{song?.artist}</p>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Album: {songDetails?.album}<br />
                Duration: {formatDuration(songDetails?.duration)}
              </p>
              
              {/* Star Rating */}
              <div className="mb-6">
                <select 
                  className="w-32 border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white px-4 py-2 text-xl"
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                >
                  <option value="">Rate</option>
                  {[1,2,3,4,5].map(num => (
                    <option key={num} value={num}>{'★'.repeat(num)}</option>
                  ))}
                </select>
              </div>

              {/* Review Section */}
              <div>
                <h2 className="font-bold mb-2">
                  <span className="text-black dark:text-white">Review</span>
                </h2>
                <textarea 
                  className="w-full h-32 border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-2 resize-none mb-4"
                  placeholder="Write your review here..."
                />
                <button className="w-full border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white">
                  Submit Review
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
