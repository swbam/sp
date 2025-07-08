#!/usr/bin/env node

/**
 * Direct Database Migration for MySetlist
 * 
 * This script executes the database migration using individual SQL statements
 */

import { createClient } from '@supabase/supabase-js';
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

const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase environment variables');
  process.exit(1);
}

console.log('🔗 Connecting to Supabase...');
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSQL(sql, description) {
  console.log(`🔄 ${description}...`);
  try {
    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey
      },
      body: JSON.stringify({ sql })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`❌ Error in ${description}:`, error);
      return false;
    }

    console.log(`✅ ${description} completed`);
    return true;
  } catch (err) {
    console.error(`❌ Error in ${description}:`, err.message);
    return false;
  }
}

async function createTables() {
  console.log('🚀 Starting MySetlist Database Migration...\n');

  // Step 1: Create Artists table
  const createArtists = `
    CREATE TABLE IF NOT EXISTS artists (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      spotify_id VARCHAR(255) UNIQUE,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      image_url TEXT,
      genres JSONB DEFAULT '[]',
      followers INTEGER DEFAULT 0,
      verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Step 2: Create Venues table
  const createVenues = `
    CREATE TABLE IF NOT EXISTS venues (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE NOT NULL,
      city VARCHAR(255) NOT NULL,
      state VARCHAR(255),
      country VARCHAR(255) NOT NULL,
      capacity INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Step 3: Create Shows table
  const createShows = `
    CREATE TABLE IF NOT EXISTS shows (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
      venue_id UUID REFERENCES venues(id),
      name VARCHAR(255) NOT NULL,
      date DATE NOT NULL,
      start_time TIME,
      status VARCHAR(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'ongoing', 'completed', 'cancelled')),
      ticket_url TEXT,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Step 4: Create Songs table
  const createSongs = `
    CREATE TABLE IF NOT EXISTS songs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      artist_name VARCHAR(255) NOT NULL,
      spotify_id VARCHAR(255),
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Step 5: Create Setlists table
  const createSetlists = `
    CREATE TABLE IF NOT EXISTS setlists (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
      type VARCHAR(20) NOT NULL CHECK (type IN ('predicted', 'actual')),
      is_locked BOOLEAN DEFAULT FALSE,
      created_by UUID REFERENCES auth.users(id),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;

  // Step 6: Create Setlist Songs table
  const createSetlistSongs = `
    CREATE TABLE IF NOT EXISTS setlist_songs (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE,
      song_id UUID REFERENCES songs(id),
      position INTEGER NOT NULL,
      upvotes INTEGER DEFAULT 0,
      downvotes INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(setlist_id, position)
    );
  `;

  // Step 7: Create Votes table
  const createVotes = `
    CREATE TABLE IF NOT EXISTS votes (
      id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      setlist_song_id UUID REFERENCES setlist_songs(id) ON DELETE CASCADE,
      vote_type VARCHAR(10) CHECK (vote_type IN ('up', 'down')),
      created_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, setlist_song_id)
    );
  `;

  // Step 8: Create User Artists table
  const createUserArtists = `
    CREATE TABLE IF NOT EXISTS user_artists (
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY(user_id, artist_id)
    );
  `;

  // Execute table creation
  const steps = [
    [createArtists, 'Creating artists table'],
    [createVenues, 'Creating venues table'],
    [createShows, 'Creating shows table'],
    [createSongs, 'Creating songs table'],
    [createSetlists, 'Creating setlists table'],
    [createSetlistSongs, 'Creating setlist_songs table'],
    [createVotes, 'Creating votes table'],
    [createUserArtists, 'Creating user_artists table']
  ];

  for (const [sql, description] of steps) {
    await executeSQL(sql, description);
  }

  // Add sample data
  console.log('\n🌱 Adding sample data...');
  
  const sampleData = `
    INSERT INTO venues (name, slug, city, state, country, capacity) 
    VALUES 
      ('Madison Square Garden', 'madison-square-garden', 'New York', 'NY', 'USA', 20789),
      ('Red Rocks Amphitheatre', 'red-rocks-amphitheatre', 'Morrison', 'CO', 'USA', 9545)
    ON CONFLICT (slug) DO NOTHING;

    INSERT INTO artists (name, slug, image_url, genres, followers, verified) 
    VALUES 
      ('Radiohead', 'radiohead', 'https://example.com/radiohead.jpg', '["alternative rock", "experimental"]', 8500000, true),
      ('Taylor Swift', 'taylor-swift', 'https://example.com/taylorswift.jpg', '["pop", "country"]', 45000000, true)
    ON CONFLICT (slug) DO NOTHING;
  `;

  await executeSQL(sampleData, 'Adding sample data');

  // Test the setup
  console.log('\n🔍 Testing database setup...');
  
  const { data: artists, error } = await supabase
    .from('artists')
    .select('*')
    .limit(5);

  if (error) {
    console.error('❌ Test query failed:', error.message);
  } else {
    console.log(`✅ Test successful: Found ${artists.length} artists`);
    artists.forEach(artist => {
      console.log(`  - ${artist.name} (${artist.slug})`);
    });
  }

  console.log('\n🎉 Database migration completed successfully!');
  console.log('\n📋 Next Steps:');
  console.log('1. Enable RLS policies in Supabase Dashboard');
  console.log('2. Test the application: npm run dev');
  console.log('3. Verify user authentication flow');
}

createTables().catch(console.error);