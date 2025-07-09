import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { dataWarehouse } from '@/lib/analytics/dataWarehouse';

// Force dynamic rendering for this route
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';


// ETL Pipeline Management API
// Handles triggering, monitoring, and managing ETL operations

const ETLTriggerSchema = z.object({
  pipelineType: z.enum(['hourly', 'daily', 'weekly', 'full']).default('daily'),
  force: z.boolean().default(false), // Force run even if already running
  notifyOnComplete: z.boolean().default(false)
});

const ETLStatusQuerySchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  status: z.enum(['running', 'completed', 'failed']).optional(),
  pipelineType: z.enum(['hourly', 'daily', 'weekly', 'full']).optional()
});

// Trigger ETL pipeline
export async function POST(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication and admin permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Check if user has admin privileges
    const hasAdminAccess = await checkAdminAccess(supabase, user.id);
    if (!hasAdminAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json();
    const { pipelineType, force, notifyOnComplete } = ETLTriggerSchema.parse(body);

    // Check if pipeline is already running (unless forced)
    if (!force) {
      const isRunning = await checkPipelineRunning(supabase, pipelineType);
      if (isRunning) {
        return NextResponse.json({
          error: 'Pipeline already running',
          message: `${pipelineType} pipeline is currently active. Use force=true to override.`
        }, { status: 409 });
      }
    }

    // Trigger ETL pipeline asynchronously
    const pipelinePromise = dataWarehouse.runETLPipeline(pipelineType);
    
    // Don't wait for completion, return immediate response
    pipelinePromise.then(async (result) => {
      console.log(`ETL Pipeline ${pipelineType} completed:`, result);
      
      if (notifyOnComplete) {
        await sendETLCompletionNotification(supabase, user.id, pipelineType, result);
      }
    }).catch(async (error) => {
      console.error(`ETL Pipeline ${pipelineType} failed:`, error);
      
      if (notifyOnComplete) {
        await sendETLFailureNotification(supabase, user.id, pipelineType, error);
      }
    });

    return NextResponse.json({
      success: true,
      message: `${pipelineType} ETL pipeline triggered successfully`,
      pipelineType,
      triggeredBy: user.id,
      triggeredAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('ETL trigger error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to trigger ETL pipeline' },
      { status: 500 }
    );
  }
}

// Get ETL pipeline status and history
export async function GET(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const query = ETLStatusQuerySchema.parse({
      limit: parseInt(searchParams.get('limit') || '20'),
      status: searchParams.get('status') || undefined,
      pipelineType: searchParams.get('pipelineType') || undefined
    });

    // Get ETL run history
    let dbQuery = supabase
      .from('etl_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(query.limit);

    if (query.status) {
      dbQuery = dbQuery.eq('status', query.status);
    }

    if (query.pipelineType) {
      dbQuery = dbQuery.eq('pipeline_type', query.pipelineType);
    }

    const { data: etlRuns, error } = await dbQuery;

    if (error) {
      throw error;
    }

    // Get current running pipelines
    const { data: activeLocks } = await supabase
      .from('etl_locks')
      .select('*')
      .gt('expires_at', new Date().toISOString());

    // Get system health metrics
    const healthMetrics = await getETLSystemHealth(supabase);

    // Calculate statistics
    const stats = calculateETLStatistics(etlRuns || []);

    return NextResponse.json({
      runs: etlRuns || [],
      activeLocks: activeLocks || [],
      health: healthMetrics,
      statistics: stats,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('ETL status error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch ETL status' },
      { status: 500 }
    );
  }
}

// Cancel running ETL pipeline
export async function DELETE(request: Request) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Check authentication and admin permissions
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const hasAdminAccess = await checkAdminAccess(supabase, user.id);
    if (!hasAdminAccess) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const pipelineType = searchParams.get('pipelineType');

    if (!pipelineType) {
      return NextResponse.json(
        { error: 'Pipeline type required' },
        { status: 400 }
      );
    }

    // Release ETL lock to stop pipeline
    const { error: lockError } = await supabase
      .from('etl_locks')
      .delete()
      .eq('lock_key', 'etl_process_lock');

    if (lockError) {
      throw lockError;
    }

    // Mark any running ETL as cancelled
    const { error: updateError } = await supabase
      .from('etl_runs')
      .update({
        status: 'failed',
        error_message: `Cancelled by user ${user.id}`,
        completed_at: new Date().toISOString()
      })
      .eq('status', 'running')
      .eq('pipeline_type', pipelineType);

    if (updateError) {
      console.error('Failed to update ETL run status:', updateError);
    }

    return NextResponse.json({
      success: true,
      message: `${pipelineType} ETL pipeline cancelled`,
      cancelledBy: user.id,
      cancelledAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('ETL cancellation error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel ETL pipeline' },
      { status: 500 }
    );
  }
}

// Utility functions
async function checkAdminAccess(supabase: any, userId: string): Promise<boolean> {
  // In a real implementation, you'd check user roles/permissions
  // For now, we'll allow any authenticated user (development only)
  return true;
}

async function checkPipelineRunning(supabase: any, pipelineType: string): Promise<boolean> {
  const { data: runningPipelines } = await supabase
    .from('etl_runs')
    .select('id')
    .eq('status', 'running')
    .eq('pipeline_type', pipelineType);

  const { data: activeLocks } = await supabase
    .from('etl_locks')
    .select('lock_key')
    .eq('lock_key', 'etl_process_lock')
    .gt('expires_at', new Date().toISOString());

  return (runningPipelines?.length || 0) > 0 || (activeLocks?.length || 0) > 0;
}

async function getETLSystemHealth(supabase: any): Promise<ETLSystemHealth> {
  // Check data freshness
  const { data: latestRun } = await supabase
    .from('etl_runs')
    .select('completed_at, status, pipeline_type')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .single();

  // Check error rates
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const { data: recentRuns } = await supabase
    .from('etl_runs')
    .select('status')
    .gte('started_at', oneDayAgo.toISOString());

  // Check queue size
  const { data: queuedEvents } = await supabase
    .from('event_processing_queue')
    .select('id', { count: 'exact' })
    .in('status', ['pending', 'processing']);

  // Check data warehouse freshness
  const { data: warehouseStats } = await supabase
    .from('user_behavior_warehouse')
    .select('updated_at')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single();

  const totalRuns = recentRuns?.length || 0;
  const failedRuns = recentRuns?.filter(run => run.status === 'failed').length || 0;
  const errorRate = totalRuns > 0 ? (failedRuns / totalRuns) * 100 : 0;

  const dataFreshness = latestRun?.completed_at 
    ? Math.floor((Date.now() - new Date(latestRun.completed_at).getTime()) / (1000 * 60 * 60))
    : 999;

  const warehouseFreshness = warehouseStats?.updated_at
    ? Math.floor((Date.now() - new Date(warehouseStats.updated_at).getTime()) / (1000 * 60 * 60))
    : 999;

  return {
    dataFreshnessHours: dataFreshness,
    warehouseFreshnessHours: warehouseFreshness,
    errorRatePercent: Math.round(errorRate * 100) / 100,
    queueSize: queuedEvents?.length || 0,
    lastSuccessfulRun: latestRun?.completed_at || null,
    healthStatus: determineHealthStatus(dataFreshness, errorRate, queuedEvents?.length || 0)
  };
}

function calculateETLStatistics(runs: any[]): ETLStatistics {
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      successRate: 0,
      avgDurationMinutes: 0,
      avgRecordsProcessed: 0,
      lastRunStatus: 'none'
    };
  }

  const completedRuns = runs.filter(run => run.status === 'completed');
  const successRate = (completedRuns.length / runs.length) * 100;

  const avgDuration = completedRuns.reduce((sum, run) => {
    return sum + (run.duration_ms || 0);
  }, 0) / (completedRuns.length || 1);

  const avgRecords = completedRuns.reduce((sum, run) => {
    return sum + (run.records_processed || 0);
  }, 0) / (completedRuns.length || 1);

  return {
    totalRuns: runs.length,
    successRate: Math.round(successRate * 100) / 100,
    avgDurationMinutes: Math.round((avgDuration / (1000 * 60)) * 100) / 100,
    avgRecordsProcessed: Math.round(avgRecords),
    lastRunStatus: runs[0]?.status || 'unknown'
  };
}

