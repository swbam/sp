import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { advancedAnalytics } from '@/libs/advanced-analytics';
import { advancedCaching } from '@/libs/advanced-caching';
import { APIOptimizer, perfMonitor } from '@/libs/performance';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'running' | 'paused' | 'completed';
  start_date: string;
  end_date?: string;
  traffic_allocation: number; // Percentage of users to include
  variants: ABTestVariant[];
  metrics: ABTestMetrics;
  target_audience?: {
    user_segments?: string[];
    device_types?: string[];
    regions?: string[];
    new_users_only?: boolean;
  };
}

interface ABTestVariant {
  id: string;
  name: string;
  description: string;
  traffic_split: number; // Percentage within the test
  content: Record<string, any>;
  is_control: boolean;
}

interface ABTestMetrics {
  primary_metric: string;
  secondary_metrics: string[];
  success_criteria: {
    metric: string;
    improvement_threshold: number; // Minimum % improvement required
    statistical_significance: number; // Required confidence level
  };
  current_results?: {
    [variantId: string]: {
      users: number;
      conversions: number;
      conversion_rate: number;
      confidence_level: number;
    };
  };
}

interface ContentExperiment {
  test_id: string;
  user_id: string;
  variant_id: string;
  assigned_at: string;
  interactions: ContentInteraction[];
}

interface ContentInteraction {
  type: 'view' | 'click' | 'conversion' | 'engagement';
  timestamp: string;
  metadata?: Record<string, any>;
}

// Get content with A/B testing
export async function GET(request: Request) {
  return perfMonitor.measure('ab_testing_content', async () => {
    try {
      const { searchParams } = new URL(request.url);
      const contentType = searchParams.get('content_type');
      const placement = searchParams.get('placement');
      const userId = searchParams.get('user_id');
      const testId = searchParams.get('test_id');

      if (!contentType || !placement) {
        return NextResponse.json({
          error: 'content_type and placement are required'
        }, { status: 400 });
      }

      const supabase = createRouteHandlerClient({ cookies });

      // Get active A/B tests for this content type and placement
      const activeTests = await getActiveABTests(supabase, contentType, placement);

      let selectedContent: any = null;
      let assignedTest: ABTest | null = null;
      let assignedVariant: ABTestVariant | null = null;

      if (activeTests.length > 0 && userId) {
        // Assign user to test and get variant
        const assignment = await assignUserToTest(supabase, userId, activeTests);
        if (assignment) {
          assignedTest = assignment.test;
          assignedVariant = assignment.variant;
          selectedContent = assignedVariant.content;

          // Track content view
          await trackInteraction(supabase, {
            test_id: assignedTest.id,
            user_id: userId,
            variant_id: assignedVariant.id,
            interaction_type: 'view',
            metadata: { content_type: contentType, placement }
          });
        }
      }

      // Fallback to default content if no test assigned
      if (!selectedContent) {
        selectedContent = await getDefaultContent(supabase, contentType, placement);
      }

      // Track analytics
      await advancedAnalytics.trackEvent({
        type: 'view',
        userId,
        entityId: placement,
        entityType: 'content',
        metadata: {
          content_type: contentType,
          test_id: assignedTest?.id,
          variant_id: assignedVariant?.id,
          is_ab_test: !!assignedTest
        }
      });

      return NextResponse.json({
        content: selectedContent,
        ab_test: assignedTest ? {
          test_id: assignedTest.id,
          variant_id: assignedVariant?.id,
          variant_name: assignedVariant?.name
        } : null,
        placement,
        content_type: contentType,
        served_at: new Date().toISOString()
      }, {
        headers: APIOptimizer.getPerformanceHeaders(60) // 1 minute cache
      });

    } catch (error) {
      console.error('A/B Testing content API error:', error);
      return NextResponse.json({
        error: 'Failed to retrieve content',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      }, { status: 500 });
    }
  });
}

