-- =====================================================
-- MYSETLIST DATABASE MIGRATION SCRIPT
-- Complete transformation from Spotify clone to MySetlist
-- =====================================================

-- ===== STEP 1: CLEANUP - DROP OLD MUSIC TABLES =====
-- WARNING: This will delete all existing music data!
-- Run this ONLY if you're sure about the migration

-- Drop old music-related tables first (cascading)
DROP TABLE IF EXISTS liked_songs CASCADE;
DROP TABLE IF EXISTS songs CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS prices CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS customers CASCADE;

-- Drop old enums that won't be needed
DROP TYPE IF EXISTS pricing_plan_interval CASCADE;
DROP TYPE IF EXISTS pricing_type CASCADE;
DROP TYPE IF EXISTS subscription_status CASCADE;

-- ===== STEP 2: CREATE NEW MYSETLIST TABLES =====

-- Artists table - core entity for MySetlist
CREATE TABLE artists (
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
CREATE TABLE venues (
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
CREATE TABLE shows (
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

-- Songs table (just metadata, NO audio fields)
CREATE TABLE songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist_name VARCHAR(255) NOT NULL,
  spotify_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setlists table
CREATE TABLE setlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('predicted', 'actual')),
  is_locked BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Setlist songs with voting
CREATE TABLE setlist_songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setlist_id UUID REFERENCES setlists(id) ON DELETE CASCADE,
  song_id UUID REFERENCES songs(id),
  position INTEGER NOT NULL,
  upvotes INTEGER DEFAULT 0,
  downvotes INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(setlist_id, position)
);

-- Votes table
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  setlist_song_id UUID REFERENCES setlist_songs(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, setlist_song_id)
);

-- User following artists
CREATE TABLE user_artists (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, artist_id)
);

-- ===== STEP 3: CREATE PERFORMANCE INDEXES =====

-- Artists indexes
CREATE INDEX idx_artists_slug ON artists(slug);
CREATE INDEX idx_artists_spotify_id ON artists(spotify_id);
CREATE INDEX idx_artists_name ON artists(name);
CREATE INDEX idx_artists_followers ON artists(followers DESC);

-- Venues indexes  
CREATE INDEX idx_venues_slug ON venues(slug);
CREATE INDEX idx_venues_city ON venues(city);
CREATE INDEX idx_venues_country ON venues(country);

-- Shows indexes
CREATE INDEX idx_shows_date ON shows(date);
CREATE INDEX idx_shows_artist_id ON shows(artist_id);
CREATE INDEX idx_shows_venue_id ON shows(venue_id);
CREATE INDEX idx_shows_status ON shows(status);
CREATE INDEX idx_shows_date_status ON shows(date, status);

-- Songs indexes
CREATE INDEX idx_songs_spotify_id ON songs(spotify_id);
CREATE INDEX idx_songs_title ON songs(title);
CREATE INDEX idx_songs_artist_name ON songs(artist_name);

-- Setlists indexes
CREATE INDEX idx_setlists_show_id ON setlists(show_id);
CREATE INDEX idx_setlists_type ON setlists(type);
CREATE INDEX idx_setlists_created_by ON setlists(created_by);

-- Setlist songs indexes
CREATE INDEX idx_setlist_songs_setlist_id ON setlist_songs(setlist_id);
CREATE INDEX idx_setlist_songs_song_id ON setlist_songs(song_id);
CREATE INDEX idx_setlist_songs_position ON setlist_songs(setlist_id, position);
CREATE INDEX idx_setlist_songs_votes ON setlist_songs(upvotes DESC, downvotes);

-- Votes indexes
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_setlist_song_id ON votes(setlist_song_id);
CREATE INDEX idx_votes_vote_type ON votes(vote_type);

-- User artists indexes
CREATE INDEX idx_user_artists_user_id ON user_artists(user_id);
CREATE INDEX idx_user_artists_artist_id ON user_artists(artist_id);

-- ===== STEP 4: CREATE DATABASE FUNCTIONS =====

