-- =====================================================
-- DATABASE INITIALIZATION SCRIPT
-- Run this to ensure core database tables exist and have sample data
-- =====================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS votes CASCADE;
DROP TABLE IF EXISTS setlist_songs CASCADE;
DROP TABLE IF EXISTS setlists CASCADE;
DROP TABLE IF EXISTS user_artists CASCADE;
DROP TABLE IF EXISTS songs CASCADE;
DROP TABLE IF EXISTS shows CASCADE;
DROP TABLE IF EXISTS venues CASCADE;
DROP TABLE IF EXISTS artists CASCADE;

-- Create artists table
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

-- Create venues table
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

-- Create shows table
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

-- Create songs table
CREATE TABLE songs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  artist_name VARCHAR(255) NOT NULL,
  spotify_id VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create setlists table
CREATE TABLE setlists (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('predicted', 'actual')),
  is_locked BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create setlist_songs table
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

-- Create votes table
CREATE TABLE votes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  setlist_song_id UUID REFERENCES setlist_songs(id) ON DELETE CASCADE,
  vote_type VARCHAR(10) CHECK (vote_type IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, setlist_song_id)
);

-- Create user_artists table
CREATE TABLE user_artists (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  artist_id UUID REFERENCES artists(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY(user_id, artist_id)
);

-- Create indexes for performance
CREATE INDEX idx_artists_slug ON artists(slug);
CREATE INDEX idx_artists_name ON artists(name);
CREATE INDEX idx_venues_slug ON venues(slug);
CREATE INDEX idx_shows_date ON shows(date);
CREATE INDEX idx_shows_artist_id ON shows(artist_id);
CREATE INDEX idx_shows_venue_id ON shows(venue_id);
CREATE INDEX idx_setlists_show_id ON setlists(show_id);
CREATE INDEX idx_setlist_songs_setlist_id ON setlist_songs(setlist_id);
CREATE INDEX idx_votes_user_id ON votes(user_id);
CREATE INDEX idx_votes_setlist_song_id ON votes(setlist_song_id);

-- Enable Row Level Security
ALTER TABLE artists ENABLE ROW LEVEL SECURITY;
ALTER TABLE venues ENABLE ROW LEVEL SECURITY;
ALTER TABLE shows ENABLE ROW LEVEL SECURITY;
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE setlist_songs ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_artists ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Anyone can view artists" ON artists FOR SELECT USING (true);
CREATE POLICY "Anyone can view venues" ON venues FOR SELECT USING (true);
CREATE POLICY "Anyone can view shows" ON shows FOR SELECT USING (true);
CREATE POLICY "Anyone can view songs" ON songs FOR SELECT USING (true);
CREATE POLICY "Anyone can view setlists" ON setlists FOR SELECT USING (true);
CREATE POLICY "Anyone can view setlist songs" ON setlist_songs FOR SELECT USING (true);
CREATE POLICY "Anyone can view votes" ON votes FOR SELECT USING (true);

-- User-specific policies
CREATE POLICY "Users can view their followed artists" ON user_artists FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can follow artists" ON user_artists FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can unfollow artists" ON user_artists FOR DELETE USING (auth.uid() = user_id);

-- Voting policies
CREATE POLICY "Users can create votes" ON votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own votes" ON votes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own votes" ON votes FOR DELETE USING (auth.uid() = user_id);

-- INSERT SAMPLE DATA

-- Insert sample venues
INSERT INTO venues (name, slug, city, state, country, capacity) VALUES
  ('Madison Square Garden', 'madison-square-garden', 'New York', 'NY', 'USA', 20789),
  ('Hollywood Bowl', 'hollywood-bowl', 'Los Angeles', 'CA', 'USA', 17500),
  ('Red Rocks Amphitheatre', 'red-rocks-amphitheatre', 'Morrison', 'CO', 'USA', 9545),
  ('Wembley Stadium', 'wembley-stadium', 'London', null, 'UK', 90000),
  ('Chase Center', 'chase-center', 'San Francisco', 'CA', 'USA', 18064),
  ('United Center', 'united-center', 'Chicago', 'IL', 'USA', 23500);

-- Insert sample artists
INSERT INTO artists (name, slug, image_url, genres, followers, verified) VALUES
  ('Taylor Swift', 'taylor-swift', 'https://i.scdn.co/image/ab6761610000e5ebf2b6b5e4e5f6f7b8a1e2c3d4', '["pop", "country", "folk"]', 85000000, true),
  ('The Weeknd', 'the-weeknd', 'https://i.scdn.co/image/ab6761610000e5eb2e4f5e6f7b8a1e2c3d4f5g6h', '["pop", "r&b", "electronic"]', 78000000, true),
  ('Billie Eilish', 'billie-eilish', 'https://i.scdn.co/image/ab6761610000e5eb3e4f5e6f7b8a1e2c3d4f5g6h', '["pop", "alternative", "indie"]', 65000000, true),
  ('Drake', 'drake', 'https://i.scdn.co/image/ab6761610000e5eb4e4f5e6f7b8a1e2c3d4f5g6h', '["hip-hop", "rap", "pop"]', 72000000, true),
  ('Radiohead', 'radiohead', 'https://i.scdn.co/image/ab6761610000e5eb5e4f5e6f7b8a1e2c3d4f5g6h', '["alternative rock", "experimental", "rock"]', 12000000, true),
  ('Beyoncé', 'beyonce', 'https://i.scdn.co/image/ab6761610000e5eb6e4f5e6f7b8a1e2c3d4f5g6h', '["pop", "r&b", "hip-hop"]', 45000000, true),
  ('Ed Sheeran', 'ed-sheeran', 'https://i.scdn.co/image/ab6761610000e5eb7e4f5e6f7b8a1e2c3d4f5g6h', '["pop", "folk", "acoustic"]', 89000000, true),
  ('Dua Lipa', 'dua-lipa', 'https://i.scdn.co/image/ab6761610000e5eb8e4f5e6f7b8a1e2c3d4f5g6h', '["pop", "dance", "electronic"]', 55000000, true);

-- Insert sample shows
INSERT INTO shows (artist_id, venue_id, name, date, start_time, status, ticket_url) VALUES
  (
    (SELECT id FROM artists WHERE slug = 'taylor-swift'),
    (SELECT id FROM venues WHERE slug = 'madison-square-garden'),
    'Taylor Swift | The Eras Tour',
    '2024-08-15',
    '20:00:00',
    'upcoming',
    'https://www.ticketmaster.com/taylor-swift-tickets'
  ),
  (
    (SELECT id FROM artists WHERE slug = 'the-weeknd'),
    (SELECT id FROM venues WHERE slug = 'hollywood-bowl'),
    'The Weeknd - After Hours Tour',
    '2024-09-02',
    '21:00:00',
    'upcoming',
    'https://www.ticketmaster.com/the-weeknd-tickets'
  ),
  (
    (SELECT id FROM artists WHERE slug = 'billie-eilish'),
    (SELECT id FROM venues WHERE slug = 'chase-center'),
    'Billie Eilish - Hit Me Hard and Soft Tour',
    '2024-10-14',
    '19:30:00',
    'upcoming',
    'https://www.ticketmaster.com/billie-eilish-tickets'
  ),
  (
    (SELECT id FROM artists WHERE slug = 'radiohead'),
    (SELECT id FROM venues WHERE slug = 'red-rocks-amphitheatre'),
    'Radiohead - OK Computer 25th Anniversary',
    '2024-07-25',
    '20:00:00',
    'completed',
    'https://www.ticketmaster.com/radiohead-tickets'
  ),
  (
    (SELECT id FROM artists WHERE slug = 'drake'),
    (SELECT id FROM venues WHERE slug = 'united-center'),
    'Drake - For All The Dogs Tour',
    '2024-11-18',
    '20:00:00',
    'upcoming',
    'https://www.ticketmaster.com/drake-tickets'
  );

-- Insert sample songs
INSERT INTO songs (title, artist_name) VALUES
  -- Taylor Swift songs
  ('Love Story', 'Taylor Swift'),
  ('Shake It Off', 'Taylor Swift'),
  ('Anti-Hero', 'Taylor Swift'),
  ('Blank Space', 'Taylor Swift'),
  ('22', 'Taylor Swift'),
  ('We Are Never Getting Back Together', 'Taylor Swift'),
  ('I Knew You Were Trouble', 'Taylor Swift'),
  ('Bad Blood', 'Taylor Swift'),
  ('Delicate', 'Taylor Swift'),
  ('Cardigan', 'Taylor Swift'),
  
  -- The Weeknd songs
  ('Blinding Lights', 'The Weeknd'),
  ('Can''t Feel My Face', 'The Weeknd'),
  ('Starboy', 'The Weeknd'),
  ('The Hills', 'The Weeknd'),
  ('Earned It', 'The Weeknd'),
  ('I Feel It Coming', 'The Weeknd'),
  ('After Hours', 'The Weeknd'),
  ('Save Your Tears', 'The Weeknd'),
  ('Call Out My Name', 'The Weeknd'),
  ('Wicked Games', 'The Weeknd'),
  
  -- Billie Eilish songs
  ('bad guy', 'Billie Eilish'),
  ('when the party''s over', 'Billie Eilish'),
  ('everything i wanted', 'Billie Eilish'),
  ('lovely', 'Billie Eilish'),
  ('bury a friend', 'Billie Eilish'),
  ('ocean eyes', 'Billie Eilish'),
  ('my boy', 'Billie Eilish'),
  ('Therefore I Am', 'Billie Eilish'),
  ('Your Power', 'Billie Eilish'),
  ('Happier Than Ever', 'Billie Eilish'),
  
  -- Drake songs
  ('God''s Plan', 'Drake'),
  ('In My Feelings', 'Drake'),
  ('Nice For What', 'Drake'),
  ('Hotline Bling', 'Drake'),
  ('One Dance', 'Drake'),
  ('Work', 'Drake'),
  ('Started From the Bottom', 'Drake'),
  ('Take Care', 'Drake'),
  ('Energy', 'Drake'),
  ('Nonstop', 'Drake'),
  
  -- Radiohead songs
  ('Karma Police', 'Radiohead'),
  ('Paranoid Android', 'Radiohead'),
  ('No Surprises', 'Radiohead'),
  ('Creep', 'Radiohead'),
  ('Fake Plastic Trees', 'Radiohead'),
  ('High and Dry', 'Radiohead'),
  ('Everything In Its Right Place', 'Radiohead'),
  ('15 Step', 'Radiohead'),
  ('Weird Fishes', 'Radiohead'),
  ('Nude', 'Radiohead');

-- Create sample setlists with songs
-- For Taylor Swift show
INSERT INTO setlists (show_id, type, is_locked) VALUES
  ((SELECT id FROM shows WHERE name = 'Taylor Swift | The Eras Tour'), 'predicted', false);

-- Add songs to Taylor Swift setlist
INSERT INTO setlist_songs (setlist_id, song_id, position, upvotes, downvotes) VALUES
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Taylor Swift | The Eras Tour')),
    (SELECT id FROM songs WHERE title = 'Love Story' AND artist_name = 'Taylor Swift'),
    1, 45, 3
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Taylor Swift | The Eras Tour')),
    (SELECT id FROM songs WHERE title = 'Shake It Off' AND artist_name = 'Taylor Swift'),
    2, 38, 5
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Taylor Swift | The Eras Tour')),
    (SELECT id FROM songs WHERE title = 'Anti-Hero' AND artist_name = 'Taylor Swift'),
    3, 52, 2
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Taylor Swift | The Eras Tour')),
    (SELECT id FROM songs WHERE title = 'Blank Space' AND artist_name = 'Taylor Swift'),
    4, 41, 4
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Taylor Swift | The Eras Tour')),
    (SELECT id FROM songs WHERE title = '22' AND artist_name = 'Taylor Swift'),
    5, 33, 7
  );

