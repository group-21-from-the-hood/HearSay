import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSpotifyArtist, getSpotifyArtistAlbums, getSpotifyAlbum, getSpotifyAlbums, getSavedArtist } from '../config/spotify';
import { upsertReview, getMyReview, deleteMyReview } from '../config/reviews';
import HeadphoneRating from './HeadphoneRating';
import { sanitizeInput, sanitizeRating } from '../utils/sanitize';

export default function ArtistPage() {
  const { artistId } = useParams();
  const navigate = useNavigate();
  

  const [artistDetails, setArtistDetails] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [singles, setSingles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewText, setReviewText] = useState('');
  const [artistRating, setArtistRating] = useState(0);
  const [topSongs, setTopSongs] = useState([]);
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [isEditingRating, setIsEditingRating] = useState(false);
  const [hasSavedReview, setHasSavedReview] = useState(false);
  const [hasSavedRating, setHasSavedRating] = useState(false);
  const ARTIST_REVIEW_WORD_LIMIT = 1000;

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!artistId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Prefer saved artist metadata in DB first; fallback to Spotify
        let artistMeta = null;
        try {
          artistMeta = await getSavedArtist(artistId);
        } catch {}

        if (artistMeta) {
          setArtistDetails({
            name: artistMeta.name,
            image: artistMeta.image,
            followers: artistMeta.followers,
            genres: artistMeta.genres,
          });
        } else {
          const artistResponse = await getSpotifyArtist(artistId);
          setArtistDetails({
            name: artistResponse.name,
            image: artistResponse.images?.[0]?.url,
            followers: artistResponse.followers?.total,
            genres: artistResponse.genres
          });
        }

        // Always fetch albums/singles live (not yet cached)
        const albumsResponse = await getSpotifyArtistAlbums(artistId, { include_groups: 'album,single', limit: 50, market: 'US' });

        const albumItems = [];
        const singleItems = [];
        const seenAlbums = new Map();
        const seenSingles = new Map();

        (albumsResponse.items || []).forEach(item => {
          const key = item.name.toLowerCase().trim();
          
          if (item.album_type === 'album') {
            if (!seenAlbums.has(key)) {
              seenAlbums.set(key, item);
              albumItems.push(item);
            }
          } else if (item.album_type === 'single') {
            if (!seenSingles.has(key)) {
              seenSingles.set(key, item);
              singleItems.push(item);
            }
          }
        });

        // Get full details for albums in batches to avoid rate limits
        const albumIds = albumItems.slice(0, 50).map(a => a.id);
        const batchedAlbumsResp = await getSpotifyAlbums(albumIds);
        const albumDetailsResponses = Array.isArray(batchedAlbumsResp?.albums) ? batchedAlbumsResp.albums : [];

        const sortedAlbums = albumDetailsResponses
          .map(r => ({
            id: r.id,
            title: r.name,
            artist: r.artists?.[0]?.name,
            coverArt: r.images?.[0]?.url,
            releaseDate: r.release_date,
            totalTracks: r.total_tracks,
            popularity: r.popularity || 0,
            type: r.album_type,
            spotifyUrl: r.external_urls?.spotify
          }))
          .sort((a, b) => b.popularity - a.popularity);

        // Get full details for singles in batches and extract first track
        const singleIds = singleItems.slice(0, 50).map(s => s.id);
        const batchedSinglesResp = await getSpotifyAlbums(singleIds);
        const singleDetailsResponses = Array.isArray(batchedSinglesResp?.albums) ? batchedSinglesResp.albums : [];

        const sortedSingles = singleDetailsResponses
          .map(r => {
            const firstTrack = r.tracks?.items?.[0];
            return {
              id: firstTrack?.id || r.id,
              title: r.name,
              artist: r.artists?.[0]?.name,
              coverArt: r.images?.[0]?.url,
              releaseDate: r.release_date,
              totalTracks: r.total_tracks,
              popularity: r.popularity || 0,
              type: r.album_type,
              spotifyUrl: r.external_urls?.spotify,
              album: r.name,
            };
          })
          .sort((a, b) => b.popularity - a.popularity);

        setAlbums(sortedAlbums);
        setSingles(sortedSingles);

        // Load existing review
        try {
          const existing = await getMyReview('artist', artistId);
          if (existing) {
            if (typeof existing.text === 'string') setReviewText(existing.text);
            if (typeof existing.rating === 'number') setArtistRating(existing.rating);
            setIsEditingReview(false);
            setIsEditingRating(false);
            const saved = !!(existing && typeof existing.text === 'string' && existing.text.trim().length > 0);
            setHasSavedReview(saved);
            const savedRating = !!(existing && typeof existing.rating === 'number' && existing.rating > 0);
            setHasSavedRating(savedRating);
          }
        } catch {}

        // Fetch top rated songs for this artist
        try {
          const resp = await fetch(`/api/reviews/top-songs-for-artist?artistId=${encodeURIComponent(artistId)}&limit=5`, { credentials: 'include' });
          const data = await resp.json().catch(() => null);
          if (resp.ok && data?.ok) setTopSongs(Array.isArray(data.songs) ? data.songs : []);
        } catch {}
      } catch (error) {
        console.error('Error fetching artist data:', error);
        setError('An error occurred while loading artist data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchArtistData();
  }, [artistId]);

  const wordCount = reviewText.trim().split(/\s+/).filter(w => w.length > 0).length;
  const remainingWords = ARTIST_REVIEW_WORD_LIMIT - wordCount;

  const handleReviewChange = (e) => {
    const text = e.target.value;
    const wc = text.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wc <= ARTIST_REVIEW_WORD_LIMIT || text.length < reviewText.length) setReviewText(text);
  };

  const handleSubmitArtistReview = async () => {
    const sanitized = sanitizeInput(reviewText);
    if (!sanitized.trim()) {
      alert('Please write a review before submitting!');
      return;
    }
    if (wordCount > ARTIST_REVIEW_WORD_LIMIT) {
      alert(`Review exceeds ${ARTIST_REVIEW_WORD_LIMIT} word limit.`);
      return;
    }
    try {
      await upsertReview({ type: 'artist', oid: artistId, text: sanitized, rating: artistRating ? sanitizeRating(artistRating) : undefined });
      setIsEditingReview(false);
      setHasSavedReview(true);
    } catch (e) {
      if (String(e.message).includes('unauthorized')) alert('Please sign in to submit a review.');
      else alert('Failed to submit review.');
    }
  };

  const handleSubmitArtistRating = async () => {
    const sanitized = sanitizeRating(artistRating);
    if (sanitized === 0) { alert('Select a rating first.'); return; }
    try {
      await upsertReview({ type: 'artist', oid: artistId, rating: sanitized });
      setIsEditingRating(false);
      setHasSavedRating(true);
    } catch (e) {
      if (String(e.message).includes('unauthorized')) alert('Please sign in to submit a rating.');
      else alert('Failed to submit rating.');
    }
  };

  const handleDeleteArtistReview = async () => {
    try {
      const deleted = await deleteMyReview('artist', artistId);
      if (deleted) {
        setReviewText('');
        setArtistRating(0);
        alert('Your artist review was deleted.');
        setIsEditingReview(false);
        setIsEditingRating(false);
        setHasSavedReview(false);
        setHasSavedRating(false);
      } else {
        alert('No existing review to delete.');
      }
    } catch (e) {
      if (String(e.message).includes('unauthorized')) alert('Please sign in to delete your review.');
      else alert('Failed to delete review.');
    }
  };

  if (loading) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-xl text-black dark:text-white">Loading artist...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="border-2 border-red-500 bg-white dark:bg-gray-900 p-6 text-red-500">
          {error}
        </div>
      </main>
    );
  }

  if (!artistId) {
    return (
      <main className="container mx-auto px-4 py-8">
        <div className="text-center text-xl text-black dark:text-white">Artist not found</div>
      </main>
    );
  }

  return (
    <main className="container mx-auto px-4 py-8">
      {/* Artist Header */}
      <div className="mb-12">
        <div className="flex flex-col md:flex-row items-start gap-8">
          <div className="w-full md:w-64 aspect-square md:h-64 flex-shrink-0 border-2 border-black dark:border-white">
            {artistDetails?.image ? (
              <img 
                src={artistDetails.image} 
                alt={artistDetails.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                No Image
              </div>
            )}
          </div>
          <div className="flex-1">
            <h1 className="text-2xl md:text-4xl font-bold mb-4">
              <span className="text-black dark:text-white">{artistDetails?.name}</span>
            </h1>
            <div className="space-y-3 text-base text-black dark:text-white">
              <p>
                <span className="font-semibold">Followers:</span>{' '}
                {artistDetails?.followers?.toLocaleString()}
              </p>
              {artistDetails?.genres && artistDetails.genres.length > 0 && (
                <p>
                  <span className="font-semibold">Genres:</span>{' '}
                  {artistDetails.genres.join(', ')}
                </p>
              )}
              <div>
                <p className="font-semibold mb-2">About:</p>
                <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                  {artistDetails?.name} is a {artistDetails?.genres?.[0] || 'music'} artist with{' '}
                  {artistDetails?.followers?.toLocaleString()} followers on Spotify. 
                  {artistDetails?.genres && artistDetails.genres.length > 1 && (
                    <> Their music spans across {artistDetails.genres.slice(0, 3).join(', ')} genres.</>
                  )}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Artist Review & Rating */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-12">
        <div className="lg:col-span-8 border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
          <h2 className="font-semibold mb-4"><span className="text-black dark:text-white">Artist Review</span></h2>
          {hasSavedReview && !isEditingReview ? (
            <>
              <div className="whitespace-pre-wrap border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-2 min-h-[8rem]">{reviewText}</div>
              <button
                onClick={() => setIsEditingReview(true)}
                className="w-full mt-4 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
              >Edit Review</button>
            </>
          ) : (
            <>
              <div className="relative">
                <textarea
                  value={reviewText}
                  onChange={handleReviewChange}
                  className="w-full h-32 border-2 border-black dark:border-white bg-white dark:bg-gray-800 text-black dark:text-white p-2 pb-6 resize-none"
                  placeholder="Write your review of this artist..."
                  maxLength={5000}
                />
                <div className="absolute bottom-2 right-2 text-xs italic text-gray-500 dark:text-gray-400">
                  {remainingWords} {remainingWords === 1 ? 'word' : 'words'} remaining
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 mt-4">
                <button
                  onClick={handleSubmitArtistReview}
                  className="flex-1 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                >{reviewText.trim().length > 0 ? (isEditingReview ? 'Save Review' : 'Submit Review') : 'Submit Review'}</button>
                {isEditingReview && (
                  <>
                    <button
                      onClick={() => setIsEditingReview(false)}
                      className="flex-1 border-2 border-gray-400 dark:border-gray-500 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                    >Cancel</button>
                    <button
                      onClick={handleDeleteArtistReview}
                      className="flex-1 border-2 border-red-600 text-red-700 dark:text-red-400 dark:border-red-500 py-2 hover:bg-red-50 dark:hover:bg-red-900/20 bg-white dark:bg-gray-900 transition-colors"
                    >Delete Review</button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
        <div className="lg:col-span-4 border-2 border-black dark:border-white p-4 bg-white dark:bg-gray-900 text-black dark:text-white">
          <h2 className="font-semibold mb-4"><span className="text-black dark:text-white">Artist Rating</span></h2>
          <div className={`flex justify-center mb-4 ${hasSavedRating && !isEditingRating ? 'pointer-events-none opacity-90' : ''}`}>
            <HeadphoneRating value={artistRating} onChange={setArtistRating} size="medium" />
          </div>
          {hasSavedRating && !isEditingRating ? (
            <button
              onClick={() => setIsEditingRating(true)}
              className="w-full border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
            >Edit Rating</button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              <button
                onClick={handleSubmitArtistRating}
                className="flex-1 border-2 border-black dark:border-white py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
              >{hasSavedRating ? (isEditingRating ? 'Update Rating' : 'Submit Rating') : 'Submit Rating'}</button>
              {isEditingRating && (
                <button
                  onClick={() => setIsEditingRating(false)}
                  className="flex-1 border-2 border-gray-400 dark:border-gray-500 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 bg-white dark:bg-gray-900 text-black dark:text-white transition-colors"
                >Cancel</button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Top Rated Songs */}
      <div className="mb-12">
        <h2 className="text-2xl font-semibold mb-6"><span className="text-black dark:text-white">Top Rated Songs</span></h2>
        {topSongs.length ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-5 gap-4">
            {topSongs.map(song => (
              <div key={song.id} className="group cursor-pointer" onClick={() => navigate(`/song/${song.id}`)}>
                <div className="aspect-square mb-2 border-2 border-black dark:border-white">
                  {song.coverArt ? (
                    <img src={song.coverArt} alt={song.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">No Image</div>
                  )}
                </div>
                <p className="font-medium text-center truncate text-black dark:text-white group-hover:underline">{song.title}</p>
                <p className="text-xs text-center text-gray-600 dark:text-gray-400 truncate">Avg {typeof song.avgRating === 'number' ? song.avgRating.toFixed(1) : song.avgRating} · {song.reviewCount} reviews</p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No rated songs yet</p>
        )}
      </div>

      {/* Albums Section */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-6">
          <span className="text-black dark:text-white">Albums ({albums.length})</span>
        </h2>
        {albums.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {albums.map(album => (
              <div
                key={album.id}
                className="cursor-pointer group"
                onClick={() => navigate(`/album/${album.id}`)}
              >
                <div className="aspect-square mb-2 border-2 border-black dark:border-white">
                  {album.coverArt ? (
                    <img 
                      src={album.coverArt} 
                      alt={album.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                      No Image
                    </div>
                  )}
                </div>
                <p className="font-medium text-center truncate text-black dark:text-white group-hover:underline">
                  {album.title}
                </p>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400 truncate">
                  {album.releaseDate?.split('-')[0]}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No albums found for this artist</p>
        )}
      </section>

      {/* Singles Section */}
      <section>
        <h2 className="text-2xl font-semibold mb-6">
          <span className="text-black dark:text-white">Singles ({singles.length})</span>
        </h2>
        {singles.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {singles.map(single => (
              <div
                key={single.id}
                className="cursor-pointer group"
                onClick={() => navigate(`/song/${single.id}`)}
              >
                <div className="aspect-square mb-2 border-2 border-black dark:border-white">
                  {single.coverArt ? (
                    <img 
                      src={single.coverArt} 
                      alt={single.title} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-black dark:text-white">
                      No Image
                    </div>
                  )}
                </div>
                <p className="font-medium text-center truncate text-black dark:text-white group-hover:underline">
                  {single.title}
                </p>
                <p className="text-sm text-center text-gray-600 dark:text-gray-400 truncate">
                  {single.releaseDate?.split('-')[0]}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 dark:text-gray-400">No singles found for this artist</p>
        )}
      </section>
    </main>
  );
}
