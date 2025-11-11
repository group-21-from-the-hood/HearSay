import { useState } from 'react';
import Header from './Header';

export default function MyReviewsPage() {
  const [reviews, setReviews] = useState([]);

  return (
    <div className="min-h-screen bg-white pt-16">
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">My Reviews</h1>
        
        {reviews.length === 0 ? (
          <div className="border-2 border-black p-8 text-center">
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
