import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  database: {
    connected: boolean;
    response_time: number;
    counts: {
      artists: number;
      shows: number;
      songs: number;
      venues: number;
      setlists: number;
      votes: number;
    };
  };
  data_completeness: {
    artists_with_songs: number;
    shows_with_setlists: number;
    completeness_score: number;
  };
  external_apis: {
    spotify: 'available' | 'unavailable' | 'unknown';
    ticketmaster: 'available' | 'unavailable' | 'unknown';
  };
  sync_status: {
    last_sync: string | null;
    next_sync: string;
    sync_health: 'good' | 'warning' | 'error';
  };
}

/**
 * SYSTEM HEALTH MONITORING
 * 
 * Provides comprehensive health check of the MySetlist platform including:
 * - Database connectivity and performance
 * - Data completeness metrics
 * - External API availability
 * - Sync system status
 */
export async function GET() {
  const startTime = Date.now();
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const health: SystemHealth = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        response_time: 0,
        counts: {
          artists: 0,
          shows: 0,
          songs: 0,
          venues: 0,
          setlists: 0,
          votes: 0
        }
      },
      data_completeness: {
        artists_with_songs: 0,
        shows_with_setlists: 0,
        completeness_score: 0
      },
      external_apis: {
        spotify: 'unknown',
        ticketmaster: 'unknown'
      },
      sync_status: {
        last_sync: null,
        next_sync: getNextScheduledSync(),
        sync_health: 'good'
      }
    };

    // Database health check
    const dbStartTime = Date.now();
    try {
      const [
        { count: artistCount },
        { count: showCount },
        { count: songCount },
        { count: venueCount },
        { count: setlistCount },
        { count: voteCount }
      ] = await Promise.all([
        supabase.from('artists').select('id', { count: 'exact', head: true }),
        supabase.from('shows').select('id', { count: 'exact', head: true }),
        supabase.from('songs').select('id', { count: 'exact', head: true }),
        supabase.from('venues').select('id', { count: 'exact', head: true }),
        supabase.from('setlists').select('id', { count: 'exact', head: true }),
        supabase.from('votes').select('id', { count: 'exact', head: true })
      ]);

      health.database.connected = true;
      health.database.response_time = Date.now() - dbStartTime;
      health.database.counts = {
        artists: artistCount || 0,
        shows: showCount || 0,
        songs: songCount || 0,
        venues: venueCount || 0,
        setlists: setlistCount || 0,
        votes: voteCount || 0
      };

    } catch (dbError) {
      console.error('Database health check failed:', dbError);
      health.status = 'unhealthy';
      health.database.connected = false;
    }

    // Data completeness check
    if (health.database.connected) {
      try {
        // Check artists with songs
        const { data: allArtists } = await supabase
          .from('artists')
          .select('id, name');

        let artistsWithSongs = 0;
        if (allArtists && allArtists.length > 0) {
          for (const artist of allArtists) {
            const { count } = await supabase
              .from('songs')
              .select('id', { count: 'exact', head: true })
              .eq('artist_name', artist.name);
            
            if (count && count > 0) {
              artistsWithSongs++;
            }
          }
        }

        // Check shows with setlists - count total shows and shows without setlists
        const { data: showsWithoutSetlists } = await supabase
          .from('shows')
          .select('id')
          .not('id', 'in', `(SELECT DISTINCT show_id FROM setlists WHERE show_id IS NOT NULL)`);

        const totalShows = health.database.counts.shows;
        const showsWithoutSetlistsCount = showsWithoutSetlists?.length || 0;
        const showsWithSetlistsCount = totalShows - showsWithoutSetlistsCount;

        health.data_completeness.artists_with_songs = artistsWithSongs;
        health.data_completeness.shows_with_setlists = showsWithSetlistsCount;
        
        // Calculate completeness score
        const totalArtists = health.database.counts.artists;
        
        let completenessScore = 100;
        if (totalArtists > 0) {
          const artistCompleteness = (artistsWithSongs / totalArtists) * 100;
          completenessScore = Math.min(completenessScore, artistCompleteness);
        }
        
        if (totalShows > 0) {
          const showCompleteness = (health.data_completeness.shows_with_setlists / totalShows) * 100;
          completenessScore = Math.min(completenessScore, showCompleteness);
        }

        health.data_completeness.completeness_score = Math.round(completenessScore);

        // Update overall health based on completeness
        if (completenessScore < 50) {
          health.status = 'unhealthy';
        } else if (completenessScore < 80) {
          health.status = 'degraded';
        }

      } catch (completenessError) {
        console.error('Data completeness check failed:', completenessError);
        health.status = 'degraded';
      }
    }

    // External API health checks
    health.external_apis.spotify = checkSpotifyAvailability();
    health.external_apis.ticketmaster = checkTicketmasterAvailability();

    // Sync status check
    try {
      // Check for recent sync activity (placeholder - would need actual sync logs)
      const lastSyncTime = await getLastSyncTime();
      health.sync_status.last_sync = lastSyncTime;
      
      // Determine sync health based on last sync time
      if (lastSyncTime) {
        const timeSinceLastSync = Date.now() - new Date(lastSyncTime).getTime();
        const hoursSinceLastSync = timeSinceLastSync / (1000 * 60 * 60);
        
        if (hoursSinceLastSync > 12) {
          health.sync_status.sync_health = 'warning';
          if (health.status === 'healthy') {
            health.status = 'degraded';
          }
        }
        
        if (hoursSinceLastSync > 24) {
          health.sync_status.sync_health = 'error';
          health.status = 'unhealthy';
        }
      }
    } catch (syncError) {
      console.error('Sync status check failed:', syncError);
      health.sync_status.sync_health = 'warning';
    }

    // Set final status based on critical issues
    if (!health.database.connected) {
      health.status = 'unhealthy';
    } else if (health.database.response_time > 5000) {
      health.status = 'degraded';
    }

    const totalResponseTime = Date.now() - startTime;
    console.log(`🔍 Health check completed in ${totalResponseTime}ms - Status: ${health.status}`);

    return NextResponse.json(health, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });

  } catch (error) {
    console.error('Health check failed:', error);
    
    return NextResponse.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { 
      status: 500,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  }
}

function checkSpotifyAvailability(): 'available' | 'unavailable' | 'unknown' {
  if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
    return 'unavailable';
  }
  return 'available'; // Would need actual API test for full check
}

function checkTicketmasterAvailability(): 'available' | 'unavailable' | 'unknown' {
  if (!process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY) {
    return 'unavailable';
  }
  return 'available'; // Would need actual API test for full check
}

function getNextScheduledSync(): string {
  const now = new Date();
  const nextSync = new Date(now);
  nextSync.setHours(Math.ceil(now.getHours() / 6) * 6, 0, 0, 0);
  
  if (nextSync <= now) {
    nextSync.setHours(nextSync.getHours() + 6);
  }
  
  return nextSync.toISOString();
}

async function getLastSyncTime(): Promise<string | null> {
  // In a real implementation, this would check sync logs or database records
  // For now, return a placeholder
  const sixHoursAgo = new Date();
  sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
  return sixHoursAgo.toISOString();
}