#!/usr/bin/env node

/**
 * Test trending API endpoints
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load environment variables
const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...valueParts] = line.split('=');
  if (key && valueParts.length > 0) {
    envVars[key.trim()] = valueParts.join('=').trim();
  }
});

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

async function testTrendingAPI() {
  console.log('🔥 Testing Trending API Endpoints...\n');

  try {
    // Test trending shows API call directly
    const response = await fetch('http://localhost:3000/api/trending?type=shows&limit=5');
    
    if (!response.ok) {
      throw new Error(`API failed with status: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('✅ Trending shows API response:', {
      showsCount: data.trending_shows?.length || 0,
      hasData: !!data.trending_shows
    });
    
    if (data.trending_shows && data.trending_shows.length > 0) {
      console.log('\n🏆 Top 3 Trending Shows:');
      data.trending_shows.slice(0, 3).forEach((show, index) => {
        console.log(`${index + 1}. ${show.artist?.name || 'Unknown'} - ${show.name}`);
        console.log(`   📅 ${show.date}`);
        console.log(`   🗳️  Total votes: ${show.totalVotes || 0}`);
        console.log(`   📊 Trending score: ${show.trending_score?.toFixed(2) || 'N/A'}`);
      });
    }
    
    // Test trending artists API
    const artistsResponse = await fetch('http://localhost:3000/api/trending?type=artists&limit=5');
    const artistsData = await artistsResponse.json();
    
    console.log('\n🎤 Artists API response:', {
      artistsCount: artistsData.trending_artists?.length || 0,
      hasData: !!artistsData.trending_artists
    });
    
    if (artistsData.trending_artists && artistsData.trending_artists.length > 0) {
      console.log('\n⭐ Top 3 Trending Artists:');
      artistsData.trending_artists.slice(0, 3).forEach((artist, index) => {
        console.log(`${index + 1}. ${artist.name}`);
        console.log(`   👥 Followers: ${artist.followers?.toLocaleString() || 0}`);
        console.log(`   📊 Trending score: ${artist.trending_score?.toFixed(2) || 'N/A'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ API Test Failed:', error.message);
  }
}

testTrendingAPI();