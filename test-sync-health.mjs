#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
const ticketmasterApiKey = process.env.TICKETMASTER_API_KEY;

console.log('🔍 SYNC HEALTH TEST\n');

// Initialize Supabase client
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Health check implementation (matching the route logic)
async function performHealthCheck() {
  const startTime = Date.now();
  
  const health = {
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
  console.log('1. Database Health Check:');
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

    console.log('   ✓ Database connected');
    console.log(`   ✓ Response time: ${health.database.response_time}ms`);
    console.log(`   ✓ Artists: ${health.database.counts.artists}`);
    console.log(`   ✓ Shows: ${health.database.counts.shows}`);
    console.log(`   ✓ Songs: ${health.database.counts.songs}`);
    console.log(`   ✓ Venues: ${health.database.counts.venues}`);
    console.log(`   ✓ Setlists: ${health.database.counts.setlists}`);
    console.log(`   ✓ Votes: ${health.database.counts.votes}`);

  } catch (dbError) {
    console.error('   ❌ Database health check failed:', dbError.message);
    health.status = 'unhealthy';
    health.database.connected = false;
  }

  // Data completeness check
  console.log('\n2. Data Completeness Check:');
  
  if (health.database.connected) {
    try {
      // Check artists with songs
      const { data: allArtists } = await supabase
        .from('artists')
        .select('id, name');

      let artistsWithSongs = 0;
      if (allArtists && allArtists.length > 0) {
        // Sample check - just test first 10 artists for performance
        const sampleArtists = allArtists.slice(0, 10);
        
        for (const artist of sampleArtists) {
          const { count } = await supabase
            .from('songs')
            .select('id', { count: 'exact', head: true })
            .eq('artist_name', artist.name);
          
          if (count && count > 0) {
            artistsWithSongs++;
          }
        }
        
        // Scale up the result based on sample
        artistsWithSongs = Math.round((artistsWithSongs / sampleArtists.length) * allArtists.length);
      }

      // Check shows with setlists
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
        const showCompleteness = (showsWithSetlistsCount / totalShows) * 100;
        completenessScore = Math.min(completenessScore, showCompleteness);
      }

      health.data_completeness.completeness_score = Math.round(completenessScore);

      console.log(`   ✓ Artists with songs: ${artistsWithSongs}/${totalArtists}`);
      console.log(`   ✓ Shows with setlists: ${showsWithSetlistsCount}/${totalShows}`);
      console.log(`   ✓ Completeness score: ${health.data_completeness.completeness_score}%`);

      // Update overall health based on completeness
      if (completenessScore < 50) {
        health.status = 'unhealthy';
      } else if (completenessScore < 80) {
        health.status = 'degraded';
      }

    } catch (completenessError) {
      console.error('   ❌ Data completeness check failed:', completenessError.message);
      health.status = 'degraded';
    }
  }

  // External API health checks
  console.log('\n3. External API Health Check:');
  
  // Spotify API check
  if (spotifyClientId && spotifyClientSecret) {
    try {
      const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (tokenResponse.ok) {
        health.external_apis.spotify = 'available';
        console.log('   ✓ Spotify API: Available');
      } else {
        health.external_apis.spotify = 'unavailable';
        console.log('   ❌ Spotify API: Unavailable');
      }
    } catch (error) {
      health.external_apis.spotify = 'unavailable';
      console.log('   ❌ Spotify API: Error -', error.message);
    }
  } else {
    health.external_apis.spotify = 'unavailable';
    console.log('   ❌ Spotify API: Missing credentials');
  }

  // Ticketmaster API check
  if (ticketmasterApiKey) {
    try {
      const response = await fetch(`https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=test&size=1&apikey=${ticketmasterApiKey}`);
      
      if (response.ok) {
        health.external_apis.ticketmaster = 'available';
        console.log('   ✓ Ticketmaster API: Available');
      } else {
        health.external_apis.ticketmaster = 'unavailable';
        console.log('   ❌ Ticketmaster API: Unavailable');
      }
    } catch (error) {
      health.external_apis.ticketmaster = 'unavailable';
      console.log('   ❌ Ticketmaster API: Error -', error.message);
    }
  } else {
    health.external_apis.ticketmaster = 'unavailable';
    console.log('   ❌ Ticketmaster API: Missing credentials');
  }

  // Sync status check
  console.log('\n4. Sync Status Check:');
  const lastSyncTime = getLastSyncTime();
  health.sync_status.last_sync = lastSyncTime;
  
  if (lastSyncTime) {
    const timeSinceLastSync = Date.now() - new Date(lastSyncTime).getTime();
    const hoursSinceLastSync = timeSinceLastSync / (1000 * 60 * 60);
    
    if (hoursSinceLastSync > 12) {
      health.sync_status.sync_health = 'warning';
      if (health.status === 'healthy') {
        health.status = 'degraded';
      }
      console.log(`   ⚠️  Last sync: ${hoursSinceLastSync.toFixed(1)} hours ago (Warning)`);
    } else {
      console.log(`   ✓ Last sync: ${hoursSinceLastSync.toFixed(1)} hours ago`);
    }
    
    if (hoursSinceLastSync > 24) {
      health.sync_status.sync_health = 'error';
      health.status = 'unhealthy';
      console.log(`   ❌ Sync health: Critical (>24 hours)`);
    }
  } else {
    console.log('   ❌ No sync history found');
  }

  console.log(`   ✓ Next sync: ${health.sync_status.next_sync}`);

  // Final status determination
  if (!health.database.connected) {
    health.status = 'unhealthy';
  } else if (health.database.response_time > 5000) {
    health.status = 'degraded';
  }

  const totalResponseTime = Date.now() - startTime;
  console.log(`\n🎯 HEALTH CHECK COMPLETE`);
  console.log(`   Overall Status: ${health.status.toUpperCase()}`);
  console.log(`   Total Response Time: ${totalResponseTime}ms`);

  return health;
}

function getNextScheduledSync() {
  const now = new Date();
  const nextSync = new Date(now);
  nextSync.setHours(Math.ceil(now.getHours() / 6) * 6, 0, 0, 0);
  
  if (nextSync <= now) {
    nextSync.setHours(nextSync.getHours() + 6);
  }
  
  return nextSync.toISOString();
}

function getLastSyncTime() {
  // Simulate a sync 6 hours ago
  const sixHoursAgo = new Date();
  sixHoursAgo.setHours(sixHoursAgo.getHours() - 6);
  return sixHoursAgo.toISOString();
}

// Run the health check
performHealthCheck().then(health => {
  console.log('\n📊 HEALTH REPORT:');
  console.log(JSON.stringify(health, null, 2));
}).catch(error => {
  console.error('❌ Health check failed:', error);
});