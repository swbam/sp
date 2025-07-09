import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    // For now, just log the navigation timing data
    // In a production app, you'd send this to your analytics service
    console.log('Navigation timing data:', body);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Navigation timing error:', error);
    return NextResponse.json({ error: 'Failed to process timing data' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}