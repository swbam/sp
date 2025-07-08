import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Header } from '@/components/Header';
import { ShowCard } from '@/components/ShowCard';
import type { ShowWithDetails } from '@/types';
import Image from 'next/image';

export default async function ShowsPage() {
  const supabase = createServerComponentClient({ cookies });

  // Get upcoming shows with artist and venue details
  const { data: upcomingShows } = await supabase
    .from('shows')
    .select(`
      id,
      name,
      date,
      start_time,
      status,
      ticket_url,
      created_at,
      updated_at,
      artist:artists (
        id,
        name,
        slug,
        image_url,
        genres,
        followers,
        verified
      ),
      venue:venues (
        id,
        name,
        slug,
        city,
        state,
        country,
        capacity
      )
    `)
    .eq('status', 'upcoming')
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true })
    .limit(20);

  // Get featured shows (shows with high activity)
  const { data: featuredShows } = await supabase
    .from('shows')
    .select(`
      id,
      name,
      date,
      start_time,
      status,
      ticket_url,
      created_at,
      updated_at,
      artist:artists (
        id,
        name,
        slug,
        image_url,
        genres,
        followers,
        verified
      ),
      venue:venues (
        id,
        name,
        slug,
        city,
        state,
        country,
        capacity
      )
    `)
    .eq('status', 'upcoming')
    .gte('date', new Date().toISOString().split('T')[0])
    .order('created_at', { ascending: false })
    .limit(6);

  // Transform the data to match ShowWithDetails type
  const transformShows = (shows: any[]): ShowWithDetails[] => {
    return shows?.map((show: any) => ({
      ...show,
      artist_id: show.artist?.id || '',
      venue_id: show.venue?.id || '',
      artist: show.artist || { id: '', name: '', slug: '', image_url: '', genres: [], followers: 0, verified: false },
      venue: show.venue || { id: '', name: '', slug: '', city: '', state: '', country: '' },
    })) || [];
  };

  const transformedUpcoming = transformShows(upcomingShows || []);
  const transformedFeatured = transformShows(featuredShows || []);

  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header>
        <div className="mb-2">
          <h1 className="text-white text-3xl font-semibold">
            Upcoming Shows
          </h1>
          <p className="text-neutral-400 text-sm mt-2">
            Discover concerts and predict setlists for your favorite artists
          </p>
        </div>
      </Header>

      <div className="px-6 pb-6">
        {/* Featured Shows Section */}
        {transformedFeatured.length > 0 && (
          <div className="mb-8">
            <h2 className="text-white text-2xl font-semibold mb-4">
              Featured Shows
            </h2>
            <p className="text-neutral-400 text-sm mb-6">
              Recently announced concerts with active setlist predictions
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {transformedFeatured.slice(0, 6).map((show) => (
                <div key={show.id} className="bg-neutral-800 rounded-lg p-4 hover:bg-neutral-700 transition cursor-pointer"
                     onClick={() => window.location.href = `/shows/${show.id}`}>
                  <div className="flex items-center gap-4">
                    <div className="relative w-16 h-16 rounded-md overflow-hidden">
                      <Image
                        src={show.artist?.image_url || "/images/music-placeholder.png"}
                        alt={show.artist?.name || 'Artist'}
                        fill
                        className="object-cover"
                      />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium truncate">{show.name}</h3>
                      <p className="text-neutral-400 text-sm truncate">{show.artist?.name}</p>
                      <p className="text-neutral-500 text-xs">
                        {new Date(show.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        {show.venue && ` • ${show.venue.city}`}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* All Upcoming Shows */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-2xl font-semibold">
              All Upcoming Shows
            </h2>
            {transformedUpcoming.length > 0 && (
              <p className="text-neutral-400 text-sm">
                {transformedUpcoming.length} show{transformedUpcoming.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {transformedUpcoming.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">🎵</div>
              <p className="text-neutral-400 text-lg mb-2">No upcoming shows</p>
              <p className="text-neutral-500 text-sm">
                Check back soon for new concert announcements!
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {transformedUpcoming.map((show) => (
                <ShowCard key={show.id} show={show} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}