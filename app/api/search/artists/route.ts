import { NextRequest, NextResponse } from 'next/server';
import { searchArtists } from '@/libs/ticketmaster';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q');

  if (!query) {
    return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
  }

  // Validate search query
  if (query.trim().length === 0) {
    return NextResponse.json({ error: 'Valid search query is required' }, { status: 400 });
  }

  if (query.length > 100) {
    return NextResponse.json({ error: 'Search query too long' }, { status: 400 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // First search our database for existing artists
    const { data: dbArtists, error: dbError } = await supabase
      .from('artists')
      .select('*')
      .ilike('name', `%${query}%`)
      .limit(10);

    if (dbError) {
      console.error('Database search error:', dbError);
    }

    // Then search Ticketmaster for additional results
    const ticketmasterArtists = await searchArtists(query);

    // Convert Ticketmaster results to our Artist format
    const convertedArtists = ticketmasterArtists.map(tmArtist => ({
      id: tmArtist.id,
      name: tmArtist.name,
      slug: tmArtist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      image_url: tmArtist.images?.[0]?.url || null,
      genres: tmArtist.genres || [],
      followers: 0,
      verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Combine results, prioritizing database results
    const allArtists = [
      ...(dbArtists || []),
      ...convertedArtists.filter(ta => 
        !(dbArtists || []).some(da => da.name.toLowerCase() === ta.name.toLowerCase())
      )
    ];

    return NextResponse.json(allArtists);
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search for artists' },
      { status: 500 }
    );
  }
} 