function determineHealthStatus(
  dataFreshness: number,
  errorRate: number,
  queueSize: number
): 'healthy' | 'warning' | 'critical' {
  if (dataFreshness > 48 || errorRate > 50 || queueSize > 10000) {
    return 'critical';
  }
  
  if (dataFreshness > 24 || errorRate > 20 || queueSize > 5000) {
    return 'warning';
  }
  
  return 'healthy';
}

async function sendETLCompletionNotification(
  supabase: any,
  userId: string,
  pipelineType: string,
  result: any
): Promise<void> {
  try {
    // In a real implementation, you'd use your notification system
    console.log(`ETL ${pipelineType} completed for user ${userId}:`, result);
    
    // Could integrate with your notification manager here
    // await notificationManager.sendNotification({
    //   userId,
    //   type: 'etl_completion',
    //   title: 'ETL Pipeline Completed',
    //   message: `${pipelineType} pipeline processed ${result.recordsProcessed} records`,
    //   data: { pipelineType, result }
    // });
  } catch (error) {
    console.error('Failed to send ETL completion notification:', error);
  }
}

async function sendETLFailureNotification(
  supabase: any,
  userId: string,
  pipelineType: string,
  error: any
): Promise<void> {
  try {
    console.log(`ETL ${pipelineType} failed for user ${userId}:`, error);
    
    // Could integrate with your notification system here
    // await notificationManager.sendNotification({
    //   userId,
    //   type: 'etl_failure',
    //   title: 'ETL Pipeline Failed',
    //   message: `${pipelineType} pipeline encountered an error`,
    //   data: { pipelineType, error: error.message }
    // });
  } catch (notificationError) {
    console.error('Failed to send ETL failure notification:', notificationError);
  }
}

// Type definitions
interface ETLSystemHealth {
  dataFreshnessHours: number;
  warehouseFreshnessHours: number;
  errorRatePercent: number;
  queueSize: number;
  lastSuccessfulRun: string | null;
  healthStatus: 'healthy' | 'warning' | 'critical';
}

interface ETLStatistics {
  totalRuns: number;
  successRate: number;
  avgDurationMinutes: number;
  avgRecordsProcessed: number;
  lastRunStatus: string;
}