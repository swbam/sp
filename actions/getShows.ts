import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Show, Artist, Venue } from '@/types';

type ShowWithRelations = Omit<Show, 'artist' | 'venue'> & {
  artist: Artist;
  venue: Venue;
};

export const getShows = async (limit: number = 20): Promise<any[]> => {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: shows, error } = await supabase
    .from('shows')
    .select(`
      id,
      artist_id,
      venue_id,
      name,
      slug,
      date,
      start_time,
      status,
      ticket_url,
      created_at,
      updated_at,
      artist:artists!inner(
        id,
        name,
        slug,
        image_url,
        verified,
        followers
      ),
      venue:venues!inner(
        id,
        name,
        city,
        state,
        country,
        capacity
      )
    `)
    .gte('date', new Date().toISOString().split('T')[0])
    .eq('status', 'upcoming')
    .order('date', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching shows:', error);
    return [];
  }

  return shows || [];
};

export const getShowById = async (id: string): Promise<any | null> => {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: show, error } = await supabase
    .from('shows')
    .select(`
      id,
      artist_id,
      venue_id,
      name,
      slug,
      date,
      start_time,
      status,
      ticket_url,
      created_at,
      updated_at,
      artist:artists(
        id,
        name,
        slug,
        image_url,
        verified,
        followers,
        genres
      ),
      venue:venues(
        id,
        name,
        city,
        state,
        country,
        capacity
      )
    `)
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error fetching show by ID:', error);
    return null;
  }

  return show;
};

export const getShowsByArtist = async (artistId: string, limit: number = 10): Promise<any[]> => {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: shows, error } = await supabase
    .from('shows')
    .select(`
      id,
      artist_id,
      venue_id,
      name,
      slug,
      date,
      start_time,
      status,
      ticket_url,
      created_at,
      updated_at,
      venue:venues(
        id,
        name,
        city,
        state,
        country,
        capacity
      )
    `)
    .eq('artist_id', artistId)
    .order('date', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching shows by artist:', error);
    return [];
  }

  return shows || [];
};

export const getUpcomingShows = async (limit: number = 20): Promise<any[]> => {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: shows, error } = await supabase
    .from('shows')
    .select(`
      id,
      artist_id,
      venue_id,
      name,
      slug,
      date,
      start_time,
      status,
      ticket_url,
      created_at,
      updated_at,
      artist:artists(
        id,
        name,
        slug,
        image_url,
        verified,
        followers
      ),
      venue:venues(
        id,
        name,
        city,
        state,
        country,
        capacity
      )
    `)
    .gte('date', new Date().toISOString().split('T')[0])
    .in('status', ['upcoming', 'ongoing'])
    .order('date', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('Error fetching upcoming shows:', error);
    return [];
  }

  return shows || [];
}; 