import { NextRequest, NextResponse } from 'next/server';
import { APIOptimizer } from '@/libs/performance';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate required fields
    if (!body.metric || !body.value || !body.threshold) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Log performance alert
    console.warn(`⚠️ Performance Alert: ${body.metric} = ${body.value} (threshold: ${body.threshold})`);

    // In production, you would:
    // 1. Save to monitoring database
    // 2. Send alerts to monitoring service (e.g., Sentry, DataDog)
    // 3. Notify developers if severity is high

    if (process.env.NODE_ENV === 'production') {
      // Example: Send to monitoring service
      if (body.severity === 'high') {
        console.error(`🚨 High severity performance issue: ${body.metric}`);
        // await sendCriticalAlert(body);
      }
      
      // Example: Save to database
      // await savePerformanceAlert(body);
    }

    return NextResponse.json(
      { success: true },
      { 
        status: 200,
        headers: APIOptimizer.getPerformanceHeaders(60)
      }
    );
  } catch (error) {
    console.error('Error processing performance alert:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    }
  );
}