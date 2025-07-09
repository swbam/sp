#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log('🔍 API ENDPOINT DEBUGGING - Testing all critical endpoints');
console.log('============================================================');

// Test direct database connections first
async function testDatabaseConnection() {
  console.log('\n1. Testing Direct Database Connection');
  console.log('-------------------------------------');
  
  try {
    const { data: artists, error } = await supabase
      .from('artists')
      .select('id, name, slug, image_url, followers')
      .limit(5);
    
    if (error) {
      console.error('❌ Database connection error:', error.message);
      return false;
    }
    
    console.log('✅ Database connection successful');
    console.log(`Found ${artists?.length || 0} artists`);
    if (artists?.length > 0) {
      console.log('Sample artist:', artists[0]);
    }
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
}

// Test API endpoints via HTTP
async function testAPIEndpoint(endpoint, description) {
  console.log(`\n2. Testing ${description}`);
  console.log('-------------------------------------');
  
  try {
    const response = await fetch(`http://localhost:3000${endpoint}`);
    const data = await response.json();
    
    if (!response.ok) {
      console.error(`❌ ${description} failed:`, response.status, data);
      return false;
    }
    
    console.log(`✅ ${description} successful`);
    console.log('Response structure:', Object.keys(data));
    
    // Show sample data
    if (data.artists && data.artists.length > 0) {
      console.log('Sample artist:', data.artists[0]);
    }
    if (data.shows && data.shows.length > 0) {
      console.log('Sample show:', data.shows[0]);
    }
    if (data.trending_shows && data.trending_shows.length > 0) {
      console.log('Sample trending show:', data.trending_shows[0]);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ ${description} failed:`, error.message);
    return false;
  }
}

// Test Ticketmaster API
async function testTicketmasterAPI() {
  console.log('\n3. Testing Ticketmaster API');
  console.log('-------------------------------------');
  
  const apiKey = process.env.NEXT_PUBLIC_TICKETMASTER_API_KEY;
  if (!apiKey) {
    console.error('❌ Ticketmaster API key not found');
    return false;
  }
  
  try {
    const response = await fetch(
      `https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=taylor&classificationName=music&size=3&apikey=${apiKey}`
    );
    
    if (!response.ok) {
      console.error('❌ Ticketmaster API failed:', response.status);
      return false;
    }
    
    const data = await response.json();
    console.log('✅ Ticketmaster API working');
    console.log(`Found ${data._embedded?.attractions?.length || 0} attractions`);
    
    return true;
  } catch (error) {
    console.error('❌ Ticketmaster API failed:', error.message);
    return false;
  }
}

// Main test runner
async function runTests() {
  console.log('Starting API endpoint tests...\n');
  
  // Test database connection first
  const dbWorking = await testDatabaseConnection();
  if (!dbWorking) {
    console.log('\n❌ Database connection failed - API tests will likely fail');
    return;
  }
  
  // Test Ticketmaster API
  await testTicketmasterAPI();
  
  // Only test actual API endpoints if we have a server running
  console.log('\n🚀 Testing actual API endpoints (requires server to be running)');
  console.log('================================================================');
  
  const endpoints = [
    ['/api/artists', 'Artists API'],
    ['/api/artists?limit=5', 'Artists API with limit'],
    ['/api/shows', 'Shows API'],
    ['/api/shows?limit=5', 'Shows API with limit'],
    ['/api/trending', 'Trending API'],
    ['/api/trending?type=shows&limit=3', 'Trending Shows API'],
    ['/api/search/artists?q=taylor', 'Search Artists API'],
  ];
  
  for (const [endpoint, description] of endpoints) {
    await testAPIEndpoint(endpoint, description);
    await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between tests
  }
  
  console.log('\n✅ API endpoint testing completed');
  console.log('If any endpoints failed, check the server logs for detailed error information');
}

runTests().catch(console.error);