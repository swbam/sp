import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST() {
  try {
    const supabase = createRouteHandlerClient({ cookies });

    console.log('🔧 Starting image URL cleanup...');

    // Get all artists with invalid Spotify image URLs
    const { data: artists, error: fetchError } = await supabase
      .from('artists')
      .select('id, name, image_url')
      .like('image_url', 'https://i.scdn.co/image/%')
      .neq('image_url', null);

    if (fetchError) {
      console.error('Error fetching artists:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    console.log(`Found ${artists?.length || 0} artists with potentially invalid Spotify URLs`);

    let fixedCount = 0;
    const errors = [];

    if (artists && artists.length > 0) {
      for (const artist of artists) {
        try {
          // Check if the Spotify URL is actually valid by making a quick HEAD request
          const response = await fetch(artist.image_url, { method: 'HEAD' });
          
          if (!response.ok) {
            // URL is invalid, replace with null
            const { error: updateError } = await supabase
              .from('artists')
              .update({ image_url: null })
              .eq('id', artist.id);

            if (updateError) {
              console.error(`Error updating artist ${artist.name}:`, updateError);
              errors.push(`${artist.name}: ${updateError.message}`);
            } else {
              console.log(`✅ Fixed invalid image URL for ${artist.name}`);
              fixedCount++;
            }
          } else {
            console.log(`✓ Valid image URL for ${artist.name}`);
          }
        } catch (urlError) {
          // URL is invalid (network error), replace with null
          const { error: updateError } = await supabase
            .from('artists')
            .update({ image_url: null })
            .eq('id', artist.id);

          if (updateError) {
            console.error(`Error updating artist ${artist.name}:`, updateError);
            errors.push(`${artist.name}: ${updateError.message}`);
          } else {
            console.log(`✅ Fixed invalid image URL for ${artist.name}`);
            fixedCount++;
          }
        }
      }
    }

    console.log(`🎉 Image cleanup complete! Fixed ${fixedCount} invalid URLs`);

    return NextResponse.json({
      success: true,
      total_checked: artists?.length || 0,
      fixed_count: fixedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully cleaned up ${fixedCount} invalid image URLs`
    });

  } catch (error) {
    console.error('Image cleanup error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 