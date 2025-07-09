-- Email templates for MySetlist notification system
-- Insert initial email templates

INSERT INTO email_templates (name, subject_template, html_template, text_template, template_type, variables) VALUES

-- Welcome email template
('welcome', 
 'Welcome to MySetlist, {{user_name}}!',
 '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to MySetlist</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
        .logo { font-size: 28px; font-weight: bold; color: #1DB954; }
        .content { padding: 30px 0; }
        .button { display: inline-block; background: #1DB954; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 14px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">🎵 MySetlist</div>
        </div>
        <div class="content">
            <h1>Welcome to MySetlist, {{user_name}}!</h1>
            <p>Thanks for joining the ultimate concert setlist prediction platform! You''re now part of a community of music lovers who help predict what artists will play at their shows.</p>
            
            <h3>Here''s what you can do:</h3>
            <ul>
                <li>🎤 Follow your favorite artists</li>
                <li>🗳️ Vote on predicted setlists for upcoming shows</li>
                <li>📊 See how accurate your predictions are</li>
                <li>🎯 Get personalized show recommendations</li>
            </ul>
            
            <a href="{{app_url}}/search" class="button">Start Exploring Artists</a>
            
            <p>Have questions? Just reply to this email and we''ll help you get started!</p>
        </div>
        <div class="footer">
            <p>MySetlist - Predict the Music<br>
            <a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="{{app_url}}/notifications/preferences">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>',
 'Welcome to MySetlist, {{user_name}}!

Thanks for joining the ultimate concert setlist prediction platform! You''re now part of a community of music lovers who help predict what artists will play at their shows.

Here''s what you can do:
- Follow your favorite artists
- Vote on predicted setlists for upcoming shows  
- See how accurate your predictions are
- Get personalized show recommendations

Start exploring: {{app_url}}/search

Have questions? Just reply to this email!

MySetlist - Predict the Music
Unsubscribe: {{unsubscribe_url}}',
 'transactional',
 '["user_name", "app_url", "unsubscribe_url"]'),

-- Show reminder template
('show-reminder',
 '🎤 {{artist_name}} is performing {{reminder_text}} - Don''t forget to vote!',
 '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Show Reminder</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; padding: 20px 0; }
        .show-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; border-radius: 12px; margin: 20px 0; text-align: center; }
        .artist-name { font-size: 24px; font-weight: bold; margin-bottom: 10px; }
        .show-details { font-size: 16px; opacity: 0.9; }
        .button { display: inline-block; background: #1DB954; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
        .setlist-preview { background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .song-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid #eee; }
        .vote-buttons { display: flex; gap: 10px; }
        .vote-btn { padding: 4px 12px; border: 1px solid #ddd; border-radius: 4px; text-decoration: none; font-size: 12px; }
        .vote-up { background: #d4edda; color: #155724; }
        .vote-down { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎵 Show Reminder</h2>
        </div>
        
        <div class="show-card">
            <div class="artist-name">{{artist_name}}</div>
            <div class="show-details">
                📍 {{venue_name}}, {{venue_city}}<br>
                📅 {{show_date}} at {{show_time}}<br>
                ⏰ {{reminder_text}}
            </div>
        </div>
        
        <p>Hi {{user_name}},</p>
        <p>{{artist_name}} is performing {{reminder_text}}! The voting is still open for their predicted setlist.</p>
        
        {{#if top_songs}}
        <div class="setlist-preview">
            <h3>🗳️ Current Top Predictions:</h3>
            {{#each top_songs}}
            <div class="song-item">
                <span>{{position}}. {{title}}</span>
                <div class="vote-buttons">
                    <span>{{net_votes}} votes</span>
                </div>
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <div style="text-align: center;">
            <a href="{{show_url}}" class="button">Vote on Setlist Predictions</a>
        </div>
        
        {{#if ticket_url}}
        <p style="text-align: center;">
            <a href="{{ticket_url}}" style="color: #1DB954;">🎫 Get Tickets</a>
        </p>
        {{/if}}
        
        <div class="footer">
            <p>MySetlist - Predict the Music<br>
            <a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="{{app_url}}/notifications/preferences">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>',
 '🎤 {{artist_name}} Show Reminder

{{artist_name}} is performing {{reminder_text}}!
📍 {{venue_name}}, {{venue_city}}
📅 {{show_date}} at {{show_time}}

The voting is still open for their predicted setlist.

Vote on predictions: {{show_url}}
{{#if ticket_url}}Get tickets: {{ticket_url}}{{/if}}

MySetlist - Predict the Music
Unsubscribe: {{unsubscribe_url}}',
 'transactional',
 '["user_name", "artist_name", "venue_name", "venue_city", "show_date", "show_time", "reminder_text", "show_url", "ticket_url", "top_songs", "app_url", "unsubscribe_url"]'),

-- Artist update template  
('artist-update',
 '🎸 {{artist_name}} just announced {{update_count}} new shows!',
 '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Artist Update</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; padding: 20px 0; }
        .artist-header { background: linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%); color: white; padding: 25px; border-radius: 12px; margin: 20px 0; text-align: center; }
        .show-list { margin: 20px 0; }
        .show-item { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; border-left: 4px solid #1DB954; }
        .show-date { font-weight: bold; color: #1DB954; }
        .show-venue { color: #666; margin-top: 5px; }
        .button { display: inline-block; background: #1DB954; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>🎸 Artist Update</h2>
        </div>
        
        <div class="artist-header">
            <h1>{{artist_name}}</h1>
            <p>Just announced {{update_count}} new shows!</p>
        </div>
        
        <p>Hi {{user_name}},</p>
        <p>Great news! {{artist_name}}, one of your followed artists, just announced new tour dates. {{recommendation_reason}}.</p>
        
        <div class="show-list">
            <h3>📅 New Shows:</h3>
            {{#each new_shows}}
            <div class="show-item">
                <div class="show-date">{{date}} at {{time}}</div>
                <div class="show-venue">📍 {{venue_name}}, {{venue_city}}</div>
                {{#if ticket_url}}
                <div style="margin-top: 10px;">
                    <a href="{{ticket_url}}" style="color: #1DB954; text-decoration: none;">🎫 Get Tickets</a>
                </div>
                {{/if}}
            </div>
            {{/each}}
        </div>
        
        <div style="text-align: center;">
            <a href="{{artist_url}}" class="button">View All {{artist_name}} Shows</a>
        </div>
        
        <p>Don''t forget to vote on the predicted setlists once they''re available!</p>
        
        <div class="footer">
            <p>MySetlist - Predict the Music<br>
            <a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="{{app_url}}/notifications/preferences">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>',
 '🎸 {{artist_name}} Update

{{artist_name}} just announced {{update_count}} new shows!

New Shows:
{{#each new_shows}}
📅 {{date}} at {{time}}
📍 {{venue_name}}, {{venue_city}}
{{#if ticket_url}}🎫 Tickets: {{ticket_url}}{{/if}}

{{/each}}

View all shows: {{artist_url}}

MySetlist - Predict the Music
Unsubscribe: {{unsubscribe_url}}',
 'transactional',
 '["user_name", "artist_name", "update_count", "new_shows", "artist_url", "recommendation_reason", "app_url", "unsubscribe_url"]'),

-- Vote summary template
('vote-summary',
 '📊 Your voting summary: {{accuracy_percentage}}% accuracy this week',
 '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vote Summary</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; padding: 20px 0; }
        .stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-number { font-size: 32px; font-weight: bold; color: #1DB954; }
        .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
        .accuracy-bar { background: #e9ecef; height: 20px; border-radius: 10px; margin: 20px 0; overflow: hidden; }
        .accuracy-fill { background: linear-gradient(90deg, #1DB954, #1ed760); height: 100%; transition: width 0.3s ease; }
        .recent-votes { margin: 20px 0; }
        .vote-item { display: flex; justify-content: space-between; align-items: center; padding: 10px; background: #f8f9fa; margin: 5px 0; border-radius: 6px; }
        .badge { padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
        .badge-correct { background: #d4edda; color: #155724; }
        .badge-incorrect { background: #f8d7da; color: #721c24; }
        .badge-pending { background: #d1ecf1; color: #0c5460; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2>📊 Your Weekly Voting Summary</h2>
        </div>
        
        <p>Hi {{user_name}},</p>
        <p>Here''s how your setlist predictions performed this week:</p>
        
        <div class="stats-grid">
            <div class="stat-card">
                <div class="stat-number">{{total_votes}}</div>
                <div class="stat-label">Total Votes</div>
            </div>
            <div class="stat-card">
                <div class="stat-number">{{accuracy_percentage}}%</div>
                <div class="stat-label">Accuracy Rate</div>
            </div>
        </div>
        
        <div>
            <h4>Accuracy Trend</h4>
            <div class="accuracy-bar">
                <div class="accuracy-fill" style="width: {{accuracy_percentage}}%;"></div>
            </div>
            <p style="text-align: center; color: #666; font-size: 14px;">{{accuracy_percentage}}% of your predictions were correct</p>
        </div>
        
        {{#if recent_votes}}
        <div class="recent-votes">
            <h3>🎵 Recent Predictions:</h3>
            {{#each recent_votes}}
            <div class="vote-item">
                <div>
                    <strong>{{artist_name}}</strong> - {{song_title}}<br>
                    <small>{{venue_name}} • {{show_date}}</small>
                </div>
                <div>
                    {{#if result}}
                        {{#if (eq result "correct")}}
                            <span class="badge badge-correct">✓ Correct</span>
                        {{else}}
                            <span class="badge badge-incorrect">✗ Incorrect</span>
                        {{/if}}
                    {{else}}
                        <span class="badge badge-pending">⏳ Pending</span>
                    {{/if}}
                </div>
            </div>
            {{/each}}
        </div>
        {{/if}}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{{app_url}}/profile/stats" class="button">View Detailed Stats</a>
        </div>
        
        <p>Keep up the great work! The more you vote, the better your predictions become.</p>
        
        <div class="footer">
            <p>MySetlist - Predict the Music<br>
            <a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="{{app_url}}/notifications/preferences">Manage Preferences</a></p>
        </div>
    </div>
</body>
</html>',
 '📊 Your Weekly Voting Summary

Hi {{user_name}},

Your setlist prediction performance this week:

📊 Statistics:
- Total Votes: {{total_votes}}
- Accuracy Rate: {{accuracy_percentage}}%

{{#if recent_votes}}
🎵 Recent Predictions:
{{#each recent_votes}}
{{artist_name}} - {{song_title}}
{{venue_name}} • {{show_date}}
Result: {{#if result}}{{result}}{{else}}Pending{{/if}}

{{/each}}
{{/if}}

View detailed stats: {{app_url}}/profile/stats

Keep up the great work!

MySetlist - Predict the Music
Unsubscribe: {{unsubscribe_url}}',
 'marketing',
 '["user_name", "total_votes", "accuracy_percentage", "recent_votes", "app_url", "unsubscribe_url"]'),

-- Marketing newsletter template
('marketing-newsletter',
 '🎵 This Week in Music: {{featured_artist}} and {{new_shows_count}} new shows',
 '<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MySetlist Newsletter</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f4f4f4; }
        .container { max-width: 600px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1DB954 0%, #1ed760 100%); color: white; padding: 30px; border-radius: 12px 12px 0 0; text-align: center; margin: -20px -20px 20px -20px; }
        .section { margin: 30px 0; }
        .featured-artist { background: linear-gradient(135deg, #6c5ce7 0%, #a29bfe 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .trending-list { list-style: none; padding: 0; }
        .trending-item { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; }
        .trend-number { background: #1DB954; color: white; width: 24px; height: 24px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: bold; }
        .button { display: inline-block; background: #1DB954; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin: 10px 5px; }
        .button-secondary { background: transparent; color: #1DB954; border: 2px solid #1DB954; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎵 This Week in Music</h1>
            <p>Your weekly dose of concert predictions and music news</p>
        </div>
        
        <div class="section">
            <h2>🌟 Featured Artist Spotlight</h2>
            <div class="featured-artist">
                <h3>{{featured_artist}}</h3>
                <p>{{featured_artist_description}}</p>
                <p><strong>{{featured_artist_shows_count}}</strong> upcoming shows</p>
            </div>
        </div>
        
        <div class="section">
            <h2>🔥 Trending This Week</h2>
            <ul class="trending-list">
                {{#each trending_artists}}
                <li class="trending-item">
                    <div>
                        <div class="trend-number">{{@index}}</div>
                    </div>
                    <div style="flex: 1; margin-left: 15px;">
                        <strong>{{name}}</strong><br>
                        <small>{{upcoming_shows}} upcoming shows • {{vote_activity}} votes this week</small>
                    </div>
                </li>
                {{/each}}
            </ul>
        </div>
        
        <div class="section">
            <h2>📅 {{new_shows_count}} New Shows Added</h2>
            <p>Discover exciting new concerts and start making your predictions:</p>
            
            {{#each featured_shows}}
            <div style="background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 6px;">
                <strong>{{artist_name}}</strong> at {{venue_name}}<br>
                <small>{{date}} • {{city}}</small>
                {{#if is_hot}}<span style="background: #ff6b6b; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 10px;">🔥 HOT</span>{{/if}}
            </div>
            {{/each}}
        </div>
        
        <div style="text-align: center; margin: 40px 0;">
            <a href="{{app_url}}/shows" class="button">Explore All Shows</a>
            <a href="{{app_url}}/search" class="button button-secondary">Discover Artists</a>
        </div>
        
        <div class="section">
            <h3>📊 Community Stats</h3>
            <p>This week our community made <strong>{{community_votes}}</strong> predictions across <strong>{{active_shows}}</strong> shows. The most predicted song was "{{top_predicted_song}}" by {{top_predicted_artist}}!</p>
        </div>
        
        <div class="footer">
            <p style="text-align: center;">
                Thanks for being part of the MySetlist community!<br>
                <a href="{{unsubscribe_url}}">Unsubscribe</a> | <a href="{{app_url}}/notifications/preferences">Manage Preferences</a>
            </p>
        </div>
    </div>
</body>
</html>',
 '🎵 This Week in Music Newsletter

🌟 Featured Artist: {{featured_artist}}
{{featured_artist_description}}
{{featured_artist_shows_count}} upcoming shows

🔥 Trending Artists:
{{#each trending_artists}}
{{@index}}. {{name}} - {{upcoming_shows}} shows, {{vote_activity}} votes
{{/each}}

📅 {{new_shows_count}} New Shows Added:
{{#each featured_shows}}
{{artist_name}} at {{venue_name}} - {{date}} in {{city}}
{{/each}}

📊 Community Stats:
{{community_votes}} predictions made across {{active_shows}} shows this week.
Top predicted: "{{top_predicted_song}}" by {{top_predicted_artist}}

Explore shows: {{app_url}}/shows

MySetlist - Predict the Music
Unsubscribe: {{unsubscribe_url}}',
 'marketing',
 '["featured_artist", "featured_artist_description", "featured_artist_shows_count", "new_shows_count", "trending_artists", "featured_shows", "community_votes", "active_shows", "top_predicted_song", "top_predicted_artist", "app_url", "unsubscribe_url"]');

-- Update template status
UPDATE email_templates SET is_active = true WHERE name IN ('welcome', 'show-reminder', 'artist-update', 'vote-summary', 'marketing-newsletter');