import { useState } from 'react';

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState([]);

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-black">
        <div className="container mx-auto px-4 py-3">
          <h1 className="text-2xl font-bold">My Reviews</h1>
        </div>
      </header>
      
      <main className="container mx-auto px-4 py-8">
        {reviews.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-600">No reviews yet</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {/* Reviews will be mapped here */}
          </div>
        )}
      </main>
    </div>
  );
}
