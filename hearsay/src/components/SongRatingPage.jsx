import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getSpotifyTrack } from '../config/spotify';
import { useTheme } from '../context/ThemeContext';
import HeadphoneRating from './HeadphoneRating';
import { sanitizeInput, sanitizeRating } from '../utils/sanitize';

const SONG_REVIEW_WORD_LIMIT = 300;

export default function SongRatingPage() {
  const { songId } = useParams();
  const { theme } = useTheme();
  const [song, setSong] = useState(null);
  const [songDetails, setSongDetails] = useState(null);
  const [rating, setRating] = useState(0); // Changed from '' to 0
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState('');

  // Calculate word count
  const wordCount = review.trim().split(/\s+/).filter(word => word.length > 0).length;
  const remainingWords = SONG_REVIEW_WORD_LIMIT - wordCount;

  useEffect(() => {
    const fetchSongData = async () => {
      if (!songId) return;

      try {
        setLoading(true);
        const trackResponse = await getSpotifyTrack(songId);
        const songData = {
          id: trackResponse.id,
          title: trackResponse.name,
          artist: trackResponse.artists?.[0]?.name,
          coverArt: trackResponse.album?.images?.[0]?.url,
          duration: trackResponse.duration_ms,
          album: trackResponse.album?.name,
          spotifyUrl: trackResponse.external_urls?.spotify
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

  const handleSubmitRating = () => {
    const sanitizedRating = sanitizeRating(rating);
    
    console.log('Song rating:', sanitizedRating);
    if (sanitizedRating === 0) {
      alert('Please select a rating before submitting!');
    } else {
      alert(`Rating of ${sanitizedRating}/5 submitted! (This will save to database in the future)`);
    }
  };

  const handleSubmitReview = () => {
    const sanitizedReview = sanitizeInput(review);
    
    console.log('Song review:', {
      songId: song.id,
      songTitle: song.title,
      review: sanitizedReview,
      wordCount: wordCount
    });
    
    if (!sanitizedReview.trim()) {
      alert('Please write a review before submitting!');
    } else if (wordCount > SONG_REVIEW_WORD_LIMIT) {
      alert(`Review exceeds ${SONG_REVIEW_WORD_LIMIT} word limit. Please shorten your review.`);
    } else {
      alert('Review submitted! (This will save to database in the future)');
    }
  };

  const handleReviewChange = (e) => {
    const newText = e.target.value;
    const newWordCount = newText.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // Only update if within word limit
    if (newWordCount <= SONG_REVIEW_WORD_LIMIT || newText.length < review.length) {
      setReview(newText);
    }
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
              <div className="relative">
                <textarea 
                  value={review}
                  onChange={handleReviewChange}
                  className="w-full h-32 border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-2 pb-6 resize-none"
                  placeholder="Write your review here..."
                  maxLength={5000}
                />
                <div className="absolute bottom-2 right-2 text-xs italic text-gray-500 dark:text-gray-400">
                  {remainingWords} {remainingWords === 1 ? 'word' : 'words'} remaining
                </div>
              </div>
              <button 
                onClick={handleSubmitReview}
                className="w-full mt-4 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
              >
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
              <div className="flex justify-center mb-4">
                <HeadphoneRating
                  value={rating}
                  onChange={setRating}
                  size="medium"
                />
              </div>
              {/* Submit Rating Button */}
              <button 
                onClick={handleSubmitRating}
                className="w-full border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
              >
                Submit Rating
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