-- For The Weeknd show
INSERT INTO setlists (show_id, type, is_locked) VALUES
  ((SELECT id FROM shows WHERE name = 'The Weeknd - After Hours Tour'), 'predicted', false);

-- Add songs to The Weeknd setlist
INSERT INTO setlist_songs (setlist_id, song_id, position, upvotes, downvotes) VALUES
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'The Weeknd - After Hours Tour')),
    (SELECT id FROM songs WHERE title = 'Blinding Lights' AND artist_name = 'The Weeknd'),
    1, 67, 1
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'The Weeknd - After Hours Tour')),
    (SELECT id FROM songs WHERE title = 'Can''t Feel My Face' AND artist_name = 'The Weeknd'),
    2, 55, 3
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'The Weeknd - After Hours Tour')),
    (SELECT id FROM songs WHERE title = 'Starboy' AND artist_name = 'The Weeknd'),
    3, 48, 2
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'The Weeknd - After Hours Tour')),
    (SELECT id FROM songs WHERE title = 'The Hills' AND artist_name = 'The Weeknd'),
    4, 42, 4
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'The Weeknd - After Hours Tour')),
    (SELECT id FROM songs WHERE title = 'After Hours' AND artist_name = 'The Weeknd'),
    5, 39, 6
  );

-- For Billie Eilish show
INSERT INTO setlists (show_id, type, is_locked) VALUES
  ((SELECT id FROM shows WHERE name = 'Billie Eilish - Hit Me Hard and Soft Tour'), 'predicted', false);