-- Function to update vote counts when votes are inserted/updated/deleted
CREATE OR REPLACE FUNCTION update_setlist_song_votes()
RETURNS TRIGGER AS $$
BEGIN
  -- For INSERT operations
  IF TG_OP = 'INSERT' THEN
    UPDATE setlist_songs 
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote_type = 'down' THEN 1 ELSE 0 END
    WHERE id = NEW.setlist_song_id;
    RETURN NEW;
  END IF;

  -- For UPDATE operations
  IF TG_OP = 'UPDATE' THEN
    -- Remove old vote
    UPDATE setlist_songs 
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type = 'up' THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN OLD.vote_type = 'down' THEN 1 ELSE 0 END
    WHERE id = OLD.setlist_song_id;
    
    -- Add new vote
    UPDATE setlist_songs 
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote_type = 'down' THEN 1 ELSE 0 END
    WHERE id = NEW.setlist_song_id;
    RETURN NEW;
  END IF;

  -- For DELETE operations
  IF TG_OP = 'DELETE' THEN
    UPDATE setlist_songs 
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type = 'up' THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN OLD.vote_type = 'down' THEN 1 ELSE 0 END
    WHERE id = OLD.setlist_song_id;
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic vote counting
DROP TRIGGER IF EXISTS setlist_song_vote_trigger ON votes;
CREATE TRIGGER setlist_song_vote_trigger
  AFTER INSERT OR UPDATE OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION update_setlist_song_votes();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shows_updated_at BEFORE UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_setlists_updated_at BEFORE UPDATE ON setlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ===== STEP 5: ENABLE ROW LEVEL SECURITY =====

-- Enable RLS on all tables
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_artists ENABLE ROW LEVEL SECURITY;

-- ===== STEP 6: CREATE RLS POLICIES =====

-- Public read access policies
CREATE POLICY "Anyone can view artists" ON artists FOR SELECT USING (true);
CREATE POLICY "Anyone can view venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Anyone can view shows" ON shows FOR SELECT USING (true);
CREATE POLICY "Anyone can view songs" ON songs FOR SELECT USING (true);
CREATE POLICY "Anyone can view setlists" ON setlists FOR SELECT USING (true);
CREATE POLICY "Anyone can view setlist songs" ON setlist_songs FOR SELECT USING (true);
CREATE POLICY "Anyone can view votes" ON votes FOR SELECT USING (true);

-- User-specific policies for following artists
CREATE POLICY "Users can view their followed artists" ON user_artists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can follow artists" ON user_artists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow artists" ON user_artists FOR DELETE USING (auth.uid() = user_id);

-- Voting policies
CREATE POLICY "Users can create votes" ON votes 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON votes 
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON votes 
  FOR DELETE USING (auth.uid() = user_id);

-- Setlist creation policies
CREATE POLICY "Users can create setlists" ON setlists 
  FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Users can update own setlists" ON setlists 
  FOR UPDATE USING (auth.uid() = created_by);

-- Setlist song policies  
CREATE POLICY "Users can add songs to setlists" ON setlist_songs 
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM setlists 
      WHERE setlists.id = setlist_id 
      AND setlists.created_by = auth.uid()
    )
  );

-- Admin policies (for data imports and management)
CREATE POLICY "Admins can manage artists" ON artists FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admins can manage venues" ON venues FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

CREATE POLICY "Admins can manage shows" ON shows FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM auth.users 
      WHERE auth.users.id = auth.uid() 
      AND auth.users.raw_app_meta_data->>'role' = 'admin'
    )
  );

-- ===== STEP 7: CREATE UTILITY FUNCTIONS =====

