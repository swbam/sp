import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { Header } from '@/components/Header';
import type { Artist, ShowWithDetails } from '@/types';
import { notFound } from 'next/navigation';
import { ArtistHeader } from './components/ArtistHeader';
import { ShowsList } from './components/ShowsList';
import { ArtistStats } from './components/ArtistStats';

interface ArtistPageProps {
  params: {
    slug: string;
  };
}

export default async function ArtistPage({ params }: ArtistPageProps) {
  const supabase = createServerComponentClient({ cookies });

  // Get artist by slug
  const { data: artist, error: artistError } = await supabase
    .from('artists')
    .select('*')
    .eq('slug', params.slug)
    .single();

  if (artistError || !artist) {
    notFound();
  }

  // Get upcoming shows for this artist
  const { data: shows } = await supabase
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
    .eq('artist_id', artist.id)
    .eq('status', 'upcoming')
    .gte('date', new Date().toISOString().split('T')[0])
    .order('date', { ascending: true });

  // Transform the show data to match ShowWithDetails type
  const transformedShows: ShowWithDetails[] = shows?.map((show: any) => ({
    ...show,
    artist_id: artist.id,
    venue_id: show.venue?.id || '',
    artist: artist,
    venue: show.venue || { id: '', name: '', slug: '', city: '', state: '', country: '' },
  })) || [];

  return (
    <div className="bg-neutral-900 rounded-lg h-full w-full overflow-hidden overflow-y-auto">
      <Header className="from-emerald-800">
        <div className="mt-20">
          <ArtistHeader artist={artist} />
        </div>
      </Header>

      <div className="px-6 pb-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 mt-8">
          {/* Main Content - Shows */}
          <div className="lg:col-span-3">
            <ShowsList 
              artistSlug={params.slug}
              initialShows={transformedShows}
            />
          </div>

          {/* Sidebar - Stats */}
          <div className="lg:col-span-1">
            <ArtistStats artist={artist} />
          </div>
        </div>
      </div>
    </div>
  );
} 