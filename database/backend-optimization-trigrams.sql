-- =====================================================
-- BACKEND OPTIMIZATION: TRIGRAM FTS INDEXES
-- Ultra-fast fuzzy search with PostgreSQL trigrams
-- Target: <100ms search performance for production
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- =====================================================
-- TRIGRAM INDEXES FOR FUZZY SEARCH
-- =====================================================

-- Artists trigram indexes for fuzzy search
DROP INDEX IF EXISTS idx_artists_name_trigram;
CREATE INDEX CONCURRENTLY idx_artists_name_trigram 
ON artists USING gin(name gin_trgm_ops);

-- Composite trigram index for artists (name + genres)
DROP INDEX IF EXISTS idx_artists_search_composite;
CREATE INDEX CONCURRENTLY idx_artists_search_composite 
ON artists USING gin(
    (name || ' ' || COALESCE(array_to_string(genres, ' '), '')) gin_trgm_ops
);

-- Songs trigram indexes for fuzzy search
DROP INDEX IF EXISTS idx_songs_title_trigram;
CREATE INDEX CONCURRENTLY idx_songs_title_trigram 
ON songs USING gin(title gin_trgm_ops);

DROP INDEX IF EXISTS idx_songs_artist_name_trigram;
CREATE INDEX CONCURRENTLY idx_songs_artist_name_trigram 
ON songs USING gin(artist_name gin_trgm_ops);

-- Composite trigram index for songs (title + artist)
DROP INDEX IF EXISTS idx_songs_search_composite;
CREATE INDEX CONCURRENTLY idx_songs_search_composite 
ON songs USING gin(
    (title || ' ' || artist_name) gin_trgm_ops
);

-- Venues trigram indexes for fuzzy search
DROP INDEX IF EXISTS idx_venues_name_trigram;
CREATE INDEX CONCURRENTLY idx_venues_name_trigram 
ON venues USING gin(name gin_trgm_ops);

DROP INDEX IF EXISTS idx_venues_location_trigram;
CREATE INDEX CONCURRENTLY idx_venues_location_trigram 
ON venues USING gin(
    (name || ' ' || city || ' ' || COALESCE(state, '') || ' ' || country) gin_trgm_ops
);

-- =====================================================
-- FULL-TEXT SEARCH INDEXES
-- =====================================================

-- Artists full-text search with ranking
DROP INDEX IF EXISTS idx_artists_fts;
CREATE INDEX CONCURRENTLY idx_artists_fts 
ON artists USING gin(
    to_tsvector('english', 
        name || ' ' || COALESCE(array_to_string(genres, ' '), '')
    )
);

-- Songs full-text search with ranking
DROP INDEX IF EXISTS idx_songs_fts;
CREATE INDEX CONCURRENTLY idx_songs_fts 
ON songs USING gin(
    to_tsvector('english', title || ' ' || artist_name)
);

-- Venues full-text search
DROP INDEX IF EXISTS idx_venues_fts;
CREATE INDEX CONCURRENTLY idx_venues_fts 
ON venues USING gin(
    to_tsvector('english', 
        name || ' ' || city || ' ' || 
        COALESCE(state, '') || ' ' || country
    )
);

-- =====================================================
-- OPTIMIZED SEARCH FUNCTIONS
-- =====================================================

