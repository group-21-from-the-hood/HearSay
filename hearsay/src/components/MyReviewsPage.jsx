import { useState } from 'react';

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState([]);

  return (
    <main className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">
        <span className="text-black dark:text-white">My Reviews</span>
      </h1>
      
      {reviews.length === 0 ? (
        <div className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-8 text-center">
          <p className="text-gray-600 dark:text-gray-400">No reviews yet</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {reviews.map(review => (
            <div key={review.id} className="border-2 border-black dark:border-white bg-white dark:bg-gray-900 p-4">
              {/* Review content */}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
