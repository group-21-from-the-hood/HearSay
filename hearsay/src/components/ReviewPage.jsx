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
      <div className="max-w-3xl mx-auto">
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
            {/* Media Info */}
            <div className="md:col-span-1">
              <Link to={review.media?.route || '#'} className="block group">
                <div className="aspect-square border-2 border-black dark:border-white bg-gray-100 dark:bg-gray-800 overflow-hidden mb-3">
                  {review.media?.coverArt ? (
                    <img src={review.media.coverArt} alt={review.media?.title || review.oid} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400">No Image</div>
                  )}
                </div>
                <p className="font-medium text-black dark:text-white group-hover:underline">{review.media?.title || review.oid}</p>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{review.type}</p>
              </Link>
            </div>

            {/* Review Content */}
            <div className="md:col-span-2">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-black dark:text-white">{review.userName}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {new Date(review.createdAt).toLocaleDateString()} at {new Date(review.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                  <div>
                    {editMode && review.canEdit ? (
                      <HeadphoneRating value={formRating} onChange={v => setFormRating(v)} size="medium" />
                    ) : (
                      <div className="pointer-events-none">
                        <HeadphoneRating value={review.rating} onChange={() => {}} size="medium" />
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="border-t-2 border-black dark:border-white pt-4 space-y-4">
                {editMode && review.canEdit ? (
                  <>
                    <textarea
                      value={formText}
                      onChange={e => setFormText(e.target.value)}
                      rows={8}
                      maxLength={8000}
                      className="w-full border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-3 text-sm"
                      placeholder="Update your review text"
                    />
                    {saveError && (
                      <div className="text-red-600 dark:text-red-400 text-sm">{saveError}</div>
                    )}
                    <div className="flex gap-3 flex-wrap">
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
                  <div>
                    <button
                      onClick={beginEdit}
                      className="mt-2 px-4 py-2 border-2 border-black dark:border-white bg-white dark:bg-gray-900 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-gray-800"
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
