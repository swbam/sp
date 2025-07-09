-- DATABASE OPTIMIZATION SCRIPT
-- SUB-AGENT 2: Performance Optimization for MySetlist Database

-- ===========================================
-- PERFORMANCE INDEXES
-- ===========================================

-- Artist indexes for fast search
CREATE INDEX IF NOT EXISTS idx_artists_name_trgm ON artists USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_artists_slug_hash ON artists USING hash (slug);
CREATE INDEX IF NOT EXISTS idx_artists_followers_desc ON artists (followers DESC);

-- Show indexes for date and relationship queries
CREATE INDEX IF NOT EXISTS idx_shows_date_status ON shows (date, status);
CREATE INDEX IF NOT EXISTS idx_shows_artist_date ON shows (artist_id, date);
CREATE INDEX IF NOT EXISTS idx_shows_venue_date ON shows (venue_id, date);
CREATE INDEX IF NOT EXISTS idx_shows_status_date ON shows (status, date) WHERE status IN ('upcoming', 'ongoing');

-- Setlist indexes for voting performance
CREATE INDEX IF NOT EXISTS idx_setlists_show_type ON setlists (show_id, type);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_setlist_position ON setlist_songs (setlist_id, position);
CREATE INDEX IF NOT EXISTS idx_setlist_songs_votes ON setlist_songs (upvotes DESC, downvotes ASC);

