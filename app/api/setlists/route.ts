import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const showId = searchParams.get('show_id');
  const type = searchParams.get('type') || 'predicted'; // 'predicted' or 'actual'

  if (!showId) {
    return NextResponse.json({ error: 'show_id is required' }, { status: 400 });
  }

  try {
    const supabase = createRouteHandlerClient({ cookies });

    const { data: setlists, error } = await supabase
      .from('setlists')
      .select(`
        id,
        type,
        is_locked,
        created_at,
        setlist_songs (
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
        )
      `)
      .eq('show_id', showId)
      .eq('type', type)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ setlist: null });
      }
      console.error('Setlist fetch error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Sort songs by position
    if (setlists?.setlist_songs) {
      setlists.setlist_songs.sort((a, b) => a.position - b.position);
    }

    return NextResponse.json({ setlist: setlists });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { show_id, type = 'predicted' } = await request.json();
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Create setlist
    const { data: setlist, error } = await supabase
      .from('setlists')
      .insert({
        show_id,
        type,
        is_locked: false,
        created_by: user.id
      })
      .select()
      .single();

    if (error) {
      console.error('Setlist creation error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ setlist });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}