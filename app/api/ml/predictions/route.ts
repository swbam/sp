import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { mlPredictionService } from '@/libs/ml-prediction-service';
import { APIOptimizer, perfMonitor } from '@/libs/performance';
import { advancedCaching } from '@/libs/advanced-caching';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// Generate setlist predictions for a show
export async function POST(request: Request) {
  return perfMonitor.measure('ml_predictions_api', async () => {
    try {
      const supabase = createRouteHandlerClient({ cookies });
      
      // Authentication check
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
      }

      // Rate limiting
      const rateLimitKey = `ml_predictions_${user.id}`;
      if (!APIOptimizer.checkRateLimit(rateLimitKey, 10, 60000)) { // 10 requests per minute
        return NextResponse.json({ 
          error: 'Rate limit exceeded. Please wait before making another prediction request.' 
        }, { status: 429 });
      }

      // Parse request body
      let body;
      try {
        body = await request.json();
      } catch (error) {
        return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
      }

      const { show_id, setlist_length = 20, force_refresh = false } = body;

      if (!show_id) {
        return NextResponse.json({ error: 'show_id is required' }, { status: 400 });
      }

      // UUID validation
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(show_id)) {
        return NextResponse.json({ error: 'Invalid show_id format' }, { status: 400 });
      }

      if (setlist_length > 50 || setlist_length < 5) {
        return NextResponse.json({ 
          error: 'setlist_length must be between 5 and 50' 
        }, { status: 400 });
      }

      // Check cache first (unless forced refresh)
      const cacheKey = `ml_predictions_${show_id}_${setlist_length}`;
      
      if (!force_refresh) {
        const cachedPredictions = await advancedCaching.get(cacheKey);
        if (cachedPredictions) {
          return NextResponse.json({
            predictions: cachedPredictions.predictions,
            metrics: cachedPredictions.metrics,
            cached: true,
            generated_at: cachedPredictions.generated_at
          }, {
            headers: APIOptimizer.getPerformanceHeaders(300) // 5 minute cache
          });
        }
      }

      // Verify show exists
      const { data: show, error: showError } = await supabase
        .from('shows')
        .select('id, name, date, artist_id')
        .eq('id', show_id)
        .single();

      if (showError || !show) {
        return NextResponse.json({ error: 'Show not found' }, { status: 404 });
      }

      // Check if show is too far in the past (predictions less useful)
      const showDate = new Date(show.date);
      const daysSinceShow = (Date.now() - showDate.getTime()) / (1000 * 60 * 60 * 24);
      
      if (daysSinceShow > 30) {
        return NextResponse.json({ 
          error: 'Predictions are only available for shows within 30 days of current date' 
        }, { status: 400 });
      }

      // Generate predictions
      const predictions = await mlPredictionService.generateSetlistPredictions(
        show_id, 
        setlist_length
      );

      // Get prediction metrics
      const metrics = await mlPredictionService.getPredictionMetrics('week');

      const result = {
        predictions,
        metrics,
        cached: false,
        generated_at: new Date().toISOString(),
        show_info: {
          id: show.id,
          name: show.name,
          date: show.date
        }
      };

      // Cache the results
      await advancedCaching.set(cacheKey, result, {
        ttl: 300000, // 5 minutes
        priority: 'high',
        tags: [`show_${show_id}`, `artist_${show.artist_id}`, 'ml_predictions']
      });

      return NextResponse.json(result, {
        headers: APIOptimizer.getPerformanceHeaders(300)
      });

    } catch (error) {
      console.error('ML Predictions API error:', error);
      
      return NextResponse.json({ 
        error: 'Failed to generate predictions. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }
  });
}

// Get prediction history and analytics
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const showId = searchParams.get('show_id');
    const timeframe = searchParams.get('timeframe') as 'day' | 'week' | 'month' || 'week';
    const limit = parseInt(searchParams.get('limit') || '10');

    const supabase = createRouteHandlerClient({ cookies });
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    if (showId) {
      // Get specific show predictions
      const cacheKey = `ml_predictions_${showId}_20`; // Default length
      const cachedPredictions = await advancedCaching.get(cacheKey);
      
      if (cachedPredictions) {
        return NextResponse.json({
          predictions: cachedPredictions.predictions,
          cached: true
        });
      } else {
        return NextResponse.json({
          error: 'No predictions found for this show. Generate predictions first.'
        }, { status: 404 });
      }
    }

    // Get general prediction metrics and analytics
    const metrics = await mlPredictionService.getPredictionMetrics(timeframe);
    
    // Get recent prediction activity (would come from analytics)
    const recentPredictions = await advancedCaching.get(
      `recent_predictions_${timeframe}`,
      async () => {
        // In a real implementation, this would query a predictions log table
        return [];
      },
      { ttl: 600000 } // 10 minutes
    );

    return NextResponse.json({
      metrics,
      recent_predictions: recentPredictions,
      timeframe
    }, {
      headers: APIOptimizer.getPerformanceHeaders(600) // 10 minute cache
    });

  } catch (error) {
    console.error('ML Predictions GET API error:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve prediction data' 
    }, { status: 500 });
  }
}

// Update prediction model configuration (admin only)
export async function PATCH(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user is admin (you'd implement proper role checking)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { config } = await request.json();
    
    if (!config) {
      return NextResponse.json({ error: 'config is required' }, { status: 400 });
    }

    // Validate config parameters
    const validKeys = ['artistWeight', 'venueWeight', 'genreWeight', 'popularityWeight', 'historicalWeight', 'recentTrendsWeight'];
    const configKeys = Object.keys(config);
    
    if (!configKeys.every(key => validKeys.includes(key))) {
      return NextResponse.json({ 
        error: 'Invalid config keys. Valid keys: ' + validKeys.join(', ')
      }, { status: 400 });
    }

    // Validate weight values
    for (const [key, value] of Object.entries(config)) {
      if (typeof value !== 'number' || value < 0 || value > 1) {
        return NextResponse.json({ 
          error: `${key} must be a number between 0 and 1` 
        }, { status: 400 });
      }
    }

    // Update configuration
    mlPredictionService.updateConfig(config);

    // Clear related caches
    await advancedCaching.clearByTags(['ml_predictions']);

    return NextResponse.json({
      message: 'Configuration updated successfully',
      new_config: config
    });

  } catch (error) {
    console.error('ML Predictions PATCH API error:', error);
    return NextResponse.json({ 
      error: 'Failed to update configuration' 
    }, { status: 500 });
  }
}