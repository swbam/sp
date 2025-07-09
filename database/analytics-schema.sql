-- Advanced Analytics Schema for MySetlist Platform
-- Designed for 10,000+ concurrent users with real-time processing

-- Event tracking tables for user behavior analytics
CREATE TABLE user_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id VARCHAR(255),
  event_type VARCHAR(100) NOT NULL,
  event_data JSONB DEFAULT '{}',
  page_url TEXT,
  user_agent TEXT,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Partitioned by date for performance (daily partitions)
CREATE TABLE user_events_y2024m01 PARTITION OF user_events
  FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE user_events_y2024m02 PARTITION OF user_events
  FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');

-- Add monthly partitions as needed...

-- Real-time analytics aggregation tables
CREATE TABLE daily_user_stats (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  page_views INTEGER DEFAULT 0,
  votes_cast INTEGER DEFAULT 0,
  shows_viewed INTEGER DEFAULT 0,
  artists_followed INTEGER DEFAULT 0,
  session_duration_minutes INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- Platform-wide analytics for dashboards
CREATE TABLE platform_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_date DATE NOT NULL,
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  total_votes INTEGER DEFAULT 0,
  total_shows INTEGER DEFAULT 0,
  avg_session_duration DECIMAL(10,2) DEFAULT 0,
  bounce_rate DECIMAL(5,2) DEFAULT 0,
  top_artists JSONB DEFAULT '[]',
  top_venues JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(metric_date)
);