// Create or update A/B test
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check admin role
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!profile || !['admin', 'content_manager'].includes(profile.role)) {
      return NextResponse.json({ error: 'Admin or content manager access required' }, { status: 403 });
    }

    const { action, test_data } = await request.json();

    if (!action) {
      return NextResponse.json({ error: 'action is required' }, { status: 400 });
    }

    let result;
    switch (action) {
      case 'create_test':
        result = await createABTest(supabase, test_data, user.id);
        break;

      case 'update_test':
        result = await updateABTest(supabase, test_data, user.id);
        break;

      case 'start_test':
        result = await startABTest(supabase, test_data.test_id);
        break;

      case 'pause_test':
        result = await pauseABTest(supabase, test_data.test_id);
        break;

      case 'complete_test':
        result = await completeABTest(supabase, test_data.test_id);
        break;

      case 'track_interaction':
        result = await trackInteraction(supabase, test_data);
        break;

      default:
        return NextResponse.json({
          error: 'Invalid action. Valid actions: create_test, update_test, start_test, pause_test, complete_test, track_interaction'
        }, { status: 400 });
    }

    return NextResponse.json({
      action,
      result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('A/B Testing POST API error:', error);
    return NextResponse.json({
      error: 'Failed to process A/B testing request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { status: 500 });
  }
}

// Get A/B test results and analytics
export async function PATCH(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const testId = searchParams.get('test_id');
    const action = searchParams.get('action') || 'results';

    if (!testId) {
      return NextResponse.json({ error: 'test_id is required' }, { status: 400 });
    }

    const supabase = createRouteHandlerClient({ cookies });
    
    // Authentication check
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    let result;
    switch (action) {
      case 'results':
        result = await getABTestResults(supabase, testId);
        break;

      case 'statistical_analysis':
        result = await getStatisticalAnalysis(supabase, testId);
        break;

      case 'segment_analysis':
        result = await getSegmentAnalysis(supabase, testId);
        break;

      case 'real_time_metrics':
        result = await getRealTimeMetrics(supabase, testId);
        break;

      default:
        return NextResponse.json({
          error: 'Invalid action. Valid actions: results, statistical_analysis, segment_analysis, real_time_metrics'
        }, { status: 400 });
    }

    return NextResponse.json({
      test_id: testId,
      action,
      data: result,
      timestamp: new Date().toISOString()
    }, {
      headers: APIOptimizer.getPerformanceHeaders(300) // 5 minute cache for results
    });

  } catch (error) {
    console.error('A/B Testing PATCH API error:', error);
    return NextResponse.json({
      error: 'Failed to retrieve A/B test analytics'
    }, { status: 500 });
  }
}

// Helper functions

async function getActiveABTests(supabase: any, contentType: string, placement: string): Promise<ABTest[]> {
  return advancedCaching.get(
    `active_ab_tests_${contentType}_${placement}`,
    async () => {
      const { data, error } = await supabase
        .from('ab_tests')
        .select(`
          *,
          variants:ab_test_variants (*)
        `)
        .eq('content_type', contentType)
        .eq('placement', placement)
        .eq('status', 'running')
        .lte('start_date', new Date().toISOString())
        .or('end_date.is.null,end_date.gte.' + new Date().toISOString());

      if (error) throw error;
      return data || [];
    },
    { ttl: 300000, tags: ['ab_tests', 'active_tests'] }
  );
}

async function assignUserToTest(
  supabase: any, 
  userId: string, 
  activeTests: ABTest[]
): Promise<{ test: ABTest; variant: ABTestVariant } | null> {
  // Check if user is already assigned to any of these tests
  const { data: existingAssignment } = await supabase
    .from('content_experiments')
    .select('test_id, variant_id')
    .eq('user_id', userId)
    .in('test_id', activeTests.map(t => t.id))
    .limit(1)
    .single();

  if (existingAssignment) {
    const test = activeTests.find(t => t.id === existingAssignment.test_id);
    const variant = test?.variants.find(v => v.id === existingAssignment.variant_id);
    if (test && variant) {
      return { test, variant };
    }
  }

  // Select test based on traffic allocation
  for (const test of activeTests) {
    const hash = hashUserId(userId + test.id);
    const bucket = hash % 100;
    
    if (bucket < test.traffic_allocation) {
      // User is included in this test, now assign variant
      const variant = selectVariant(test.variants, userId + test.id);
      
      // Store assignment
      await supabase
        .from('content_experiments')
        .insert({
          test_id: test.id,
          user_id: userId,
          variant_id: variant.id,
          assigned_at: new Date().toISOString()
        });

      return { test, variant };
    }
  }

  return null;
}

function hashUserId(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

function selectVariant(variants: ABTestVariant[], seed: string): ABTestVariant {
  const hash = hashUserId(seed);
  const bucket = hash % 100;
  
  let cumulativeWeight = 0;
  for (const variant of variants) {
    cumulativeWeight += variant.traffic_split;
    if (bucket < cumulativeWeight) {
      return variant;
    }
  }
  
  // Fallback to control variant
  return variants.find(v => v.is_control) || variants[0];
}

async function getDefaultContent(supabase: any, contentType: string, placement: string) {
  return advancedCaching.get(
    `default_content_${contentType}_${placement}`,
    async () => {
      const { data, error } = await supabase
        .from('default_content')
        .select('content')
        .eq('content_type', contentType)
        .eq('placement', placement)
        .single();

      if (error) throw error;
      return data?.content || {};
    },
    { ttl: 1800000, tags: ['default_content'] } // 30 minute cache
  );
}

async function createABTest(supabase: any, testData: any, createdBy: string) {
  // Validate test data
  if (!testData.name || !testData.variants || testData.variants.length < 2) {
    throw new Error('Test must have a name and at least 2 variants');
  }

  // Ensure traffic splits add up to 100
  const totalSplit = testData.variants.reduce((sum: number, v: any) => sum + v.traffic_split, 0);
  if (Math.abs(totalSplit - 100) > 0.01) {
    throw new Error('Variant traffic splits must add up to 100%');
  }

  const testId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  
  // Create test
  const { error: testError } = await supabase
    .from('ab_tests')
    .insert({
      id: testId,
      name: testData.name,
      description: testData.description,
      content_type: testData.content_type,
      placement: testData.placement,
      status: 'draft',
      traffic_allocation: testData.traffic_allocation || 100,
      metrics: testData.metrics,
      target_audience: testData.target_audience,
      created_by: createdBy,
      created_at: new Date().toISOString()
    });

  if (testError) throw testError;

  // Create variants
  const variants = testData.variants.map((variant: any, index: number) => ({
    id: `variant_${testId}_${index}`,
    test_id: testId,
    name: variant.name,
    description: variant.description,
    traffic_split: variant.traffic_split,
    content: variant.content,
    is_control: variant.is_control || index === 0
  }));

  const { error: variantError } = await supabase
    .from('ab_test_variants')
    .insert(variants);

  if (variantError) throw variantError;

  // Clear cache
  await advancedCaching.clearByTags(['ab_tests']);

  return { test_id: testId, variants: variants.length };
}

async function startABTest(supabase: any, testId: string) {
  const { error } = await supabase
    .from('ab_tests')
    .update({
      status: 'running',
      start_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', testId);

  if (error) throw error;

  await advancedCaching.clearByTags(['ab_tests', 'active_tests']);
  return { message: 'Test started successfully' };
}

async function pauseABTest(supabase: any, testId: string) {
  const { error } = await supabase
    .from('ab_tests')
    .update({
      status: 'paused',
      updated_at: new Date().toISOString()
    })
    .eq('id', testId);

  if (error) throw error;

  await advancedCaching.clearByTags(['ab_tests', 'active_tests']);
  return { message: 'Test paused successfully' };
}

async function completeABTest(supabase: any, testId: string) {
  const { error } = await supabase
    .from('ab_tests')
    .update({
      status: 'completed',
      end_date: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', testId);

  if (error) throw error;

  await advancedCaching.clearByTags(['ab_tests', 'active_tests']);
  return { message: 'Test completed successfully' };
}

async function trackInteraction(supabase: any, interaction: {
  test_id: string;
  user_id: string;
  variant_id: string;
  interaction_type: string;
  metadata?: Record<string, any>;
}) {
  const { error } = await supabase
    .from('ab_test_interactions')
    .insert({
      test_id: interaction.test_id,
      user_id: interaction.user_id,
      variant_id: interaction.variant_id,
      interaction_type: interaction.interaction_type,
      metadata: interaction.metadata,
      timestamp: new Date().toISOString()
    });

  if (error) throw error;

  return { tracked: true };
}

async function getABTestResults(supabase: any, testId: string) {
  return advancedCaching.get(
    `ab_test_results_${testId}`,
    async () => {
      // Get test details
      const { data: test, error: testError } = await supabase
        .from('ab_tests')
        .select(`
          *,
          variants:ab_test_variants (*)
        `)
        .eq('id', testId)
        .single();

      if (testError) throw testError;

      // Get interaction data for each variant
      const results: Record<string, any> = {};
      
      for (const variant of test.variants) {
        const { data: interactions } = await supabase
          .from('ab_test_interactions')
          .select('interaction_type, user_id')
          .eq('test_id', testId)
          .eq('variant_id', variant.id);

        const uniqueUsers = new Set(interactions?.map(i => i.user_id) || []);
        const conversions = interactions?.filter(i => i.interaction_type === 'conversion') || [];
        
        results[variant.id] = {
          variant_name: variant.name,
          users: uniqueUsers.size,
          conversions: conversions.length,
          conversion_rate: uniqueUsers.size > 0 ? (conversions.length / uniqueUsers.size) * 100 : 0,
          is_control: variant.is_control
        };
      }

      return {
        test_info: {
          name: test.name,
          status: test.status,
          start_date: test.start_date,
          end_date: test.end_date
        },
        results
      };
    },
    { ttl: 300000, tags: [`ab_test_${testId}`] }
  );
}

async function getStatisticalAnalysis(supabase: any, testId: string) {
  const results = await getABTestResults(supabase, testId);
  
  // Find control variant
  const controlVariant = Object.values(results.results).find((r: any) => r.is_control);
  if (!controlVariant) {
    throw new Error('No control variant found');
  }

  const analysis: Record<string, any> = {};
  
  for (const [variantId, variant] of Object.entries(results.results)) {
    const v = variant as any;
    if (v.is_control) continue;

    // Calculate statistical significance (simplified)
    const improvement = ((v.conversion_rate - (controlVariant as any).conversion_rate) / (controlVariant as any).conversion_rate) * 100;
    const sampleSize = v.users + (controlVariant as any).users;
    
    // Simplified confidence calculation (would use proper statistical tests in production)
    const confidence = Math.min(95, Math.max(50, 70 + (sampleSize / 100)));

    analysis[variantId] = {
      variant_name: v.variant_name,
      improvement_percentage: improvement,
      confidence_level: confidence,
      is_significant: confidence >= 95 && Math.abs(improvement) >= 5,
      sample_size: sampleSize,
      recommendation: confidence >= 95 && improvement > 5 ? 'winner' : 
                    confidence >= 95 && improvement < -5 ? 'loser' : 'inconclusive'
    };
  }

  return analysis;
}

async function getSegmentAnalysis(supabase: any, testId: string) {
  // Analyze results by user segments
  return {
    by_device: {},
    by_region: {},
    by_user_type: {},
    message: 'Segment analysis requires additional user metadata'
  };
}

async function getRealTimeMetrics(supabase: any, testId: string) {
  // Get real-time metrics for the test
  const { data: recentInteractions } = await supabase
    .from('ab_test_interactions')
    .select('variant_id, interaction_type, timestamp')
    .eq('test_id', testId)
    .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Last hour

  const metrics = {
    interactions_last_hour: recentInteractions?.length || 0,
    by_variant: {} as Record<string, number>,
    conversion_velocity: 0
  };

  if (recentInteractions) {
    for (const interaction of recentInteractions) {
      metrics.by_variant[interaction.variant_id] = (metrics.by_variant[interaction.variant_id] || 0) + 1;
    }
    
    metrics.conversion_velocity = recentInteractions.filter(i => i.interaction_type === 'conversion').length;
  }

  return metrics;
}