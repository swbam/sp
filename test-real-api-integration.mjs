#!/usr/bin/env node

/**
 * REAL API INTEGRATION VALIDATION TEST
 * SUB-AGENT 2: Real Data Sync & API Integration Validation
 * 
 * This script validates all real API integrations with the provided credentials
 * and ensures the complete data sync pipeline works with live data.
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

console.log('🔍 SUB-AGENT 2: REAL API INTEGRATION VALIDATION');
console.log('====================================================');
console.log('Testing real API credentials and data sync endpoints...\n');

// Real API credentials provided
const API_CREDENTIALS = {
  SPOTIFY_CLIENT_ID: '2946864dc822469b9c672292ead45f43',
  SPOTIFY_CLIENT_SECRET: 'feaf0fc901124b839b11e02f97d18a8d',
  TICKETMASTER_API_KEY: 'k8GrSAkbFaN0w7qDxGl7ohr8LwdAQm9b',
  SETLISTFM_API_KEY: 'xkutflW-aRy_Df9rF4OkJyCsHBYN88V37EBL'
};

// Set environment variables for testing
for (const [key, value] of Object.entries(API_CREDENTIALS)) {
  process.env[key] = value;
}

class RealAPIValidator {
  constructor() {
    this.results = {
      spotify: { status: 'pending', tests: [] },
      ticketmaster: { status: 'pending', tests: [] },
      setlistfm: { status: 'pending', tests: [] },
      syncEndpoints: { status: 'pending', tests: [] }
    };
  }

  async validateSpotifyAPI() {
    console.log('🎵 TESTING SPOTIFY API');
    console.log('----------------------');
    
    try {
      // Test Spotify authentication
      const authResponse = await fetch('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${Buffer.from(`${API_CREDENTIALS.SPOTIFY_CLIENT_ID}:${API_CREDENTIALS.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
        },
        body: 'grant_type=client_credentials'
      });

      if (!authResponse.ok) {
        throw new Error(`Auth failed: ${authResponse.statusText}`);
      }

      const authData = await authResponse.json();
      const accessToken = authData.access_token;
      
      this.results.spotify.tests.push({
        name: 'Authentication',
        status: 'passed',
        details: 'Successfully obtained access token'
      });

      console.log('✅ Spotify authentication successful');

      // Test artist search
      const artistResponse = await fetch('https://api.spotify.com/v1/search?q=Taylor%20Swift&type=artist&limit=5', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!artistResponse.ok) {
        throw new Error(`Artist search failed: ${artistResponse.statusText}`);
      }

      const artistData = await artistResponse.json();
      
      this.results.spotify.tests.push({
        name: 'Artist Search',
        status: 'passed',
        details: `Found ${artistData.artists.items.length} artists`
      });

      console.log(`✅ Artist search successful: Found ${artistData.artists.items.length} artists`);

      // Test getting artist details
      if (artistData.artists.items.length > 0) {
        const artistId = artistData.artists.items[0].id;
        const artistDetailsResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!artistDetailsResponse.ok) {
          throw new Error(`Artist details failed: ${artistDetailsResponse.statusText}`);
        }

        const artistDetails = await artistDetailsResponse.json();
        
        this.results.spotify.tests.push({
          name: 'Artist Details',
          status: 'passed',
          details: `Retrieved details for ${artistDetails.name}`
        });

        console.log(`✅ Artist details successful: ${artistDetails.name}`);

        // Test top tracks
        const topTracksResponse = await fetch(`https://api.spotify.com/v1/artists/${artistId}/top-tracks?market=US`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        if (!topTracksResponse.ok) {
          throw new Error(`Top tracks failed: ${topTracksResponse.statusText}`);
        }

        const topTracksData = await topTracksResponse.json();
        
        this.results.spotify.tests.push({
          name: 'Top Tracks',
          status: 'passed',
          details: `Retrieved ${topTracksData.tracks.length} top tracks`
        });

        console.log(`✅ Top tracks successful: ${topTracksData.tracks.length} tracks`);
      }

      this.results.spotify.status = 'passed';
      console.log('✅ SPOTIFY API - ALL TESTS PASSED\n');

    } catch (error) {
      this.results.spotify.status = 'failed';
      this.results.spotify.tests.push({
        name: 'Error',
        status: 'failed',
        details: error.message
      });
      console.log(`❌ SPOTIFY API FAILED: ${error.message}\n`);
    }
  }

  async validateTicketmasterAPI() {
    console.log('🎪 TESTING TICKETMASTER API');
    console.log('---------------------------');
    
    try {
      // Test event search
      const eventResponse = await fetch(
        `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${API_CREDENTIALS.TICKETMASTER_API_KEY}&city=New%20York&classificationName=Music&size=5`
      );

      if (!eventResponse.ok) {
        throw new Error(`Event search failed: ${eventResponse.statusText}`);
      }

      const eventData = await eventResponse.json();
      const events = eventData._embedded?.events || [];
      
      this.results.ticketmaster.tests.push({
        name: 'Event Search',
        status: 'passed',
        details: `Found ${events.length} music events in New York`
      });

      console.log(`✅ Event search successful: Found ${events.length} events`);

      // Test venue search
      const venueResponse = await fetch(
        `https://app.ticketmaster.com/discovery/v2/venues.json?apikey=${API_CREDENTIALS.TICKETMASTER_API_KEY}&city=New%20York&size=5`
      );

      if (!venueResponse.ok) {
        throw new Error(`Venue search failed: ${venueResponse.statusText}`);
      }

      const venueData = await venueResponse.json();
      const venues = venueData._embedded?.venues || [];
      
      this.results.ticketmaster.tests.push({
        name: 'Venue Search',
        status: 'passed',
        details: `Found ${venues.length} venues in New York`
      });

      console.log(`✅ Venue search successful: Found ${venues.length} venues`);

      // Test specific event details
      if (events.length > 0) {
        const eventId = events[0].id;
        const eventDetailsResponse = await fetch(
          `https://app.ticketmaster.com/discovery/v2/events/${eventId}.json?apikey=${API_CREDENTIALS.TICKETMASTER_API_KEY}`
        );

        if (!eventDetailsResponse.ok) {
          throw new Error(`Event details failed: ${eventDetailsResponse.statusText}`);
        }

        const eventDetails = await eventDetailsResponse.json();
        
        this.results.ticketmaster.tests.push({
          name: 'Event Details',
          status: 'passed',
          details: `Retrieved details for ${eventDetails.name}`
        });

        console.log(`✅ Event details successful: ${eventDetails.name}`);
      }

      this.results.ticketmaster.status = 'passed';
      console.log('✅ TICKETMASTER API - ALL TESTS PASSED\n');

    } catch (error) {
      this.results.ticketmaster.status = 'failed';
      this.results.ticketmaster.tests.push({
        name: 'Error',
        status: 'failed',
        details: error.message
      });
      console.log(`❌ TICKETMASTER API FAILED: ${error.message}\n`);
    }
  }

  async validateSetlistFMAPI() {
    console.log('🎭 TESTING SETLIST.FM API');
    console.log('-------------------------');
    
    try {
      // Test artist search
      const artistResponse = await fetch(
        'https://api.setlist.fm/rest/1.0/search/artists?artistName=Coldplay&p=1&sort=relevance',
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': API_CREDENTIALS.SETLISTFM_API_KEY,
            'User-Agent': 'MySetlist/1.0.0 (https://mysetlist.app)'
          }
        }
      );

      if (!artistResponse.ok) {
        throw new Error(`Artist search failed: ${artistResponse.statusText}`);
      }

      const artistData = await artistResponse.json();
      const artists = artistData.artist || [];
      
      this.results.setlistfm.tests.push({
        name: 'Artist Search',
        status: 'passed',
        details: `Found ${artists.length} artists matching 'Coldplay'`
      });

      console.log(`✅ Artist search successful: Found ${artists.length} artists`);

      // Test setlist search
      const setlistResponse = await fetch(
        'https://api.setlist.fm/rest/1.0/search/setlists?artistName=Coldplay&p=1',
        {
          headers: {
            'Accept': 'application/json',
            'x-api-key': API_CREDENTIALS.SETLISTFM_API_KEY,
            'User-Agent': 'MySetlist/1.0.0 (https://mysetlist.app)'
          }
        }
      );

      if (!setlistResponse.ok) {
        throw new Error(`Setlist search failed: ${setlistResponse.statusText}`);
      }

      const setlistData = await setlistResponse.json();
      const setlists = setlistData.setlist || [];
      
      this.results.setlistfm.tests.push({
        name: 'Setlist Search',
        status: 'passed',
        details: `Found ${setlists.length} setlists for Coldplay`
      });

      console.log(`✅ Setlist search successful: Found ${setlists.length} setlists`);

      // Test getting artist setlists by MBID
      if (artists.length > 0 && artists[0].mbid) {
        const mbid = artists[0].mbid;
        const artistSetlistsResponse = await fetch(
          `https://api.setlist.fm/rest/1.0/artist/${mbid}/setlists?p=1`,
          {
            headers: {
              'Accept': 'application/json',
              'x-api-key': API_CREDENTIALS.SETLISTFM_API_KEY,
              'User-Agent': 'MySetlist/1.0.0 (https://mysetlist.app)'
            }
          }
        );

        if (!artistSetlistsResponse.ok) {
          throw new Error(`Artist setlists failed: ${artistSetlistsResponse.statusText}`);
        }

        const artistSetlistsData = await artistSetlistsResponse.json();
        const artistSetlists = artistSetlistsData.setlist || [];
        
        this.results.setlistfm.tests.push({
          name: 'Artist Setlists',
          status: 'passed',
          details: `Retrieved ${artistSetlists.length} setlists for artist`
        });

        console.log(`✅ Artist setlists successful: ${artistSetlists.length} setlists`);
      }

      this.results.setlistfm.status = 'passed';
      console.log('✅ SETLIST.FM API - ALL TESTS PASSED\n');

    } catch (error) {
      this.results.setlistfm.status = 'failed';
      this.results.setlistfm.tests.push({
        name: 'Error',
        status: 'failed',
        details: error.message
      });
      console.log(`❌ SETLIST.FM API FAILED: ${error.message}\n`);
    }
  }

  async validateSyncEndpoints() {
    console.log('🔄 TESTING SYNC ENDPOINTS');
    console.log('-------------------------');
    
    try {
      const baseUrl = 'http://localhost:3000';
      
      // Test artist search endpoint
      const artistSearchResponse = await fetch(`${baseUrl}/api/search/artists?q=Taylor%20Swift`);
      
      if (!artistSearchResponse.ok) {
        throw new Error(`Artist search endpoint failed: ${artistSearchResponse.statusText}`);
      }

      const artistSearchData = await artistSearchResponse.json();
      
      this.results.syncEndpoints.tests.push({
        name: 'Artist Search Endpoint',
        status: 'passed',
        details: `Search returned ${artistSearchData.artists?.length || 0} results`
      });

      console.log(`✅ Artist search endpoint: ${artistSearchData.artists?.length || 0} results`);

      // Test sync health endpoint
      const syncHealthResponse = await fetch(`${baseUrl}/api/sync/health`);
      
      if (!syncHealthResponse.ok) {
        throw new Error(`Sync health endpoint failed: ${syncHealthResponse.statusText}`);
      }

      const syncHealthData = await syncHealthResponse.json();
      
      this.results.syncEndpoints.tests.push({
        name: 'Sync Health Endpoint',
        status: 'passed',
        details: `Health check: ${syncHealthData.status}`
      });

      console.log(`✅ Sync health endpoint: ${syncHealthData.status}`);

      // Test trending endpoint
      const trendingResponse = await fetch(`${baseUrl}/api/trending`);
      
      if (!trendingResponse.ok) {
        throw new Error(`Trending endpoint failed: ${trendingResponse.statusText}`);
      }

      const trendingData = await trendingResponse.json();
      
      this.results.syncEndpoints.tests.push({
        name: 'Trending Endpoint',
        status: 'passed',
        details: `Trending data available: ${trendingData.success}`
      });

      console.log(`✅ Trending endpoint: ${trendingData.success}`);

      // Test sync status endpoint
      const syncStatusResponse = await fetch(`${baseUrl}/api/sync/status`);
      
      if (!syncStatusResponse.ok) {
        throw new Error(`Sync status endpoint failed: ${syncStatusResponse.statusText}`);
      }

      const syncStatusData = await syncStatusResponse.json();
      
      this.results.syncEndpoints.tests.push({
        name: 'Sync Status Endpoint',
        status: 'passed',
        details: `Sync status: ${syncStatusData.status}`
      });

      console.log(`✅ Sync status endpoint: ${syncStatusData.status}`);

      this.results.syncEndpoints.status = 'passed';
      console.log('✅ SYNC ENDPOINTS - ALL TESTS PASSED\n');

    } catch (error) {
      this.results.syncEndpoints.status = 'failed';
      this.results.syncEndpoints.tests.push({
        name: 'Error',
        status: 'failed',
        details: error.message
      });
      console.log(`❌ SYNC ENDPOINTS FAILED: ${error.message}\n`);
    }
  }

  async runAllTests() {
    console.log('🚀 STARTING COMPREHENSIVE REAL API VALIDATION');
    console.log('==============================================\n');

    await this.validateSpotifyAPI();
    await this.validateTicketmasterAPI();
    await this.validateSetlistFMAPI();
    await this.validateSyncEndpoints();

    this.generateReport();
  }

  generateReport() {
    console.log('📊 FINAL VALIDATION REPORT');
    console.log('===========================');
    
    const overallStatus = Object.values(this.results).every(result => result.status === 'passed') ? 'PASSED' : 'FAILED';
    
    console.log(`\n🎯 OVERALL STATUS: ${overallStatus}`);
    console.log('\n📋 DETAILED RESULTS:');
    
    for (const [api, result] of Object.entries(this.results)) {
      const statusIcon = result.status === 'passed' ? '✅' : '❌';
      console.log(`\n${statusIcon} ${api.toUpperCase()}: ${result.status.toUpperCase()}`);
      
      for (const test of result.tests) {
        const testIcon = test.status === 'passed' ? '  ✓' : '  ✗';
        console.log(`${testIcon} ${test.name}: ${test.details}`);
      }
    }

    console.log('\n🔧 RECOMMENDATIONS:');
    
    if (this.results.spotify.status === 'failed') {
      console.log('- Fix Spotify API integration');
    }
    
    if (this.results.ticketmaster.status === 'failed') {
      console.log('- Fix Ticketmaster API integration');
    }
    
    if (this.results.setlistfm.status === 'failed') {
      console.log('- Fix Setlist.fm API integration');
    }
    
    if (this.results.syncEndpoints.status === 'failed') {
      console.log('- Fix sync endpoints (start development server)');
    }
    
    if (overallStatus === 'PASSED') {
      console.log('- All APIs are functioning correctly with real data');
      console.log('- Ready for production deployment');
    }

    console.log('\n📝 NEXT STEPS:');
    console.log('1. Start development server: npm run dev');
    console.log('2. Test autonomous sync: POST /api/sync/autonomous');
    console.log('3. Verify database population with real data');
    console.log('4. Test complete user flow with real data');
    
    console.log('\n🎯 SUB-AGENT 2 VALIDATION COMPLETE');
  }
}

// Run the validation
const validator = new RealAPIValidator();
validator.runAllTests().catch(console.error);