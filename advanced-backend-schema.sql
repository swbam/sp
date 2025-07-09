-- Advanced Backend Schema for MySetlist
-- Supporting ML predictions, analytics, notifications, A/B testing, and monitoring

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Analytics Events Table
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    entity_id VARCHAR(255) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    session_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics events
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_timestamp ON analytics_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_id ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_entity ON analytics_events(entity_type, entity_id);

-- User Activity Log Table
CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL,
    page_url TEXT,
    session_id VARCHAR(255),
    duration_seconds INTEGER,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for user activity
CREATE INDEX IF NOT EXISTS idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_created_at ON user_activity_log(created_at);

-- Trending Metrics Table
CREATE TABLE IF NOT EXISTS trending_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    setlist_song_id UUID REFERENCES setlist_songs(id) ON DELETE CASCADE,
    show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
    trending_score DECIMAL(10,4) DEFAULT 0,
    vote_velocity DECIMAL(8,4) DEFAULT 0,
    total_votes INTEGER DEFAULT 0,
    positive_ratio DECIMAL(5,4) DEFAULT 0.5,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    vote_count INTEGER DEFAULT 0
);

-- Indexes for trending metrics
CREATE INDEX IF NOT EXISTS idx_trending_metrics_setlist_song ON trending_metrics(setlist_song_id);
CREATE INDEX IF NOT EXISTS idx_trending_metrics_show ON trending_metrics(show_id);
CREATE INDEX IF NOT EXISTS idx_trending_metrics_score ON trending_metrics(trending_score DESC);

-- Real-time Vote Metrics Table
CREATE TABLE IF NOT EXISTS realtime_vote_metrics (
    setlist_song_id UUID PRIMARY KEY REFERENCES setlist_songs(id) ON DELETE CASCADE,
    last_vote_time TIMESTAMPTZ DEFAULT NOW(),
    vote_velocity DECIMAL(8,4) DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- System Alerts Table
CREATE TABLE IF NOT EXISTS system_alerts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    entity_type VARCHAR(50),
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for system alerts
CREATE INDEX IF NOT EXISTS idx_system_alerts_type ON system_alerts(type);
CREATE INDEX IF NOT EXISTS idx_system_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_system_alerts_resolved ON system_alerts(resolved);

-- User Notification Preferences Table
CREATE TABLE IF NOT EXISTS user_notification_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    channels JSONB DEFAULT '{"push": true, "email": true, "in_app": true, "sms": false}',
    frequency VARCHAR(20) DEFAULT 'immediate' CHECK (frequency IN ('immediate', 'hourly', 'daily', 'weekly')),
    quiet_hours JSONB DEFAULT '{"enabled": true, "start": "22:00", "end": "08:00", "timezone": "UTC"}',
    content_types JSONB DEFAULT '{"show_reminders": true, "vote_updates": false, "trending_alerts": true, "new_predictions": true, "artist_updates": true}',
    ai_personalization BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notification Templates Table
CREATE TABLE IF NOT EXISTS notification_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    channel VARCHAR(20) NOT NULL CHECK (channel IN ('push', 'email', 'in_app', 'sms')),
    personalization_vars JSONB DEFAULT '[]',
    ab_test_group VARCHAR(1) CHECK (ab_test_group IN ('A', 'B')),
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notification templates
CREATE INDEX IF NOT EXISTS idx_notification_templates_type ON notification_templates(type);
CREATE INDEX IF NOT EXISTS idx_notification_templates_active ON notification_templates(active);

-- Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES notification_templates(id),
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    priority VARCHAR(20) NOT NULL,
    channels JSONB NOT NULL,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'scheduled', 'sent', 'failed', 'cancelled')),
    ab_test_group VARCHAR(1),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for ON notifications(scheduled_for);

