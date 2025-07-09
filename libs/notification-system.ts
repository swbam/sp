/**
 * Comprehensive Notification System for MySetlist
 * Email, Push, and In-App notifications with Resend integration
 */

import { Resend } from 'resend';
import { supabaseAdmin } from './supabaseAdmin';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import webpush from 'web-push';
import type { Database } from '@/types_db';

// Initialize Resend
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Web Push
webpush.setVapidDetails(
  'mailto:' + process.env.VAPID_EMAIL,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || '',
  process.env.VAPID_PRIVATE_KEY || ''
);

// Notification Types
export interface NotificationTemplate {
  id: string;
  name: string;
  type: 'email' | 'push' | 'in_app';
  subject?: string;
  htmlContent?: string;
  textContent?: string;
  pushTitle?: string;
  pushBody?: string;
  pushIcon?: string;
  pushActions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
  variables: string[];
  isActive: boolean;
}

export interface NotificationEvent {
  type: 'show_reminder' | 'artist_update' | 'vote_milestone' | 'trending_alert' | 'system_alert' | 'welcome' | 'setlist_update';
  userId: string;
  data: Record<string, any>;
  scheduledFor?: Date;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  channels: Array<'email' | 'push' | 'in_app'>;
  templateId?: string;
  metadata?: Record<string, any>;
}

export interface NotificationPreferences {
  userId: string;
  emailMarketing: boolean;
  emailShowReminders: boolean;
  emailArtistUpdates: boolean;
  emailVoteSummaries: boolean;
  pushShowReminders: boolean;
  pushArtistUpdates: boolean;
  pushTrendingAlerts: boolean;
  inAppNotifications: boolean;
  preferredTimezone: string;
  reminderHoursBefore: number;
  quietHours: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
  };
}

export interface PushSubscription {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent: string;
  isActive: boolean;
  createdAt: Date;
}

export interface NotificationDelivery {
  id: string;
  userId: string;
  notificationType: string;
  channel: 'email' | 'push' | 'in_app';
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'opened' | 'clicked';
  sentAt?: Date;
  deliveredAt?: Date;
  openedAt?: Date;
  clickedAt?: Date;
  errorMessage?: string;
  metadata: Record<string, any>;
}

