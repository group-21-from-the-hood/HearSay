import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import HeadphoneRating from './HeadphoneRating';

export default function ReviewPage() {
  const { reviewId } = useParams();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [formRating, setFormRating] = useState(0);
  const [formText, setFormText] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reviews/${reviewId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.ok) {
          setReview(data.review);
          setFormRating(data.review.rating || 0);
          setFormText(data.review.text || '');
        } else {
          setError(data.error || 'Failed to load review');
        }
      } catch (e) {
        setError('Failed to load review');
      } finally {
        setLoading(false);
      }
    };

    if (reviewId) fetchReview();
  }, [reviewId]);

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-xl text-black dark:text-white">Loading review...</div>
      </main>
    );
  }

  if (error || !review) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="border-2 border-red-500 bg-white dark:bg-gray-900 p-6 text-red-500">
          {error || 'Review not found'}
        </div>
      </main>
    );
  }

  const beginEdit = () => {
    setFormRating(review.rating || 0);
    setFormText(review.text || '');
    setEditMode(true);
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditMode(false);
    setFormRating(review.rating || 0);
    setFormText(review.text || '');
    setSaveError(null);
  };

  const saveEdit = async () => {
    if (!review?.canEdit) return;
    setSaving(true);
    setSaveError(null);
    try {
      const body = {
        type: review.type,
        oid: review.oid,
        rating: formRating,
        text: formText,
      };
      const res = await fetch('/api/reviews/upsert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok && data.review) {
        setReview(data.review);
        setEditMode(false);
      } else {
        setSaveError(data.error || 'Failed to save');
      }
    } catch (e) {
      setSaveError('Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 overflow-hidden p-4">
          <div className="flex gap-4 items-start">
            {/* Cover Art */}
            <div className="w-28 h-28 sm:w-32 sm:h-32 flex-shrink-0 border-2 border-black dark:border-white overflow-hidden">
              {review.media?.coverArt ? (
                <img src={review.media.coverArt} alt={review.media?.title || review.oid} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">No Image</div>
              )}
            </div>

            {/* Right column: title, icons, big number, date, text */}
            <div className="flex-1">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between">
                <div className="min-w-0 pr-4">
                  <h2 className="text-sm sm:text-base uppercase tracking-wide font-semibold text-black dark:text-white leading-tight">
                    {review.media?.title || review.oid}
                  </h2>

                  {/* Desktop: small inline icons (no numeric) shown next to title; hidden on mobile */}
                  <div className="hidden sm:flex mt-2 items-center gap-3 pointer-events-none">
                    <HeadphoneRating
                      value={review.rating}
                      onChange={() => {}}
                      size="medium"
                      showBox={false}
                      compact={false}
                    />
                  </div>

                  {/* Mobile: stacked rating (icons above numeric) shown below the title */}
                  <div className="block sm:hidden mt-2">
                    <HeadphoneRating
                      value={review.rating}
                      onChange={() => {}}
                      size="small"
                      showBox={true}
                      boxSizeOverride="medium"
                      compact={false}
                      stackOnSmall={true}
                    />
                  </div>
                </div>

                {/* Desktop-only large numeric preview on the right (hidden on small screens) */}
                <div className="ml-0 sm:ml-4 flex-shrink-0 hidden sm:flex">
                  <HeadphoneRating
                    value={review.rating}
                    onChange={() => {}}
                    size="large"
                    showBox={true}
                    boxSizeOverride="large"
                    compact={false}
                  />
                </div>
              </div>

              {/* Date */}
              <div className="mt-2 text-xs text-gray-600 dark:text-gray-400">
                {new Date(review.createdAt || review.updatedAt || Date.now()).toLocaleString()}
              </div>

              {/* Review text */}
              <div className="mt-3">
                {editMode && review.canEdit ? (
                  <>
                    <textarea
                      value={formText}
                      onChange={e => setFormText(e.target.value)}
                      rows={6}
                      maxLength={8000}
                      className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-3 text-sm"
                      placeholder="Update your review text"
                    />
                    {saveError && <div className="text-red-600 dark:text-red-400 text-sm mt-2">{saveError}</div>}
                    <div className="mt-3 flex gap-3">
                      <button
                        disabled={saving}
                        onClick={saveEdit}
                        className="px-4 py-2 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-60"
                      >{saving ? 'Saving…' : 'Save Changes'}</button>
                      <button
                        disabled={saving}
                        onClick={cancelEdit}
                        className="px-4 py-2 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                      >Cancel</button>
                    </div>
                  </>
                ) : (
                  review.text ? (
                    <p className="whitespace-pre-wrap text-black dark:text-white">{review.text}</p>
                  ) : (
                    <p className="text-gray-600 dark:text-gray-400 italic">No review text</p>
                  )
                )}
                {!editMode && review.canEdit && (
                  <div className="mt-3">
                    <button
                      onClick={beginEdit}
                      className="px-4 py-2 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
                    >Edit Review</button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
