import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Header } from '@/components/Header';
import type { ShowWithDetails, SetlistSongWithDetails } from '@/types';
import { notFound } from 'next/navigation';
import { ShowHeader } from './components/ShowHeader';
import { ShowInfo } from './components/ShowInfo';
import { SetlistVoting } from './components/SetlistVoting';
import { VenueInfo } from './components/VenueInfo';
import { ActualSetlistDisplay } from './components/ActualSetlistDisplay';

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
  let { data: setlist } = await supabase
    .from('setlists')
    .select('id, type, is_locked')
    .eq('show_id', params.id)
    .eq('type', 'predicted')
    .single();

  // Auto-create predicted setlist if it doesn't exist
  if (!setlist) {
    const { data: newSetlist } = await supabase
      .from('setlists')
      .insert({
        show_id: params.id,
        type: 'predicted',
        is_locked: false
      })
      .select('id, type, is_locked')
      .single();

    setlist = newSetlist;

    // Add 5 random songs from artist's catalog
    if (setlist && transformedShow.artist?.name) {
      const { data: artistSongs } = await supabase
        .from('songs')
        .select('id, title')
        .eq('artist_name', transformedShow.artist.name)
        .limit(50);

      if (artistSongs && artistSongs.length > 0) {
        // Shuffle and take 5 songs
        const shuffledSongs = [...artistSongs].sort(() => Math.random() - 0.5);
        const selectedSongs = shuffledSongs.slice(0, 5);

        const setlistSongs = selectedSongs.map((song, index) => ({
          setlist_id: setlist!.id,
          song_id: song.id,
          position: index + 1,
          upvotes: Math.floor(Math.random() * 20) + 5,
          downvotes: Math.floor(Math.random() * 3) + 1
        }));

        await supabase.from('setlist_songs').insert(setlistSongs);
      }
    }
  }

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
      setlist_id: setlist!.id,
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
          <div className="lg:col-span-2 space-y-8">
            <SetlistVoting
              showId={params.id}
              initialSongs={setlistSongs}
              isLocked={setlist?.is_locked || false}
              artistName={transformedShow.artist?.name || 'Unknown Artist'}
            />
            
            {/* Actual Setlist for Completed Shows */}
            {transformedShow.status === 'completed' && (
              <div className="bg-neutral-800 rounded-lg p-6">
                <h3 className="text-white text-xl font-semibold mb-6">
                  Actual Setlist
                </h3>
                <ActualSetlistDisplay 
                  showId={params.id}
                  artistName={transformedShow.artist?.name}
                  showDate={transformedShow.date}
                />
              </div>
            )}
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