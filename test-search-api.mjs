#!/usr/bin/env node

import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const TICKETMASTER_API_KEY = process.env.TICKETMASTER_API_KEY;
const TICKETMASTER_BASE_URL = 'https://app.ticketmaster.com/discovery/v2';

console.log('🔍 SEARCH API TEST\n');

// Test the actual searchArtists function from ticketmaster.ts
async function searchArtists(query) {
  if (!TICKETMASTER_API_KEY) {
    throw new Error('Ticketmaster API key not configured');
  }

  try {
    const response = await fetch(
      `${TICKETMASTER_BASE_URL}/attractions.json?` + 
      `keyword=${encodeURIComponent(query)}` +
      `&classificationName=music` +
      `&size=20` +
      `&apikey=${TICKETMASTER_API_KEY}`
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Ticketmaster API');
    }

    const data = await response.json();
    
    if (!data._embedded?.attractions) {
      return [];
    }

    return data._embedded.attractions.map((attraction) => ({
      id: attraction.id,
      name: attraction.name,
      images: attraction.images || [],
      genres: attraction.classifications?.[0]?.genre?.name 
        ? [attraction.classifications[0].genre.name]
        : [],
      url: attraction.url
    }));
  } catch (error) {
    console.error('Error searching Ticketmaster artists:', error);
    return [];
  }
}

// Test searches
const testQueries = ['taylor swift', 'coldplay', 'drake', 'adele', 'foo fighters'];

for (const query of testQueries) {
  console.log(`\n🎵 Testing search for: "${query}"`);
  
  try {
    const artists = await searchArtists(query);
    console.log(`   ✓ Found ${artists.length} artists`);
    
    if (artists.length > 0) {
      console.log(`   → Top result: ${artists[0].name}`);
      console.log(`   → Genres: ${artists[0].genres.join(', ') || 'None'}`);
      console.log(`   → Images: ${artists[0].images.length} available`);
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
  }
  
  // Rate limiting
  await new Promise(resolve => setTimeout(resolve, 500));
}

console.log('\n🎯 SEARCH API TEST COMPLETE\n');