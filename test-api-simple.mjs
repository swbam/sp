#!/usr/bin/env node

console.log('🔍 API ENDPOINT DEBUGGING - Testing database connection');
console.log('=======================================================');

// Test if environment variables are loaded
import { readFileSync } from 'fs';
import path from 'path';

let supabaseUrl, supabaseKey, ticketmasterKey;

try {
  const envFile = readFileSync('.env.local', 'utf8');
  const lines = envFile.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1];
    } else if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      supabaseKey = line.split('=')[1];
    } else if (line.startsWith('NEXT_PUBLIC_TICKETMASTER_API_KEY=')) {
      ticketmasterKey = line.split('=')[1];
    }
  }
} catch (error) {
  console.error('❌ Could not read .env.local file:', error.message);
  process.exit(1);
}

console.log('Environment check:');
console.log('- Supabase URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
console.log('- Supabase Key:', supabaseKey ? '✅ Set' : '❌ Missing');
console.log('- Ticketmaster Key:', ticketmasterKey ? '✅ Set' : '❌ Missing');

// Test database connection
async function testDatabase() {
  console.log('\n1. Testing Database Connection');
  console.log('------------------------------');
  
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/artists?select=id,name,slug&limit=5`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      console.error('❌ Database connection failed:', response.status, response.statusText);
      return false;
    }
    
    const data = await response.json();
    console.log('✅ Database connection successful');
    console.log(`Found ${data.length} artists`);
    
    if (data.length > 0) {
      console.log('Sample artist:', data[0]);
    }
    
    return true;
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    return false;
  }
}

// Test Ticketmaster API
async function testTicketmaster() {
  console.log('\n2. Testing Ticketmaster API');
  console.log('----------------------------');
  
  if (!ticketmasterKey) {
    console.error('❌ Ticketmaster API key not found');
    return false;
  }
  
  try {
    const response = await fetch(
      `https://app.ticketmaster.com/discovery/v2/attractions.json?keyword=taylor&classificationName=music&size=3&apikey=${ticketmasterKey}`
    );
    
    if (!response.ok) {
      console.error('❌ Ticketmaster API failed:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error details:', errorText);
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

// Main test
async function runTests() {
  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing required environment variables');
    process.exit(1);
  }
  
  await testDatabase();
  await testTicketmaster();
  
  console.log('\n🎯 CONCLUSION:');
  console.log('==============');
  console.log('Direct database and external API tests completed.');
  console.log('To test actual API endpoints, start the server with: npm run dev');
  console.log('Then test endpoints like: curl http://localhost:3000/api/artists');
}

runTests().catch(console.error);