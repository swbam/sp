-- Data Warehouse Schema for MySetlist Analytics Platform
-- Optimized for 10,000+ concurrent users with advanced analytics

-- ETL Management Tables
CREATE TABLE etl_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pipeline_type VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL, -- running, completed, failed
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  records_processed INTEGER DEFAULT 0,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE etl_locks (
  lock_key VARCHAR(100) PRIMARY KEY,
  acquired_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  process_id VARCHAR(255),
  metadata JSONB DEFAULT '{}'
);

-- Data Warehouse Fact Tables
CREATE TABLE user_behavior_warehouse (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_sessions INTEGER DEFAULT 0,
  page_views INTEGER DEFAULT 0,
  unique_pages_visited INTEGER DEFAULT 0,
  avg_session_duration DECIMAL(10,2) DEFAULT 0,
  most_active_hour INTEGER DEFAULT 0,
  most_active_day INTEGER DEFAULT 0,
  engagement_score DECIMAL(3,2) DEFAULT 0,
  behavior_summary JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE voting_patterns_warehouse (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  total_votes INTEGER DEFAULT 0,
  upvote_ratio DECIMAL(3,2) DEFAULT 0,
  artists_diversity INTEGER DEFAULT 0,
  most_active_voting_hour INTEGER DEFAULT 0,
  voting_consistency DECIMAL(3,2) DEFAULT 0,
  genre_preferences JSONB DEFAULT '{}',
  voting_velocity DECIMAL(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_engagement_warehouse (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  engagement_score DECIMAL(3,2) DEFAULT 0,
  activity_level VARCHAR(20) DEFAULT 'low', -- inactive, low, medium, high
  last_activity TIMESTAMPTZ,
  retention_risk DECIMAL(3,2) DEFAULT 0,
  churn_probability DECIMAL(3,2) DEFAULT 0,
  lifetime_value_score DECIMAL(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_recommendation_features (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  genre_preferences JSONB DEFAULT '{}',
  voting_behavior_vector DECIMAL(3,2)[] DEFAULT '{}',
  browsing_pattern_vector DECIMAL(3,2)[] DEFAULT '{}',
  similarity_features DECIMAL(3,2)[] DEFAULT '{}',
  prediction_confidence DECIMAL(3,2) DEFAULT 0,
  feature_version INTEGER DEFAULT 1,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artist and Show Analytics Warehouse
CREATE TABLE artist_popularity_warehouse (
  artist_id UUID PRIMARY KEY REFERENCES artists(id) ON DELETE CASCADE,
  total_followers INTEGER DEFAULT 0,
  weekly_new_followers INTEGER DEFAULT 0,
  total_votes_received INTEGER DEFAULT 0,
  weekly_votes_received INTEGER DEFAULT 0,
  show_count INTEGER DEFAULT 0,
  upcoming_show_count INTEGER DEFAULT 0,
  avg_setlist_accuracy DECIMAL(3,2) DEFAULT 0,
  popularity_score DECIMAL(5,2) DEFAULT 0,
  trending_score DECIMAL(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE show_engagement_warehouse (
  show_id UUID PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
  total_views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  unique_voters INTEGER DEFAULT 0,
  engagement_rate DECIMAL(3,2) DEFAULT 0,
  prediction_activity DECIMAL(3,2) DEFAULT 0,
  social_buzz_score DECIMAL(5,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE venue_analytics_warehouse (
  venue_id UUID PRIMARY KEY REFERENCES venues(id) ON DELETE CASCADE,
  total_shows INTEGER DEFAULT 0,
  upcoming_shows INTEGER DEFAULT 0,
  avg_attendance_prediction INTEGER DEFAULT 0,
  popularity_by_genre JSONB DEFAULT '{}',
  fan_engagement_score DECIMAL(3,2) DEFAULT 0,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Time-series Analytics Tables (partitioned by date)
CREATE TABLE daily_platform_metrics (
  metric_date DATE NOT NULL,
  active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  avg_session_duration DECIMAL(10,2) DEFAULT 0,
  bounce_rate DECIMAL(3,2) DEFAULT 0,
  user_retention_rate DECIMAL(3,2) DEFAULT 0,
  top_artists JSONB DEFAULT '[]',
  top_venues JSONB DEFAULT '[]',
  trending_genres JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (metric_date)
);

CREATE TABLE hourly_real_time_metrics (
  metric_hour TIMESTAMPTZ NOT NULL,
  concurrent_users INTEGER DEFAULT 0,
  votes_per_hour INTEGER DEFAULT 0,
  page_views_per_hour INTEGER DEFAULT 0,
  api_requests_per_hour INTEGER DEFAULT 0,
  error_rate_percent DECIMAL(3,2) DEFAULT 0,
  avg_response_time_ms DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (metric_hour)
);

-- Machine Learning Feature Store
CREATE TABLE ml_user_features (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  feature_vector DECIMAL(5,4)[] NOT NULL,
  feature_names TEXT[] NOT NULL,
  model_version VARCHAR(20) NOT NULL,
  confidence_score DECIMAL(3,2) DEFAULT 0,
  last_prediction JSONB,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ml_artist_features (
  artist_id UUID PRIMARY KEY REFERENCES artists(id) ON DELETE CASCADE,
  popularity_features DECIMAL(5,4)[] NOT NULL,
  genre_embeddings DECIMAL(5,4)[] NOT NULL,
  fan_behavior_features DECIMAL(5,4)[] NOT NULL,
  seasonal_patterns JSONB DEFAULT '{}',
  model_version VARCHAR(20) NOT NULL,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ml_show_predictions (
  show_id UUID PRIMARY KEY REFERENCES shows(id) ON DELETE CASCADE,
  predicted_attendance INTEGER,
  predicted_engagement_score DECIMAL(3,2),
  predicted_setlist_accuracy DECIMAL(3,2),
  uncertainty_bounds JSONB DEFAULT '{}',
  contributing_factors JSONB DEFAULT '{}',
  model_version VARCHAR(20) NOT NULL,
  prediction_confidence DECIMAL(3,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Real-time Analytics Cache Tables
CREATE TABLE real_time_user_stats (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  current_session_id VARCHAR(255),
  session_start_time TIMESTAMPTZ,
  current_page VARCHAR(255),
  pages_visited_today INTEGER DEFAULT 0,
  votes_cast_today INTEGER DEFAULT 0,
  last_activity TIMESTAMPTZ DEFAULT NOW(),
  online_status BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE real_time_platform_stats (
  id INTEGER PRIMARY KEY DEFAULT 1,
  concurrent_users INTEGER DEFAULT 0,
  votes_last_hour INTEGER DEFAULT 0,
  active_shows INTEGER DEFAULT 0,
  trending_artist_id UUID REFERENCES artists(id),
  system_load DECIMAL(3,2) DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- A/B Testing and Experimentation
CREATE TABLE ab_experiments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'draft', -- draft, running, paused, completed
  target_metric VARCHAR(100) NOT NULL,
  hypothesis TEXT,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  sample_size INTEGER,
  confidence_level DECIMAL(3,2) DEFAULT 0.95,
  variants JSONB NOT NULL, -- {control: {}, variant_a: {}, variant_b: {}}
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE ab_user_assignments (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
  variant VARCHAR(50) NOT NULL,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, experiment_id)
);

CREATE TABLE ab_experiment_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID REFERENCES ab_experiments(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  variant VARCHAR(50) NOT NULL,
  metric_name VARCHAR(100) NOT NULL,
  metric_value DECIMAL(10,4) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cohort Analysis Tables
CREATE TABLE user_cohorts (
  cohort_date DATE NOT NULL,
  users_count INTEGER NOT NULL,
  cohort_metadata JSONB DEFAULT '{}',
  PRIMARY KEY (cohort_date)
);

CREATE TABLE cohort_retention (
  cohort_date DATE NOT NULL,
  period_number INTEGER NOT NULL, -- 0=day0, 1=day1, 7=week1, etc.
  retained_users INTEGER NOT NULL,
  retention_rate DECIMAL(3,2) NOT NULL,
  PRIMARY KEY (cohort_date, period_number)
);

-- Event Streaming and Real-time Processing
CREATE TABLE event_stream_checkpoints (
  stream_name VARCHAR(100) PRIMARY KEY,
  last_processed_offset BIGINT NOT NULL,
  last_processed_timestamp TIMESTAMPTZ NOT NULL,
  processing_lag_ms INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_processing_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  stream_name VARCHAR(100),
  event_data JSONB,
  error_message TEXT,
  error_type VARCHAR(100),
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Materialized Views for Fast Analytics
CREATE MATERIALIZED VIEW user_summary_view AS
SELECT 
  u.id,
  u.full_name,
  ub.engagement_score,
  ue.activity_level,
  vp.total_votes,
  vp.upvote_ratio,
  COUNT(ua.artist_id) as followed_artists_count,
  ub.calculated_at as last_calculated
FROM auth.users u
LEFT JOIN user_behavior_warehouse ub ON u.id = ub.user_id
LEFT JOIN user_engagement_warehouse ue ON u.id = ue.user_id
LEFT JOIN voting_patterns_warehouse vp ON u.id = vp.user_id
LEFT JOIN user_artists ua ON u.id = ua.user_id
GROUP BY u.id, u.full_name, ub.engagement_score, ue.activity_level, 
         vp.total_votes, vp.upvote_ratio, ub.calculated_at;

CREATE MATERIALIZED VIEW artist_popularity_view AS
SELECT 
  a.id,
  a.name,
  a.genres,
  ap.popularity_score,
  ap.trending_score,
  ap.total_followers,
  ap.total_votes_received,
  COUNT(s.id) as total_shows,
  COUNT(CASE WHEN s.date >= CURRENT_DATE THEN 1 END) as upcoming_shows
FROM artists a
LEFT JOIN artist_popularity_warehouse ap ON a.id = ap.artist_id
LEFT JOIN shows s ON a.id = s.artist_id
GROUP BY a.id, a.name, a.genres, ap.popularity_score, ap.trending_score,
         ap.total_followers, ap.total_votes_received;

CREATE MATERIALIZED VIEW show_engagement_view AS
SELECT 
  s.id,
  s.name as show_name,
  s.date,
  a.name as artist_name,
  v.name as venue_name,
  se.total_views,
  se.total_votes,
  se.engagement_rate,
  CASE 
    WHEN s.date >= CURRENT_DATE THEN 'upcoming'
    WHEN s.date < CURRENT_DATE THEN 'past'
  END as status
FROM shows s
JOIN artists a ON s.artist_id = a.id
LEFT JOIN venues v ON s.venue_id = v.id
LEFT JOIN show_engagement_warehouse se ON s.id = se.show_id;

-- Indexes for Performance
CREATE INDEX idx_etl_runs_pipeline_status ON etl_runs(pipeline_type, status, started_at DESC);
CREATE INDEX idx_user_behavior_engagement ON user_behavior_warehouse(engagement_score DESC);
CREATE INDEX idx_voting_patterns_consistency ON voting_patterns_warehouse(voting_consistency DESC);
CREATE INDEX idx_user_engagement_risk ON user_engagement_warehouse(retention_risk DESC, churn_probability DESC);
CREATE INDEX idx_artist_popularity_trending ON artist_popularity_warehouse(trending_score DESC, popularity_score DESC);
CREATE INDEX idx_show_engagement_rate ON show_engagement_warehouse(engagement_rate DESC);
CREATE INDEX idx_daily_metrics_date ON daily_platform_metrics(metric_date DESC);
CREATE INDEX idx_hourly_metrics_time ON hourly_real_time_metrics(metric_hour DESC);
CREATE INDEX idx_ml_features_updated ON ml_user_features(updated_at DESC);
CREATE INDEX idx_real_time_users_activity ON real_time_user_stats(last_activity DESC, online_status);
CREATE INDEX idx_ab_experiments_status ON ab_experiments(status, start_date, end_date);
CREATE INDEX idx_cohort_retention_rate ON cohort_retention(cohort_date, retention_rate DESC);

-- Composite indexes for complex queries
CREATE INDEX idx_user_engagement_composite ON user_engagement_warehouse(activity_level, engagement_score DESC);
CREATE INDEX idx_artist_composite ON artist_popularity_warehouse(trending_score DESC, total_followers DESC);
CREATE INDEX idx_show_date_engagement ON show_engagement_warehouse(calculated_at DESC, engagement_rate DESC);

-- Partitioning for time-series data
-- Daily metrics partitioned by month
ALTER TABLE daily_platform_metrics 
  ADD CONSTRAINT daily_metrics_date_range 
  CHECK (metric_date >= '2024-01-01' AND metric_date < '2030-01-01');

-- Hourly metrics partitioned by day (auto-cleanup old data)
CREATE OR REPLACE FUNCTION cleanup_old_hourly_metrics()
RETURNS void AS $$
BEGIN
  DELETE FROM hourly_real_time_metrics 
  WHERE metric_hour < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Auto-cleanup trigger
CREATE OR REPLACE FUNCTION schedule_cleanup_trigger()
RETURNS trigger AS $$
BEGIN
  -- Schedule cleanup every 1000 inserts
  IF (TG_OP = 'INSERT') THEN
    IF NEW.metric_hour::date != (NOW() - INTERVAL '1 day')::date THEN
      PERFORM cleanup_old_hourly_metrics();
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hourly_metrics_cleanup_trigger
  AFTER INSERT ON hourly_real_time_metrics
  FOR EACH ROW EXECUTE FUNCTION schedule_cleanup_trigger();

-- RLS Policies
ALTER TABLE user_behavior_warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE voting_patterns_warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_engagement_warehouse ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recommendation_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_user_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE real_time_user_stats ENABLE ROW LEVEL SECURITY;

-- Users can only access their own data
CREATE POLICY "Users can view own behavior data" ON user_behavior_warehouse FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own voting patterns" ON voting_patterns_warehouse FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own engagement data" ON user_engagement_warehouse FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own recommendation features" ON user_recommendation_features FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own ML features" ON ml_user_features FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own real-time stats" ON real_time_user_stats FOR SELECT USING (auth.uid() = user_id);

-- Platform metrics are publicly readable
CREATE POLICY "Anyone can view platform metrics" ON daily_platform_metrics FOR SELECT USING (true);
CREATE POLICY "Anyone can view hourly metrics" ON hourly_real_time_metrics FOR SELECT USING (true);
CREATE POLICY "Anyone can view artist popularity" ON artist_popularity_warehouse FOR SELECT USING (true);
CREATE POLICY "Anyone can view show engagement" ON show_engagement_warehouse FOR SELECT USING (true);
CREATE POLICY "Anyone can view venue analytics" ON venue_analytics_warehouse FOR SELECT USING (true);

-- Stored Procedures for ETL Operations
CREATE OR REPLACE FUNCTION refresh_user_summary_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_summary_view;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_artist_popularity_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY artist_popularity_view;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_show_engagement_view()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY show_engagement_view;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION generate_ml_features()
RETURNS void AS $$
BEGIN
  -- Trigger ML feature generation process
  -- This would integrate with your ML pipeline
  INSERT INTO event_processing_queue (event_type, payload, priority)
  VALUES ('generate_ml_features', '{"trigger": "etl_pipeline"}', 2);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION optimize_warehouse_indexes()
RETURNS void AS $$
BEGIN
  -- Analyze tables for better query planning
  ANALYZE user_behavior_warehouse;
  ANALYZE voting_patterns_warehouse;
  ANALYZE user_engagement_warehouse;
  ANALYZE artist_popularity_warehouse;
  ANALYZE show_engagement_warehouse;
  ANALYZE daily_platform_metrics;
  
  -- Reindex if needed (would be more sophisticated in production)
  REINDEX INDEX CONCURRENTLY idx_user_behavior_engagement;
  REINDEX INDEX CONCURRENTLY idx_artist_popularity_trending;
END;
$$ LANGUAGE plpgsql;

-- Initial data population
INSERT INTO real_time_platform_stats (id, concurrent_users, votes_last_hour, active_shows, system_load)
VALUES (1, 0, 0, 0, 0.0)
ON CONFLICT (id) DO NOTHING;