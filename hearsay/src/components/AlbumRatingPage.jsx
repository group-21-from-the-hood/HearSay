import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getSpotifyAlbum } from '../config/spotify';
import { upsertReview, getMyReview, deleteMyReview } from '../config/reviews';
import { useTheme } from '../context/ThemeContext';
import HeadphoneRating from './HeadphoneRating';
import { useToast } from '../context/ToastContext';
import { sanitizeInput, sanitizeRating } from '../utils/sanitize';

const ALBUM_REVIEW_WORD_LIMIT = 1000;

export default function AlbumRatingPage() {
  const { albumId } = useParams();
  const { theme } = useTheme();
  const [album, setAlbum] = useState(null);
  const [albumDetails, setAlbumDetails] = useState(null);
  const [tracks, setTracks] = useState([]);
  const [trackRatings, setTrackRatings] = useState({});
  const [relatedAlbums, setRelatedAlbums] = useState([]);
  const [loading, setLoading] = useState(true);
  const [review, setReview] = useState('');
  const [albumRating, setAlbumRating] = useState(0);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [isEditingRating, setIsEditingRating] = useState(false);
  const [hasSavedReview, setHasSavedReview] = useState(false);
  const [hasSavedRating, setHasSavedRating] = useState(false);
  const { success } = useToast();

  // Calculate word count
  const wordCount = review.trim().split(/\s+/).filter(word => word.length > 0).length;
  const remainingWords = ALBUM_REVIEW_WORD_LIMIT - wordCount;

  useEffect(() => {
    const fetchAlbumData = async () => {
      if (!albumId) return;

      try {
        setLoading(true);
        
        // Always fetch from Spotify to get complete tracklist
        const albumResponse = await getSpotifyAlbum(albumId);
        const albumData = {
          id: albumResponse.id,
          title: albumResponse.name,
          artist: albumResponse.artists?.[0]?.name,
          coverArt: albumResponse.images?.[0]?.url,
          releaseDate: albumResponse.release_date,
          totalTracks: albumResponse.total_tracks,
          label: albumResponse.label,
          popularity: albumResponse.popularity,
          spotifyUrl: albumResponse.external_urls?.spotify,
        };

        // Populate tracklist from Spotify data (always complete list)
        const trackItems = albumResponse.tracks?.items || [];
        setTracks(
          trackItems.map((track) => ({
            id: track.id,
            name: track.name,
            duration: track.duration_ms,
            trackNumber: track.track_number,
          }))
        );

        setAlbum(albumData);
        setAlbumDetails(albumData);
      } catch (error) {
        console.error('Error fetching album data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAlbumData();
  }, [albumId]);

  // Load existing review (text + rating) for this album for the current user
  useEffect(() => {
    const loadMyReview = async () => {
      if (!albumId) return;
      try {
        const existing = await getMyReview('album', albumId);
        if (existing) {
          if (typeof existing.text === 'string') setReview(existing.text);
          if (typeof existing.rating === 'number') setAlbumRating(existing.rating);
          setIsEditingReview(false);
          setIsEditingRating(false);
          const saved = !!(existing && typeof existing.text === 'string' && existing.text.trim().length > 0);
          setHasSavedReview(saved);
          const savedRating = !!(existing && typeof existing.rating === 'number' && existing.rating > 0);
          setHasSavedRating(savedRating);
        }
      } catch (e) {
        // Not logged in or no review; ignore
      }
    };
    loadMyReview();
  }, [albumId]);

  // Load existing track ratings for the current user
  useEffect(() => {
    const loadTrackRatings = async () => {
      if (!tracks.length) return;
      
      try {
        // Fetch reviews for each track
        const ratings = {};
        for (const track of tracks) {
          try {
            const existingReview = await getMyReview('song', track.id);
            if (existingReview && typeof existingReview.rating === 'number') {
              ratings[track.id] = existingReview.rating;
            }
          } catch (e) {
            // No review for this track, skip
          }
        }
        setTrackRatings(ratings);
      } catch (e) {
        // Not logged in or error; ignore
      }
    };
    
    loadTrackRatings();
  }, [tracks]);

  const handleTrackRating = (trackId, rating) => {
    const sanitizedRating = sanitizeRating(rating);
    setTrackRatings(prev => ({
      ...prev,
      [trackId]: sanitizedRating
    }));
  };

  const formatDuration = (ms) => {
    const minutes = Math.floor(ms / 60000);
    const seconds = ((ms % 60000) / 1000).toFixed(0);
    return `${minutes}:${seconds.padStart(2, '0')}`;
  };

  const handleSubmitRatings = async () => {
    try {
      // Filter to only include tracks that have been rated (non-zero ratings)
      const sanitizedRatings = Object.entries(trackRatings)
        .filter(([trackId, rating]) => rating && rating > 0)
        .reduce((acc, [trackId, rating]) => {
          acc[trackId] = sanitizeRating(rating);
          return acc;
        }, {});

      // Check if at least one track has been rated
      if (Object.keys(sanitizedRatings).length === 0) {
        alert('Please rate at least one track before submitting.');
        return;
      }

      // Submit individual song reviews for each rated track
      for (const [trackId, rating] of Object.entries(sanitizedRatings)) {
        await upsertReview({
          type: 'song',
          oid: trackId,
          rating: rating,
        });
      }

      // Calculate album rating as the average of rated tracks only
      const averageRating = Object.values(sanitizedRatings).reduce((sum, rating) => sum + rating, 0) / Object.keys(sanitizedRatings).length;
      setAlbumRating(averageRating);

      // Submit album review with track ratings
      await upsertReview({
        type: 'album',
        oid: albumId,
        rating: sanitizeRating(averageRating),
        trackRatings: sanitizedRatings, // Include individual track ratings for reference
      });

      // Show success message and reset editing state
      success('Album rating and track ratings submitted successfully!');
      setIsEditingRating(false);
      setHasSavedRating(true);
    } catch (error) {
      console.error('Error submitting album rating:', error);
      alert('Failed to submit album rating. Please try again.');
    }
  };

  const handleSubmitReview = async () => {
    const sanitizedReview = sanitizeInput(review);
    
    console.log('Album review:', {
      albumId: album.id,
      albumTitle: album.title,
      review: sanitizedReview,
      wordCount: wordCount
    });
    
    if (!sanitizedReview.trim()) {
      alert('Please write a review before submitting!');
    } else if (wordCount > ALBUM_REVIEW_WORD_LIMIT) {
      alert(`Review exceeds ${ALBUM_REVIEW_WORD_LIMIT} word limit. Please shorten your review.`);
    } else {
      try {
        const saved = await upsertReview({ type: 'album', oid: albumId, text: sanitizedReview, rating: albumRating ? sanitizeRating(albumRating) : undefined });
        // Immediate refetch to ensure state matches server (and scaled rating if added later)
        try {
          const latest = await getMyReview('album', albumId);
          if (latest) {
            if (typeof latest.text === 'string') setReview(latest.text);
            if (typeof latest.rating === 'number') setAlbumRating(latest.rating);
          }
        } catch {}
        setIsEditingReview(false);
        setHasSavedReview(true);
        success('Review saved');
      } catch (e) {
        if (String(e.message).includes('unauthorized')) {
          alert('Please sign in to submit a review.');
        } else if (String(e.message).includes('text_too_long')) {
          alert(`Review exceeds ${ALBUM_REVIEW_WORD_LIMIT} words.`);
        } else {
          alert('Failed to submit review. Please try again.');
        }
      }
    }
  };

  const handleSubmitAlbumRating = async () => {
    const sanitized = sanitizeRating(albumRating);
    if (sanitized === 0) {
      alert('Please select a rating before submitting!');
      return;
    }
    try {
      const saved = await upsertReview({ type: 'album', oid: albumId, rating: sanitized });
      // Refetch to capture any server-side normalization
      try {
        const latest = await getMyReview('album', albumId);
        if (latest && typeof latest.rating === 'number') setAlbumRating(latest.rating);
      } catch {}
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
  };

  const handleReviewChange = (e) => {
    const newText = e.target.value;
    const newWordCount = newText.trim().split(/\s+/).filter(word => word.length > 0).length;
    
    // Only update if within word limit
    if (newWordCount <= ALBUM_REVIEW_WORD_LIMIT || newText.length < review.length) {
      setReview(newText);
    }
  };

  const handleDeleteAlbumReview = async () => {
    if (!albumId) return;
    
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }
    
    try {
      await deleteMyReview('album', albumId);
      
      // Successfully deleted
      setReview('');
      setAlbumRating(0);
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
        setAlbumRating(0);
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
          <div className="text-xl text-black dark:text-white">Loading album details...</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cover Art and Info */}
          <div className="lg:col-span-4">
            <div className="aspect-square border-2 border-black dark:border-white bg-white dark:bg-gray-900 mb-4">
              {album?.coverArt && (
                <img src={album.coverArt} alt={album.title} className="w-full h-full object-cover" />
              )}
            </div>

            {/* Album Info */}
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <div className="text-sm space-y-2">
                <p><span className="font-semibold">Release Date:</span> {albumDetails?.releaseDate}</p>
                <p><span className="font-semibold">Label:</span> {albumDetails?.label}</p>
                <p><span className="font-semibold">Total Tracks:</span> {albumDetails?.totalTracks}</p>
              </div>
            </div>
          </div>

          {/* Middle Column - Player, Review, Album Rating */}
          <div className="lg:col-span-5">
            {/* Embedded Player */}
            <div className="border-2 border-black dark:border-white overflow-hidden mb-4" style={{ backgroundColor: theme === 'dark' ? '#121212' : '#ffffff' }}>
              <iframe
                key={album?.id}
                style={{ borderRadius: '0' }}
                src={`https://open.spotify.com/embed/album/${album?.id}?utm_source=generator`}
                width="100%"
                height="352"
                frameBorder="0"
                allowFullScreen=""
                allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                loading="lazy"
                className="w-full"
              />
            </div>
            
            {/* Review text above rating */}
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white mb-6">
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
                      maxLength={10000}
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
                          onClick={handleDeleteAlbumReview}
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

            {/* Album Rating below review text */}
            <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
              <h2 className="font-semibold mb-4">
                <span className="text-black dark:text-white">Album Rating</span>
              </h2>
              <div className={`flex justify-center mb-4 ${hasSavedRating && !isEditingRating ? 'pointer-events-none opacity-90' : ''}`}>
                <HeadphoneRating
                  value={albumRating}
                  onChange={setAlbumRating}
                  size="medium"
                  showBox={true}
                  boxSizeOverride="large"
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
                    onClick={handleSubmitAlbumRating}
                    className="flex-1 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                  >
                    {hasSavedRating ? (isEditingRating ? 'Update Rating' : 'Submit Album Rating') : 'Submit Album Rating'}
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

          {/* Track List */}
          <div className="lg:col-span-3">
            <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white flex flex-col" style={{ maxHeight: 'calc(100vh - 8rem)' }}>
              <h2 className="font-semibold p-4 pb-2 border-b-2 border-black dark:border-white">
                <span className="text-black dark:text-white">Track List</span>
              </h2>
              {/* Reduced padding so track rows have more horizontal room */}
              <div className="overflow-y-auto p-1 pt-1 flex-1">
                <div className="space-y-1">
                  {tracks.map((track) => (
                    <div
                      key={track.id}
                      /* single column on mobile so elements stack; compact 3-col on sm+ */
                      className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] items-start gap-x-2 gap-y-2 py-3 sm:py-1 border-b border-black dark:border-white last:border-0 min-h-[4.25rem] sm:min-h-0"
                    >
                      {/* Track number */}
                      <div className="text-right text-gray-500 dark:text-gray-400 text-sm pr-1 pl-2 sm:order-1">
                        {track.trackNumber}
                      </div>

                      {/* Title and rating stacked */}
                      <div className="min-w-0 pl-3 sm:order-2 flex flex-col">
                        <Link
                          to={`/song/${track.id}`}
                          className="block text-sm text-black dark:text-white hover:underline whitespace-normal break-words mb-1"
                        >
                          {track.name}
                        </Link>
                        <div>
                          <HeadphoneRating
                            size="small"
                            value={trackRatings[track.id] || 0}
                            onChange={(rating) => handleTrackRating(track.id, rating)}
                            showBox={true}
                            compact={true}
                            /* stackOnSmall default for small size will stack icons above number if needed */
                          />
                        </div>
                      </div>

                      {/* Duration */}
                      <div className="text-right text-gray-500 dark:text-gray-400 text-xs pr-1 sm:order-4">
                        {formatDuration(track.duration)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Submit Rating Button */}
              <div className="p-4 border-t-2 border-black dark:border-white">
                <button 
                  onClick={handleSubmitRatings}
                  className="w-full border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                >
                  Submit Ratings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Related Albums */}
      <div className="mt-12">
        <h2 className="text-xl font-semibold mb-4">
          <span className="text-black dark:text-white">Related Albums</span>
        </h2>
        <div className="border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900">
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {relatedAlbums.map(related => (
              <div key={related.id} className="cursor-pointer">
                <div className="aspect-square">
                  <img src={related.coverArt} alt={related.title} className="w-full h-full object-cover" />
                </div>
                <p className="mt-2 text-center truncate">{related.title}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
