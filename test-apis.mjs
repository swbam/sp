#!/usr/bin/env node

/**
 * API Integration Test Script
 * 
 * Tests Spotify and Ticketmaster APIs to ensure they're working correctly
 */

import { readFileSync } from 'fs';

// Load environment variables manually
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

// Set environment variables
Object.keys(envVars).forEach(key => {
  process.env[key] = envVars[key];
});

// Spotify API Test Class
class SpotifyAPITest {
  constructor() {
    this.clientId = process.env.SPOTIFY_CLIENT_ID;
    this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
    this.accessToken = null;
  }

  async getAccessToken() {
    console.log('🔑 Getting Spotify access token...');
    
    const response = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (!response.ok) {
      throw new Error(`Failed to get Spotify access token: ${response.statusText}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    console.log('✅ Spotify access token obtained');
    return this.accessToken;
  }

  async testArtistSearch(query = 'radiohead') {
    console.log(`🔍 Testing Spotify artist search for "${query}"...`);
    
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=artist&limit=5`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Spotify search failed: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.artists.items.length} artists`);
    
    data.artists.items.slice(0, 3).forEach(artist => {
      console.log(`  - ${artist.name} (${artist.followers.total.toLocaleString()} followers)`);
    });

    return data.artists.items;
  }

  async testTopTracks(artistId) {
    console.log(`🎵 Testing top tracks for artist ${artistId}...`);
    
    const response = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to get top tracks: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`✅ Found ${data.tracks.length} top tracks`);
    
    data.tracks.slice(0, 3).forEach(track => {
      console.log(`  - ${track.name} (${track.popularity}/100 popularity)`);
    });

    return data.tracks;
  }
}

// Ticketmaster API Test Class
class TicketmasterAPITest {
  constructor() {
    this.apiKey = process.env.TICKETMASTER_API_KEY;
    this.baseUrl = 'https://app.ticketmaster.com/discovery/v2';
  }

  async testEventSearch(options = {}) {
    console.log('🎫 Testing Ticketmaster event search...');
    
    const params = new URLSearchParams({
      apikey: this.apiKey,
      classificationName: 'Music',
      countryCode: 'US',
      size: '10',
      startDateTime: new Date().toISOString(),
      ...options
    });

    const response = await fetch(`${this.baseUrl}/events.json?${params}`);

    if (!response.ok) {
      throw new Error(`Ticketmaster search failed: ${response.statusText}`);
    }

    const data = await response.json();
    const events = data._embedded?.events || [];
    
    console.log(`✅ Found ${events.length} upcoming music events`);
    
    events.slice(0, 3).forEach(event => {
      const venue = event._embedded?.venues?.[0];
      const date = event.dates?.start?.localDate;
      console.log(`  - ${event.name} at ${venue?.name || 'Unknown venue'} on ${date}`);
    });

    return events;
  }

  async testVenueSearch(city = 'New York') {
    console.log(`🏟️  Testing venue search for "${city}"...`);
    
    const params = new URLSearchParams({
      apikey: this.apiKey,
      city: city,
      size: '5'
    });

    const response = await fetch(`${this.baseUrl}/venues.json?${params}`);

    if (!response.ok) {
      throw new Error(`Ticketmaster venue search failed: ${response.statusText}`);
    }

    const data = await response.json();
    const venues = data._embedded?.venues || [];
    
    console.log(`✅ Found ${venues.length} venues in ${city}`);
    
    venues.forEach(venue => {
      console.log(`  - ${venue.name} (${venue.city?.name || 'Unknown city'})`);
    });

    return venues;
  }
}

// Main test runner
async function runAPITests() {
  console.log('🚀 Starting API Integration Tests...\n');

  try {
    // Verify environment variables
    console.log('🔧 Checking environment variables...');
    
    const requiredVars = [
      'SPOTIFY_CLIENT_ID',
      'SPOTIFY_CLIENT_SECRET', 
      'TICKETMASTER_API_KEY'
    ];

    const missingVars = requiredVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      console.error('❌ Missing environment variables:', missingVars.join(', '));
      process.exit(1);
    }

    console.log('✅ All environment variables present\n');

    // Test Spotify API
    console.log('=== SPOTIFY API TESTS ===');
    const spotify = new SpotifyAPITest();
    
    await spotify.getAccessToken();
    const artists = await spotify.testArtistSearch('radiohead');
    
    if (artists.length > 0) {
      await spotify.testTopTracks(artists[0].id);
    }

    console.log('\n=== TICKETMASTER API TESTS ===');
    const ticketmaster = new TicketmasterAPITest();
    
    await ticketmaster.testEventSearch();
    await ticketmaster.testVenueSearch('New York');

    console.log('\n🎉 All API tests completed successfully!');
    console.log('\n📋 API Integration Status:');
    console.log('✅ Spotify API - Working correctly');
    console.log('✅ Ticketmaster API - Working correctly');
    console.log('✅ Environment variables - Configured properly');
    
    console.log('\n📋 Next Steps:');
    console.log('1. ✅ API connectivity - VERIFIED');
    console.log('2. ⏳ Test authentication flow - PENDING');
    console.log('3. ⏳ Test real-time voting - PENDING');
    console.log('4. ⏳ Test end-to-end user journey - PENDING');

  } catch (error) {
    console.error('❌ API test failed:', error.message);
    console.error('\n🔧 Troubleshooting:');
    console.error('1. Check your API credentials in .env.local');
    console.error('2. Ensure you have internet connectivity');
    console.error('3. Verify API quotas/rate limits haven\'t been exceeded');
    process.exit(1);
  }
}

runAPITests();