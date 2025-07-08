#!/usr/bin/env node

/**
 * Database Optimization Script for MySetlist
 * Optimizes database indexes, queries, and caching for maximum performance
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

class DatabaseOptimizer {
  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
    );
    
    this.optimizations = [];
    this.errors = [];
    this.performanceResults = {};
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const colorMap = {
      INFO: '\x1b[36m',
      SUCCESS: '\x1b[32m',
      WARNING: '\x1b[33m',
      ERROR: '\x1b[31m',
      RESET: '\x1b[0m'
    };
    
    console.log(`${colorMap[level]}[${timestamp}] ${message}${colorMap.RESET}`);
  }

  async createOptimizedIndexes() {
    this.log('📈 Creating Optimized Database Indexes', 'INFO');
    
    const indexes = [
      // Artist search optimization
      {
        name: 'idx_artists_search_text',
        sql: `CREATE INDEX IF NOT EXISTS idx_artists_search_text ON artists 
              USING gin(to_tsvector('english', name || ' ' || COALESCE(array_to_string(genres, ' '), '')));`,
        description: 'Full-text search optimization for artists'
      },
      
      // Artist slug lookup (most common query)
      {
        name: 'idx_artists_slug_unique',
        sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_artists_slug_unique ON artists (slug);`,
        description: 'Unique slug index for fast artist lookups'
      },
      
      // Show performance optimization
      {
        name: 'idx_shows_performance',
        sql: `CREATE INDEX IF NOT EXISTS idx_shows_performance ON shows 
              (status, date, created_at) WHERE status IN ('upcoming', 'ongoing');`,
        description: 'Composite index for show listing performance'
      },
      
      // Show-artist relationship optimization
      {
        name: 'idx_shows_artist_date',
        sql: `CREATE INDEX IF NOT EXISTS idx_shows_artist_date ON shows 
              (artist_id, date, status);`,
        description: 'Artist shows lookup optimization'
      },
      
      // Trending shows optimization
      {
        name: 'idx_shows_trending',
        sql: `CREATE INDEX IF NOT EXISTS idx_shows_trending ON shows 
              (date, created_at, status) WHERE status = 'upcoming' AND date >= CURRENT_DATE;`,
        description: 'Trending shows calculation optimization'
      },
      
      // Venue lookup optimization
      {
        name: 'idx_venues_location',
        sql: `CREATE INDEX IF NOT EXISTS idx_venues_location ON venues 
              (city, state, country);`,
        description: 'Venue location search optimization'
      },
      
      // Setlist voting optimization
      {
        name: 'idx_setlist_songs_votes',
        sql: `CREATE INDEX IF NOT EXISTS idx_setlist_songs_votes ON setlist_songs 
              (setlist_id, upvotes, downvotes);`,
        description: 'Setlist voting performance optimization'
      },
      
      // Vote aggregation optimization
      {
        name: 'idx_votes_aggregation',
        sql: `CREATE INDEX IF NOT EXISTS idx_votes_aggregation ON votes 
              (setlist_song_id, vote_type, created_at);`,
        description: 'Vote counting and aggregation optimization'
      },
      
      // User following optimization
      {
        name: 'idx_user_artists_lookup',
        sql: `CREATE INDEX IF NOT EXISTS idx_user_artists_lookup ON user_artists 
              (user_id, created_at);`,
        description: 'User following artists lookup optimization'
      },
      
      // Song search optimization
      {
        name: 'idx_songs_search',
        sql: `CREATE INDEX IF NOT EXISTS idx_songs_search ON songs 
              USING gin(to_tsvector('english', title || ' ' || artist_name));`,
        description: 'Song search performance optimization'
      }
    ];

    for (const index of indexes) {
      try {
        this.log(`Creating index: ${index.name}`, 'INFO');
        
        const { error } = await this.supabase.rpc('execute_sql', {
          sql: index.sql
        });
        
        if (error) {
          this.log(`❌ Failed to create index ${index.name}: ${error.message}`, 'ERROR');
          this.errors.push({ type: 'INDEX_CREATION', index: index.name, error: error.message });
        } else {
          this.log(`✅ Created index: ${index.name} - ${index.description}`, 'SUCCESS');
          this.optimizations.push({ type: 'INDEX_CREATED', index: index.name });
        }
      } catch (error) {
        this.log(`❌ Error creating index ${index.name}: ${error.message}`, 'ERROR');
        this.errors.push({ type: 'INDEX_ERROR', index: index.name, error: error.message });
      }
    }
  }

  async createOptimizedFunctions() {
    this.log('⚡ Creating Optimized Database Functions', 'INFO');
    
    const functions = [
      // Fast artist search function
      {
        name: 'search_artists_optimized',
        sql: `
          CREATE OR REPLACE FUNCTION search_artists_optimized(search_query TEXT, result_limit INTEGER DEFAULT 20)
          RETURNS TABLE(
            id UUID,
            name VARCHAR,
            slug VARCHAR,
            image_url TEXT,
            genres JSONB,
            followers INTEGER,
            verified BOOLEAN,
            relevance REAL
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
              ts_rank(
                to_tsvector('english', a.name || ' ' || COALESCE(array_to_string(a.genres, ' '), '')),
                plainto_tsquery('english', search_query)
              ) as relevance
            FROM artists a
            WHERE to_tsvector('english', a.name || ' ' || COALESCE(array_to_string(a.genres, ' '), '')) 
                  @@ plainto_tsquery('english', search_query)
            ORDER BY relevance DESC, a.followers DESC
            LIMIT result_limit;
          END;
          $$ LANGUAGE plpgsql;
        `,
        description: 'Optimized artist search with relevance ranking'
      },
      
      // Fast trending shows calculation
      {
        name: 'get_trending_shows_optimized',
        sql: `
          CREATE OR REPLACE FUNCTION get_trending_shows_optimized(result_limit INTEGER DEFAULT 10)
          RETURNS TABLE(
            id UUID,
            name VARCHAR,
            date DATE,
            start_time TIME,
            status VARCHAR,
            ticket_url TEXT,
            artist_id UUID,
            venue_id UUID,
            vote_score INTEGER,
            trending_score REAL
          ) AS $$
          BEGIN
            RETURN QUERY
            SELECT 
              s.id,
              s.name,
              s.date,
              s.start_time,
              s.status,
              s.ticket_url,
              s.artist_id,
              s.venue_id,
              COALESCE(vote_summary.total_votes, 0) as vote_score,
              -- Trending algorithm: recency + vote activity + time to show
              (
                EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 86400 * 0.3 +  -- Recency factor
                COALESCE(vote_summary.total_votes, 0) * 0.4 +                -- Vote activity
                (7 - EXTRACT(EPOCH FROM (s.date - CURRENT_DATE)) / 86400) * 0.3 -- Time to show
              ) as trending_score
            FROM shows s
            LEFT JOIN (
              SELECT 
                sl.show_id,
                SUM(ss.upvotes + ss.downvotes) as total_votes
              FROM setlists sl
              JOIN setlist_songs ss ON sl.id = ss.setlist_id
              GROUP BY sl.show_id
            ) vote_summary ON s.id = vote_summary.show_id
            WHERE s.status = 'upcoming' 
              AND s.date >= CURRENT_DATE
              AND s.date <= CURRENT_DATE + INTERVAL '30 days'
            ORDER BY trending_score DESC, s.date ASC
            LIMIT result_limit;
          END;
          $$ LANGUAGE plpgsql;
        `,
        description: 'Optimized trending shows with scoring algorithm'
      },
      
      // Fast vote counting function
      {
        name: 'update_vote_counts_optimized',
        sql: `
          CREATE OR REPLACE FUNCTION update_vote_counts_optimized(song_id UUID)
          RETURNS VOID AS $$
          BEGIN
            UPDATE setlist_songs 
            SET 
              upvotes = (
                SELECT COUNT(*) FROM votes 
                WHERE setlist_song_id = song_id AND vote_type = 'up'
              ),
              downvotes = (
                SELECT COUNT(*) FROM votes 
                WHERE setlist_song_id = song_id AND vote_type = 'down'
              )
            WHERE id = song_id;
          END;
          $$ LANGUAGE plpgsql;
        `,
        description: 'Optimized vote counting for setlist songs'
      },
      
      // Artist statistics function
      {
        name: 'get_artist_stats_optimized',
        sql: `
          CREATE OR REPLACE FUNCTION get_artist_stats_optimized(artist_id UUID)
          RETURNS TABLE(
            total_shows INTEGER,
            upcoming_shows INTEGER,
            total_votes INTEGER,
            followers INTEGER,
            avg_votes_per_show REAL
          ) AS $$
          BEGIN
            RETURN QUERY
            SELECT 
              COUNT(s.id)::INTEGER as total_shows,
              COUNT(CASE WHEN s.status = 'upcoming' AND s.date >= CURRENT_DATE THEN 1 END)::INTEGER as upcoming_shows,
              COALESCE(SUM(
                CASE WHEN sl.id IS NOT NULL THEN 
                  (SELECT SUM(ss.upvotes + ss.downvotes) FROM setlist_songs ss WHERE ss.setlist_id = sl.id)
                ELSE 0 END
              ), 0)::INTEGER as total_votes,
              a.followers,
              CASE 
                WHEN COUNT(s.id) > 0 THEN 
                  COALESCE(SUM(
                    CASE WHEN sl.id IS NOT NULL THEN 
                      (SELECT SUM(ss.upvotes + ss.downvotes) FROM setlist_songs ss WHERE ss.setlist_id = sl.id)
                    ELSE 0 END
                  ), 0)::REAL / COUNT(s.id)::REAL
                ELSE 0
              END as avg_votes_per_show
            FROM artists a
            LEFT JOIN shows s ON a.id = s.artist_id
            LEFT JOIN setlists sl ON s.id = sl.show_id
            WHERE a.id = artist_id
            GROUP BY a.id, a.followers;
          END;
          $$ LANGUAGE plpgsql;
        `,
        description: 'Optimized artist statistics calculation'
      }
    ];

    for (const func of functions) {
      try {
        this.log(`Creating function: ${func.name}`, 'INFO');
        
        const { error } = await this.supabase.rpc('execute_sql', {
          sql: func.sql
        });
        
        if (error) {
          this.log(`❌ Failed to create function ${func.name}: ${error.message}`, 'ERROR');
          this.errors.push({ type: 'FUNCTION_CREATION', function: func.name, error: error.message });
        } else {
          this.log(`✅ Created function: ${func.name} - ${func.description}`, 'SUCCESS');
          this.optimizations.push({ type: 'FUNCTION_CREATED', function: func.name });
        }
      } catch (error) {
        this.log(`❌ Error creating function ${func.name}: ${error.message}`, 'ERROR');
        this.errors.push({ type: 'FUNCTION_ERROR', function: func.name, error: error.message });
      }
    }
  }

  async testQueryPerformance() {
    this.log('🔍 Testing Query Performance', 'INFO');
    
    const queryTests = [
      {
        name: 'Artist Search Performance',
        query: `SELECT * FROM search_artists_optimized('test', 10);`,
        threshold: 50 // ms
      },
      {
        name: 'Trending Shows Performance',
        query: `SELECT * FROM get_trending_shows_optimized(10);`,
        threshold: 100 // ms
      },
      {
        name: 'Artist Stats Performance',
        query: `SELECT * FROM get_artist_stats_optimized((SELECT id FROM artists LIMIT 1));`,
        threshold: 75 // ms
      },
      {
        name: 'Show Listing Performance',
        query: `
          SELECT s.*, a.name as artist_name, v.name as venue_name
          FROM shows s
          JOIN artists a ON s.artist_id = a.id
          JOIN venues v ON s.venue_id = v.id
          WHERE s.status = 'upcoming' 
            AND s.date >= CURRENT_DATE
          ORDER BY s.date ASC
          LIMIT 20;
        `,
        threshold: 100 // ms
      }
    ];

    for (const test of queryTests) {
      try {
        this.log(`Testing: ${test.name}`, 'INFO');
        
        const startTime = Date.now();
        const { data, error } = await this.supabase.rpc('execute_sql', {
          sql: test.query
        });
        const endTime = Date.now();
        
        const duration = endTime - startTime;
        
        if (error) {
          this.log(`❌ Query failed: ${test.name} - ${error.message}`, 'ERROR');
          this.errors.push({ type: 'QUERY_ERROR', test: test.name, error: error.message });
        } else {
          const status = duration <= test.threshold ? 'FAST' : 'SLOW';
          const color = duration <= test.threshold ? 'SUCCESS' : 'WARNING';
          
          this.log(`${status === 'FAST' ? '✅' : '⚠️'} ${test.name}: ${duration}ms (${status})`, color);
          
          this.performanceResults[test.name] = {
            duration,
            threshold: test.threshold,
            status,
            rowCount: Array.isArray(data) ? data.length : 0
          };
        }
      } catch (error) {
        this.log(`❌ Error testing ${test.name}: ${error.message}`, 'ERROR');
        this.errors.push({ type: 'QUERY_TEST_ERROR', test: test.name, error: error.message });
      }
    }
  }

  async optimizeTableStatistics() {
    this.log('📊 Updating Table Statistics', 'INFO');
    
    const tables = ['artists', 'shows', 'venues', 'setlists', 'setlist_songs', 'votes', 'songs'];
    
    for (const table of tables) {
      try {
        this.log(`Analyzing table: ${table}`, 'INFO');
        
        const { error } = await this.supabase.rpc('execute_sql', {
          sql: `ANALYZE ${table};`
        });
        
        if (error) {
          this.log(`❌ Failed to analyze table ${table}: ${error.message}`, 'ERROR');
          this.errors.push({ type: 'ANALYZE_ERROR', table, error: error.message });
        } else {
          this.log(`✅ Analyzed table: ${table}`, 'SUCCESS');
          this.optimizations.push({ type: 'TABLE_ANALYZED', table });
        }
      } catch (error) {
        this.log(`❌ Error analyzing table ${table}: ${error.message}`, 'ERROR');
        this.errors.push({ type: 'ANALYZE_TABLE_ERROR', table, error: error.message });
      }
    }
  }

  async createMaterializedViews() {
    this.log('🔄 Creating Materialized Views for Performance', 'INFO');
    
    const views = [
      {
        name: 'mv_artist_stats',
        sql: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS mv_artist_stats AS
          SELECT 
            a.id,
            a.name,
            a.slug,
            a.image_url,
            a.genres,
            a.followers,
            a.verified,
            COUNT(s.id) as total_shows,
            COUNT(CASE WHEN s.status = 'upcoming' AND s.date >= CURRENT_DATE THEN 1 END) as upcoming_shows,
            COALESCE(SUM(vote_counts.total_votes), 0) as total_votes,
            EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 86400 as days_since_created
          FROM artists a
          LEFT JOIN shows s ON a.id = s.artist_id
          LEFT JOIN (
            SELECT 
              sl.show_id,
              SUM(ss.upvotes + ss.downvotes) as total_votes
            FROM setlists sl
            JOIN setlist_songs ss ON sl.id = ss.setlist_id
            GROUP BY sl.show_id
          ) vote_counts ON s.id = vote_counts.show_id
          GROUP BY a.id, a.name, a.slug, a.image_url, a.genres, a.followers, a.verified, a.created_at;
        `,
        description: 'Materialized view for artist statistics'
      },
      
      {
        name: 'mv_trending_shows',
        sql: `
          CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trending_shows AS
          SELECT 
            s.*,
            a.name as artist_name,
            a.slug as artist_slug,
            a.image_url as artist_image,
            a.followers as artist_followers,
            v.name as venue_name,
            v.city as venue_city,
            v.state as venue_state,
            COALESCE(vote_summary.total_votes, 0) as vote_count,
            COALESCE(vote_summary.upvotes, 0) as upvotes,
            COALESCE(vote_summary.downvotes, 0) as downvotes,
            -- Trending score calculation
            (
              -- Recency factor (newer shows get higher score)
              CASE 
                WHEN EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 86400 < 1 THEN 100
                WHEN EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 86400 < 7 THEN 80
                WHEN EXTRACT(EPOCH FROM (NOW() - s.created_at)) / 86400 < 30 THEN 60
                ELSE 40
              END * 0.3 +
              -- Vote activity factor
              COALESCE(vote_summary.total_votes, 0) * 0.4 +
              -- Time to show factor (shows happening soon get higher score)
              CASE 
                WHEN EXTRACT(EPOCH FROM (s.date - CURRENT_DATE)) / 86400 < 7 THEN 100
                WHEN EXTRACT(EPOCH FROM (s.date - CURRENT_DATE)) / 86400 < 30 THEN 80
                WHEN EXTRACT(EPOCH FROM (s.date - CURRENT_DATE)) / 86400 < 90 THEN 60
                ELSE 40
              END * 0.3
            ) as trending_score
          FROM shows s
          JOIN artists a ON s.artist_id = a.id
          JOIN venues v ON s.venue_id = v.id
          LEFT JOIN (
            SELECT 
              sl.show_id,
              SUM(ss.upvotes + ss.downvotes) as total_votes,
              SUM(ss.upvotes) as upvotes,
              SUM(ss.downvotes) as downvotes
            FROM setlists sl
            JOIN setlist_songs ss ON sl.id = ss.setlist_id
            GROUP BY sl.show_id
          ) vote_summary ON s.id = vote_summary.show_id
          WHERE s.status IN ('upcoming', 'ongoing')
            AND s.date >= CURRENT_DATE
            AND s.date <= CURRENT_DATE + INTERVAL '6 months';
        `,
        description: 'Materialized view for trending shows with pre-calculated scores'
      }
    ];

    for (const view of views) {
      try {
        this.log(`Creating materialized view: ${view.name}`, 'INFO');
        
        const { error } = await this.supabase.rpc('execute_sql', {
          sql: view.sql
        });
        
        if (error) {
          this.log(`❌ Failed to create materialized view ${view.name}: ${error.message}`, 'ERROR');
          this.errors.push({ type: 'MATERIALIZED_VIEW_ERROR', view: view.name, error: error.message });
        } else {
          this.log(`✅ Created materialized view: ${view.name}`, 'SUCCESS');
          this.optimizations.push({ type: 'MATERIALIZED_VIEW_CREATED', view: view.name });
          
          // Create indexes on materialized views
          const indexSql = `
            CREATE INDEX IF NOT EXISTS idx_${view.name}_trending_score 
            ON ${view.name} (trending_score DESC);
          `;
          
          const { error: indexError } = await this.supabase.rpc('execute_sql', {
            sql: indexSql
          });
          
          if (!indexError) {
            this.log(`✅ Created index for materialized view: ${view.name}`, 'SUCCESS');
          }
        }
      } catch (error) {
        this.log(`❌ Error creating materialized view ${view.name}: ${error.message}`, 'ERROR');
        this.errors.push({ type: 'MATERIALIZED_VIEW_CREATE_ERROR', view: view.name, error: error.message });
      }
    }
  }

  async refreshMaterializedViews() {
    this.log('🔄 Refreshing Materialized Views', 'INFO');
    
    const views = ['mv_artist_stats', 'mv_trending_shows'];
    
    for (const view of views) {
      try {
        this.log(`Refreshing materialized view: ${view}`, 'INFO');
        
        const { error } = await this.supabase.rpc('execute_sql', {
          sql: `REFRESH MATERIALIZED VIEW ${view};`
        });
        
        if (error) {
          this.log(`❌ Failed to refresh materialized view ${view}: ${error.message}`, 'ERROR');
          this.errors.push({ type: 'REFRESH_ERROR', view, error: error.message });
        } else {
          this.log(`✅ Refreshed materialized view: ${view}`, 'SUCCESS');
          this.optimizations.push({ type: 'MATERIALIZED_VIEW_REFRESHED', view });
        }
      } catch (error) {
        this.log(`❌ Error refreshing materialized view ${view}: ${error.message}`, 'ERROR');
        this.errors.push({ type: 'REFRESH_VIEW_ERROR', view, error: error.message });
      }
    }
  }

  generateOptimizationReport() {
    this.log('📋 Generating Database Optimization Report', 'INFO');
    
    const report = {
      timestamp: new Date().toISOString(),
      optimizations: this.optimizations,
      errors: this.errors,
      performanceResults: this.performanceResults,
      summary: {
        totalOptimizations: this.optimizations.length,
        totalErrors: this.errors.length,
        averageQueryTime: this.calculateAverageQueryTime(),
        recommendedActions: this.generateRecommendations()
      }
    };

    const reportDir = path.join(process.cwd(), 'reports');
    if (!fs.existsSync(reportDir)) {
      fs.mkdirSync(reportDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportPath = path.join(reportDir, `database-optimization-${timestamp}.json`);
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    this.log(`📄 Database optimization report saved: ${reportPath}`, 'SUCCESS');
    
    return report;
  }

  calculateAverageQueryTime() {
    const times = Object.values(this.performanceResults).map(r => r.duration);
    return times.length > 0 ? times.reduce((a, b) => a + b, 0) / times.length : 0;
  }

  generateRecommendations() {
    const recommendations = [];
    
    // Query performance recommendations
    const slowQueries = Object.entries(this.performanceResults)
      .filter(([_, result]) => result.status === 'SLOW');
    
    if (slowQueries.length > 0) {
      recommendations.push({
        type: 'QUERY_PERFORMANCE',
        priority: 'HIGH',
        message: `${slowQueries.length} slow queries detected`,
        actions: [
          'Review and optimize slow queries',
          'Consider additional indexing',
          'Implement query caching',
          'Use materialized views for complex queries'
        ]
      });
    }

    // Error handling recommendations
    if (this.errors.length > 0) {
      recommendations.push({
        type: 'ERROR_HANDLING',
        priority: 'MEDIUM',
        message: `${this.errors.length} errors encountered during optimization`,
        actions: [
          'Review database permissions',
          'Check SQL syntax and compatibility',
          'Verify database connection',
          'Review error logs for patterns'
        ]
      });
    }

    // Maintenance recommendations
    recommendations.push({
      type: 'MAINTENANCE',
      priority: 'LOW',
      message: 'Regular maintenance tasks recommended',
      actions: [
        'Schedule regular VACUUM ANALYZE',
        'Monitor index usage statistics',
        'Refresh materialized views periodically',
        'Review query performance metrics'
      ]
    });

    return recommendations;
  }

  async runComprehensiveOptimization() {
    this.log('🚀 Starting Comprehensive Database Optimization', 'INFO');
    
    try {
      // Create optimized indexes
      await this.createOptimizedIndexes();
      
      // Create optimized functions
      await this.createOptimizedFunctions();
      
      // Create materialized views
      await this.createMaterializedViews();
      
      // Refresh materialized views
      await this.refreshMaterializedViews();
      
      // Update table statistics
      await this.optimizeTableStatistics();
      
      // Test query performance
      await this.testQueryPerformance();
      
      // Generate comprehensive report
      const report = this.generateOptimizationReport();
      
      // Display results
      this.displayResults();
      
      const success = this.errors.length === 0;
      this.log(`🏁 Database optimization completed: ${success ? 'SUCCESS' : 'ISSUES FOUND'}`, 
                success ? 'SUCCESS' : 'WARNING');
      
      return { success, report };
      
    } catch (error) {
      this.log(`❌ Database optimization failed: ${error.message}`, 'ERROR');
      return { success: false, error: error.message };
    }
  }

  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📊 Database Optimization Results');
    console.log('='.repeat(60));
    
    console.log(`\n✅ Optimizations Applied: ${this.optimizations.length}`);
    console.log(`❌ Errors Encountered: ${this.errors.length}`);
    
    if (Object.keys(this.performanceResults).length > 0) {
      console.log(`\n🔍 Query Performance Results:`);
      Object.entries(this.performanceResults).forEach(([name, result]) => {
        const status = result.status === 'FAST' ? '✅' : '⚠️';
        console.log(`   ${status} ${name}: ${result.duration}ms (${result.status})`);
      });
      
      const avgTime = this.calculateAverageQueryTime();
      console.log(`\n📈 Average Query Time: ${avgTime.toFixed(2)}ms`);
    }
    
    if (this.errors.length > 0) {
      console.log(`\n❌ Errors Encountered:`);
      this.errors.forEach((error, index) => {
        console.log(`   ${index + 1}. ${error.type}: ${error.error}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
  }
}

// CLI execution
async function main() {
  const optimizer = new DatabaseOptimizer();
  const result = await optimizer.runComprehensiveOptimization();
  
  process.exit(result.success ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = DatabaseOptimizer;