-- Vote indexes for real-time performance
CREATE INDEX IF NOT EXISTS idx_votes_user_setlist ON votes (user_id, setlist_song_id);
CREATE INDEX IF NOT EXISTS idx_votes_setlist_song ON votes (setlist_song_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes (created_at DESC);

-- Song search index
CREATE INDEX IF NOT EXISTS idx_songs_title_trgm ON songs USING gin (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_songs_artist_trgm ON songs USING gin (artist_name gin_trgm_ops);

-- User artist following index
CREATE INDEX IF NOT EXISTS idx_user_artists_user_created ON user_artists (user_id, created_at DESC);

-- ===========================================
-- PERFORMANCE FUNCTIONS
-- ===========================================

-- Fast artist search with ranking
CREATE OR REPLACE FUNCTION search_artists_fast(search_term TEXT, result_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  spotify_id TEXT,
  name TEXT,
  slug TEXT,
  image_url TEXT,
  genres JSONB,
  followers INTEGER,
  verified BOOLEAN,
  show_count BIGINT,
  similarity_score FLOAT
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
    COALESCE(show_counts.show_count, 0) as show_count,
    (
      CASE 
        WHEN a.name ILIKE search_term || '%' THEN 1.0
        WHEN a.name ILIKE '%' || search_term || '%' THEN 0.8
        ELSE 0.5
      END
    ) as similarity_score
  FROM artists a
  LEFT JOIN (
    SELECT 
      artist_id,
      COUNT(*) as show_count
    FROM shows 
    WHERE date >= CURRENT_DATE
    GROUP BY artist_id
  ) show_counts ON a.id = show_counts.artist_id
  WHERE 
    a.name ILIKE '%' || search_term || '%'
    OR a.slug ILIKE '%' || search_term || '%'
  ORDER BY 
    similarity_score DESC,
    a.followers DESC,
    show_counts.show_count DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Get setlist with optimized vote counts
CREATE OR REPLACE FUNCTION get_setlist_with_votes_fast(setlist_uuid UUID)
RETURNS TABLE (
  id UUID,
  setlist_id UUID,
  song_id UUID,
  position INTEGER,
  upvotes INTEGER,
  downvotes INTEGER,
  net_votes INTEGER,
  song_title TEXT,
  song_artist TEXT,
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
  JOIN songs s ON ss.song_id = s.id
  WHERE ss.setlist_id = setlist_uuid
  ORDER BY ss.position;
END;
$$ LANGUAGE plpgsql;

-- Get trending shows with optimized algorithm
CREATE OR REPLACE FUNCTION get_trending_shows(days_back INT DEFAULT 7, result_limit INT DEFAULT 20)
RETURNS TABLE (
  id UUID,
  name TEXT,
  date DATE,
  status TEXT,
  artist_id UUID,
  artist_name TEXT,
  artist_followers INTEGER,
  venue_id UUID,
  venue_name TEXT,
  venue_city TEXT,
  total_votes INTEGER,
  trending_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sh.id,
    sh.name,
    sh.date,
    sh.status,
    sh.artist_id,
    a.name as artist_name,
    a.followers as artist_followers,
    sh.venue_id,
    v.name as venue_name,
    v.city as venue_city,
    COALESCE(vote_counts.total_votes, 0) as total_votes,
    (
      -- Base score from artist popularity
      (a.followers * 0.1) +
      -- Voting activity boost
      (COALESCE(vote_counts.total_votes, 0) * 100) +
      -- Recency boost (closer dates get higher scores)
      (CASE 
        WHEN sh.date = CURRENT_DATE THEN 5000
        WHEN sh.date <= CURRENT_DATE + INTERVAL '7 days' THEN 3000
        WHEN sh.date <= CURRENT_DATE + INTERVAL '30 days' THEN 1000
        ELSE 0
      END)
    ) as trending_score
  FROM shows sh
  JOIN artists a ON sh.artist_id = a.id
  LEFT JOIN venues v ON sh.venue_id = v.id
  LEFT JOIN (
    SELECT 
      sl.show_id,
      SUM(ss.upvotes + ss.downvotes) as total_votes
    FROM setlists sl
    JOIN setlist_songs ss ON sl.id = ss.setlist_id
    GROUP BY sl.show_id
  ) vote_counts ON sh.id = vote_counts.show_id
  WHERE 
    sh.status IN ('upcoming', 'ongoing')
    AND sh.date >= CURRENT_DATE
    AND sh.date <= CURRENT_DATE + INTERVAL '6 months'
  ORDER BY trending_score DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Get user's vote on setlist song
CREATE OR REPLACE FUNCTION get_user_vote_fast(user_uuid UUID, setlist_song_uuid UUID)
RETURNS TEXT AS $$
DECLARE
  vote_result TEXT;
BEGIN
  SELECT vote_type INTO vote_result
  FROM votes
  WHERE user_id = user_uuid AND setlist_song_id = setlist_song_uuid;
  
  RETURN vote_result;
END;
$$ LANGUAGE plpgsql;

-- ===========================================
-- VOTE UPDATE TRIGGERS
-- ===========================================

-- Function to update vote counts when votes are inserted/updated/deleted
CREATE OR REPLACE FUNCTION update_setlist_song_votes()
RETURNS TRIGGER AS $$
BEGIN
  -- Update vote counts for the affected setlist song
  UPDATE setlist_songs
  SET 
    upvotes = (
      SELECT COUNT(*) FROM votes 
      WHERE setlist_song_id = COALESCE(NEW.setlist_song_id, OLD.setlist_song_id) 
      AND vote_type = 'up'
    ),
    downvotes = (
      SELECT COUNT(*) FROM votes 
      WHERE setlist_song_id = COALESCE(NEW.setlist_song_id, OLD.setlist_song_id) 
      AND vote_type = 'down'
    )
  WHERE id = COALESCE(NEW.setlist_song_id, OLD.setlist_song_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_update_votes_on_insert ON votes;
DROP TRIGGER IF EXISTS trigger_update_votes_on_update ON votes;
DROP TRIGGER IF EXISTS trigger_update_votes_on_delete ON votes;

-- Create triggers for automatic vote count updates
CREATE TRIGGER trigger_update_votes_on_insert
    AFTER INSERT ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_setlist_song_votes();

CREATE TRIGGER trigger_update_votes_on_update
    AFTER UPDATE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_setlist_song_votes();

CREATE TRIGGER trigger_update_votes_on_delete
    AFTER DELETE ON votes
    FOR EACH ROW
    EXECUTE FUNCTION update_setlist_song_votes();

-- ===========================================
-- PERFORMANCE VIEWS
-- ===========================================

-- View for trending artists with cached calculations
CREATE OR REPLACE VIEW trending_artists AS
SELECT 
  a.id,
  a.name,
  a.slug,
  a.image_url,
  a.genres,
  a.followers,
  a.verified,
  COALESCE(show_stats.upcoming_shows, 0) as upcoming_shows,
  COALESCE(show_stats.total_votes, 0) as total_votes,
  (
    (a.followers * 0.1) +
    (COALESCE(show_stats.total_votes, 0) * 50) +
    (COALESCE(show_stats.upcoming_shows, 0) * 1000)
  ) as trending_score
FROM artists a
LEFT JOIN (
  SELECT 
    sh.artist_id,
    COUNT(*) as upcoming_shows,
    SUM(COALESCE(vote_counts.total_votes, 0)) as total_votes
  FROM shows sh
  LEFT JOIN (
    SELECT 
      sl.show_id,
      SUM(ss.upvotes + ss.downvotes) as total_votes
    FROM setlists sl
    JOIN setlist_songs ss ON sl.id = ss.setlist_id
    GROUP BY sl.show_id
  ) vote_counts ON sh.id = vote_counts.show_id
  WHERE 
    sh.status IN ('upcoming', 'ongoing')
    AND sh.date >= CURRENT_DATE
  GROUP BY sh.artist_id
) show_stats ON a.id = show_stats.artist_id
ORDER BY trending_score DESC;

-- ===========================================
-- PERFORMANCE STATISTICS
-- ===========================================

-- Update table statistics for better query planning
ANALYZE artists;
ANALYZE shows;
ANALYZE setlists;
ANALYZE setlist_songs;
ANALYZE votes;
ANALYZE songs;
ANALYZE venues;
ANALYZE user_artists;

-- ===========================================
-- REFRESH MATERIALIZED VIEWS (if any)
-- ===========================================

-- Enable auto-vacuum for performance
ALTER TABLE votes SET (autovacuum_enabled = true);
ALTER TABLE setlist_songs SET (autovacuum_enabled = true);
ALTER TABLE setlists SET (autovacuum_enabled = true);
ALTER TABLE shows SET (autovacuum_enabled = true);
ALTER TABLE artists SET (autovacuum_enabled = true);

-- Set table-specific vacuum settings for high-traffic tables
ALTER TABLE votes SET (autovacuum_vacuum_scale_factor = 0.1);
ALTER TABLE setlist_songs SET (autovacuum_vacuum_scale_factor = 0.1);

-- Enable extension for text search if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_trgm;