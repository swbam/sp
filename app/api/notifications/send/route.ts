import { NextRequest, NextResponse } from 'next/server';
import { notificationSystem } from '@/libs/notification-system';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';

// Send notification
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { type, userId, data, channels, priority, scheduledFor } = body;
    
    // Validate required fields
    if (!type || !userId || !data || !channels) {
      return NextResponse.json(
        { error: 'Missing required fields: type, userId, data, channels' },
        { status: 400 }
      );
    }
    
    // Validate notification type
    const validTypes = ['show_reminder', 'artist_update', 'vote_milestone', 'trending_alert', 'system_alert', 'welcome', 'setlist_update'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid notification type' },
        { status: 400 }
      );
    }
    
    // Validate channels
    const validChannels = ['email', 'push', 'in_app'];
    if (!Array.isArray(channels) || !channels.every(channel => validChannels.includes(channel))) {
      return NextResponse.json(
        { error: 'Invalid channels. Must be array of: email, push, in_app' },
        { status: 400 }
      );
    }
    
    // Send notification
    await notificationSystem.sendNotification({
      type,
      userId,
      data,
      channels,
      priority: priority || 'medium',
      scheduledFor: scheduledFor ? new Date(scheduledFor) : undefined
    });
    
    const processingTime = Date.now() - startTime;
    
    return NextResponse.json({
      success: true,
      message: 'Notification sent successfully',
      processingTime,
      timestamp: new Date().toISOString()
    }, {
      status: 200
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    return NextResponse.json(
      { error: 'Failed to send notification' },
      { status: 500 }
    );
  }
}

// Handle preflight requests
export async function OPTIONS() {
  return NextResponse.json({}, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
}