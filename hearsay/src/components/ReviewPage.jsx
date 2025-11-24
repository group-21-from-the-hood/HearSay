import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import HeadphoneRating from './HeadphoneRating';

export default function ReviewPage() {
  const { reviewId } = useParams();
  const [review, setReview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchReview = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/reviews/${reviewId}`, { credentials: 'include' });
        const data = await res.json();
        if (res.ok && data.ok) {
          setReview(data.review);
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
                  <div className="pointer-events-none">
                    <HeadphoneRating value={review.rating} onChange={() => {}} size="medium" />
                  </div>
                </div>
              </div>

              <div className="border-t-2 border-black dark:border-white pt-4">
                {review.text ? (
                  <p className="whitespace-pre-wrap text-black dark:text-white">{review.text}</p>
                ) : (
                  <p className="text-gray-600 dark:text-gray-400 italic">No review text</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
