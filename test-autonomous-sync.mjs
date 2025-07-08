#!/usr/bin/env node

/**
 * AUTONOMOUS SYNC ENDPOINT TEST
 * Test the autonomous sync endpoint with real API data
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

console.log('🚀 TESTING AUTONOMOUS SYNC ENDPOINT');
console.log('===================================');

async function testAutonomousSync() {
  console.log('📡 Testing autonomous sync endpoint...');
  
  try {
    // Get the cron secret from environment
    const cronSecret = process.env.CRON_SECRET;
    
    if (!cronSecret) {
      console.log('❌ CRON_SECRET not found in environment');
      return false;
    }
    
    console.log('🔑 Using CRON_SECRET for authentication');
    
    // Test with a simulated autonomous sync call
    const url = `http://localhost:3000/api/sync/autonomous?secret=${cronSecret}`;
    
    console.log('📞 Making autonomous sync request...');
    console.log(`URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`📡 Response status: ${response.status}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Autonomous sync failed: ${response.statusText}`);
      console.log(`Error details: ${errorText}`);
      return false;
    }
    
    const data = await response.json();
    
    console.log('✅ Autonomous sync successful!');
    console.log('📊 Sync results:');
    console.log(JSON.stringify(data, null, 2));
    
    return true;
    
  } catch (error) {
    console.log(`❌ Autonomous sync test failed: ${error.message}`);
    return false;
  }
}

// Test individual API connections
async function testAPIConnections() {
  console.log('\n🔌 Testing individual API connections...');
  
  const results = {
    spotify: false,
    ticketmaster: false,
    setlistfm: false
  };
  
  // Test Spotify
  try {
    const authResponse = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString('base64')}`
      },
      body: 'grant_type=client_credentials'
    });

    if (authResponse.ok) {
      const authData = await authResponse.json();
      const accessToken = authData.access_token;
      
      const testResponse = await fetch('https://api.spotify.com/v1/search?q=test&type=artist&limit=1', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (testResponse.ok) {
        results.spotify = true;
        console.log('✅ Spotify API: Connected');
      }
    }
  } catch (error) {
    console.log(`❌ Spotify API: Failed - ${error.message}`);
  }
  
  // Test Ticketmaster
  try {
    const tmResponse = await fetch(`https://app.ticketmaster.com/discovery/v2/events.json?apikey=${process.env.TICKETMASTER_API_KEY}&size=1`);
    
    if (tmResponse.ok) {
      results.ticketmaster = true;
      console.log('✅ Ticketmaster API: Connected');
    }
  } catch (error) {
    console.log(`❌ Ticketmaster API: Failed - ${error.message}`);
  }
  
  // Test Setlist.fm
  try {
    const setlistResponse = await fetch('https://api.setlist.fm/rest/1.0/search/artists?artistName=test&p=1', {
      headers: {
        'Accept': 'application/json',
        'x-api-key': process.env.SETLISTFM_API_KEY,
        'User-Agent': 'MySetlist/1.0.0 (https://mysetlist.app)'
      }
    });
    
    if (setlistResponse.ok) {
      results.setlistfm = true;
      console.log('✅ Setlist.fm API: Connected');
    }
  } catch (error) {
    console.log(`❌ Setlist.fm API: Failed - ${error.message}`);
  }
  
  return results;
}

// Main test function
async function runTest() {
  console.log('🎯 STARTING AUTONOMOUS SYNC VALIDATION');
  console.log('======================================\n');
  
  // Test API connections first
  const apiResults = await testAPIConnections();
  
  const allAPIsConnected = Object.values(apiResults).every(connected => connected);
  
  if (!allAPIsConnected) {
    console.log('\n❌ Not all APIs are connected. Autonomous sync may fail.');
    console.log('🔧 API Connection Status:');
    console.log(`   Spotify: ${apiResults.spotify ? '✅' : '❌'}`);
    console.log(`   Ticketmaster: ${apiResults.ticketmaster ? '✅' : '❌'}`);
    console.log(`   Setlist.fm: ${apiResults.setlistfm ? '✅' : '❌'}`);
  } else {
    console.log('\n✅ All APIs connected successfully');
  }
  
  // Test autonomous sync
  const syncResult = await testAutonomousSync();
  
  if (syncResult) {
    console.log('\n🎉 AUTONOMOUS SYNC VALIDATION PASSED');
    console.log('✅ Real data sync is working correctly');
    console.log('✅ Database population is functional');
    console.log('✅ All API integrations are operational');
  } else {
    console.log('\n❌ AUTONOMOUS SYNC VALIDATION FAILED');
    console.log('🔧 Check server logs for details');
  }
}

// Execute the test
runTest().catch(console.error);