// Notification Templates
export const NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
  show_reminder: {
    id: 'show_reminder',
    name: 'Show Reminder',
    type: 'email',
    subject: '🎤 Don\'t miss {{artistName}} tonight!',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">🎤 Show Reminder</h2>
        <p>Hi {{userName}},</p>
        <p>Just a reminder that <strong>{{artistName}}</strong> is performing tonight!</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin: 0 0 10px 0;">{{showName}}</h3>
          <p style="margin: 5px 0;"><strong>Artist:</strong> {{artistName}}</p>
          <p style="margin: 5px 0;"><strong>Venue:</strong> {{venueName}}</p>
          <p style="margin: 5px 0;"><strong>Date:</strong> {{showDate}}</p>
          <p style="margin: 5px 0;"><strong>Time:</strong> {{showTime}}</p>
        </div>
        <p>Don't forget to:</p>
        <ul>
          <li>Check the predicted setlist</li>
          <li>Vote on songs you want to hear</li>
          <li>Share your predictions with friends</li>
        </ul>
        <a href="{{showUrl}}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View Show Details</a>
        <p>Have a great time at the show!</p>
        <p>The MySetlist Team</p>
      </div>
    `,
    pushTitle: '🎤 {{artistName}} performing tonight!',
    pushBody: 'Don\'t miss {{artistName}} at {{venueName}}. Check the setlist predictions!',
    pushIcon: '/icons/show-reminder.png',
    variables: ['userName', 'artistName', 'showName', 'venueName', 'showDate', 'showTime', 'showUrl'],
    isActive: true
  },
  
  artist_update: {
    id: 'artist_update',
    name: 'Artist Update',
    type: 'email',
    subject: '🎵 {{artistName}} has new show announcements!',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10b981;">🎵 Artist Update</h2>
        <p>Hi {{userName}},</p>
        <p>Great news! <strong>{{artistName}}</strong> has announced new shows:</p>
        <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          {{#newShows}}
          <div style="border-bottom: 1px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 15px;">
            <h3 style="margin: 0 0 5px 0;">{{showName}}</h3>
            <p style="margin: 2px 0;"><strong>Venue:</strong> {{venueName}}</p>
            <p style="margin: 2px 0;"><strong>Date:</strong> {{showDate}}</p>
            <p style="margin: 2px 0;"><strong>Time:</strong> {{showTime}}</p>
          </div>
          {{/newShows}}
        </div>
        <p>Be among the first to:</p>
        <ul>
          <li>View the predicted setlists</li>
          <li>Vote on your favorite songs</li>
          <li>Get tickets before they sell out</li>
        </ul>
        <a href="{{artistUrl}}" style="background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 20px 0;">View All Shows</a>
        <p>Happy listening!</p>
        <p>The MySetlist Team</p>
      </div>
    `,
    pushTitle: '🎵 {{artistName}} announced new shows!',
    pushBody: 'Check out the new tour dates and setlist predictions',
    pushIcon: '/icons/artist-update.png',
    variables: ['userName', 'artistName', 'newShows', 'artistUrl'],
    isActive: true
  },
  
  vote_milestone: {
    id: 'vote_milestone',
    name: 'Vote Milestone',
    type: 'push',
    pushTitle: '🎉 Your vote made a difference!',
    pushBody: '{{songTitle}} is now trending thanks to your vote!',
    pushIcon: '/icons/vote-milestone.png',
    pushActions: [
      {
        action: 'view_setlist',
        title: 'View Setlist',
        icon: '/icons/setlist.png'
      },
      {
        action: 'share',
        title: 'Share',
        icon: '/icons/share.png'
      }
    ],
    variables: ['songTitle', 'artistName', 'showName'],
    isActive: true
  },
  
  trending_alert: {
    id: 'trending_alert',
    name: 'Trending Alert',
    type: 'push',
    pushTitle: '🔥 {{showName}} is trending!',
    pushBody: 'Votes are pouring in for {{artistName}}\'s upcoming show',
    pushIcon: '/icons/trending.png',
    pushActions: [
      {
        action: 'view_show',
        title: 'View Show',
        icon: '/icons/show.png'
      },
      {
        action: 'vote_now',
        title: 'Vote Now',
        icon: '/icons/vote.png'
      }
    ],
    variables: ['showName', 'artistName', 'voteCount'],
    isActive: true
  },
  
  welcome: {
    id: 'welcome',
    name: 'Welcome Email',
    type: 'email',
    subject: '🎵 Welcome to MySetlist!',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #10b981; text-align: center;">Welcome to MySetlist! 🎵</h1>
        <p>Hi {{userName}},</p>
        <p>Welcome to the ultimate concert setlist prediction platform! We're thrilled to have you join our community of music lovers.</p>
        
        <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; border-radius: 12px; margin: 30px 0; text-align: center;">
          <h2 style="margin: 0 0 15px 0;">🎤 What You Can Do</h2>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 20px;">
            <div>
              <h3 style="margin: 0 0 10px 0;">🗳️ Vote</h3>
              <p style="margin: 0; font-size: 14px;">Predict which songs artists will play</p>
            </div>
            <div>
              <h3 style="margin: 0 0 10px 0;">📊 Track</h3>
              <p style="margin: 0; font-size: 14px;">Follow your favorite artists</p>
            </div>
            <div>
              <h3 style="margin: 0 0 10px 0;">🎯 Predict</h3>
              <p style="margin: 0; font-size: 14px;">See how accurate your predictions are</p>
            </div>
            <div>
              <h3 style="margin: 0 0 10px 0;">🏆 Compete</h3>
              <p style="margin: 0; font-size: 14px;">Climb the leaderboards</p>
            </div>
          </div>
        </div>
        
        <h3>🚀 Get Started</h3>
        <ol>
          <li>Search for your favorite artists</li>
          <li>Check out their upcoming shows</li>
          <li>Vote on songs you think they'll play</li>
          <li>Set up show reminders</li>
        </ol>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="{{appUrl}}" style="background: #10b981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: bold;">Start Exploring</a>
        </div>
        
        <p>Need help? Reply to this email or check out our <a href="{{helpUrl}}" style="color: #10b981;">Help Center</a>.</p>
        
        <p>Happy predicting!</p>
        <p>The MySetlist Team</p>
      </div>
    `,
    variables: ['userName', 'appUrl', 'helpUrl'],
    isActive: true
  }
};

// Notification System Class
export class NotificationSystem {
  private static instance: NotificationSystem;
  private supabase = createClientComponentClient<Database>();
  private processingQueue: NotificationEvent[] = [];
  private isProcessing = false;
  
  static getInstance(): NotificationSystem {
    if (!NotificationSystem.instance) {
      NotificationSystem.instance = new NotificationSystem();
      NotificationSystem.instance.startProcessing();
    }
    return NotificationSystem.instance;
  }

  /**
   * Send notification to user
   */
  async sendNotification(event: NotificationEvent): Promise<void> {
    try {
      // Get user preferences
      const preferences = await this.getUserPreferences(event.userId);
      
      // Filter channels based on preferences
      const allowedChannels = this.filterChannelsByPreferences(event.channels, preferences, event.type);
      
      if (allowedChannels.length === 0) {
        console.log(`No allowed channels for user ${event.userId} and event type ${event.type}`);
        return;
      }

      // Check quiet hours
      if (this.isQuietHour(preferences)) {
        // Schedule for later unless urgent
        if (event.priority !== 'urgent') {
          await this.scheduleNotification(event, this.getNextAllowedTime(preferences));
          return;
        }
      }

      // Send to each allowed channel
      for (const channel of allowedChannels) {
        await this.sendToChannel(event, channel, preferences);
      }
    } catch (error) {
      console.error('Error sending notification:', error);
      await this.logNotificationError(event, error);
    }
  }

  /**
   * Send email notification
   */
  async sendEmail(event: NotificationEvent, preferences: NotificationPreferences): Promise<void> {
    try {
      const template = NOTIFICATION_TEMPLATES[event.type];
      if (!template || template.type !== 'email') {
        throw new Error(`No email template found for event type: ${event.type}`);
      }

      const user = await this.getUserData(event.userId);
      if (!user?.email) {
        throw new Error('User email not found');
      }

      // Render template with data
      const renderedSubject = this.renderTemplate(template.subject || '', { ...event.data, userName: user.name });
      const renderedHtml = this.renderTemplate(template.htmlContent || '', { ...event.data, userName: user.name });
      const renderedText = this.renderTemplate(template.textContent || '', { ...event.data, userName: user.name });

      // Send email via Resend
      const { data, error } = await resend.emails.send({
        from: 'MySetlist <noreply@mysetlist.com>',
        to: [user.email],
        subject: renderedSubject,
        html: renderedHtml,
        text: renderedText,
        headers: {
          'X-Event-Type': event.type,
          'X-User-ID': event.userId,
          'X-Priority': event.priority
        }
      });

      if (error) {
        throw error;
      }

      // Log delivery
      await this.logNotificationDelivery({
        userId: event.userId,
        notificationType: event.type,
        channel: 'email',
        status: 'sent',
        sentAt: new Date(),
        metadata: {
          emailId: data?.id,
          subject: renderedSubject,
          recipient: user.email
        }
      });

      console.log(`Email sent to ${user.email} for event ${event.type}`);
    } catch (error) {
      console.error('Error sending email:', error);
      await this.logNotificationDelivery({
        userId: event.userId,
        notificationType: event.type,
        channel: 'email',
        status: 'failed',
        sentAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { error }
      });
    }
  }

  /**
   * Send push notification
   */
  async sendPush(event: NotificationEvent, preferences: NotificationPreferences): Promise<void> {
    try {
      const template = NOTIFICATION_TEMPLATES[event.type];
      if (!template || !template.pushTitle) {
        throw new Error(`No push template found for event type: ${event.type}`);
      }

      // Get user's push subscriptions
      const subscriptions = await this.getUserPushSubscriptions(event.userId);
      if (subscriptions.length === 0) {
        console.log(`No push subscriptions found for user ${event.userId}`);
        return;
      }

      // Render push notification content
      const title = this.renderTemplate(template.pushTitle, event.data);
      const body = this.renderTemplate(template.pushBody || '', event.data);
      
      const payload = {
        title,
        body,
        icon: template.pushIcon || '/icons/default.png',
        badge: '/icons/badge.png',
        data: {
          eventType: event.type,
          userId: event.userId,
          ...event.data
        },
        actions: template.pushActions || [],
        requireInteraction: event.priority === 'urgent',
        timestamp: Date.now()
      };

      // Send to all subscriptions
      const sendPromises = subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: subscription.keys
            },
            JSON.stringify(payload)
          );

          await this.logNotificationDelivery({
            userId: event.userId,
            notificationType: event.type,
            channel: 'push',
            status: 'sent',
            sentAt: new Date(),
            metadata: {
              title,
              body,
              endpoint: subscription.endpoint.substring(0, 50) + '...'
            }
          });
        } catch (error) {
          console.error('Error sending push to subscription:', error);
          
          // Remove invalid subscription
          if (error instanceof Error && error.message.includes('410')) {
            await this.removeInvalidPushSubscription(subscription.endpoint);
          }
        }
      });

      await Promise.all(sendPromises);
      console.log(`Push notifications sent to ${subscriptions.length} subscriptions for event ${event.type}`);
    } catch (error) {
      console.error('Error sending push notification:', error);
      await this.logNotificationDelivery({
        userId: event.userId,
        notificationType: event.type,
        channel: 'push',
        status: 'failed',
        sentAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { error }
      });
    }
  }

  /**
   * Send in-app notification
   */
  async sendInApp(event: NotificationEvent, preferences: NotificationPreferences): Promise<void> {
    try {
      // Store in-app notification in database
      await supabaseAdmin
        .from('in_app_notifications')
        .insert({
          user_id: event.userId,
          type: event.type,
          title: event.data.title || `New ${event.type.replace('_', ' ')}`,
          message: event.data.message || '',
          data: event.data,
          priority: event.priority,
          is_read: false,
          created_at: new Date().toISOString()
        });

      // Send real-time notification via Supabase
      await this.supabase
        .channel(`user_${event.userId}`)
        .send({
          type: 'broadcast',
          event: 'new_notification',
          payload: {
            type: event.type,
            title: event.data.title || `New ${event.type.replace('_', ' ')}`,
            message: event.data.message || '',
            data: event.data,
            priority: event.priority,
            timestamp: new Date().toISOString()
          }
        });

      await this.logNotificationDelivery({
        userId: event.userId,
        notificationType: event.type,
        channel: 'in_app',
        status: 'sent',
        sentAt: new Date(),
        metadata: {
          title: event.data.title,
          message: event.data.message
        }
      });

      console.log(`In-app notification sent to user ${event.userId} for event ${event.type}`);
    } catch (error) {
      console.error('Error sending in-app notification:', error);
      await this.logNotificationDelivery({
        userId: event.userId,
        notificationType: event.type,
        channel: 'in_app',
        status: 'failed',
        sentAt: new Date(),
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        metadata: { error }
      });
    }
  }

  /**
   * Schedule notification for later
   */
  async scheduleNotification(event: NotificationEvent, scheduledFor: Date): Promise<void> {
    await supabaseAdmin
      .from('notification_queue')
      .insert({
        user_id: event.userId,
        event_type: event.type,
        event_data: event.data,
        channels: event.channels,
        priority: event.priority,
        scheduled_for: scheduledFor.toISOString(),
        template_id: event.templateId,
        metadata: event.metadata || {},
        status: 'scheduled'
      });
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences> {
    const { data } = await supabaseAdmin
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    return data || {
      userId,
      emailMarketing: true,
      emailShowReminders: true,
      emailArtistUpdates: true,
      emailVoteSummaries: false,
      pushShowReminders: true,
      pushArtistUpdates: false,
      pushTrendingAlerts: true,
      inAppNotifications: true,
      preferredTimezone: 'UTC',
      reminderHoursBefore: 24,
      quietHours: {
        start: '22:00',
        end: '08:00'
      }
    };
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(userId: string, preferences: Partial<NotificationPreferences>): Promise<void> {
    await supabaseAdmin
      .from('user_notification_preferences')
      .upsert({
        user_id: userId,
        ...preferences,
        updated_at: new Date().toISOString()
      });
  }

  /**
   * Register push subscription
   */
  async registerPushSubscription(subscription: Omit<PushSubscription, 'createdAt'>): Promise<void> {
    await supabaseAdmin
      .from('push_subscriptions')
      .upsert({
        user_id: subscription.userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        user_agent: subscription.userAgent,
        is_active: true,
        created_at: new Date().toISOString()
      });
  }

  /**
   * Get user push subscriptions
   */
  async getUserPushSubscriptions(userId: string): Promise<PushSubscription[]> {
    const { data } = await supabaseAdmin
      .from('push_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true);

    return data || [];
  }

  /**
   * Remove invalid push subscription
   */
  async removeInvalidPushSubscription(endpoint: string): Promise<void> {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({ is_active: false })
      .eq('endpoint', endpoint);
  }

  /**
   * Get notification analytics
   */
  async getNotificationAnalytics(timeframe: '1d' | '7d' | '30d' = '7d'): Promise<{
    totalSent: number;
    deliveryRate: number;
    openRate: number;
    clickRate: number;
    byChannel: Record<string, number>;
    byType: Record<string, number>;
  }> {
    const since = new Date();
    switch (timeframe) {
      case '1d':
        since.setDate(since.getDate() - 1);
        break;
      case '7d':
        since.setDate(since.getDate() - 7);
        break;
      case '30d':
        since.setDate(since.getDate() - 30);
        break;
    }

    const { data } = await supabaseAdmin
      .from('notification_delivery')
      .select('*')
      .gte('created_at', since.toISOString());

    const notifications = data || [];
    const totalSent = notifications.filter(n => n.status !== 'failed').length;
    const delivered = notifications.filter(n => n.status === 'delivered').length;
    const opened = notifications.filter(n => n.status === 'opened').length;
    const clicked = notifications.filter(n => n.status === 'clicked').length;

    const byChannel = notifications.reduce((acc, n) => {
      acc[n.channel] = (acc[n.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const byType = notifications.reduce((acc, n) => {
      acc[n.notification_type] = (acc[n.notification_type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalSent,
      deliveryRate: totalSent > 0 ? (delivered / totalSent) * 100 : 0,
      openRate: delivered > 0 ? (opened / delivered) * 100 : 0,
      clickRate: opened > 0 ? (clicked / opened) * 100 : 0,
      byChannel,
      byType
    };
  }

  // Private helper methods
  private async sendToChannel(event: NotificationEvent, channel: 'email' | 'push' | 'in_app', preferences: NotificationPreferences): Promise<void> {
    switch (channel) {
      case 'email':
        await this.sendEmail(event, preferences);
        break;
      case 'push':
        await this.sendPush(event, preferences);
        break;
      case 'in_app':
        await this.sendInApp(event, preferences);
        break;
    }
  }

  private filterChannelsByPreferences(channels: string[], preferences: NotificationPreferences, eventType: string): string[] {
    return channels.filter(channel => {
      switch (channel) {
        case 'email':
          return this.isEmailAllowed(preferences, eventType);
        case 'push':
          return this.isPushAllowed(preferences, eventType);
        case 'in_app':
          return preferences.inAppNotifications;
        default:
          return false;
      }
    });
  }

  private isEmailAllowed(preferences: NotificationPreferences, eventType: string): boolean {
    switch (eventType) {
      case 'show_reminder':
        return preferences.emailShowReminders;
      case 'artist_update':
        return preferences.emailArtistUpdates;
      case 'vote_milestone':
        return preferences.emailVoteSummaries;
      case 'welcome':
        return true; // Always allow welcome emails
      default:
        return preferences.emailMarketing;
    }
  }

  private isPushAllowed(preferences: NotificationPreferences, eventType: string): boolean {
    switch (eventType) {
      case 'show_reminder':
        return preferences.pushShowReminders;
      case 'artist_update':
        return preferences.pushArtistUpdates;
      case 'trending_alert':
        return preferences.pushTrendingAlerts;
      default:
        return true;
    }
  }

  private isQuietHour(preferences: NotificationPreferences): boolean {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: preferences.preferredTimezone 
    });
    
    const start = preferences.quietHours.start;
    const end = preferences.quietHours.end;
    
    if (start > end) {
      // Quiet hours span midnight
      return currentTime >= start || currentTime <= end;
    } else {
      // Quiet hours within same day
      return currentTime >= start && currentTime <= end;
    }
  }

  private getNextAllowedTime(preferences: NotificationPreferences): Date {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number);
    tomorrow.setHours(endHour, endMinute, 0, 0);
    
    return tomorrow;
  }

  private renderTemplate(template: string, data: Record<string, any>): string {
    let rendered = template;
    
    // Simple template rendering - replace {{variable}} with data
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      rendered = rendered.replace(regex, String(value));
    }
    
    // Handle arrays for {{#array}} ... {{/array}} syntax
    const arrayRegex = /{{#(\w+)}}(.*?){{\/\1}}/gs;
    rendered = rendered.replace(arrayRegex, (match, arrayName, content) => {
      const arrayData = data[arrayName];
      if (Array.isArray(arrayData)) {
        return arrayData.map(item => {
          let itemContent = content;
          for (const [key, value] of Object.entries(item)) {
            itemContent = itemContent.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
          }
          return itemContent;
        }).join('');
      }
      return '';
    });
    
    return rendered;
  }

  private async getUserData(userId: string): Promise<{ email: string; name: string } | null> {
    const { data } = await supabaseAdmin
      .from('users')
      .select('email, name')
      .eq('id', userId)
      .single();

    return data;
  }

  private async logNotificationDelivery(delivery: Omit<NotificationDelivery, 'id'>): Promise<void> {
    await supabaseAdmin
      .from('notification_delivery')
      .insert({
        user_id: delivery.userId,
        notification_type: delivery.notificationType,
        channel: delivery.channel,
        status: delivery.status,
        sent_at: delivery.sentAt?.toISOString(),
        delivered_at: delivery.deliveredAt?.toISOString(),
        opened_at: delivery.openedAt?.toISOString(),
        clicked_at: delivery.clickedAt?.toISOString(),
        error_message: delivery.errorMessage,
        metadata: delivery.metadata || {}
      });
  }

  private async logNotificationError(event: NotificationEvent, error: any): Promise<void> {
    console.error('Notification error:', {
      eventType: event.type,
      userId: event.userId,
      error: error.message || error
    });
    
    await supabaseAdmin
      .from('notification_errors')
      .insert({
        user_id: event.userId,
        event_type: event.type,
        error_message: error.message || String(error),
        event_data: event.data,
        created_at: new Date().toISOString()
      });
  }

  private startProcessing(): void {
    // Process scheduled notifications every minute
    setInterval(async () => {
      await this.processScheduledNotifications();
    }, 60000);
  }

  private async processScheduledNotifications(): Promise<void> {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    
    try {
      const { data: scheduledNotifications } = await supabaseAdmin
        .from('notification_queue')
        .select('*')
        .eq('status', 'scheduled')
        .lte('scheduled_for', new Date().toISOString())
        .limit(100);

      if (scheduledNotifications) {
        for (const notification of scheduledNotifications) {
          const event: NotificationEvent = {
            type: notification.event_type,
            userId: notification.user_id,
            data: notification.event_data,
            channels: notification.channels,
            priority: notification.priority,
            templateId: notification.template_id,
            metadata: notification.metadata
          };

          await this.sendNotification(event);
          
          // Mark as processed
          await supabaseAdmin
            .from('notification_queue')
            .update({ status: 'processed', processed_at: new Date().toISOString() })
            .eq('id', notification.id);
        }
      }
    } catch (error) {
      console.error('Error processing scheduled notifications:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}

// Export singleton instance
export const notificationSystem = NotificationSystem.getInstance();

// Convenience functions for common notifications
export const sendWelcomeEmail = async (userId: string, userName: string) => {
  await notificationSystem.sendNotification({
    type: 'welcome',
    userId,
    data: {
      userName,
      appUrl: process.env.NEXT_PUBLIC_APP_URL,
      helpUrl: `${process.env.NEXT_PUBLIC_APP_URL}/help`
    },
    priority: 'medium',
    channels: ['email']
  });
};

export const sendShowReminder = async (userId: string, showData: any) => {
  await notificationSystem.sendNotification({
    type: 'show_reminder',
    userId,
    data: showData,
    priority: 'high',
    channels: ['email', 'push']
  });
};

export const sendArtistUpdate = async (userId: string, artistData: any) => {
  await notificationSystem.sendNotification({
    type: 'artist_update',
    userId,
    data: artistData,
    priority: 'medium',
    channels: ['email', 'push']
  });
};

export const sendVoteMilestone = async (userId: string, voteData: any) => {
  await notificationSystem.sendNotification({
    type: 'vote_milestone',
    userId,
    data: voteData,
    priority: 'low',
    channels: ['push', 'in_app']
  });
};

export const sendTrendingAlert = async (userId: string, trendingData: any) => {
  await notificationSystem.sendNotification({
    type: 'trending_alert',
    userId,
    data: trendingData,
    priority: 'medium',
    channels: ['push', 'in_app']
  });
};