-- Add songs to Billie Eilish setlist
INSERT INTO setlist_songs (setlist_id, song_id, position, upvotes, downvotes) VALUES
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Billie Eilish - Hit Me Hard and Soft Tour')),
    (SELECT id FROM songs WHERE title = 'bad guy' AND artist_name = 'Billie Eilish'),
    1, 71, 2
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Billie Eilish - Hit Me Hard and Soft Tour')),
    (SELECT id FROM songs WHERE title = 'when the party''s over' AND artist_name = 'Billie Eilish'),
    2, 44, 8
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Billie Eilish - Hit Me Hard and Soft Tour')),
    (SELECT id FROM songs WHERE title = 'everything i wanted' AND artist_name = 'Billie Eilish'),
    3, 35, 5
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Billie Eilish - Hit Me Hard and Soft Tour')),
    (SELECT id FROM songs WHERE title = 'lovely' AND artist_name = 'Billie Eilish'),
    4, 61, 3
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Billie Eilish - Hit Me Hard and Soft Tour')),
    (SELECT id FROM songs WHERE title = 'ocean eyes' AND artist_name = 'Billie Eilish'),
    5, 28, 9
  );

-- For Drake show
INSERT INTO setlists (show_id, type, is_locked) VALUES
  ((SELECT id FROM shows WHERE name = 'Drake - For All The Dogs Tour'), 'predicted', false);