-- A/B Tests Table
CREATE TABLE IF NOT EXISTS ab_tests (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    content_type VARCHAR(50) NOT NULL,
    placement VARCHAR(100) NOT NULL,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    traffic_allocation INTEGER DEFAULT 100 CHECK (traffic_allocation BETWEEN 1 AND 100),
    metrics JSONB NOT NULL,
    target_audience JSONB,
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for A/B tests
CREATE INDEX IF NOT EXISTS idx_ab_tests_content_type ON ab_tests(content_type, placement);
CREATE INDEX IF NOT EXISTS idx_ab_tests_status ON ab_tests(status);

-- A/B Test Variants Table
CREATE TABLE IF NOT EXISTS ab_test_variants (
    id VARCHAR(255) PRIMARY KEY,
    test_id VARCHAR(255) REFERENCES ab_tests(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    traffic_split INTEGER NOT NULL CHECK (traffic_split BETWEEN 0 AND 100),
    content JSONB NOT NULL,
    is_control BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for A/B test variants
CREATE INDEX IF NOT EXISTS idx_ab_test_variants_test_id ON ab_test_variants(test_id);

-- Content Experiments Table (User assignments)
CREATE TABLE IF NOT EXISTS content_experiments (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id VARCHAR(255) REFERENCES ab_tests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    variant_id VARCHAR(255) REFERENCES ab_test_variants(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(test_id, user_id)
);

-- Indexes for content experiments
CREATE INDEX IF NOT EXISTS idx_content_experiments_user_id ON content_experiments(user_id);
CREATE INDEX IF NOT EXISTS idx_content_experiments_test_id ON content_experiments(test_id);

-- A/B Test Interactions Table
CREATE TABLE IF NOT EXISTS ab_test_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    test_id VARCHAR(255) REFERENCES ab_tests(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    variant_id VARCHAR(255) REFERENCES ab_test_variants(id) ON DELETE CASCADE,
    interaction_type VARCHAR(50) NOT NULL,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for A/B test interactions
CREATE INDEX IF NOT EXISTS idx_ab_test_interactions_test_id ON ab_test_interactions(test_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_interactions_user_id ON ab_test_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ab_test_interactions_timestamp ON ab_test_interactions(timestamp);

-- Default Content Table
CREATE TABLE IF NOT EXISTS default_content (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    content_type VARCHAR(50) NOT NULL,
    placement VARCHAR(100) NOT NULL,
    content JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(content_type, placement)
);

-- User Profiles Table (for roles and extended user data)
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'content_manager', 'moderator')),
    display_name VARCHAR(255),
    avatar_url TEXT,
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance Metrics Table
CREATE TABLE IF NOT EXISTS performance_metrics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(12,4) NOT NULL,
    metric_unit VARCHAR(20),
    endpoint VARCHAR(255),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    response_time DECIMAL(8,4),
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'
);

-- Indexes for performance metrics
CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_performance_metrics_endpoint ON performance_metrics(endpoint);

-- Cache Statistics Table
CREATE TABLE IF NOT EXISTS cache_statistics (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    cache_layer VARCHAR(20) NOT NULL,
    hit_count BIGINT DEFAULT 0,
    miss_count BIGINT DEFAULT 0,
    eviction_count BIGINT DEFAULT 0,
    memory_usage BIGINT DEFAULT 0,
    entry_count INTEGER DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cache statistics
CREATE INDEX IF NOT EXISTS idx_cache_statistics_layer ON cache_statistics(cache_layer);
CREATE INDEX IF NOT EXISTS idx_cache_statistics_timestamp ON cache_statistics(timestamp);

-- ML Prediction Results Table
CREATE TABLE IF NOT EXISTS ml_prediction_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    show_id UUID REFERENCES shows(id) ON DELETE CASCADE,
    model_version VARCHAR(20) DEFAULT '1.0.0',
    predictions JSONB NOT NULL,
    confidence_score DECIMAL(5,4),
    prediction_metrics JSONB,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

-- Indexes for ML predictions
CREATE INDEX IF NOT EXISTS idx_ml_predictions_show_id ON ml_prediction_results(show_id);
CREATE INDEX IF NOT EXISTS idx_ml_predictions_generated_at ON ml_prediction_results(generated_at);

-- Create database functions for vote counting
CREATE OR REPLACE FUNCTION increment_vote_count(
    setlist_song_id UUID,
    vote_field TEXT,
    increment_value INTEGER
)
RETURNS VOID AS $$
BEGIN
    IF vote_field = 'upvotes' THEN
        UPDATE setlist_songs 
        SET upvotes = GREATEST(0, upvotes + increment_value)
        WHERE id = setlist_song_id;
    ELSIF vote_field = 'downvotes' THEN
        UPDATE setlist_songs 
        SET downvotes = GREATEST(0, downvotes + increment_value)
        WHERE id = setlist_song_id;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate trending scores
CREATE OR REPLACE FUNCTION calculate_trending_score(
    show_id UUID,
    vote_count INTEGER,
    positive_ratio DECIMAL,
    vote_velocity DECIMAL
)
RETURNS DECIMAL AS $$
DECLARE
    artist_followers INTEGER;
    days_until_show INTEGER;
    trending_score DECIMAL;
BEGIN
    -- Get artist followers
    SELECT a.followers INTO artist_followers
    FROM shows s
    JOIN artists a ON s.artist_id = a.id
    WHERE s.id = show_id;
    
    -- Calculate days until show
    SELECT EXTRACT(DAYS FROM (s.date - CURRENT_DATE)) INTO days_until_show
    FROM shows s
    WHERE s.id = show_id;
    
    -- Calculate trending score
    trending_score := (
        (vote_count * positive_ratio * 0.4) +
        (vote_velocity * 0.3) +
        (LN(COALESCE(artist_followers, 1) + 1) * 0.2) +
        (EXP(-0.1 * GREATEST(1, days_until_show)) * 0.1)
    );
    
    RETURN trending_score;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for new tables

-- Analytics events (readable by authenticated users, writable by system)
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own analytics events" ON analytics_events
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (
        SELECT user_id FROM user_profiles WHERE role IN ('admin', 'moderator')
    ));

-- User activity log (readable by owner and admins)
ALTER TABLE user_activity_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own activity" ON user_activity_log
    FOR SELECT USING (auth.uid() = user_id OR auth.uid() IN (
        SELECT user_id FROM user_profiles WHERE role IN ('admin')
    ));

-- System alerts (readable by admins)
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view system alerts" ON system_alerts
    FOR ALL USING (auth.uid() IN (
        SELECT user_id FROM user_profiles WHERE role IN ('admin')
    ));

-- User notification preferences (readable/writable by owner)
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their notification preferences" ON user_notification_preferences
    FOR ALL USING (auth.uid() = user_id);

-- Notifications (readable by owner)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

-- A/B tests (readable by all, writable by content managers and admins)
ALTER TABLE ab_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active A/B tests" ON ab_tests
    FOR SELECT USING (status = 'running');
CREATE POLICY "Content managers can manage A/B tests" ON ab_tests
    FOR ALL USING (auth.uid() IN (
        SELECT user_id FROM user_profiles WHERE role IN ('admin', 'content_manager')
    ));

-- User profiles (readable by all, writable by owner)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON user_profiles
    FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON user_profiles
    FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own profile" ON user_profiles
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_notification_preferences_updated_at
    BEFORE UPDATE ON user_notification_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ab_tests_updated_at
    BEFORE UPDATE ON ab_tests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some default notification templates
INSERT INTO notification_templates (type, title, body, priority, channel, personalization_vars) VALUES
    ('show_reminder', 'Don''t miss {{artist_name}}!', 'The show "{{show_name}}" starts at {{start_time}}. Get ready to vote on the setlist!', 'medium', 'push', '["artist_name", "show_name", "start_time"]'),
    ('vote_update', 'Voting is heating up!', 'Your vote on "{{song_title}}" by {{artist_name}} is making a difference. Current score: {{score}}', 'low', 'in_app', '["song_title", "artist_name", "score"]'),
    ('trending_alert', '{{artist_name}} is trending!', 'Check out the latest predictions for {{artist_name}}''s upcoming show', 'medium', 'push', '["artist_name"]'),
    ('new_prediction', 'New setlist prediction available', 'AI has generated a new setlist prediction for {{show_name}}. Check it out!', 'medium', 'in_app', '["show_name"]')
ON CONFLICT DO NOTHING;

-- Insert default content for A/B testing
INSERT INTO default_content (content_type, placement, content) VALUES
    ('homepage_hero', 'main', '{"title": "Vote on Concert Setlists", "subtitle": "Predict what your favorite artists will play", "cta_text": "Start Voting"}'),
    ('search_placeholder', 'search_bar', '{"placeholder": "Search for artists, shows, or songs..."}'),
    ('trending_section', 'homepage', '{"title": "Trending Shows", "description": "Most popular shows this week"}')
ON CONFLICT (content_type, placement) DO NOTHING;

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON analytics_events TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_activity_log TO authenticated;
GRANT SELECT ON trending_metrics TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_notification_preferences TO authenticated;
GRANT SELECT ON notifications TO authenticated;
GRANT SELECT ON ab_tests TO authenticated;
GRANT SELECT ON ab_test_variants TO authenticated;
GRANT SELECT, INSERT ON content_experiments TO authenticated;
GRANT SELECT, INSERT ON ab_test_interactions TO authenticated;
GRANT SELECT ON default_content TO authenticated;
GRANT SELECT, INSERT, UPDATE ON user_profiles TO authenticated;

-- Grant admin permissions for system management
GRANT ALL ON system_alerts TO service_role;
GRANT ALL ON notification_templates TO service_role;
GRANT ALL ON notifications TO service_role;
GRANT ALL ON performance_metrics TO service_role;
GRANT ALL ON cache_statistics TO service_role;
GRANT ALL ON ml_prediction_results TO service_role;