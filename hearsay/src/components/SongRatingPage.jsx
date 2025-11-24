import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getSpotifyTrack } from '../config/spotify';
import { upsertReview, getMyReview, deleteMyReview } from '../config/reviews';
import { useTheme } from '../context/ThemeContext';
import HeadphoneRating from './HeadphoneRating';
import { useToast } from '../context/ToastContext';
import { sanitizeInput, sanitizeRating } from '../utils/sanitize';

const SONG_REVIEW_WORD_LIMIT = 1000;

export default function SongRatingPage() {
  const { songId } = useParams();
  const { theme } = useTheme();
  const [song, setSong] = useState(null);
  const [songDetails, setSongDetails] = useState(null);
  const [rating, setRating] = useState(0); // Changed from '' to 0
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState('');
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [isEditingRating, setIsEditingRating] = useState(false);
  const [hasSavedReview, setHasSavedReview] = useState(false);
  const [hasSavedRating, setHasSavedRating] = useState(false);
  const { success } = useToast();

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

  // Load existing review for this song for the current user
  useEffect(() => {
    const loadMyReview = async () => {
      if (!songId) return;
      try {
        const existing = await getMyReview('song', songId);
        if (existing) {
          if (typeof existing.rating === 'number') setRating(existing.rating);
          if (typeof existing.text === 'string') setReview(existing.text);
          setIsEditingReview(false);
          setIsEditingRating(false);
          const saved = !!(existing && typeof existing.text === 'string' && existing.text.trim().length > 0);
          setHasSavedReview(saved);
          const savedRating = !!(existing && typeof existing.rating === 'number' && existing.rating > 0);
          setHasSavedRating(savedRating);
        }
      } catch (e) {
        // Not logged in or no review yet; ignore
      }
    };
    loadMyReview();
  }, [songId]);

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  const handleSubmitRating = async () => {
    const sanitizedRating = sanitizeRating(rating);
    
    if (sanitizedRating === 0) {
      alert('Please select a rating before submitting!');
    } else {
      try {
        await upsertReview({ type: 'song', oid: songId, rating: sanitizedRating });
        setIsEditingRating(false);
        setHasSavedRating(true);
        success('Rating saved');
      } catch (e) {
        if (String(e.message).includes('unauthorized')) {
          alert('Please sign in to submit a rating.');
        } else {
          alert('Failed to submit rating. Please try again.');
        }
      }
    }
  };

  const handleSubmitReview = async () => {
    const sanitizedReview = sanitizeInput(review);
    
    if (!sanitizedReview.trim()) {
      alert('Please write a review before submitting!');
    } else if (wordCount > SONG_REVIEW_WORD_LIMIT) {
      alert(`Review exceeds ${SONG_REVIEW_WORD_LIMIT} word limit. Please shorten your review.`);
    } else {
      try {
        await upsertReview({ type: 'song', oid: songId, text: sanitizedReview });
        setIsEditingReview(false);
        setHasSavedReview(true);
        success('Review saved');
      } catch (e) {
        if (String(e.message).includes('unauthorized')) {
          alert('Please sign in to submit a review.');
        } else if (String(e.message).includes('text_too_long')) {
          alert(`Review exceeds ${SONG_REVIEW_WORD_LIMIT} words.`);
        } else {
          alert('Failed to submit review. Please try again.');
        }
      }
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

  const handleDeleteReview = async () => {
    if (!songId) return;
    
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteMyReview('song', songId);
      
      // Successfully deleted
      setReview('');
      setRating(0);
      setIsEditingReview(false);
      setIsEditingRating(false);
      setHasSavedReview(false);
      setHasSavedRating(false);
      alert('Your review was deleted.');
    } catch (e) {
      const errorMsg = String(e.message || e);
      if (errorMsg.includes('unauthorized')) {
        alert('Please sign in to delete your review.');
      } else if (errorMsg.includes('review_not_found')) {
        // Review was already deleted - still clear the UI
        setReview('');
        setRating(0);
        setIsEditingReview(false);
        setIsEditingRating(false);
        setHasSavedReview(false);
        setHasSavedRating(false);
        alert('Review was already deleted.');
      } else {
        alert('Failed to delete review. Please try again.');
        console.error('Delete error:', e);
      }
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
              
              {hasSavedReview && !isEditingReview ? (
                <>
                  <div className="whitespace-pre-wrap border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-2 min-h-[8rem]">
                    {review}
                  </div>
                  <button
                    onClick={() => setIsEditingReview(true)}
                    className="w-full mt-4 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                  >
                    Edit Review
                  </button>
                </>
              ) : (
                <>
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
                  <div className="flex flex-col sm:flex-row gap-2 mt-4">
                    <button
                      onClick={handleSubmitReview}
                      className="flex-1 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                    >
                      {review.trim().length > 0 ? (isEditingReview ? 'Save Review' : 'Submit Review') : 'Submit Review'}
                    </button>
                    {isEditingReview && (
                      <>
                        <button
                          onClick={() => setIsEditingReview(false)}
                          className="flex-1 border-2 border-gray-400 dark:border-gray-500 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleDeleteReview}
                          className="flex-1 border-2 border-red-600 text-red-700 dark:text-red-400 dark:border-red-500 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 bg-white dark:bg-gray-900 transition-colors"
                        >
                          Delete Review
                        </button>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Right: Rating */}
          <div className="lg:col-span-3">
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <h2 className="font-semibold mb-4">
                <span className="text-black dark:text-white">Rating</span>
              </h2>
              
              <div className={`flex justify-center mb-4 ${hasSavedRating && !isEditingRating ? 'pointer-events-none opacity-90' : ''}`}>
                <HeadphoneRating
                  value={rating}
                  onChange={setRating}
                  size="medium"
                />
              </div>
              {hasSavedRating && !isEditingRating ? (
                <button
                  onClick={() => setIsEditingRating(true)}
                  className="w-full border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                >
                  Edit Rating
                </button>
              ) : (
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={handleSubmitRating}
                    className="flex-1 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                  >
                    {hasSavedRating ? (isEditingRating ? 'Update Rating' : 'Submit Rating') : 'Submit Rating'}
                  </button>
                  {isEditingRating && (
                    <button
                      onClick={() => setIsEditingRating(false)}
                      className="flex-1 border-2 border-gray-400 dark:border-gray-500 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
