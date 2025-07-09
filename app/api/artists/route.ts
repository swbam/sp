import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '20');
  const trending = searchParams.get('trending') === 'true';

  try {
    const supabase = createRouteHandlerClient({ cookies });

    let query = supabase
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
        shows:shows(count)
      `);

    if (trending) {
      // Get trending artists based on recent show activity and followers
      query = query
        .order('followers', { ascending: false })
        .order('created_at', { ascending: false });
    } else {
      query = query.order('name', { ascending: true });
    }

    const { data: artists, error } = await query.limit(limit);

    if (error) {
      console.error('Artists fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ artists: artists || [] });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const artistData = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user - only authenticated users can add artists
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: artist, error } = await supabase
      .from('artists')
      .insert(artistData)
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