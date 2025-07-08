import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Header } from '@/components/Header';
import type { ShowWithDetails, SetlistSongWithDetails } from '@/types';
import { notFound } from 'next/navigation';
import { ShowHeader } from './components/ShowHeader';
import { ShowInfo } from './components/ShowInfo';
import { SetlistVoting } from './components/SetlistVoting';
import { VenueInfo } from './components/VenueInfo';

interface ShowPageProps {
  params: {
    id: string;
  };
}

export default async function ShowPage({ params }: ShowPageProps) {
  const supabase = createServerComponentClient({ cookies });

  // Get show with artist and venue details
  const { data: show, error: showError } = await supabase
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
    .eq('id', params.id)
    .single();

  if (showError || !show) {
    notFound();
  }

  // Transform to ShowWithDetails type
  const transformedShow: ShowWithDetails = {
    ...show,
    artist_id: (show as any).artist?.id || '',
    venue_id: (show as any).venue?.id || '',
    artist: (show as any).artist || { id: '', name: '', slug: '', image_url: '', genres: [], followers: 0, verified: false },
    venue: (show as any).venue || { id: '', name: '', slug: '', city: '', state: '', country: '' },
  };

  // Get predicted setlist for this show
  const { data: setlist } = await supabase
    .from('setlists')
    .select('id, type, is_locked')
    .eq('show_id', params.id)
    .eq('type', 'predicted')
    .single();

  let setlistSongs: SetlistSongWithDetails[] = [];

  if (setlist) {
    // Get setlist songs with vote counts
    const { data: songs } = await supabase
      .from('setlist_songs')
      .select(`
        id,
        position,
        upvotes,
        downvotes,
        song:songs (
          id,
          title,
          artist_name,
          spotify_id
        )
      `)
      .eq('setlist_id', setlist.id)
      .order('upvotes', { ascending: false })
      .order('position', { ascending: true });

    setlistSongs = (songs as any[])?.map((song: any) => ({
      ...song,
      setlist_id: setlist.id,
      song_id: song.song?.id || '',
      created_at: new Date().toISOString(),
      song: Array.isArray(song.song) ? song.song[0] : song.song
    })) || [];
  }

  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header className="from-emerald-800">
        <div className="mt-20">
          <ShowHeader show={transformedShow} />
        </div>
      </Header>

      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
          {/* Main Content - Predicted Setlist */}
          <div className="lg:col-span-2">
            <SetlistVoting
              showId={params.id}
              initialSongs={setlistSongs}
              isLocked={setlist?.is_locked || false}
              artistName={transformedShow.artist?.name || 'Unknown Artist'}
            />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ShowInfo show={transformedShow} />
            {transformedShow.venue && (
              <VenueInfo venue={transformedShow.venue} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 