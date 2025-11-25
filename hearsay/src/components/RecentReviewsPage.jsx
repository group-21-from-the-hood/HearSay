import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import HeadphoneRating from './HeadphoneRating';

export default function RecentReviewsPage() {
  const [reviews, setReviews] = useState([]);
  const [nextOffset, setNextOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const didInit = useRef(false);
  const navigate = useNavigate();

  const loadMore = async () => {
    if (loading || nextOffset === null) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/recent?limit=20&offset=${nextOffset}`, { credentials: 'include' });
      const data = await res.json();
      if (data.ok) {
        setReviews(prev => [...prev, ...(data.items || [])]);
        setNextOffset(typeof data.nextOffset === 'number' ? data.nextOffset : null);
      }
    } catch (e) {
      console.error('Failed to load recent reviews', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Split reviews by type
  const songReviews = reviews.filter(r => r.type === 'song');
  const albumReviews = reviews.filter(r => r.type === 'album');

  const ReviewCard = ({ r }) => (
    <div
      className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      onClick={() => navigate(`/review/${r.id}`)}
    >
      <div className="flex p-2 gap-3">
        {/* Left: Artwork */}
        <div className="flex-shrink-0 w-24 h-24 md:w-28 md:h-28 border-2 border-black dark:border-white overflow-hidden bg-gray-100 dark:bg-gray-800">
          {r.media?.coverArt ? (
            <img src={r.media.coverArt} alt={r.media?.title || r.oid} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-500 dark:text-gray-400 text-xs">No Image</div>
          )}
        </div>
        {/* Right: Content */}
        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-sm text-black dark:text-white truncate">{r.media?.title || r.oid}</p>
              <p className="text-xs font-medium text-gray-700 dark:text-gray-300 truncate">{r.userName}</p>
              <p className="text-[10px] text-gray-500 dark:text-gray-500">{new Date(r.createdAt).toLocaleDateString()}</p>
            </div>
            <div className="flex-shrink-0 pointer-events-none">
              <HeadphoneRating value={r.rating} onChange={() => {}} size="small" />
            </div>
          </div>
          {/* Review text area with dynamic height & scroll */}
          <div className="mt-1 relative">
            {r.text ? (
              <div className="max-h-32 md:max-h-40 overflow-y-auto pr-1">
                <p className="text-xs text-black dark:text-white whitespace-pre-line">
                  {r.text}
                </p>
              </div>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-500 italic">No review text</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        <span className="text-black dark:text-white">Recent Reviews</span>
      </h1>
      
      {reviews.length === 0 && !loading ? (
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">No reviews yet</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Songs Column */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                <span className="text-black dark:text-white">Songs ({songReviews.length})</span>
              </h2>
              <div className="space-y-2">
                {songReviews.length > 0 ? (
                  songReviews.map(r => <ReviewCard key={r.id} r={r} />)
                ) : (
                  <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-6 text-center">
                    <p className="text-gray-600 dark:text-gray-400">No song reviews yet</p>
                  </div>
                )}
              </div>
            </div>

            {/* Albums Column */}
            <div>
              <h2 className="text-xl font-semibold mb-4">
                <span className="text-black dark:text-white">Albums ({albumReviews.length})</span>
              </h2>
              <div className="space-y-2">
                {albumReviews.length > 0 ? (
                  albumReviews.map(r => <ReviewCard key={r.id} r={r} />)
                ) : (
                  <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-6 text-center">
                    <p className="text-gray-600 dark:text-gray-400">No album reviews yet</p>
                  </div>
                )}
              </div>
            </div>
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
}
