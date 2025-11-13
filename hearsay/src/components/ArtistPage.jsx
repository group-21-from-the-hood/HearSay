import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getSpotifyArtist, getSpotifyArtistAlbums, getSpotifyAlbum } from '../config/spotify';

export default function ArtistPage() {
  const { artistId } = useParams();
  const navigate = useNavigate();
  
  const [artistDetails, setArtistDetails] = useState(null);
  const [albums, setAlbums] = useState([]);
  const [singles, setSingles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchArtistData = async () => {
      if (!artistId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        const [artistResponse, albumsResponse] = await Promise.all([
          getSpotifyArtist(artistId),
          getSpotifyArtistAlbums(artistId, { include_groups: 'album,single', limit: 50, market: 'US' })
        ]);

        setArtistDetails({
          name: artistResponse.name,
          image: artistResponse.images?.[0]?.url,
          followers: artistResponse.followers?.total,
          genres: artistResponse.genres
        });

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

        // Get full details for albums
        const albumDetailsPromises = albumItems
          .slice(0, 50)
          .map(album => getSpotifyAlbum(album.id));

        const albumDetailsResponses = await Promise.all(albumDetailsPromises);

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

        // Get full details for singles and extract first track
        const singleDetailsPromises = singleItems
          .slice(0, 50)
          .map(single => getSpotifyAlbum(single.id));

        const singleDetailsResponses = await Promise.all(singleDetailsPromises);

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
      } catch (error) {
        console.error('Error fetching artist data:', error);
        setError('An error occurred while loading artist data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchArtistData();
  }, [artistId]);

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