-- User behavior prediction features for ML
CREATE TABLE user_behavior_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  calculated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Engagement features
  avg_session_duration DECIMAL(10,2) DEFAULT 0,
  sessions_per_week DECIMAL(5,2) DEFAULT 0,
  votes_per_session DECIMAL(5,2) DEFAULT 0,
  
  -- Preference features
  preferred_genres JSONB DEFAULT '[]',
  favorite_venues JSONB DEFAULT '[]',
  active_time_slots JSONB DEFAULT '[]',
  
  -- Prediction scores
  churn_risk_score DECIMAL(3,2) DEFAULT 0,
  engagement_score DECIMAL(3,2) DEFAULT 0,
  recommendation_affinity JSONB DEFAULT '{}',
  
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification delivery tracking
CREATE TABLE notification_delivery (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_type VARCHAR(50) NOT NULL,
  channel VARCHAR(20) NOT NULL, -- email, push, in_app
  template_id VARCHAR(100),
  status VARCHAR(20) DEFAULT 'pending', -- pending, sent, delivered, failed, opened
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Email templates and campaigns
CREATE TABLE email_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subject_template TEXT NOT NULL,
  html_template TEXT NOT NULL,
  text_template TEXT,
  template_type VARCHAR(50) NOT NULL, -- transactional, marketing, system
  variables JSONB DEFAULT '[]', -- List of template variables
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User notification preferences
CREATE TABLE user_notification_preferences (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email_marketing BOOLEAN DEFAULT TRUE,
  email_show_reminders BOOLEAN DEFAULT TRUE,
  email_artist_updates BOOLEAN DEFAULT TRUE,
  email_vote_summaries BOOLEAN DEFAULT FALSE,
  push_show_reminders BOOLEAN DEFAULT TRUE,
  push_artist_updates BOOLEAN DEFAULT FALSE,
  in_app_notifications BOOLEAN DEFAULT TRUE,
  preferred_timezone VARCHAR(50) DEFAULT 'UTC',
  reminder_hours_before INTEGER DEFAULT 24,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Event processing queue for async operations
CREATE TABLE event_processing_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  priority INTEGER DEFAULT 5, -- 1 (highest) to 10 (lowest)
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  scheduled_for TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance optimization
CREATE INDEX idx_user_events_user_created ON user_events(user_id, created_at DESC);
CREATE INDEX idx_user_events_type_created ON user_events(event_type, created_at DESC);
CREATE INDEX idx_user_events_session ON user_events(session_id);

CREATE INDEX idx_daily_stats_user_date ON daily_user_stats(user_id, date DESC);
CREATE INDEX idx_platform_metrics_date ON platform_metrics(metric_date DESC);

CREATE INDEX idx_notification_delivery_user ON notification_delivery(user_id, created_at DESC);
CREATE INDEX idx_notification_delivery_status ON notification_delivery(status, created_at);

CREATE INDEX idx_event_queue_status_priority ON event_processing_queue(status, priority, scheduled_for);

-- RLS Policies for security
ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_behavior_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_delivery ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own analytics data
CREATE POLICY "Users can view own events" ON user_events 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own stats" ON daily_user_stats 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own behavior features" ON user_behavior_features 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own notifications" ON notification_delivery 
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own preferences" ON user_notification_preferences 
  FOR ALL USING (auth.uid() = user_id);

-- Platform metrics are publicly readable
CREATE POLICY "Anyone can view platform metrics" ON platform_metrics FOR SELECT USING (true);

-- Triggers for real-time updates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_daily_user_stats_updated_at 
  BEFORE UPDATE ON daily_user_stats 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_behavior_features_updated_at 
  BEFORE UPDATE ON user_behavior_features 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_notification_preferences_updated_at 
  BEFORE UPDATE ON user_notification_preferences 
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Stored procedures for analytics aggregation
CREATE OR REPLACE FUNCTION aggregate_daily_user_stats(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
BEGIN
  INSERT INTO daily_user_stats (
    user_id, date, page_views, votes_cast, shows_viewed, 
    artists_followed, session_duration_minutes, unique_sessions
  )
  SELECT 
    e.user_id,
    target_date,
    COUNT(CASE WHEN e.event_type = 'page_view' THEN 1 END) as page_views,
    COUNT(CASE WHEN e.event_type = 'vote_cast' THEN 1 END) as votes_cast,
    COUNT(CASE WHEN e.event_type = 'show_viewed' THEN 1 END) as shows_viewed,
    COUNT(CASE WHEN e.event_type = 'artist_followed' THEN 1 END) as artists_followed,
    COALESCE(SUM(CASE WHEN e.event_type = 'session_end' THEN 
      (e.event_data->>'duration_minutes')::integer END), 0) as session_duration_minutes,
    COUNT(DISTINCT e.session_id) as unique_sessions
  FROM user_events e
  WHERE DATE(e.created_at) = target_date
    AND e.user_id IS NOT NULL
  GROUP BY e.user_id
  ON CONFLICT (user_id, date) 
  DO UPDATE SET
    page_views = EXCLUDED.page_views,
    votes_cast = EXCLUDED.votes_cast,
    shows_viewed = EXCLUDED.shows_viewed,
    artists_followed = EXCLUDED.artists_followed,
    session_duration_minutes = EXCLUDED.session_duration_minutes,
    unique_sessions = EXCLUDED.unique_sessions,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function to calculate platform metrics
CREATE OR REPLACE FUNCTION calculate_platform_metrics(target_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day')
RETURNS void AS $$
DECLARE
  _total_users INTEGER;
  _active_users INTEGER;
  _new_users INTEGER;
  _total_votes INTEGER;
  _total_shows INTEGER;
  _avg_session_duration DECIMAL(10,2);
  _bounce_rate DECIMAL(5,2);
  _top_artists JSONB;
  _top_venues JSONB;
BEGIN
  -- Calculate metrics
  SELECT COUNT(*) INTO _total_users FROM auth.users;
  
  SELECT COUNT(DISTINCT user_id) INTO _active_users 
  FROM user_events 
  WHERE DATE(created_at) = target_date;
  
  SELECT COUNT(*) INTO _new_users 
  FROM auth.users 
  WHERE DATE(created_at) = target_date;
  
  SELECT COUNT(*) INTO _total_votes 
  FROM votes 
  WHERE DATE(created_at) = target_date;
  
  SELECT COUNT(*) INTO _total_shows 
  FROM shows 
  WHERE date >= target_date AND date < target_date + INTERVAL '30 days';
  
  SELECT COALESCE(AVG(session_duration_minutes), 0) INTO _avg_session_duration
  FROM daily_user_stats 
  WHERE date = target_date;
  
  -- Calculate bounce rate (sessions with only 1 page view)
  WITH session_page_counts AS (
    SELECT session_id, COUNT(*) as page_count
    FROM user_events 
    WHERE DATE(created_at) = target_date AND event_type = 'page_view'
    GROUP BY session_id
  )
  SELECT COALESCE(
    (COUNT(CASE WHEN page_count = 1 THEN 1 END) * 100.0 / COUNT(*)), 
    0
  ) INTO _bounce_rate
  FROM session_page_counts;
  
  -- Get top artists by recent engagement
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'artist_id', a.id,
        'name', a.name,
        'engagement_score', artist_stats.engagement_score
      ) ORDER BY artist_stats.engagement_score DESC
    ) FILTER (WHERE artist_stats.engagement_score > 0),
    '[]'::jsonb
  ) INTO _top_artists
  FROM (
    SELECT 
      (event_data->>'artist_id')::uuid as artist_id,
      COUNT(*) as engagement_score
    FROM user_events 
    WHERE DATE(created_at) >= target_date - INTERVAL '7 days'
      AND event_type IN ('artist_viewed', 'artist_followed', 'show_viewed')
      AND event_data->>'artist_id' IS NOT NULL
    GROUP BY (event_data->>'artist_id')::uuid
    LIMIT 10
  ) artist_stats
  JOIN artists a ON a.id = artist_stats.artist_id;
  
  -- Insert or update platform metrics
  INSERT INTO platform_metrics (
    metric_date, total_users, active_users, new_users, total_votes, 
    total_shows, avg_session_duration, bounce_rate, top_artists, top_venues
  )
  VALUES (
    target_date, _total_users, _active_users, _new_users, _total_votes,
    _total_shows, _avg_session_duration, _bounce_rate, _top_artists, '[]'::jsonb
  )
  ON CONFLICT (metric_date)
  DO UPDATE SET
    total_users = EXCLUDED.total_users,
    active_users = EXCLUDED.active_users,
    new_users = EXCLUDED.new_users,
    total_votes = EXCLUDED.total_votes,
    total_shows = EXCLUDED.total_shows,
    avg_session_duration = EXCLUDED.avg_session_duration,
    bounce_rate = EXCLUDED.bounce_rate,
    top_artists = EXCLUDED.top_artists,
    top_venues = EXCLUDED.top_venues;
END;
$$ LANGUAGE plpgsql;

-- Background job function for processing events
CREATE OR REPLACE FUNCTION process_event_queue()
RETURNS void AS $$
DECLARE
  _event RECORD;
BEGIN
  FOR _event IN 
    SELECT * FROM event_processing_queue 
    WHERE status = 'pending' 
      AND scheduled_for <= NOW()
      AND retry_count < max_retries
    ORDER BY priority ASC, created_at ASC
    LIMIT 100
  LOOP
    BEGIN
      -- Update status to processing
      UPDATE event_processing_queue 
      SET status = 'processing', processed_at = NOW()
      WHERE id = _event.id;
      
      -- Process based on event type
      CASE _event.event_type
        WHEN 'send_email' THEN
          -- Email processing logic would be handled by application layer
          PERFORM pg_notify('email_queue', _event.payload::text);
        WHEN 'calculate_user_features' THEN
          -- Trigger ML feature calculation
          PERFORM pg_notify('ml_queue', _event.payload::text);
        WHEN 'aggregate_stats' THEN
          -- Trigger stats aggregation
          PERFORM aggregate_daily_user_stats((_event.payload->>'date')::date);
        ELSE
          -- Unknown event type
          RAISE EXCEPTION 'Unknown event type: %', _event.event_type;
      END CASE;
      
      -- Mark as completed
      UPDATE event_processing_queue 
      SET status = 'completed', processed_at = NOW()
      WHERE id = _event.id;
      
    EXCEPTION WHEN OTHERS THEN
      -- Mark as failed and increment retry count
      UPDATE event_processing_queue 
      SET 
        status = CASE 
          WHEN retry_count + 1 >= max_retries THEN 'failed'
          ELSE 'pending'
        END,
        retry_count = retry_count + 1,
        error_message = SQLERRM,
        scheduled_for = NOW() + INTERVAL '5 minutes'
      WHERE id = _event.id;
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;