-- Add songs to Drake setlist
INSERT INTO setlist_songs (setlist_id, song_id, position, upvotes, downvotes) VALUES
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Drake - For All The Dogs Tour')),
    (SELECT id FROM songs WHERE title = 'God''s Plan' AND artist_name = 'Drake'),
    1, 58, 4
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Drake - For All The Dogs Tour')),
    (SELECT id FROM songs WHERE title = 'In My Feelings' AND artist_name = 'Drake'),
    2, 49, 6
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Drake - For All The Dogs Tour')),
    (SELECT id FROM songs WHERE title = 'Hotline Bling' AND artist_name = 'Drake'),
    3, 63, 2
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Drake - For All The Dogs Tour')),
    (SELECT id FROM songs WHERE title = 'One Dance' AND artist_name = 'Drake'),
    4, 41, 7
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Drake - For All The Dogs Tour')),
    (SELECT id FROM songs WHERE title = 'Started From the Bottom' AND artist_name = 'Drake'),
    5, 36, 5
  );

-- For Radiohead show (completed)
INSERT INTO setlists (show_id, type, is_locked) VALUES
  ((SELECT id FROM shows WHERE name = 'Radiohead - OK Computer 25th Anniversary'), 'predicted', true);

-- Add songs to Radiohead setlist
INSERT INTO setlist_songs (setlist_id, song_id, position, upvotes, downvotes) VALUES
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Radiohead - OK Computer 25th Anniversary')),
    (SELECT id FROM songs WHERE title = 'Karma Police' AND artist_name = 'Radiohead'),
    1, 89, 1
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Radiohead - OK Computer 25th Anniversary')),
    (SELECT id FROM songs WHERE title = 'Paranoid Android' AND artist_name = 'Radiohead'),
    2, 95, 2
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Radiohead - OK Computer 25th Anniversary')),
    (SELECT id FROM songs WHERE title = 'No Surprises' AND artist_name = 'Radiohead'),
    3, 76, 3
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Radiohead - OK Computer 25th Anniversary')),
    (SELECT id FROM songs WHERE title = 'Creep' AND artist_name = 'Radiohead'),
    4, 82, 4
  ),
  (
    (SELECT id FROM setlists WHERE show_id = (SELECT id FROM shows WHERE name = 'Radiohead - OK Computer 25th Anniversary')),
    (SELECT id FROM songs WHERE title = 'Fake Plastic Trees' AND artist_name = 'Radiohead'),
    5, 67, 8
  );

-- Create vote count triggers
CREATE OR REPLACE FUNCTION update_setlist_song_votes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE setlist_songs 
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote_type = 'down' THEN 1 ELSE 0 END
    WHERE id = NEW.setlist_song_id;
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    UPDATE setlist_songs 
    SET 
      upvotes = upvotes - CASE WHEN OLD.vote_type = 'up' THEN 1 ELSE 0 END,
      downvotes = downvotes - CASE WHEN OLD.vote_type = 'down' THEN 1 ELSE 0 END
    WHERE id = OLD.setlist_song_id;
    
    UPDATE setlist_songs 
    SET 
      upvotes = upvotes + CASE WHEN NEW.vote_type = 'up' THEN 1 ELSE 0 END,
      downvotes = downvotes + CASE WHEN NEW.vote_type = 'down' THEN 1 ELSE 0 END
    WHERE id = NEW.setlist_song_id;
    RETURN NEW;
  END IF;

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

-- Create trigger
DROP TRIGGER IF EXISTS setlist_song_vote_trigger ON votes;
CREATE TRIGGER setlist_song_vote_trigger
  AFTER INSERT OR UPDATE OR DELETE ON votes
  FOR EACH ROW EXECUTE FUNCTION update_setlist_song_votes();

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_artists_updated_at BEFORE UPDATE ON artists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shows_updated_at BEFORE UPDATE ON shows
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_setlists_updated_at BEFORE UPDATE ON setlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Verify data was inserted
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
FROM songs
UNION ALL
SELECT 
  'setlists' as table_name, 
  COUNT(*) as record_count 
FROM setlists
UNION ALL
SELECT 
  'setlist_songs' as table_name, 
  COUNT(*) as record_count 
FROM setlist_songs;

-- =====================================================
-- DATABASE INITIALIZATION COMPLETED
-- =====================================================