-- Function to get setlist with vote counts
CREATE OR REPLACE FUNCTION get_setlist_with_votes(setlist_uuid UUID)
RETURNS TABLE (
  id UUID,
  setlist_id UUID,
  song_id UUID,
  position INTEGER,
  upvotes INTEGER,
  downvotes INTEGER,
  net_votes INTEGER,
  song_title VARCHAR,
  song_artist VARCHAR,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ss.id,
    ss.setlist_id,
    ss.song_id,
    ss.position,
    ss.upvotes,
    ss.downvotes,
    (ss.upvotes - ss.downvotes) as net_votes,
    s.title as song_title,
    s.artist_name as song_artist,
    ss.created_at
  FROM setlist_songs ss
  JOIN songs s ON s.id = ss.song_id
  WHERE ss.setlist_id = setlist_uuid
  ORDER BY (ss.upvotes - ss.downvotes) DESC, ss.position ASC;
END;
$$ LANGUAGE plpgsql;

-- Function to get user's vote for a setlist song
CREATE OR REPLACE FUNCTION get_user_vote(user_uuid UUID, setlist_song_uuid UUID)
RETURNS VARCHAR AS $$
DECLARE
  vote_result VARCHAR;
BEGIN
  SELECT vote_type INTO vote_result
  FROM votes
  WHERE user_id = user_uuid AND setlist_song_id = setlist_song_uuid;
  
  RETURN vote_result;
END;
$$ LANGUAGE plpgsql;

-- Function to search artists by name (for API endpoints)
CREATE OR REPLACE FUNCTION search_artists(search_term TEXT, result_limit INTEGER DEFAULT 20)
RETURNS TABLE (
  id UUID,
  spotify_id VARCHAR,
  name VARCHAR,
  slug VARCHAR,
  image_url TEXT,
  genres JSONB,
  followers INTEGER,
  verified BOOLEAN,
  show_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    a.id,
    a.spotify_id,
    a.name,
    a.slug,
    a.image_url,
    a.genres,
    a.followers,
    a.verified,
    COUNT(s.id) as show_count
  FROM artists a
  LEFT JOIN shows s ON s.artist_id = a.id AND s.date >= CURRENT_DATE
  WHERE a.name ILIKE '%' || search_term || '%'
  GROUP BY a.id, a.spotify_id, a.name, a.slug, a.image_url, a.genres, a.followers, a.verified
  ORDER BY a.followers DESC, a.name ASC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ===== STEP 8: INSERT SAMPLE DATA (OPTIONAL) =====

-- Insert sample venue
INSERT INTO venues (name, slug, city, state, country, capacity) 
VALUES 
  ('Madison Square Garden', 'madison-square-garden', 'New York', 'NY', 'USA', 20789),
  ('Red Rocks Amphitheatre', 'red-rocks-amphitheatre', 'Morrison', 'CO', 'USA', 9545),
  ('Hollywood Bowl', 'hollywood-bowl', 'Los Angeles', 'CA', 'USA', 17500);

-- Insert sample artist
INSERT INTO artists (name, slug, image_url, genres, followers, verified) 
VALUES 
  ('The Beatles', 'the-beatles', 'https://example.com/beatles.jpg', '["rock", "pop", "classic rock"]', 25000000, true),
  ('Radiohead', 'radiohead', 'https://example.com/radiohead.jpg', '["alternative rock", "experimental", "electronic"]', 8500000, true),
  ('Taylor Swift', 'taylor-swift', 'https://example.com/taylorswift.jpg', '["pop", "country", "folk"]', 45000000, true);

-- Insert sample show
INSERT INTO shows (artist_id, venue_id, name, date, start_time, status) 
VALUES 
  (
    (SELECT id FROM artists WHERE slug = 'radiohead'), 
    (SELECT id FROM venues WHERE slug = 'madison-square-garden'),
    'Radiohead - OK Computer 25th Anniversary Tour',
    '2024-08-15',
    '20:00:00',
    'upcoming'
  );

-- Insert sample songs
INSERT INTO songs (title, artist_name, spotify_id) 
VALUES 
  ('Paranoid Android', 'Radiohead', '6LgJqWIgXOJBLP1E5gg0mg'),
  ('Karma Police', 'Radiohead', '63OQupATfueTdZMWTxW03A'),
  ('No Surprises', 'Radiohead', '7AzIoLKOy3l2ADrxYlLPZm'),
  ('OK Computer', 'Radiohead', '3ZkLlBxP9QZ7D8S9T1Y4aQ');

-- ===== MIGRATION COMPLETED =====

-- Verify the migration worked by checking table counts
SELECT 
  'artists' as table_name, 
  COUNT(*) as record_count 
FROM artists
UNION ALL
SELECT 
  'venues' as table_name, 
  COUNT(*) as record_count 
FROM venues
UNION ALL
SELECT 
  'shows' as table_name, 
  COUNT(*) as record_count 
FROM shows
UNION ALL
SELECT 
  'songs' as table_name, 
  COUNT(*) as record_count 
FROM songs;

-- Show all created tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- =====================================================
-- MIGRATION SCRIPT COMPLETED SUCCESSFULLY
-- =====================================================