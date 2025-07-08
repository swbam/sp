import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// Real-time sync status monitoring for autonomous system health
export async function GET() {
  try {
    const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

    // Get comprehensive system metrics
    const [artistsResult, venuesResult, showsResult, songsResult, setlistsResult, setlistSongsResult] = await Promise.all([
      supabase.from('artists').select('id', { count: 'exact', head: true }),
      supabase.from('venues').select('id', { count: 'exact', head: true }),
      supabase.from('shows').select('id', { count: 'exact', head: true }),
      supabase.from('songs').select('id', { count: 'exact', head: true }),
      supabase.from('setlists').select('id', { count: 'exact', head: true }),
      supabase.from('setlist_songs').select('id', { count: 'exact', head: true })
    ]);

    // Check data completeness by checking each artist individually
    const { data: allArtists } = await supabase
      .from('artists')
      .select('id, name');

    let missingCatalogCount = 0;
    
    if (allArtists && allArtists.length > 0) {
      for (const artist of allArtists) {
        const { count } = await supabase
          .from('songs')
          .select('id', { count: 'exact', head: true })
          .eq('artist_name', artist.name);
        
        if (!count || count === 0) {
          missingCatalogCount++;
        }
      }
    }

    const { data: showsWithoutSetlists, count: missingSetlistCount } = await supabase
      .from('shows')
      .select('id', { count: 'exact', head: true })
      .not('id', 'in', `(SELECT DISTINCT show_id FROM setlists WHERE show_id IS NOT NULL)`);

    // Calculate metrics
    const totalArtists = artistsResult.count || 0;
    const totalShows = showsResult.count || 0;
    const dataCompleteness = totalArtists > 0 
      ? (((totalArtists - (missingCatalogCount || 0)) / totalArtists) * 100).toFixed(1)
      : '100.0';

    const showCompleteness = totalShows > 0
      ? (((totalShows - (missingSetlistCount || 0)) / totalShows) * 100).toFixed(1)
      : '100.0';

    // System health assessment
    const systemHealth = getSystemHealth(
      parseFloat(dataCompleteness),
      parseFloat(showCompleteness),
      missingCatalogCount || 0,
      missingSetlistCount || 0
    );

    const status = {
      timestamp: new Date().toISOString(),
      systemHealth,
      dataCompleteness: `${dataCompleteness}%`,
      showCompleteness: `${showCompleteness}%`,
      totals: {
        artists: totalArtists,
        venues: venuesResult.count || 0,
        shows: totalShows,
        songs: songsResult.count || 0,
        setlists: setlistsResult.count || 0,
        setlistSongs: setlistSongsResult.count || 0
      },
      gaps: {
        artistsWithoutSongs: missingCatalogCount || 0,
        showsWithoutSetlists: missingSetlistCount || 0
      },
      isFullyAutonomous: (missingCatalogCount || 0) === 0 && (missingSetlistCount || 0) === 0,
      nextScheduledSync: getNextScheduledSync()
    };

    return NextResponse.json(status);

  } catch (error) {
    console.error('❌ Status check failed:', error);
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      systemHealth: 'ERROR',
      error: 'Failed to get system status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

function getSystemHealth(dataCompleteness: number, showCompleteness: number, missingCatalogs: number, missingSetlists: number): string {
  if (missingCatalogs === 0 && missingSetlists === 0) {
    return 'PERFECT'; // 100% autonomous
  }
  
  if (dataCompleteness >= 95 && showCompleteness >= 95) {
    return 'EXCELLENT'; // Nearly complete
  }
  
  if (dataCompleteness >= 85 && showCompleteness >= 85) {
    return 'GOOD'; // Most data present
  }
  
  if (dataCompleteness >= 70 && showCompleteness >= 70) {
    return 'FAIR'; // Needs improvement
  }
  
  return 'POOR'; // Significant gaps
}

function getNextScheduledSync(): string {
  // Calculate next 6-hour sync window
  const now = new Date();
  const nextSync = new Date(now);
  nextSync.setHours(Math.ceil(now.getHours() / 6) * 6, 0, 0, 0);
  
  if (nextSync <= now) {
    nextSync.setHours(nextSync.getHours() + 6);
  }
  
  return nextSync.toISOString();
} 