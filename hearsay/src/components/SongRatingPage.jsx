import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { spotifyApi, getAccessToken } from '../config/spotify';
import { useTheme } from '../context/ThemeContext';
import HeadphoneRating from './HeadphoneRating';

export default function SongRatingPage() {
  const { songId } = useParams();
  const { theme } = useTheme();
  const [song, setSong] = useState(null);
  const [songDetails, setSongDetails] = useState(null);
  const [rating, setRating] = useState(0); // Changed from '' to 0
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSongData = async () => {
      if (!songId) return;

      try {
        setLoading(true);
        const token = await getAccessToken();
        spotifyApi.setAccessToken(token);

        const trackResponse = await spotifyApi.getTrack(songId);
        
        const songData = {
          id: trackResponse.body.id,
          title: trackResponse.body.name,
          artist: trackResponse.body.artists[0]?.name,
          coverArt: trackResponse.body.album?.images?.[0]?.url,
          duration: trackResponse.body.duration_ms,
          album: trackResponse.body.album.name,
          spotifyUrl: trackResponse.body.external_urls.spotify
        };

        setSong(songData);
        setSongDetails(songData);
      } catch (error) {
        console.error('Error fetching song data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSongData();
  }, [songId]);

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
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Cover Art and Info */}
          <div className="lg:col-span-4">
            <div className="aspect-square border-2 border-black dark:border-white bg-white dark:bg-gray-900 mb-4">
              {song?.coverArt && (
                <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Song Info */}
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <div className="text-sm space-y-2">
                <p><span className="font-semibold">Album:</span> {songDetails?.album}</p>
                <p><span className="font-semibold">Duration:</span> {formatDuration(songDetails?.duration)}</p>
              </div>
            </div>
          </div>

          {/* Middle Column - Player and Review */}
          <div className="lg:col-span-5">
            {/* Embedded Player */}
            <div className="border-2 border-black dark:border-white overflow-hidden mb-4" style={{ backgroundColor: theme === 'dark' ? '#121212' : '#ffffff' }}>
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
          <div className="lg:col-span-3">
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <h2 className="font-semibold mb-4">
                <span className="text-black dark:text-white">Rating</span>
              </h2>
              <div className="flex justify-center">
                <HeadphoneRating
                  value={rating}
                  onChange={setRating}
                  size="medium"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
