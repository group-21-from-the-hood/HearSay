import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMyReviews, upsertReview, deleteMyReview } from '../config/reviews';
import HeadphoneRating from './HeadphoneRating';
import { sanitizeInput, sanitizeRating } from '../utils/sanitize';

const MyReviewsPage = () => {
  const [reviews, setReviews] = useState([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(false);
  const didInit = useRef(false);
  const [editOpen, setEditOpen] = useState({}); // id -> boolean
  const [textDraft, setTextDraft] = useState({}); // id -> string
  const [ratingDraft, setRatingDraft] = useState({}); // id -> number
  const [saving, setSaving] = useState({}); // id -> 'text' | 'rating' | undefined
  const [expandedReviewId, setExpandedReviewId] = useState(null);

  const loadMore = async () => {
    if (loading || nextOffset === null) return;
    setLoading(true);
    try {
      const { items, nextOffset: no } = await listMyReviews({ limit: 5, offset: nextOffset });
      
      // Enrich album reviews with media metadata
      const enrichedItems = await Promise.all(
        items.map(async (review) => {
          if (review.type === 'album' && review.oid) {
            try {
              const albumResponse = await fetch(`/api/spotify/album/${review.oid}`, { credentials: 'include' });
              if (albumResponse.ok) {
                const albumData = await albumResponse.json();
                if (albumData.ok && albumData.data) {
                  return {
                    ...review,
                    media: {
                      title: albumData.data.name || 'Unknown Album',
                      coverArt: albumData.data.images?.[0]?.url || '',
                      route: `/album/${review.oid}`,
                    },
                  };
                }
              }
            } catch (e) {
              console.error('Failed to fetch album data:', e);
            }
          } else if (review.type === 'song' && review.oid) {
            try {
              const songResponse = await fetch(`/api/spotify/track/${review.oid}`, { credentials: 'include' });
              if (songResponse.ok) {
                const songData = await songResponse.json();
                if (songData.ok && songData.data) {
                  return {
                    ...review,
                    media: {
                      title: songData.data.name || 'Unknown Song',
                      coverArt: songData.data.album?.images?.[0]?.url || '',
                      route: `/song/${review.oid}`,
                    },
                  };
                }
              }
            } catch (e) {
              console.error('Failed to fetch song data:', e);
            }
          } else if (review.type === 'artist' && review.oid) {
            try {
              const artistResponse = await fetch(`/api/spotify/artist/${review.oid}`, { credentials: 'include' });
              if (artistResponse.ok) {
                const artistData = await artistResponse.json();
                if (artistData.ok && artistData.data) {
                  return {
                    ...review,
                    media: {
                      title: artistData.data.name || 'Unknown Artist',
                      coverArt: artistData.data.images?.[0]?.url || '',
                      route: `/artist/${review.oid}`,
                    },
                  };
                }
              }
            } catch (e) {
              console.error('Failed to fetch artist data:', e);
            }
          }
          return review;
        })
      );
      // Deduplicate by id when merging (prevents duplicate key warnings)
      setReviews(prev => {
        const combined = [...prev, ...enrichedItems];
        const seen = new Set();
        return combined.filter(r => {
          const id = r.id;
          if (!id) return true; // keep items lacking id
          if (seen.has(id)) return false;
          seen.add(id);
          return true;
        });
      });
      setNextOffset(typeof no === 'number' ? no : null);
    } catch (e) {
      if (String(e.message).includes('unauthorized')) setAuthError(true);
      else console.error('Failed to load reviews', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Prevent double-invocation in React 18 StrictMode (dev)
    if (didInit.current) return;
    didInit.current = true;
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ensure drafts are initialized for newly loaded reviews
  useEffect(() => {
    setTextDraft(prev => {
      const next = { ...prev };
      for (const r of reviews) if (typeof next[r.id] === 'undefined') next[r.id] = r.text || '';
      return next;
    });
    setRatingDraft(prev => {
      const next = { ...prev };
      for (const r of reviews) if (typeof next[r.id] === 'undefined') next[r.id] = Number(r.rating) || 0;
      return next;
    });
  }, [reviews]);

  const handleToggleEdit = (id, currentText) => {
    setEditOpen(prev => ({ ...prev, [id]: !prev[id] }));
    setTextDraft(prev => ({ ...prev, [id]: typeof prev[id] === 'string' ? prev[id] : (currentText || '') }));
  };

  const handleTextChange = (id, value) => {
    const words = String(value).trim().split(/\s+/).filter(Boolean);
    if (words.length <= 1000 || value.length < (textDraft[id] || '').length) {
      setTextDraft(prev => ({ ...prev, [id]: value }));
    }
  };

  const handleSaveReview = async (id) => {
    const r = reviews.find(x => x.id === id);
    if (!r) return;
    const sanitized = sanitizeInput(textDraft[id] || '');
    if (!sanitized.trim()) {
      alert('Please write a review before saving.');
      return;
    }
    try {
      setSaving(prev => ({ ...prev, [id]: 'text' }));
      const result = await upsertReview({ type: r.type, oid: r.oid, text: sanitized });
      setReviews(prev => prev.map(item => item.id === id ? { ...item, text: result?.text || sanitized, updatedAt: result?.updatedAt || new Date().toISOString() } : item));
      setEditOpen(prev => ({ ...prev, [id]: false }));
    } catch (e) {
      if (String(e.message).includes('unauthorized')) alert('Please sign in to update your review.');
      else alert('Failed to update review. Please try again.');
    } finally {
      setSaving(prev => ({ ...prev, [id]: undefined }));
    }
  };

  const handleUpdateRating = async (id) => {
    const r = reviews.find(x => x.id === id);
    if (!r) return;
    const sanitized = sanitizeRating(ratingDraft[id] ?? 0);
    if (sanitized === 0) {
      alert('Please select a rating before submitting!');
      return;
    }
    try {
      setSaving(prev => ({ ...prev, [id]: 'rating' }));
      const result = await upsertReview({ type: r.type, oid: r.oid, rating: sanitized });
      const newRating = typeof result?.rating === 'number' ? result.rating : sanitized;
      setReviews(prev => prev.map(item => item.id === id ? { ...item, rating: newRating, updatedAt: result?.updatedAt || new Date().toISOString() } : item));
    } catch (e) {
      if (String(e.message).includes('unauthorized')) alert('Please sign in to update your rating.');
      else alert('Failed to update rating. Please try again.');
    } finally {
      setSaving(prev => ({ ...prev, [id]: undefined }));
    }
  };

  const handleDeleteReview = async (id) => {
    const r = reviews.find(x => x.id === id);
    if (!r) return;
    
    if (!confirm('Are you sure you want to delete this review? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteMyReview(r.type, r.oid);
      
      // Successfully deleted - remove from local state
      setReviews(prev => prev.filter(item => item.id !== id));
      
      // Clean up edit state
      setEditOpen(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setTextDraft(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setRatingDraft(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    } catch (e) {
      const errorMsg = String(e.message || e);
      if (errorMsg.includes('unauthorized')) {
        alert('Please sign in to delete your review.');
      } else if (errorMsg.includes('review_not_found')) {
        // Review was already deleted - still remove from UI
        setReviews(prev => prev.filter(item => item.id !== id));
        alert('Review was already deleted.');
      } else {
        alert('Failed to delete review. Please try again.');
        console.error('Delete error:', e);
      }
    }
  };

  // Removed secondary fetchReviews effect to avoid duplicating review entries.

  const toggleExpandReview = (reviewId) => {
    setExpandedReviewId((prevId) => (prevId === reviewId ? null : reviewId));
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        <span className="text-black dark:text-white">My Reviews</span>
      </h1>
      {authError ? (
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">Please sign in to view your reviews.</p>
        </div>
      ) : reviews.length === 0 && !loading ? (
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">No reviews yet</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4">
            {reviews.map(r => (
              <div key={r.id} className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
                  <div className="sm:col-span-1">
                    <Link to={r.media?.route || '#'} className="block group">
                      <div className="w-40 h-40 md:w-44 md:h-44 lg:w-48 lg:h-48 xl:w-56 xl:h-56 border-2 border-black dark:border-white bg-gray-100 dark:bg-gray-800 overflow-hidden mx-auto sm:mx-0">
                        {r.media?.coverArt ? (
                          <img src={r.media.coverArt} alt={r.media?.title || r.oid} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">No Image</div>
                        )}
                      </div>
                      <div className="mt-2">
                        <p className="font-medium text-black dark:text-white group-hover:underline truncate">{r.media?.title || r.oid}</p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 capitalize">{r.type}</p>
                      </div>
                    </Link>
                  </div>
                  {/* make the review panel taller on small screens so text fits */}
                  <div className="sm:col-span-2 border-2 border-black dark:border-white p-3 min-h-[12rem] sm:min-h-0">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Updated {new Date(r.updatedAt || r.createdAt).toLocaleString()}</p>
                      <div className="flex items-center gap-2">
                        {/* stackOnSmall makes the numeric preview sit under the icons on mobile */}
                        <HeadphoneRating
                          value={ratingDraft[r.id] ?? (Number(r.rating) || 0)}
                          onChange={(val) => setRatingDraft(prev => ({ ...prev, [r.id]: val }))}
                          size="small"
                          showBox={true}      // always show numeric preview
                          compact={false}     // show "/5" for clarity
                          stackOnSmall={true} // stack icons above the number on small screens
                        />
                        <button
                          disabled={saving[r.id] === 'rating'}
                          onClick={() => handleUpdateRating(r.id)}
                          className="border-2 border-black dark:border-white px-3 py-1 bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
                        >
                          {saving[r.id] === 'rating' ? 'Saving…' : 'Update Rating'}
                        </button>
                      </div>
                    </div>

                    {!editOpen[r.id] ? (
                      <>
                        {r.text ? (
                          <p className="whitespace-pre-wrap text-black dark:text-white">{r.text}</p>
                        ) : (
                          <p className="text-gray-600 dark:text-gray-400 italic">No review text</p>
                        )}
                        <div className="mt-3 flex gap-2">
                          <button
                            onClick={() => handleToggleEdit(r.id, r.text)}
                            className="border-2 border-black dark:border-white px-3 py-1 bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            Edit Review
                          </button>
                          <button
                            onClick={() => handleDeleteReview(r.id)}
                            className="border-2 border-red-600 dark:border-red-500 px-3 py-1 bg-white dark:bg-gray-900 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            Delete
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="relative">
                          <textarea
                            value={textDraft[r.id] || ''}
                            onChange={(e) => handleTextChange(r.id, e.target.value)}
                            className="w-full h-28 border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-2 pb-6 resize-none"
                            placeholder="Update your review..."
                            maxLength={10000}
                          />
                          <div className="absolute bottom-2 right-2 text-xs italic text-gray-500 dark:text-gray-400">
                            {(() => {
                              const words = String(textDraft[r.id] || '').trim().split(/\s+/).filter(Boolean).length;
                              const remaining = 1000 - words;
                              return `${remaining} ${remaining === 1 ? 'word' : 'words'} remaining`;
                            })()}
                          </div>
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            disabled={saving[r.id] === 'text'}
                            onClick={() => handleSaveReview(r.id)}
                            className="border-2 border-black dark:border-white px-3 py-1 bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
                          >
                            {saving[r.id] === 'text' ? 'Saving…' : 'Save Review'}
                          </button>
                          <button
                            onClick={() => { setEditOpen(prev => ({ ...prev, [r.id]: false })); setTextDraft(prev => ({ ...prev, [r.id]: r.text || '' })); }}
                            className="border-2 border-gray-400 dark:border-gray-500 px-3 py-1 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                          >
                            Cancel
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                {r.type === 'album' && r.trackRatings && Object.keys(r.trackRatings).length > 0 && (
                  <div className="mt-4">
                    <button
                      onClick={() => toggleExpandReview(r.id)}
                      className="text-sm text-blue-500 dark:text-blue-400 hover:underline"
                    >
                      {expandedReviewId === r.id ? 'Hide Track Ratings' : 'Show Track Ratings'}
                    </button>
                    {expandedReviewId === r.id && (
                      <div className="mt-4 border-t-2 border-black dark:border-white pt-4">
                        <h3 className="font-semibold mb-2 text-black dark:text-white">Track Ratings</h3>
                        <div className="space-y-2">
                          {Object.entries(r.trackRatings).map(([trackId, rating]) => (
                            <div key={trackId} className="flex items-center justify-between">
                              <span className="text-sm text-gray-600 dark:text-gray-400">Track {trackId}</span>
                              <span className="text-sm text-black dark:text-white">{rating}/5</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-center">
            {nextOffset !== null ? (
              <button
                disabled={loading}
                onClick={loadMore}
                className="px-4 py-2 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
              >
                {loading ? 'Loading…' : 'Load More'}
              </button>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">End of results</p>
            )}
          </div>
        </>
      )}
    </main>
  );
};

export default MyReviewsPage;
