import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * MANUAL SYNC TRIGGER
 * 
 * This endpoint allows manual triggering of various sync operations
 * for testing and administration purposes.
 */
export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const syncType = searchParams.get('type') || 'comprehensive';
  const secret = searchParams.get('secret');

  // Verify secret for security
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    let syncUrl = '';
    
    switch (syncType) {
      case 'autonomous':
        syncUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sync/autonomous?secret=${secret}`;
        break;
      case 'comprehensive':
        syncUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sync/comprehensive?secret=${secret}`;
        break;
      case 'finalized':
        syncUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sync/finalized?secret=${secret}`;
        break;
      case 'artists':
        syncUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sync/artists?secret=${secret}`;
        break;
      case 'shows':
        syncUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/sync/shows?secret=${secret}`;
        break;
      default:
        return NextResponse.json({ error: 'Invalid sync type' }, { status: 400 });
    }

    console.log(`🚀 Triggering ${syncType} sync...`);
    
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || `Sync failed with status ${response.status}`);
    }

    return NextResponse.json({
      success: true,
      message: `${syncType} sync triggered successfully`,
      sync_type: syncType,
      result: result,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(`❌ ${syncType} sync trigger failed:`, error);
    
    return NextResponse.json({
      error: `Failed to trigger ${syncType} sync`,
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');

  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    message: 'Sync trigger endpoint ready',
    available_types: [
      'autonomous',
      'comprehensive', 
      'finalized',
      'artists',
      'shows'
    ],
    usage: 'POST /api/sync/trigger?type=autonomous&secret=<CRON_SECRET>',
    timestamp: new Date().toISOString()
  });
}