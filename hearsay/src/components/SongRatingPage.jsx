import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import HeadphoneRating from './HeadphoneRating';
import { sanitizeInput, sanitizeRating } from '../utils/sanitize';

const SONG_REVIEW_WORD_LIMIT = 1000;

export default function SongRatingPage() {
  const { songId } = useParams();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { success } = useToast?.() || { success: () => {} };

  const [song, setSong] = useState(null); // basic display info
  const [songDetails, setSongDetails] = useState(null); // spotify detail payload if needed
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState('');
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [isEditingRating, setIsEditingRating] = useState(false);
  const [hasSavedReview, setHasSavedReview] = useState(false);
  const [hasSavedRating, setHasSavedRating] = useState(false);
  const [savingRating, setSavingRating] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Calculate word count
  const wordCount = review.trim().length ? review.trim().split(/\s+/).filter(word => word.length > 0).length : 0;
  const remainingWords = SONG_REVIEW_WORD_LIMIT - wordCount;

  useEffect(() => {
    let cancelled = false;
    async function fetchData() {
      if (!songId) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setSaveError(null);
      try {
        // Fetch song details (Spotify proxy)
        const [trackRes, myReviewRes] = await Promise.allSettled([
          fetch(`/api/spotify/track/${encodeURIComponent(songId)}`, { credentials: 'include' }),
          fetch(`/api/reviews/my?type=song&oid=${encodeURIComponent(songId)}`, { credentials: 'include' }),
        ]);

        if (!cancelled) {
          // Track
          if (trackRes.status === 'fulfilled' && trackRes.value.ok) {
            const tjson = await trackRes.value.json().catch(() => null);
            if (tjson?.ok && tjson.data) {
              const data = tjson.data;
              setSong({
                id: data.id,
                title: data.name,
                artist: data.artists?.[0]?.name,
                coverArt: data.album?.images?.[0]?.url,
              });
              setSongDetails(data);
            } else {
              // Try to parse raw
              setSong(null);
              setSongDetails(null);
            }
          } else {
            // network or spotify failure -> still continue
          }

          // My review
          if (myReviewRes.status === 'fulfilled' && myReviewRes.value.ok) {
            const rjson = await myReviewRes.value.json().catch(() => null);
            if (rjson?.ok && rjson.review) {
              const rv = rjson.review;
              if (typeof rv.text === 'string') setReview(rv.text);
              if (typeof rv.rating === 'number') setRating(rv.rating);
              const savedText = !!(rv.text && String(rv.text).trim().length > 0);
              const savedRatingFlag = !!(typeof rv.rating === 'number' && rv.rating > 0);
              setHasSavedReview(savedText);
              setHasSavedRating(savedRatingFlag);
              setIsEditingReview(false);
              setIsEditingRating(false);
            } else {
              setReview('');
              setRating(0);
              setHasSavedReview(false);
              setHasSavedRating(false);
            }
          }
        }
      } catch (e) {
        if (!cancelled) {
          console.error('Song page load failed', e);
          setSaveError('Failed to load song details');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [songId]);

  const formatDuration = (ms) => {
    if (!ms && ms !== 0) return '';
    const minutes = Math.floor(ms / 60000);
    const seconds = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const handleSubmitRating = async () => {
    const sanitized = sanitizeRating(rating);
    if (sanitized === 0) {
      alert('Please select a rating before submitting!');
      return;
    }
    setSavingRating(true);
    setSaveError(null);
    try {
      const resp = await fetch('/api/reviews/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'song', oid: songId, rating: sanitized }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        const err = data.error || 'Failed to save rating';
        setSaveError(err);
        if (String(err).includes('unauthorized')) alert('Please sign in to submit a rating.');
        else alert('Failed to save rating. ' + String(err));
        return;
      }
      // Server stores rating as doubled Int32; response includes review object - try to extract
      const savedReview = data.review || null;
      if (savedReview && typeof savedReview.rating === 'number') {
        setRating(savedReview.rating);
      } else {
        setRating(sanitized);
      }
      setHasSavedRating(true);
      setIsEditingRating(false);
      success?.('Rating saved');
    } catch (e) {
      console.error('Submit rating failed', e);
      setSaveError('Network error while saving rating');
      alert('Network error while saving rating. Please try again.');
    } finally {
      setSavingRating(false);
    }
  };

  const handleSubmitReview = async () => {
    const sanitized = sanitizeInput(review);
    if (!sanitized.trim()) {
      alert('Please write a review before submitting!');
      return;
    }
    if (wordCount > SONG_REVIEW_WORD_LIMIT) {
      alert(`Review exceeds ${SONG_REVIEW_WORD_LIMIT} word limit.`);
      return;
    }
    try {
      const resp = await fetch('/api/reviews/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'song', oid: songId, text: sanitized, rating: (hasSavedRating ? sanitizeRating(rating) : undefined) }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        const err = data.error || 'Failed to save review';
        if (String(err).includes('unauthorized')) alert('Please sign in to submit a review.');
        else alert('Failed to save review. ' + String(err));
        return;
      }
      setHasSavedReview(true);
      setIsEditingReview(false);
      success?.('Review saved');
    } catch (e) {
      console.error('Submit review failed', e);
      alert('Network error while saving review');
    }
  };

  const handleDeleteReview = async () => {
    if (!confirm('Are you sure you want to delete your review? This action cannot be undone.')) return;
    try {
      const resp = await fetch('/api/reviews/my', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ type: 'song', oid: songId }),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok || !data.ok) {
        alert('Failed to delete review');
        return;
      }
      setReview('');
      setRating(0);
      setHasSavedReview(false);
      setHasSavedRating(false);
      setIsEditingReview(false);
      setIsEditingRating(false);
      success?.('Review deleted');
    } catch (e) {
      console.error('Delete review failed', e);
      alert('Network error while deleting review');
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-xl text-black dark:text-white">Loading song details...</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Cover Art and Info */}
        <div className="lg:col-span-4">
          <div className="aspect-square border-2 border-black dark:border-white bg-white dark:bg-gray-900 mb-4">
            {song?.coverArt ? (
              <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">No Image</div>
            )}
          </div>
          <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
            <div className="text-sm space-y-2">
              <p><span className="font-semibold">Artist:</span> {song?.artist}</p>
              <p><span className="font-semibold">Duration:</span> {songDetails ? formatDuration(songDetails.duration_ms) : ''}</p>
            </div>
          </div>
        </div>

        {/* Middle Column - Player and Review */}
        <div className="lg:col-span-5">
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

          <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
            <h2 className="font-semibold mb-4"><span className="text-black dark:text-white">Review</span></h2>

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
                    onChange={(e) => setReview(e.target.value)}
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
            <h2 className="font-semibold mb-4"><span className="text-black dark:text-white">Rating</span></h2>

            <div className={`flex justify-center mb-4 ${hasSavedRating && !isEditingRating ? 'pointer-events-none opacity-90' : ''}`}>
              <HeadphoneRating value={rating} onChange={setRating} size="medium" />
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
                  disabled={savingRating}
                  className="flex-1 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors disabled:opacity-60"
                >
                  {savingRating ? 'Saving…' : (hasSavedRating ? (isEditingRating ? 'Update Rating' : 'Submit Rating') : 'Submit Rating')}
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
            {saveError && <div className="mt-2 text-sm text-red-600 dark:text-red-400">{String(saveError)}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
