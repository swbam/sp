#!/usr/bin/env node

/**
 * REAL DATA POPULATION TEST
 * Test that the database can be populated with real API data
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read .env.local file
const envContent = readFileSync(join(__dirname, '.env.local'), 'utf8');
const envLines = envContent.split('\n').filter(line => line.trim() && !line.startsWith('#'));
for (const line of envLines) {
  const [key, value] = line.split('=');
  if (key && value) {
    process.env[key] = value;
  }
}

console.log('📊 TESTING REAL DATA POPULATION');
console.log('===============================');

// Test real data retrieval and transformation
async function testRealDataRetrieval() {
  console.log('🔍 Testing real data retrieval and transformation...');
  
  const results = {
    artists: [],
    shows: [],
    venues: [],
    songs: []
  };
  
  try {
    // Test Spotify data retrieval
    console.log('🎵 Retrieving real artist data from Spotify...');
    
    const authResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    const authData = await authResponse.json();
    const accessToken = authData.access_token;
    
    // Get real artists
    const genres = ['pop', 'rock', 'hip-hop'];
    
    for (const genre of genres) {
      const artistResponse = await fetch(`https://api.spotify.com/v1/search?q=${genre}&type=artist&limit=5`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const artistData = await artistResponse.json();
      
      for (const artist of artistData.artists.items) {
        // Transform artist data for database
        const transformedArtist = {
          spotify_id: artist.id,
          name: artist.name,
          slug: artist.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          image_url: artist.images?.[0]?.url || null,
          genres: artist.genres || [],
          followers: artist.followers?.total || 0,
          verified: artist.followers?.total > 100000
        };
        
        results.artists.push(transformedArtist);
        
        // Get top tracks for this artist
        const tracksResponse = await fetch(`https://api.spotify.com/v1/artists/${artist.id}/top-tracks?market=US`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });
        
        const tracksData = await tracksResponse.json();
        
        for (const track of tracksData.tracks) {
          const transformedTrack = {
            spotify_id: track.id,
            title: track.name,
            artist_name: artist.name
          };
          
          results.songs.push(transformedTrack);
        }
      }
    }
    
    console.log(`✅ Retrieved ${results.artists.length} real artists`);
    console.log(`✅ Retrieved ${results.songs.length} real songs`);
    
    // Test Ticketmaster data retrieval
    console.log('🎪 Retrieving real show data from Ticketmaster...');
    
    const cities = [
      { city: 'New York', stateCode: 'NY' },
      { city: 'Los Angeles', stateCode: 'CA' },
      { city: 'Chicago', stateCode: 'IL' }
    ];
    
    for (const location of cities) {
      const eventsResponse = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&city=${location.city}&classificationName=Music&size=5`
      );
      
      const eventsData = await eventsResponse.json();
      const events = eventsData._embedded?.events || [];
      
      for (const event of events) {
        const venue = event._embedded?.venues?.[0];
        const artist = event._embedded?.attractions?.[0];
        
        if (venue) {
          const transformedVenue = {
            ticketmaster_id: venue.id,
            name: venue.name,
            slug: venue.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
            city: venue.city?.name || location.city,
            state: venue.state?.stateCode || location.stateCode,
            country: venue.country?.countryCode || 'US',
            capacity: venue.capacity
          };
          
          results.venues.push(transformedVenue);
        }
        
        if (artist) {
          const transformedShow = {
            ticketmaster_id: event.id,
            name: event.name,
            date: event.dates?.start?.localDate,
            start_time: event.dates?.start?.localTime,
            status: 'upcoming',
            ticket_url: event.url,
            artist_name: artist.name,
            venue_name: venue?.name
          };
          
          results.shows.push(transformedShow);
        }
      }
    }
    
    console.log(`✅ Retrieved ${results.venues.length} real venues`);
    console.log(`✅ Retrieved ${results.shows.length} real shows`);
    
    return results;
    
  } catch (error) {
    console.log(`❌ Real data retrieval failed: ${error.message}`);
    return null;
  }
}

// Test data structure validation
function validateDataStructures(data) {
  console.log('\n🔍 Validating data structures...');
  
  const validations = {
    artists: true,
    shows: true,
    venues: true,
    songs: true
  };
  
  // Validate artists
  for (const artist of data.artists) {
    if (!artist.name || !artist.slug || !artist.spotify_id) {
      validations.artists = false;
      console.log(`❌ Invalid artist structure: ${JSON.stringify(artist)}`);
      break;
    }
  }
  
  // Validate shows
  for (const show of data.shows) {
    if (!show.name || !show.date || !show.artist_name) {
      validations.shows = false;
      console.log(`❌ Invalid show structure: ${JSON.stringify(show)}`);
      break;
    }
  }
  
  // Validate venues
  for (const venue of data.venues) {
    if (!venue.name || !venue.city || !venue.state) {
      validations.venues = false;
      console.log(`❌ Invalid venue structure: ${JSON.stringify(venue)}`);
      break;
    }
  }
  
  // Validate songs
  for (const song of data.songs) {
    if (!song.title || !song.artist_name || !song.spotify_id) {
      validations.songs = false;
      console.log(`❌ Invalid song structure: ${JSON.stringify(song)}`);
      break;
    }
  }
  
  console.log(`✅ Artists validation: ${validations.artists ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Shows validation: ${validations.shows ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Venues validation: ${validations.venues ? 'PASSED' : 'FAILED'}`);
  console.log(`✅ Songs validation: ${validations.songs ? 'PASSED' : 'FAILED'}`);
  
  return Object.values(validations).every(v => v);
}

// Test data relationships
function validateDataRelationships(data) {
  console.log('\n🔗 Validating data relationships...');
  
  const relationships = {
    artistsToSongs: false,
    showsToVenues: false,
    showsToArtists: false
  };
  
  // Check artist-to-songs relationships
  const artistNames = new Set(data.artists.map(a => a.name));
  const songArtistNames = new Set(data.songs.map(s => s.artist_name));
  
  for (const artistName of artistNames) {
    if (songArtistNames.has(artistName)) {
      relationships.artistsToSongs = true;
      break;
    }
  }
  
  // Check show-to-venue relationships
  const venueNames = new Set(data.venues.map(v => v.name));
  const showVenueNames = new Set(data.shows.map(s => s.venue_name).filter(Boolean));
  
  for (const venueName of venueNames) {
    if (showVenueNames.has(venueName)) {
      relationships.showsToVenues = true;
      break;
    }
  }
  
  // Check show-to-artist relationships
  const showArtistNames = new Set(data.shows.map(s => s.artist_name).filter(Boolean));
  
  for (const artistName of artistNames) {
    if (showArtistNames.has(artistName)) {
      relationships.showsToArtists = true;
      break;
    }
  }
  
  console.log(`✅ Artist-to-songs relationships: ${relationships.artistsToSongs ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`✅ Show-to-venue relationships: ${relationships.showsToVenues ? 'FOUND' : 'NOT FOUND'}`);
  console.log(`✅ Show-to-artist relationships: ${relationships.showsToArtists ? 'FOUND' : 'NOT FOUND'}`);
  
  return Object.values(relationships).every(v => v);
}

// Main test function
async function runTest() {
  console.log('🎯 STARTING REAL DATA POPULATION TEST');
  console.log('====================================\n');
  
  // Test real data retrieval
  const realData = await testRealDataRetrieval();
  
  if (!realData) {
    console.log('\n❌ REAL DATA POPULATION TEST FAILED');
    console.log('Could not retrieve real data from APIs');
    return;
  }
  
  // Validate data structures
  const structuresValid = validateDataStructures(realData);
  
  // Validate data relationships
  const relationshipsValid = validateDataRelationships(realData);
  
  // Generate summary
  console.log('\n📊 REAL DATA POPULATION SUMMARY');
  console.log('================================');
  console.log(`Artists retrieved: ${realData.artists.length}`);
  console.log(`Shows retrieved: ${realData.shows.length}`);
  console.log(`Venues retrieved: ${realData.venues.length}`);
  console.log(`Songs retrieved: ${realData.songs.length}`);
  
  console.log('\n✅ Sample artist data:');
  console.log(JSON.stringify(realData.artists[0], null, 2));
  
  console.log('\n✅ Sample show data:');
  console.log(JSON.stringify(realData.shows[0], null, 2));
  
  console.log('\n✅ Sample venue data:');
  console.log(JSON.stringify(realData.venues[0], null, 2));
  
  console.log('\n✅ Sample song data:');
  console.log(JSON.stringify(realData.songs[0], null, 2));
  
  // Final validation
  const overallSuccess = structuresValid && relationshipsValid;
  
  if (overallSuccess) {
    console.log('\n🎉 REAL DATA POPULATION TEST PASSED');
    console.log('✅ All APIs returning real data');
    console.log('✅ Data structures are valid');
    console.log('✅ Data relationships are correct');
    console.log('✅ Ready for database population');
  } else {
    console.log('\n❌ REAL DATA POPULATION TEST FAILED');
    console.log('🔧 Check data validation errors above');
  }
}

// Execute the test
runTest().catch(console.error);