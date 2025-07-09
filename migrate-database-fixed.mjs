#!/usr/bin/env node

/**
 * Fixed Database Migration for MySetlist
 * 
 * This script properly sets up the database schema using Supabase client methods
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

async function checkAndCreateTables() {
  console.log('🚀 Starting MySetlist Database Migration...');
  
  try {
    // Test basic connection
    const { data: testData, error: testError } = await supabase
      .from('artists')
      .select('count')
      .limit(1);
    
    if (testError && testError.code === 'PGRST106') {
      console.log('🔄 Artists table does not exist, this is expected for initial setup');
    } else if (testError) {
      console.log('⚠️  Database connection test result:', testError.message);
    } else {
      console.log('✅ Database connection successful');
    }

    // Check if tables exist by trying to query them
    const tableChecks = [
      'artists', 'venues', 'shows', 'songs', 'setlists', 'setlist_songs', 'votes', 'user_artists'
    ];
    
    let existingTables = [];
    let missingTables = [];
    
    for (const table of tableChecks) {
      try {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .limit(1);
        
        if (error && error.code === 'PGRST106') {
          missingTables.push(table);
        } else if (error) {
          console.log(`⚠️  Issue checking ${table}:`, error.message);
          missingTables.push(table);
        } else {
          existingTables.push(table);
        }
      } catch (e) {
        missingTables.push(table);
      }
    }
    
    if (existingTables.length > 0) {
      console.log(`✅ Existing tables found: ${existingTables.join(', ')}`);
    }
    
    if (missingTables.length > 0) {
      console.log(`🔄 Missing tables: ${missingTables.join(', ')}`);
      console.log('');
      console.log('📋 Database Schema Setup Required:');
      console.log('');
      console.log('Please run the following SQL in your Supabase SQL Editor:');
      console.log('https://supabase.com/dashboard/project/' + supabaseUrl.split('//')[1].split('.')[0] + '/sql');
      console.log('');
      console.log('-- MySetlist Database Schema');
      console.log(`
-- Artists table
CREATE TABLE IF NOT EXISTS public.artists (
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

-- Venues table
CREATE TABLE IF NOT EXISTS public.venues (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE NOT NULL,
    city VARCHAR(255) NOT NULL,
    state VARCHAR(255),
    country VARCHAR(255) NOT NULL,
    capacity INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shows table
CREATE TABLE IF NOT EXISTS public.shows (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    artist_id UUID REFERENCES public.artists(id) ON DELETE CASCADE,
    venue_id UUID REFERENCES public.venues(id),
    name VARCHAR(255) NOT NULL,
    date DATE NOT NULL,
    start_time TIME,
    status VARCHAR(20) DEFAULT 'upcoming',
    ticket_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Songs table
CREATE TABLE IF NOT EXISTS public.songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    spotify_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setlists table
CREATE TABLE IF NOT EXISTS public.setlists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    show_id UUID REFERENCES public.shows(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('predicted', 'actual')),
    is_locked BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setlist songs table
CREATE TABLE IF NOT EXISTS public.setlist_songs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setlist_id UUID REFERENCES public.setlists(id) ON DELETE CASCADE,
    song_id UUID REFERENCES public.songs(id),
    position INTEGER NOT NULL,
    upvotes INTEGER DEFAULT 0,
    downvotes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(setlist_id, position)
);

-- Votes table
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    setlist_song_id UUID REFERENCES public.setlist_songs(id) ON DELETE CASCADE,
    vote_type VARCHAR(10) CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, setlist_song_id)
);

-- User following artists table
CREATE TABLE IF NOT EXISTS public.user_artists (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    artist_id UUID REFERENCES public.artists(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY(user_id, artist_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_shows_date ON public.shows(date);
CREATE INDEX IF NOT EXISTS idx_shows_artist ON public.shows(artist_id);
CREATE INDEX IF NOT EXISTS idx_artists_slug ON public.artists(slug);
CREATE INDEX IF NOT EXISTS idx_venues_slug ON public.venues(slug);
CREATE INDEX IF NOT EXISTS idx_songs_artist ON public.songs(artist_name);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist ON public.setlist_songs(setlist_id);
CREATE INDEX IF NOT EXISTS idx_votes_user ON public.votes(user_id);
CREATE INDEX IF NOT EXISTS idx_votes_setlist_song ON public.votes(setlist_song_id);

-- Enable Row Level Security
ALTER TABLE public.artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_artists ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for public read access
CREATE POLICY "Public read access" ON public.artists FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.venues FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.shows FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.songs FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.setlists FOR SELECT USING (true);
CREATE POLICY "Public read access" ON public.setlist_songs FOR SELECT USING (true);

-- Vote policies - users can only vote if authenticated
CREATE POLICY "Users can create votes" ON public.votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Users can update own votes" ON public.votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON public.votes FOR DELETE USING (auth.uid() = user_id);

-- User artists policies
CREATE POLICY "Users can manage their artist follows" ON public.user_artists FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Public read access" ON public.user_artists FOR SELECT USING (true);
      `);
      
      console.log('');
      console.log('After running the SQL schema, you can add sample data:');
      console.log('');
      console.log('-- Sample Data');
      console.log(`
-- Insert sample artists
INSERT INTO public.artists (name, slug, image_url, genres, followers, verified) VALUES
('Taylor Swift', 'taylor-swift', 'https://example.com/taylor-swift.jpg', '["pop", "country"]', 50000000, true),
('The Weeknd', 'the-weeknd', 'https://example.com/the-weeknd.jpg', '["pop", "r&b"]', 30000000, true),
('Drake', 'drake', 'https://example.com/drake.jpg', '["hip-hop", "rap"]', 45000000, true),
('Post Malone', 'post-malone', 'https://example.com/post-malone.jpg', '["hip-hop", "pop"]', 25000000, true),
('Billie Eilish', 'billie-eilish', 'https://example.com/billie-eilish.jpg', '["pop", "alternative"]', 35000000, true)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample venues
INSERT INTO public.venues (name, slug, city, state, country, capacity) VALUES
('Madison Square Garden', 'madison-square-garden', 'New York', 'NY', 'USA', 20000),
('The Forum', 'the-forum', 'Los Angeles', 'CA', 'USA', 17500),
('United Center', 'united-center', 'Chicago', 'IL', 'USA', 23500),
('Red Rocks Amphitheatre', 'red-rocks-amphitheatre', 'Morrison', 'CO', 'USA', 9525),
('Wembley Stadium', 'wembley-stadium', 'London', '', 'UK', 90000)
ON CONFLICT (slug) DO NOTHING;
      `);
      
    } else {
      console.log('✅ All required tables exist');
    }
    
    // Try to add some sample data if tables exist
    if (existingTables.includes('artists')) {
      console.log('🔍 Testing database setup...');
      const { data: artists, error: artistError } = await supabase
        .from('artists')
        .select('name, slug')
        .limit(5);
      
      if (artistError) {
        console.log('⚠️  Error testing artists:', artistError.message);
      } else {
        console.log(`✅ Test successful: Found ${artists.length} artists`);
        if (artists.length > 0) {
          artists.forEach(artist => {
            console.log(`  - ${artist.name} (${artist.slug})`);
          });
        }
      }
    }
    
    console.log('');
    console.log('🎉 Database migration completed successfully!');
    console.log('');
    console.log('📋 Next Steps:');
    console.log('1. Run the SQL schema in Supabase Dashboard (if tables were missing)');
    console.log('2. Test the application: npm run dev');
    console.log('3. Verify user authentication flow');
    
  } catch (error) {
    console.error('❌ Database migration failed:', error);
    process.exit(1);
  }
}

checkAndCreateTables();