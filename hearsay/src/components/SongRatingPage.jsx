import { useLocation } from 'react-router-dom';

export default function SongRatingPage() {
  const location = useLocation();
  const song = location.state?.item;

  return (
    <div className="min-h-screen bg-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-6">{song?.title}</h1>
        <div className="flex gap-8">
          <div className="w-64 h-64">
            <img src={song?.coverArt} alt={song?.title} className="w-full h-full object-cover" />
          </div>
          <div className="flex-1">
            <p className="text-xl mb-4">Artist: {song?.artist}</p>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Rate this song:</h2>
              {/* Rating implementation will go here */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
