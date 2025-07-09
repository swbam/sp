import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get artist by slug with related data
    const { data: artist, error } = await supabase
      .from('artists')
      .select(`
        id,
        name,
        slug,
        image_url,
        genres,
        followers,
        verified,
        created_at,
        updated_at,
        shows:shows(
          id,
          name,
          date,
          start_time,
          status,
          ticket_url,
          venue:venues(
            id,
            name,
            city,
            state,
            country
          )
        )
      `)
      .eq('slug', params.slug)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
      }
      console.error('Artist fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ artist });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const body = await request.json();
    
    const { name, image_url, genres, ticketmaster_id } = body;
    
    // Check if artist already exists
    const { data: existingArtist } = await supabase
      .from('artists')
      .select('*')
      .eq('slug', params.slug)
      .single();
      
    if (existingArtist) {
      return NextResponse.json({ artist: existingArtist });
    }
    
    // Create new artist
    const { data: artist, error } = await supabase
      .from('artists')
      .insert({
        name,
        slug: params.slug,
        image_url,
        genres,
        spotify_id: ticketmaster_id, // Store TM ID in spotify_id field for now
        followers: 0,
        verified: false
      })
      .select()
      .single();
      
    if (error) {
      console.error('Artist creation error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ artist });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}