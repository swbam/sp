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

console.log('🔄 SYNC POPULATE TEST\n');

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Spotify API class
class SpotifyAPI {
  constructor() {
    this.clientId = spotifyClientId;
    this.clientSecret = spotifyClientSecret;
    this.accessToken = null;
    this.tokenExpiry = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiry = Date.now() + (data.expires_in * 1000) - 60000;

    return this.accessToken;
  }

  async searchArtists(query, limit = 20) {
    const token = await this.getAccessToken();
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    return data.artists.items;
  }

  async getArtistTopTracks(artistId, market = 'US') {
    const token = await this.getAccessToken();
    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=${market}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();
    return data.tracks;
  }

  transformArtistForDB(spotifyArtist) {
    return {
      spotify_id: spotifyArtist.id,
      name: spotifyArtist.name,
      slug: this.createSlug(spotifyArtist.name),
      image_url: spotifyArtist.images?.[0]?.url || null,
      genres: spotifyArtist.genres || [],
      followers: spotifyArtist.followers?.total || 0,
      verified: spotifyArtist.followers?.total > 100000,
    };
  }

  transformTrackForDB(spotifyTrack) {
    return {
      spotify_id: spotifyTrack.id,
      title: spotifyTrack.name,
      artist_name: spotifyTrack.artists?.[0]?.name || 'Unknown Artist',
    };
  }

  createSlug(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }
}

const spotifyAPI = new SpotifyAPI();

// Test sync populate logic
console.log('1. Testing Popular Artists Sync:');

const popularArtists = [
  'Ed Sheeran', 'Billie Eilish', 'Post Malone', 'Dua Lipa', 'The Weeknd'
];

let artistsSynced = 0;
let errorCount = 0;

for (const artistName of popularArtists) {
  try {
    console.log(`\n   🎵 Processing ${artistName}...`);
    
    const spotifyResults = await spotifyAPI.searchArtists(artistName, 1);
    
    if (spotifyResults.length > 0) {
      const spotifyArtist = spotifyResults[0];
      
      // Check if artist already exists
      const { data: existingArtist } = await supabase
        .from('artists')
        .select('id')
        .eq('spotify_id', spotifyArtist.id)
        .single();

      if (!existingArtist) {
        const artistData = spotifyAPI.transformArtistForDB(spotifyArtist);
        
        // Handle slug uniqueness
        let attemptCount = 0;
        let finalSlug = artistData.slug;
        
        while (attemptCount < 5) {
          const { data: existingSlug } = await supabase
            .from('artists')
            .select('id')
            .eq('slug', finalSlug)
            .single();
          
          if (!existingSlug) break;
          
          attemptCount++;
          finalSlug = `${artistData.slug}-${attemptCount}`;
        }
        
        artistData.slug = finalSlug;

        const { data: newArtist, error } = await supabase
          .from('artists')
          .insert(artistData)
          .select('id, name')
          .single();

        if (!error && newArtist) {
          console.log(`   ✓ Synced artist: ${newArtist.name}`);
          artistsSynced++;

          // Sync their top tracks
          try {
            const topTracks = await spotifyAPI.getArtistTopTracks(spotifyArtist.id);
            
            let tracksSynced = 0;
            for (const track of topTracks.slice(0, 5)) {
              const songData = spotifyAPI.transformTrackForDB(track);
              
              const { error: trackError } = await supabase
                .from('songs')
                .upsert(songData, {
                  onConflict: 'spotify_id',
                  ignoreDuplicates: true
                });
              
              if (!trackError) tracksSynced++;
            }
            
            console.log(`   → Synced ${tracksSynced} tracks`);
            
          } catch (trackError) {
            console.error(`   ❌ Error syncing tracks: ${trackError.message}`);
          }
        } else {
          console.error(`   ❌ Error syncing ${artistName}: ${error?.message}`);
          errorCount++;
        }
      } else {
        console.log(`   → ${artistName} already exists`);
      }
    } else {
      console.log(`   ❌ No Spotify results for ${artistName}`);
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error(`   ❌ Error processing ${artistName}: ${error.message}`);
    errorCount++;
  }
}

console.log('\n2. Testing Venue Creation:');

const testVenues = [
  { name: 'Test Arena', city: 'New York', state: 'NY', country: 'USA' },
  { name: 'Sample Stadium', city: 'Los Angeles', state: 'CA', country: 'USA' }
];

for (const venueInfo of testVenues) {
  try {
    const { data: existingVenue } = await supabase
      .from('venues')
      .select('id')
      .eq('name', venueInfo.name)
      .single();

    if (!existingVenue) {
      const venueData = {
        name: venueInfo.name,
        slug: venueInfo.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        city: venueInfo.city,
        state: venueInfo.state,
        country: venueInfo.country,
        capacity: Math.floor(Math.random() * 50000) + 5000
      };

      const { error } = await supabase.from('venues').insert(venueData);
      if (!error) {
        console.log(`   ✓ Added venue: ${venueInfo.name}`);
      } else {
        console.error(`   ❌ Error adding venue: ${error.message}`);
      }
    } else {
      console.log(`   → ${venueInfo.name} already exists`);
    }
  } catch (error) {
    console.error(`   ❌ Error with venue ${venueInfo.name}: ${error.message}`);
  }
}

console.log('\n3. Testing Show Creation:');

// Get some artists and venues for show creation
const { data: allArtists } = await supabase
  .from('artists')
  .select('id, name')
  .limit(3);

const { data: allVenues } = await supabase
  .from('venues')
  .select('id, name, city')
  .limit(3);

if (allArtists && allVenues && allArtists.length > 0 && allVenues.length > 0) {
  for (let i = 0; i < 2; i++) {
    try {
      const artist = allArtists[i % allArtists.length];
      const venue = allVenues[i % allVenues.length];
      
      const currentDate = new Date();
      const futureDate = new Date(currentDate);
      futureDate.setDate(currentDate.getDate() + Math.floor(Math.random() * 180) + 30);
      
      const showData = {
        artist_id: artist.id,
        venue_id: venue.id,
        name: `${artist.name} Live at ${venue.name}`,
        date: futureDate.toISOString().split('T')[0],
        start_time: ['19:00:00', '20:00:00'][Math.floor(Math.random() * 2)],
        status: 'upcoming',
        ticket_url: `https://tickets.example.com/test-${i + 1}`
      };

      const { data: newShow, error: showError } = await supabase
        .from('shows')
        .upsert(showData, {
          onConflict: 'artist_id,date,venue_id',
          ignoreDuplicates: true
        })
        .select('id, name')
        .single();

      if (!showError && newShow) {
        console.log(`   ✓ Created show: ${newShow.name}`);
      } else if (showError && !showError.message.includes('duplicate')) {
        console.error(`   ❌ Error creating show: ${showError.message}`);
      } else {
        console.log(`   → Show already exists for this artist/date/venue`);
      }

    } catch (showError) {
      console.error(`   ❌ Error in show creation: ${showError.message}`);
    }
  }
}

console.log(`\n🎯 SYNC POPULATE TEST COMPLETE`);
console.log(`   Artists synced: ${artistsSynced}`);
console.log(`   Errors: ${errorCount}`);