-- Ultra-fast artist search with trigram similarity
CREATE OR REPLACE FUNCTION search_artists_trigram(
    search_query TEXT,
    similarity_threshold REAL DEFAULT 0.3,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE(
    id UUID,
    name VARCHAR(255),
    slug VARCHAR(255),
    image_url TEXT,
    genres JSONB,
    followers INTEGER,
    verified BOOLEAN,
    similarity_score REAL,
    rank_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.name,
        a.slug,
        a.image_url,
        a.genres,
        a.followers,
        a.verified,
        GREATEST(
            similarity(a.name, search_query),
            similarity(COALESCE(array_to_string(a.genres, ' '), ''), search_query)
        ) as similarity_score,
        ts_rank(
            to_tsvector('english', a.name || ' ' || COALESCE(array_to_string(a.genres, ' '), '')),
            plainto_tsquery('english', search_query)
        ) as rank_score
    FROM artists a
    WHERE 
        -- Trigram similarity search
        (a.name % search_query OR 
         COALESCE(array_to_string(a.genres, ' '), '') % search_query)
        OR
        -- Full-text search fallback
        to_tsvector('english', a.name || ' ' || COALESCE(array_to_string(a.genres, ' '), '')) 
        @@ plainto_tsquery('english', search_query)
        OR
        -- Exact match and prefix search
        a.name ILIKE search_query || '%'
        OR
        a.name ILIKE '%' || search_query || '%'
    ORDER BY 
        -- Prioritize exact matches
        CASE WHEN a.name ILIKE search_query || '%' THEN 1
             WHEN a.name ILIKE '%' || search_query || '%' THEN 2
             ELSE 3 END,
        -- Then by similarity score
        GREATEST(
            similarity(a.name, search_query),
            similarity(COALESCE(array_to_string(a.genres, ' '), ''), search_query)
        ) DESC,
        -- Then by followers for tie-breaking
        a.followers DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Ultra-fast song search with trigram similarity
CREATE OR REPLACE FUNCTION search_songs_trigram(
    search_query TEXT,
    similarity_threshold REAL DEFAULT 0.3,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE(
    id UUID,
    title VARCHAR(255),
    artist_name VARCHAR(255),
    spotify_id VARCHAR(255),
    similarity_score REAL,
    rank_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        s.id,
        s.title,
        s.artist_name,
        s.spotify_id,
        GREATEST(
            similarity(s.title, search_query),
            similarity(s.artist_name, search_query)
        ) as similarity_score,
        ts_rank(
            to_tsvector('english', s.title || ' ' || s.artist_name),
            plainto_tsquery('english', search_query)
        ) as rank_score
    FROM songs s
    WHERE 
        -- Trigram similarity search
        (s.title % search_query OR s.artist_name % search_query)
        OR
        -- Full-text search fallback
        to_tsvector('english', s.title || ' ' || s.artist_name) 
        @@ plainto_tsquery('english', search_query)
        OR
        -- Exact match and prefix search
        s.title ILIKE search_query || '%'
        OR
        s.title ILIKE '%' || search_query || '%'
        OR
        s.artist_name ILIKE search_query || '%'
    ORDER BY 
        -- Prioritize exact matches
        CASE WHEN s.title ILIKE search_query || '%' THEN 1
             WHEN s.artist_name ILIKE search_query || '%' THEN 2
             WHEN s.title ILIKE '%' || search_query || '%' THEN 3
             ELSE 4 END,
        -- Then by similarity score
        GREATEST(
            similarity(s.title, search_query),
            similarity(s.artist_name, search_query)
        ) DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Ultra-fast venue search with trigram similarity
CREATE OR REPLACE FUNCTION search_venues_trigram(
    search_query TEXT,
    similarity_threshold REAL DEFAULT 0.3,
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE(
    id UUID,
    name VARCHAR(255),
    slug VARCHAR(255),
    city VARCHAR(255),
    state VARCHAR(255),
    country VARCHAR(255),
    capacity INTEGER,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        v.id,
        v.name,
        v.slug,
        v.city,
        v.state,
        v.country,
        v.capacity,
        GREATEST(
            similarity(v.name, search_query),
            similarity(v.city, search_query),
            similarity(COALESCE(v.state, ''), search_query),
            similarity(v.country, search_query)
        ) as similarity_score
    FROM venues v
    WHERE 
        -- Trigram similarity search
        (v.name % search_query OR 
         v.city % search_query OR 
         COALESCE(v.state, '') % search_query OR 
         v.country % search_query)
        OR
        -- Full-text search fallback
        to_tsvector('english', v.name || ' ' || v.city || ' ' || 
                    COALESCE(v.state, '') || ' ' || v.country) 
        @@ plainto_tsquery('english', search_query)
        OR
        -- Exact match and prefix search
        v.name ILIKE search_query || '%'
        OR
        v.city ILIKE search_query || '%'
    ORDER BY 
        -- Prioritize exact matches
        CASE WHEN v.name ILIKE search_query || '%' THEN 1
             WHEN v.city ILIKE search_query || '%' THEN 2
             ELSE 3 END,
        -- Then by similarity score
        GREATEST(
            similarity(v.name, search_query),
            similarity(v.city, search_query),
            similarity(COALESCE(v.state, ''), search_query),
            similarity(v.country, search_query)
        ) DESC,
        -- Then by capacity for tie-breaking
        v.capacity DESC NULLS LAST
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPREHENSIVE SEARCH FUNCTION
-- =====================================================

-- Multi-table search with ranking and relevance
CREATE OR REPLACE FUNCTION search_all_content(
    search_query TEXT,
    search_type TEXT DEFAULT 'all', -- 'all', 'artists', 'songs', 'venues'
    limit_count INTEGER DEFAULT 20
)
RETURNS TABLE(
    entity_type TEXT,
    entity_id UUID,
    title TEXT,
    subtitle TEXT,
    image_url TEXT,
    relevance_score REAL,
    metadata JSONB
) AS $$
BEGIN
    -- Search artists
    IF search_type = 'all' OR search_type = 'artists' THEN
        RETURN QUERY
        SELECT 
            'artist'::TEXT as entity_type,
            a.id as entity_id,
            a.name as title,
            COALESCE(array_to_string(a.genres, ', '), '') as subtitle,
            a.image_url,
            (a.similarity_score * 0.6 + a.rank_score * 0.4)::REAL as relevance_score,
            jsonb_build_object(
                'slug', a.slug,
                'followers', a.followers,
                'verified', a.verified,
                'genres', a.genres
            ) as metadata
        FROM search_artists_trigram(search_query, 0.3, limit_count) a;
    END IF;
    
    -- Search songs
    IF search_type = 'all' OR search_type = 'songs' THEN
        RETURN QUERY
        SELECT 
            'song'::TEXT as entity_type,
            s.id as entity_id,
            s.title as title,
            s.artist_name as subtitle,
            NULL::TEXT as image_url,
            (s.similarity_score * 0.7 + s.rank_score * 0.3)::REAL as relevance_score,
            jsonb_build_object(
                'artist_name', s.artist_name,
                'spotify_id', s.spotify_id
            ) as metadata
        FROM search_songs_trigram(search_query, 0.3, limit_count) s;
    END IF;
    
    -- Search venues
    IF search_type = 'all' OR search_type = 'venues' THEN
        RETURN QUERY
        SELECT 
            'venue'::TEXT as entity_type,
            v.id as entity_id,
            v.name as title,
            (v.city || CASE WHEN v.state IS NOT NULL THEN ', ' || v.state ELSE '' END || ', ' || v.country) as subtitle,
            NULL::TEXT as image_url,
            v.similarity_score as relevance_score,
            jsonb_build_object(
                'slug', v.slug,
                'city', v.city,
                'state', v.state,
                'country', v.country,
                'capacity', v.capacity
            ) as metadata
        FROM search_venues_trigram(search_query, 0.3, limit_count) v;
    END IF;
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- =====================================================

-- Composite indexes for common query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_artists_verified_followers 
ON artists(verified, followers DESC) 
WHERE verified = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_shows_status_date_artist 
ON shows(status, date DESC, artist_id) 
WHERE status IN ('upcoming', 'ongoing');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_setlist_songs_votes 
ON setlist_songs(setlist_id, position, (upvotes - downvotes) DESC);

-- Partial indexes for active data
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_votes_recent 
ON votes(created_at DESC, setlist_song_id, vote_type) 
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days';

-- =====================================================
-- SEARCH ANALYTICS & MONITORING
-- =====================================================

-- Search analytics table
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_query TEXT NOT NULL,
    search_type TEXT NOT NULL,
    user_id UUID REFERENCES auth.users(id),
    results_count INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for search analytics
CREATE INDEX IF NOT EXISTS idx_search_analytics_query_time 
ON search_analytics(search_query, created_at DESC);

-- Function to log search performance
CREATE OR REPLACE FUNCTION log_search_performance(
    query TEXT,
    search_type TEXT,
    user_id UUID,
    results_count INTEGER,
    response_time_ms INTEGER,
    ip_address INET DEFAULT NULL,
    user_agent TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO search_analytics (
        search_query, search_type, user_id, results_count, 
        response_time_ms, ip_address, user_agent
    ) VALUES (
        query, search_type, user_id, results_count, 
        response_time_ms, ip_address, user_agent
    );
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGRAM SIMILARITY TUNING
-- =====================================================

-- Set trigram similarity threshold globally
SELECT set_limit(0.3);

-- Function to get optimal similarity threshold
CREATE OR REPLACE FUNCTION get_optimal_similarity_threshold(
    search_query TEXT,
    target_results INTEGER DEFAULT 20
)
RETURNS REAL AS $$
DECLARE
    threshold REAL := 0.1;
    result_count INTEGER;
BEGIN
    -- Start with low threshold and increase until we get target results
    WHILE threshold <= 0.8 LOOP
        SELECT COUNT(*) INTO result_count
        FROM artists
        WHERE name % search_query 
        AND similarity(name, search_query) >= threshold;
        
        IF result_count >= target_results THEN
            RETURN threshold;
        END IF;
        
        threshold := threshold + 0.1;
    END LOOP;
    
    RETURN 0.3; -- Default fallback
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SEARCH RESULT CACHING
-- =====================================================

-- Search cache table for frequently accessed queries
CREATE TABLE IF NOT EXISTS search_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    search_query TEXT NOT NULL,
    search_type TEXT NOT NULL,
    results JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '15 minutes',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for search cache
CREATE INDEX IF NOT EXISTS idx_search_cache_query_type_expires 
ON search_cache(search_query, search_type, expires_at);

-- Function to get cached search results
CREATE OR REPLACE FUNCTION get_cached_search_results(
    search_query TEXT,
    search_type TEXT
)
RETURNS JSONB AS $$
DECLARE
    cached_results JSONB;
BEGIN
    SELECT results INTO cached_results
    FROM search_cache
    WHERE search_cache.search_query = get_cached_search_results.search_query
    AND search_cache.search_type = get_cached_search_results.search_type
    AND expires_at > NOW()
    ORDER BY created_at DESC
    LIMIT 1;
    
    RETURN cached_results;
END;
$$ LANGUAGE plpgsql;

-- Function to cache search results
CREATE OR REPLACE FUNCTION cache_search_results(
    search_query TEXT,
    search_type TEXT,
    results JSONB,
    cache_duration INTERVAL DEFAULT '15 minutes'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO search_cache (search_query, search_type, results, expires_at)
    VALUES (search_query, search_type, results, NOW() + cache_duration)
    ON CONFLICT (search_query, search_type) DO UPDATE SET
        results = EXCLUDED.results,
        expires_at = EXCLUDED.expires_at,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CLEANUP AND MAINTENANCE
-- =====================================================

-- Function to clean up expired search cache
CREATE OR REPLACE FUNCTION cleanup_search_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM search_cache WHERE expires_at < NOW();
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old search analytics
CREATE OR REPLACE FUNCTION cleanup_search_analytics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM search_analytics 
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PERFORMANCE VALIDATION
-- =====================================================

-- Test function to validate search performance
CREATE OR REPLACE FUNCTION test_search_performance(
    test_query TEXT DEFAULT 'taylor swift'
)
RETURNS TABLE(
    search_type TEXT,
    execution_time_ms REAL,
    result_count INTEGER,
    performance_rating TEXT
) AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration_ms REAL;
    result_count INTEGER;
BEGIN
    -- Test artist search
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO result_count FROM search_artists_trigram(test_query);
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
        'artists'::TEXT,
        duration_ms,
        result_count,
        CASE WHEN duration_ms < 50 THEN 'EXCELLENT'
             WHEN duration_ms < 100 THEN 'GOOD'
             WHEN duration_ms < 200 THEN 'FAIR'
             ELSE 'POOR' END::TEXT;
    
    -- Test song search
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO result_count FROM search_songs_trigram(test_query);
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
        'songs'::TEXT,
        duration_ms,
        result_count,
        CASE WHEN duration_ms < 50 THEN 'EXCELLENT'
             WHEN duration_ms < 100 THEN 'GOOD'
             WHEN duration_ms < 200 THEN 'FAIR'
             ELSE 'POOR' END::TEXT;
    
    -- Test venue search
    start_time := clock_timestamp();
    SELECT COUNT(*) INTO result_count FROM search_venues_trigram(test_query);
    end_time := clock_timestamp();
    duration_ms := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    RETURN QUERY SELECT 
        'venues'::TEXT,
        duration_ms,
        result_count,
        CASE WHEN duration_ms < 50 THEN 'EXCELLENT'
             WHEN duration_ms < 100 THEN 'GOOD'
             WHEN duration_ms < 200 THEN 'FAIR'
             ELSE 'POOR' END::TEXT;
             
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=== TRIGRAM FTS OPTIMIZATION COMPLETE ===';
    RAISE NOTICE 'Trigram indexes created for ultra-fast fuzzy search';
    RAISE NOTICE 'Full-text search indexes deployed with ranking';
    RAISE NOTICE 'Optimized search functions available:';
    RAISE NOTICE '  - search_artists_trigram()';
    RAISE NOTICE '  - search_songs_trigram()';
    RAISE NOTICE '  - search_venues_trigram()';
    RAISE NOTICE '  - search_all_content()';
    RAISE NOTICE 'Search analytics and caching implemented';
    RAISE NOTICE 'Performance target: <100ms search response time';
    RAISE NOTICE 'Run: SELECT * FROM test_search_performance() to validate';
END $$;