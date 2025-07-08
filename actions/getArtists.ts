import { createServerComponentClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Artist } from '@/types';

export const getArtists = async (limit: number = 20): Promise<Artist[]> => {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: artists, error } = await supabase
    .from('artists')
    .select(`
      id,
      spotify_id,
      name,
      slug,
      image_url,
      genres,
      followers,
      verified,
      created_at,
      updated_at
    `)
    .order('followers', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching artists:', error);
    return [];
  }

  return artists || [];
};

export const getArtistBySlug = async (slug: string): Promise<Artist | null> => {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: artist, error } = await supabase
    .from('artists')
    .select(`
      id,
      spotify_id,
      name,
      slug,
      image_url,
      genres,
      followers,
      verified,
      created_at,
      updated_at
    `)
    .eq('slug', slug)
    .single();

  if (error) {
    console.error('Error fetching artist by slug:', error);
    return null;
  }

  return artist;
};

export const searchArtists = async (query: string, limit: number = 20): Promise<Artist[]> => {
  const supabase = createServerComponentClient({ cookies });
  
  const { data: artists, error } = await supabase
    .from('artists')
    .select(`
      id,
      spotify_id,
      name,
      slug,
      image_url,
      genres,
      followers,
      verified,
      created_at,
      updated_at
    `)
    .or(`name.ilike.%${query}%,genres.cs.["${query}"]`)
    .order('followers', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error searching artists:', error);
    return [];
  }

  return artists || [];
}; 