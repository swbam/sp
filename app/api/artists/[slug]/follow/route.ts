import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get artist by slug
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (artistError) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Follow artist
    const { error } = await supabase
      .from('user_artist_follows')
      .insert({
        user_id: user.id,
        artist_id: artist.id
      });

    if (error) {
      if (error.code === '23505') { // unique constraint violation
        return NextResponse.json({ error: 'Already following this artist' }, { status: 409 });
      }
      console.error('Follow artist error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Artist followed successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get artist by slug
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (artistError) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Unfollow artist
    const { error } = await supabase
      .from('user_artist_follows')
      .delete()
      .eq('user_id', user.id)
      .eq('artist_id', artist.id);

    if (error) {
      console.error('Unfollow artist error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, message: 'Artist unfollowed successfully' });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return NextResponse.json({ is_following: false });
    }

    // Get artist by slug
    const { data: artist, error: artistError } = await supabase
      .from('artists')
      .select('id')
      .eq('slug', params.slug)
      .single();

    if (artistError) {
      return NextResponse.json({ error: 'Artist not found' }, { status: 404 });
    }

    // Check if user follows this artist
    const { data: follow, error } = await supabase
      .from('user_artist_follows')
      .select('user_id')
      .eq('user_id', user.id)
      .eq('artist_id', artist.id)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Check follow status error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ is_following: !!follow });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}