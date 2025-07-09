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

console.log('🔄 SYNC SYSTEM TEST\n');

// Test 1: Environment Variables
console.log('1. Testing Environment Variables:');
console.log(`   ✓ Supabase URL: ${supabaseUrl ? 'Present' : 'Missing'}`);
console.log(`   ✓ Supabase Service Key: ${supabaseServiceKey ? 'Present' : 'Missing'}`);
console.log(`   ✓ Spotify Client ID: ${spotifyClientId ? 'Present' : 'Missing'}`);
console.log(`   ✓ Spotify Client Secret: ${spotifyClientSecret ? 'Present' : 'Missing'}`);
console.log(`   ✓ Ticketmaster API Key: ${ticketmasterApiKey ? 'Present' : 'Missing'}`);

if (!supabaseUrl || !supabaseServiceKey || !spotifyClientId || !spotifyClientSecret || !ticketmasterApiKey) {
  console.error('   ❌ Missing required environment variables!');
  process.exit(1);
}

// Test 2: Database Connection
console.log('\n2. Testing Database Connection:');
const supabase = createClient(supabaseUrl, supabaseServiceKey);

try {
  const { data, error } = await supabase.from('artists').select('count').limit(1);
  if (error) throw error;
  console.log('   ✓ Database connection successful');
} catch (error) {
  console.error('   ❌ Database connection failed:', error.message);
  process.exit(1);
}

// Test 3: Spotify API
console.log('\n3. Testing Spotify API:');
try {
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  if (!tokenResponse.ok) throw new Error(`Token request failed: ${tokenResponse.statusText}`);
  
  const tokenData = await tokenResponse.json();
  console.log('   ✓ Spotify token obtained');

  // Test search
  const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=taylor%20swift&type=artist&limit=1`, {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`
    }
  });

  if (!searchResponse.ok) throw new Error(`Search request failed: ${searchResponse.statusText}`);
  
  const searchData = await searchResponse.json();
  console.log('   ✓ Spotify search successful');
  console.log(`   → Found artist: ${searchData.artists.items[0]?.name || 'None'}`);

} catch (error) {
  console.error('   ❌ Spotify API test failed:', error.message);
}

// Test 4: Ticketmaster API
console.log('\n4. Testing Ticketmaster API:');
try {
  const response = await fetch(`https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=taylor%20swift&classificationName=music&size=1&apikey=${ticketmasterApiKey}`);
  
  if (!response.ok) throw new Error(`Ticketmaster request failed: ${response.statusText}`);
  
  const data = await response.json();
  console.log('   ✓ Ticketmaster search successful');
  console.log(`   → Found ${data._embedded?.attractions?.length || 0} attractions`);

} catch (error) {
  console.error('   ❌ Ticketmaster API test failed:', error.message);
}

// Test 5: Database Schema
console.log('\n5. Testing Database Schema:');
const tables = ['artists', 'venues', 'shows', 'songs', 'setlists', 'setlist_songs', 'votes', 'user_artists'];

for (const table of tables) {
  try {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw error;
    console.log(`   ✓ ${table}: ${count || 0} records`);
  } catch (error) {
    console.error(`   ❌ ${table}: ${error.message}`);
  }
}

// Test 6: Sync Functions
console.log('\n6. Testing Sync Functions:');

// Test artist sync
console.log('\n   Testing Artist Sync:');
try {
  // Get access token
  const tokenResponse = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${spotifyClientId}:${spotifyClientSecret}`).toString('base64')}`
    },
    body: 'grant_type=client_credentials'
  });

  const tokenData = await tokenResponse.json();
  
  // Search for Taylor Swift
  const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=taylor%20swift&type=artist&limit=1`, {
    headers: {
      'Authorization': `Bearer ${tokenData.access_token}`
    }
  });

  const searchData = await searchResponse.json();
  const artist = searchData.artists.items[0];
  
  if (artist) {
    const artistData = {
      spotify_id: artist.id,
      name: artist.name,
      slug: artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      image_url: artist.images?.[0]?.url || null,
      genres: artist.genres || [],
      followers: artist.followers?.total || 0,
      verified: artist.followers?.total > 100000
    };

    const { data, error } = await supabase
      .from('artists')
      .upsert(artistData, { 
        onConflict: 'spotify_id',
        ignoreDuplicates: false 
      })
      .select('id, name');

    if (error) throw error;
    console.log(`   ✓ Artist sync test successful: ${data[0]?.name}`);

    // Test top tracks sync
    const tracksResponse = await fetch(`https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=US`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`
      }
    });

    const tracksData = await tracksResponse.json();
    const tracks = tracksData.tracks.slice(0, 3); // Just test 3 tracks

    for (const track of tracks) {
      const songData = {
        spotify_id: track.id,
        title: track.name,
        artist_name: track.artists?.[0]?.name || 'Unknown Artist'
      };

      await supabase
        .from('songs')
        .upsert(songData, {
          onConflict: 'spotify_id',
          ignoreDuplicates: true
        });
    }

    console.log(`   ✓ Songs sync test successful: ${tracks.length} tracks`);

  } else {
    console.log('   ❌ No artist found in search');
  }

} catch (error) {
  console.error('   ❌ Artist sync test failed:', error.message);
}

console.log('\n🎯 SYNC SYSTEM TEST COMPLETE\n');