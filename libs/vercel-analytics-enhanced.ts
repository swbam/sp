/**
 * Enhanced Vercel Analytics Integration for MySetlist
 * Real-time performance monitoring with custom event tracking
 */

import { track } from '@vercel/analytics';
import { supabaseAdmin } from './supabaseAdmin';
import { realTimeAnalytics } from './real-time-analytics';
import type { Database } from '@/types_db';

// Enhanced Analytics Events
export interface CustomAnalyticsEvent {
  name: string;
  data: Record<string, any>;
  timestamp: Date;
  sessionId: string;
  userId?: string;
  pageUrl?: string;
  referrer?: string;
  userAgent?: string;
  deviceType?: 'desktop' | 'mobile' | 'tablet';
  location?: {
    country?: string;
    region?: string;
    city?: string;
  };
  performance?: {
    lcp?: number;
    fcp?: number;
    cls?: number;
    fid?: number;
    ttfb?: number;
    loadTime?: number;
    renderTime?: number;
  };
}

export interface ConversionFunnelStep {
  step: string;
  description: string;
  required: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface UserJourney {
  sessionId: string;
  userId?: string;
  startTime: Date;
  endTime?: Date;
  pages: Array<{
    path: string;
    title: string;
    timeSpent: number;
    interactions: number;
    exitPage: boolean;
  }>;
  conversions: Array<{
    type: 'vote' | 'follow' | 'share' | 'signup' | 'show_view';
    timestamp: Date;
    value?: number;
  }>;
  funnelSteps: ConversionFunnelStep[];
  totalTimeSpent: number;
  bounced: boolean;
  exitReason?: 'timeout' | 'navigation' | 'close' | 'error';
}

export interface PerformanceVitals {
  sessionId: string;
  userId?: string;
  pageUrl: string;
  timestamp: Date;
  metrics: {
    lcp: number;
    fcp: number;
    cls: number;
    fid: number;
    ttfb: number;
    domContentLoaded: number;
    windowLoad: number;
    firstPaint: number;
    navigationStart: number;
  };
  resources: Array<{
    name: string;
    type: string;
    size: number;
    duration: number;
    startTime: number;
  }>;
  networkInfo: {
    effectiveType: string;
    downlink: number;
    rtt: number;
    saveData: boolean;
  };
  deviceInfo: {
    type: 'desktop' | 'mobile' | 'tablet';
    os: string;
    browser: string;
    screenResolution: string;
    pixelRatio: number;
  };
}

export interface BusinessMetrics {
  timestamp: Date;
  metrics: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    newUserSignups: number;
    userRetentionRate: number;
    averageSessionDuration: number;
    bounceRate: number;
    pageViewsPerSession: number;
    conversionRate: number;
    votesPerUser: number;
    artistFollowsPerUser: number;
    topPerformingContent: Array<{
      type: 'artist' | 'show' | 'song';
      id: string;
      name: string;
      views: number;
      engagement: number;
    }>;
    revenueMetrics: {
      totalRevenue: number;
      averageRevenuePerUser: number;
      monthlyRecurringRevenue: number;
      churnRate: number;
    };
  };
  segments: {
    userSegments: Array<{
      name: string;
      count: number;
      percentage: number;
      avgSessionDuration: number;
      conversionRate: number;
    }>;
    geographicSegments: Array<{
      country: string;
      users: number;
      percentage: number;
      topArtists: string[];
    }>;
    deviceSegments: Array<{
      type: 'desktop' | 'mobile' | 'tablet';
      users: number;
      percentage: number;
      avgSessionDuration: number;
    }>;
  };
}

// Enhanced Analytics Service
export class VercelAnalyticsEnhanced {
  private static instance: VercelAnalyticsEnhanced;
  private sessionId: string;
  private userId?: string;
  private currentJourney: UserJourney | null = null;
  private performanceBuffer: PerformanceVitals[] = [];
  private eventBuffer: CustomAnalyticsEvent[] = [];
  private conversionFunnels: Map<string, ConversionFunnelStep[]> = new Map();
  
  // Performance thresholds
  private readonly PERFORMANCE_THRESHOLDS = {
    lcp: 2500,
    fcp: 1800,
    cls: 0.1,
    fid: 100,
    ttfb: 800
  };

  constructor() {
    this.sessionId = this.generateSessionId();
    this.initializeTracking();
  }

  static getInstance(): VercelAnalyticsEnhanced {
    if (!VercelAnalyticsEnhanced.instance) {
      VercelAnalyticsEnhanced.instance = new VercelAnalyticsEnhanced();
    }
    return VercelAnalyticsEnhanced.instance;
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeTracking(): void {
    // Initialize user journey tracking
    this.startUserJourney();
    
    // Set up performance monitoring
    this.initializePerformanceMonitoring();
    
    // Set up conversion funnel tracking
    this.initializeConversionFunnels();
    
    // Set up periodic data flushing
    setInterval(() => {
      this.flushBuffers();
    }, 30000); // Flush every 30 seconds
    
    // Set up page unload tracking
    window.addEventListener('beforeunload', () => {
      this.endUserJourney();
      this.flushBuffers();
    });
  }

  /**
   * Track custom analytics event
   */
  async trackCustomEvent(event: Omit<CustomAnalyticsEvent, 'timestamp' | 'sessionId'>): Promise<void> {
    const enhancedEvent: CustomAnalyticsEvent = {
      ...event,
      timestamp: new Date(),
      sessionId: this.sessionId,
      userId: this.userId
    };

    // Add to buffer
    this.eventBuffer.push(enhancedEvent);

    // Track with Vercel Analytics
    await track(event.name, {
      ...event.data,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: enhancedEvent.timestamp.toISOString()
    });

    // Update user journey
    this.updateUserJourney(enhancedEvent);

    // Track with real-time analytics
    await realTimeAnalytics.trackEvent({
      type: this.mapEventTypeToAnalytics(event.name),
      sessionId: this.sessionId,
      userId: this.userId,
      entityId: event.data.entityId,
      entityType: event.data.entityType,
      metadata: event.data,
      userAgent: event.userAgent,
      pageUrl: event.pageUrl
    });
  }

  /**
   * Track conversion funnel step
   */
  async trackFunnelStep(funnelName: string, step: ConversionFunnelStep): Promise<void> {
    const funnelSteps = this.conversionFunnels.get(funnelName) || [];
    funnelSteps.push(step);
    this.conversionFunnels.set(funnelName, funnelSteps);

    // Track with Vercel Analytics
    await track('funnel_step', {
      funnelName,
      step: step.step,
      description: step.description,
      required: step.required,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: step.timestamp.toISOString()
    });

    // Update user journey
    if (this.currentJourney) {
      this.currentJourney.funnelSteps.push(step);
    }
  }

  /**
   * Track user conversion
   */
  async trackConversion(type: 'vote' | 'follow' | 'share' | 'signup' | 'show_view', value?: number): Promise<void> {
    const conversion = {
      type,
      timestamp: new Date(),
      value
    };

    // Add to current journey
    if (this.currentJourney) {
      this.currentJourney.conversions.push(conversion);
    }

    // Track with Vercel Analytics
    await track('conversion', {
      type,
      value,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: conversion.timestamp.toISOString()
    });

    // Track specific conversion events
    await this.trackCustomEvent({
      name: `conversion_${type}`,
      data: {
        type,
        value,
        entityId: value?.toString(),
        entityType: type
      },
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      deviceType: this.detectDeviceType()
    });
  }

  /**
   * Track performance vitals
   */
  async trackPerformanceVitals(vitals: Omit<PerformanceVitals, 'sessionId' | 'userId' | 'timestamp'>): Promise<void> {
    const enhancedVitals: PerformanceVitals = {
      ...vitals,
      sessionId: this.sessionId,
      userId: this.userId,
      timestamp: new Date()
    };

    this.performanceBuffer.push(enhancedVitals);

    // Track with Vercel Analytics
    await track('performance_vitals', {
      ...vitals.metrics,
      sessionId: this.sessionId,
      userId: this.userId,
      pageUrl: vitals.pageUrl
    });

    // Check performance thresholds and create alerts
    await this.checkPerformanceThresholds(enhancedVitals);
  }

  /**
   * Track page view with enhanced data
   */
  async trackPageView(path: string, title: string, additionalData?: Record<string, any>): Promise<void> {
    const pageView = {
      path,
      title,
      timeSpent: 0,
      interactions: 0,
      exitPage: false
    };

    // Add to current journey
    if (this.currentJourney) {
      this.currentJourney.pages.push(pageView);
    }

    // Track with enhanced data
    await this.trackCustomEvent({
      name: 'page_view',
      data: {
        path,
        title,
        referrer: document.referrer,
        ...additionalData
      },
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      deviceType: this.detectDeviceType()
    });
  }

  /**
   * Track user interaction
   */
  async trackInteraction(element: string, action: string, data?: Record<string, any>): Promise<void> {
    // Update current page interaction count
    if (this.currentJourney && this.currentJourney.pages.length > 0) {
      const currentPage = this.currentJourney.pages[this.currentJourney.pages.length - 1];
      currentPage.interactions++;
    }

    await this.trackCustomEvent({
      name: 'user_interaction',
      data: {
        element,
        action,
        ...data
      },
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      deviceType: this.detectDeviceType()
    });
  }

  /**
   * Track error occurrence
   */
  async trackError(error: Error, context?: Record<string, any>): Promise<void> {
    await this.trackCustomEvent({
      name: 'error',
      data: {
        message: error.message,
        stack: error.stack,
        name: error.name,
        context
      },
      pageUrl: window.location.href,
      userAgent: navigator.userAgent,
      deviceType: this.detectDeviceType()
    });
  }

  /**
   * Get current business metrics
   */
  async getBusinessMetrics(): Promise<BusinessMetrics> {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get user metrics
    const { data: userMetrics } = await supabaseAdmin
      .from('user_events')
      .select('user_id, created_at, event_type')
      .gte('created_at', monthAgo.toISOString());

    // Calculate DAU, WAU, MAU
    const dailyActiveUsers = new Set(
      userMetrics?.filter(m => new Date(m.created_at) >= dayAgo).map(m => m.user_id) || []
    ).size;

    const weeklyActiveUsers = new Set(
      userMetrics?.filter(m => new Date(m.created_at) >= weekAgo).map(m => m.user_id) || []
    ).size;

    const monthlyActiveUsers = new Set(
      userMetrics?.filter(m => new Date(m.created_at) >= monthAgo).map(m => m.user_id) || []
    ).size;

    // Get new user signups
    const { count: newUserSignups } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact' })
      .gte('created_at', dayAgo.toISOString());

    // Get session metrics
    const { data: sessionMetrics } = await supabaseAdmin
      .from('user_events')
      .select('session_id, created_at, event_type')
      .gte('created_at', dayAgo.toISOString());

    // Calculate session statistics
    const sessionStats = this.calculateSessionStats(sessionMetrics || []);

    // Get top performing content
    const topPerformingContent = await this.getTopPerformingContent();

    return {
      timestamp: now,
      metrics: {
        dailyActiveUsers,
        weeklyActiveUsers,
        monthlyActiveUsers,
        newUserSignups: newUserSignups || 0,
        userRetentionRate: weeklyActiveUsers > 0 ? (dailyActiveUsers / weeklyActiveUsers) * 100 : 0,
        averageSessionDuration: sessionStats.averageSessionDuration,
        bounceRate: sessionStats.bounceRate,
        pageViewsPerSession: sessionStats.pageViewsPerSession,
        conversionRate: sessionStats.conversionRate,
        votesPerUser: sessionStats.votesPerUser,
        artistFollowsPerUser: sessionStats.artistFollowsPerUser,
        topPerformingContent,
        revenueMetrics: {
          totalRevenue: 0, // Would be calculated from actual revenue data
          averageRevenuePerUser: 0,
          monthlyRecurringRevenue: 0,
          churnRate: 0
        }
      },
      segments: {
        userSegments: await this.getUserSegments(),
        geographicSegments: await this.getGeographicSegments(),
        deviceSegments: await this.getDeviceSegments()
      }
    };
  }

  /**
   * Get conversion funnel analytics
   */
  async getConversionFunnelAnalytics(funnelName: string): Promise<{
    steps: Array<{
      step: string;
      description: string;
      users: number;
      conversions: number;
      conversionRate: number;
      dropoffRate: number;
    }>;
    totalConversions: number;
    overallConversionRate: number;
  }> {
    // Get funnel data from database
    const { data: funnelData } = await supabaseAdmin
      .from('conversion_funnel_events')
      .select('*')
      .eq('funnel_name', funnelName)
      .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Process funnel data
    const stepStats = new Map<string, { users: Set<string>; conversions: number }>();

    funnelData?.forEach(event => {
      if (!stepStats.has(event.step)) {
        stepStats.set(event.step, { users: new Set(), conversions: 0 });
      }
      const stats = stepStats.get(event.step)!;
      stats.users.add(event.user_id);
      if (event.converted) {
        stats.conversions++;
      }
    });

    // Calculate step analytics
    const steps = Array.from(stepStats.entries()).map(([step, stats], index) => {
      const users = stats.users.size;
      const conversions = stats.conversions;
      const conversionRate = users > 0 ? (conversions / users) * 100 : 0;
      const dropoffRate = index > 0 ? 100 - conversionRate : 0;

      return {
        step,
        description: this.getFunnelStepDescription(step),
        users,
        conversions,
        conversionRate,
        dropoffRate
      };
    });

    const totalUsers = steps.length > 0 ? steps[0].users : 0;
    const totalConversions = steps.length > 0 ? steps[steps.length - 1].conversions : 0;
    const overallConversionRate = totalUsers > 0 ? (totalConversions / totalUsers) * 100 : 0;

    return {
      steps,
      totalConversions,
      overallConversionRate
    };
  }

  /**
   * Set current user
   */
  setUserId(userId: string): void {
    this.userId = userId;
    if (this.currentJourney) {
      this.currentJourney.userId = userId;
    }
  }

  /**
   * Get current session analytics
   */
  getCurrentSessionAnalytics(): {
    sessionId: string;
    userId?: string;
    duration: number;
    pageViews: number;
    interactions: number;
    conversions: number;
    lastActivity: Date;
  } {
    const journey = this.currentJourney;
    if (!journey) {
      return {
        sessionId: this.sessionId,
        userId: this.userId,
        duration: 0,
        pageViews: 0,
        interactions: 0,
        conversions: 0,
        lastActivity: new Date()
      };
    }

    return {
      sessionId: this.sessionId,
      userId: this.userId,
      duration: journey.totalTimeSpent,
      pageViews: journey.pages.length,
      interactions: journey.pages.reduce((sum, page) => sum + page.interactions, 0),
      conversions: journey.conversions.length,
      lastActivity: new Date()
    };
  }

  // Private helper methods
  private startUserJourney(): void {
    this.currentJourney = {
      sessionId: this.sessionId,
      userId: this.userId,
      startTime: new Date(),
      pages: [],
      conversions: [],
      funnelSteps: [],
      totalTimeSpent: 0,
      bounced: false
    };
  }

  private endUserJourney(): void {
    if (this.currentJourney) {
      this.currentJourney.endTime = new Date();
      this.currentJourney.totalTimeSpent = this.currentJourney.endTime.getTime() - this.currentJourney.startTime.getTime();
      this.currentJourney.bounced = this.currentJourney.pages.length <= 1;
      
      // Mark last page as exit page
      if (this.currentJourney.pages.length > 0) {
        this.currentJourney.pages[this.currentJourney.pages.length - 1].exitPage = true;
      }
    }
  }

  private updateUserJourney(event: CustomAnalyticsEvent): void {
    if (!this.currentJourney) return;

    // Update page time spent
    if (this.currentJourney.pages.length > 0) {
      const currentPage = this.currentJourney.pages[this.currentJourney.pages.length - 1];
      currentPage.timeSpent = event.timestamp.getTime() - this.currentJourney.startTime.getTime();
    }
  }

  private initializePerformanceMonitoring(): void {
    // Monitor Core Web Vitals
    if (typeof window !== 'undefined' && 'performance' in window) {
      // LCP (Largest Contentful Paint)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.trackPerformanceVitals({
          pageUrl: window.location.href,
          metrics: {
            lcp: lastEntry.startTime,
            fcp: 0,
            cls: 0,
            fid: 0,
            ttfb: 0,
            domContentLoaded: 0,
            windowLoad: 0,
            firstPaint: 0,
            navigationStart: 0
          },
          resources: [],
          networkInfo: {
            effectiveType: 'unknown',
            downlink: 0,
            rtt: 0,
            saveData: false
          },
          deviceInfo: {
            type: this.detectDeviceType(),
            os: navigator.platform,
            browser: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            pixelRatio: window.devicePixelRatio
          }
        });
      }).observe({ entryTypes: ['largest-contentful-paint'] });

      // FCP (First Contentful Paint)
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach(entry => {
          if (entry.name === 'first-contentful-paint') {
            this.trackPerformanceVitals({
              pageUrl: window.location.href,
              metrics: {
                lcp: 0,
                fcp: entry.startTime,
                cls: 0,
                fid: 0,
                ttfb: 0,
                domContentLoaded: 0,
                windowLoad: 0,
                firstPaint: 0,
                navigationStart: 0
              },
              resources: [],
              networkInfo: {
                effectiveType: 'unknown',
                downlink: 0,
                rtt: 0,
                saveData: false
              },
              deviceInfo: {
                type: this.detectDeviceType(),
                os: navigator.platform,
                browser: navigator.userAgent,
                screenResolution: `${screen.width}x${screen.height}`,
                pixelRatio: window.devicePixelRatio
              }
            });
          }
        });
      }).observe({ entryTypes: ['paint'] });

      // CLS (Cumulative Layout Shift)
      new PerformanceObserver((list) => {
        let clsScore = 0;
        list.getEntries().forEach(entry => {
          if (!(entry as any).hadRecentInput) {
            clsScore += (entry as any).value;
          }
        });
        
        this.trackPerformanceVitals({
          pageUrl: window.location.href,
          metrics: {
            lcp: 0,
            fcp: 0,
            cls: clsScore,
            fid: 0,
            ttfb: 0,
            domContentLoaded: 0,
            windowLoad: 0,
            firstPaint: 0,
            navigationStart: 0
          },
          resources: [],
          networkInfo: {
            effectiveType: 'unknown',
            downlink: 0,
            rtt: 0,
            saveData: false
          },
          deviceInfo: {
            type: this.detectDeviceType(),
            os: navigator.platform,
            browser: navigator.userAgent,
            screenResolution: `${screen.width}x${screen.height}`,
            pixelRatio: window.devicePixelRatio
          }
        });
      }).observe({ entryTypes: ['layout-shift'] });

      // FID (First Input Delay)
      new PerformanceObserver((list) => {
        list.getEntries().forEach(entry => {
          this.trackPerformanceVitals({
            pageUrl: window.location.href,
            metrics: {
              lcp: 0,
              fcp: 0,
              cls: 0,
              fid: (entry as any).processingStart - entry.startTime,
              ttfb: 0,
              domContentLoaded: 0,
              windowLoad: 0,
              firstPaint: 0,
              navigationStart: 0
            },
            resources: [],
            networkInfo: {
              effectiveType: 'unknown',
              downlink: 0,
              rtt: 0,
              saveData: false
            },
            deviceInfo: {
              type: this.detectDeviceType(),
              os: navigator.platform,
              browser: navigator.userAgent,
              screenResolution: `${screen.width}x${screen.height}`,
              pixelRatio: window.devicePixelRatio
            }
          });
        });
      }).observe({ entryTypes: ['first-input'] });
    }
  }

  private initializeConversionFunnels(): void {
    // Define standard conversion funnels
    this.conversionFunnels.set('signup', []);
    this.conversionFunnels.set('vote', []);
    this.conversionFunnels.set('follow_artist', []);
    this.conversionFunnels.set('share_show', []);
  }

  private detectDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    if (typeof window === 'undefined') return 'desktop';
    
    const width = window.innerWidth;
    if (width < 768) return 'mobile';
    if (width < 1024) return 'tablet';
    return 'desktop';
  }

  private mapEventTypeToAnalytics(eventName: string): 'vote' | 'view' | 'search' | 'follow' | 'share' | 'session_start' | 'session_end' {
    const mapping: Record<string, 'vote' | 'view' | 'search' | 'follow' | 'share' | 'session_start' | 'session_end'> = {
      'vote': 'vote',
      'page_view': 'view',
      'search': 'search',
      'follow': 'follow',
      'share': 'share',
      'session_start': 'session_start',
      'session_end': 'session_end'
    };
    return mapping[eventName] || 'view';
  }

  private async checkPerformanceThresholds(vitals: PerformanceVitals): Promise<void> {
    const alerts = [];

    if (vitals.metrics.lcp > this.PERFORMANCE_THRESHOLDS.lcp) {
      alerts.push({
        type: 'performance',
        severity: 'high',
        metric: 'LCP',
        value: vitals.metrics.lcp,
        threshold: this.PERFORMANCE_THRESHOLDS.lcp
      });
    }

    if (vitals.metrics.fcp > this.PERFORMANCE_THRESHOLDS.fcp) {
      alerts.push({
        type: 'performance',
        severity: 'medium',
        metric: 'FCP',
        value: vitals.metrics.fcp,
        threshold: this.PERFORMANCE_THRESHOLDS.fcp
      });
    }

    if (vitals.metrics.cls > this.PERFORMANCE_THRESHOLDS.cls) {
      alerts.push({
        type: 'performance',
        severity: 'high',
        metric: 'CLS',
        value: vitals.metrics.cls,
        threshold: this.PERFORMANCE_THRESHOLDS.cls
      });
    }

    if (vitals.metrics.fid > this.PERFORMANCE_THRESHOLDS.fid) {
      alerts.push({
        type: 'performance',
        severity: 'medium',
        metric: 'FID',
        value: vitals.metrics.fid,
        threshold: this.PERFORMANCE_THRESHOLDS.fid
      });
    }

    // Log alerts
    if (alerts.length > 0) {
      console.warn('Performance thresholds exceeded:', alerts);
      
      // Send alerts to monitoring system
      for (const alert of alerts) {
        await this.trackCustomEvent({
          name: 'performance_alert',
          data: alert,
          pageUrl: vitals.pageUrl,
          deviceType: vitals.deviceInfo.type
        });
      }
    }
  }

  private calculateSessionStats(events: any[]): {
    averageSessionDuration: number;
    bounceRate: number;
    pageViewsPerSession: number;
    conversionRate: number;
    votesPerUser: number;
    artistFollowsPerUser: number;
  } {
    const sessionGroups = new Map<string, any[]>();
    
    events.forEach(event => {
      if (!sessionGroups.has(event.session_id)) {
        sessionGroups.set(event.session_id, []);
      }
      sessionGroups.get(event.session_id)!.push(event);
    });

    const sessions = Array.from(sessionGroups.values());
    const totalSessions = sessions.length;
    
    if (totalSessions === 0) {
      return {
        averageSessionDuration: 0,
        bounceRate: 0,
        pageViewsPerSession: 0,
        conversionRate: 0,
        votesPerUser: 0,
        artistFollowsPerUser: 0
      };
    }

    const sessionDurations = sessions.map(session => {
      const start = new Date(session[0].created_at);
      const end = new Date(session[session.length - 1].created_at);
      return end.getTime() - start.getTime();
    });

    const averageSessionDuration = sessionDurations.reduce((sum, duration) => sum + duration, 0) / totalSessions;
    const bouncedSessions = sessions.filter(session => session.length === 1).length;
    const bounceRate = (bouncedSessions / totalSessions) * 100;

    const totalPageViews = events.filter(event => event.event_type === 'page_view').length;
    const pageViewsPerSession = totalPageViews / totalSessions;

    const totalConversions = events.filter(event => ['vote', 'follow', 'share'].includes(event.event_type)).length;
    const conversionRate = (totalConversions / totalSessions) * 100;

    const totalVotes = events.filter(event => event.event_type === 'vote').length;
    const votesPerUser = totalVotes / totalSessions;

    const totalFollows = events.filter(event => event.event_type === 'follow').length;
    const artistFollowsPerUser = totalFollows / totalSessions;

    return {
      averageSessionDuration,
      bounceRate,
      pageViewsPerSession,
      conversionRate,
      votesPerUser,
      artistFollowsPerUser
    };
  }

  private async getTopPerformingContent(): Promise<BusinessMetrics['metrics']['topPerformingContent']> {
    // Get top performing artists
    const { data: topArtists } = await supabaseAdmin
      .from('artists')
      .select('id, name, user_artists(count)')
      .order('created_at', { ascending: false })
      .limit(10);

    // Get top performing shows
    const { data: topShows } = await supabaseAdmin
      .from('shows')
      .select('id, name, setlists(setlist_songs(upvotes, downvotes))')
      .order('date', { ascending: false })
      .limit(10);

    const topPerformingContent: BusinessMetrics['metrics']['topPerformingContent'] = [];

    // Add top artists
    topArtists?.forEach(artist => {
      topPerformingContent.push({
        type: 'artist',
        id: artist.id,
        name: artist.name,
        views: 0, // Would calculate from analytics
        engagement: artist.user_artists?.length || 0
      });
    });

    // Add top shows
    topShows?.forEach(show => {
      const totalVotes = show.setlists?.reduce((sum, setlist) => 
        sum + (setlist.setlist_songs?.reduce((voteSum, song) => 
          voteSum + (song.upvotes || 0) + (song.downvotes || 0), 0) || 0), 0) || 0;
      
      topPerformingContent.push({
        type: 'show',
        id: show.id,
        name: show.name,
        views: 0, // Would calculate from analytics
        engagement: totalVotes
      });
    });

    return topPerformingContent;
  }

  private async getUserSegments(): Promise<BusinessMetrics['segments']['userSegments']> {
    // This would be calculated from actual user data
    return [
      {
        name: 'New Users',
        count: 0,
        percentage: 0,
        avgSessionDuration: 0,
        conversionRate: 0
      },
      {
        name: 'Active Users',
        count: 0,
        percentage: 0,
        avgSessionDuration: 0,
        conversionRate: 0
      },
      {
        name: 'Power Users',
        count: 0,
        percentage: 0,
        avgSessionDuration: 0,
        conversionRate: 0
      }
    ];
  }

  private async getGeographicSegments(): Promise<BusinessMetrics['segments']['geographicSegments']> {
    // This would be calculated from actual geographic data
    return [];
  }

  private async getDeviceSegments(): Promise<BusinessMetrics['segments']['deviceSegments']> {
    // This would be calculated from actual device data
    return [
      {
        type: 'desktop',
        users: 0,
        percentage: 0,
        avgSessionDuration: 0
      },
      {
        type: 'mobile',
        users: 0,
        percentage: 0,
        avgSessionDuration: 0
      },
      {
        type: 'tablet',
        users: 0,
        percentage: 0,
        avgSessionDuration: 0
      }
    ];
  }

  private getFunnelStepDescription(step: string): string {
    const descriptions: Record<string, string> = {
      'landing': 'User visits the site',
      'signup': 'User creates an account',
      'onboarding': 'User completes onboarding',
      'first_vote': 'User casts their first vote',
      'follow_artist': 'User follows an artist',
      'share': 'User shares content'
    };
    return descriptions[step] || step;
  }

  private async flushBuffers(): Promise<void> {
    // Flush event buffer
    if (this.eventBuffer.length > 0) {
      try {
        await supabaseAdmin
          .from('custom_analytics_events')
          .insert(this.eventBuffer.map(event => ({
            name: event.name,
            data: event.data,
            session_id: event.sessionId,
            user_id: event.userId,
            page_url: event.pageUrl,
            user_agent: event.userAgent,
            device_type: event.deviceType,
            timestamp: event.timestamp.toISOString()
          })));
        
        this.eventBuffer = [];
      } catch (error) {
        console.error('Error flushing event buffer:', error);
      }
    }

    // Flush performance buffer
    if (this.performanceBuffer.length > 0) {
      try {
        await supabaseAdmin
          .from('performance_vitals')
          .insert(this.performanceBuffer.map(vitals => ({
            session_id: vitals.sessionId,
            user_id: vitals.userId,
            page_url: vitals.pageUrl,
            metrics: vitals.metrics,
            resources: vitals.resources,
            network_info: vitals.networkInfo,
            device_info: vitals.deviceInfo,
            timestamp: vitals.timestamp.toISOString()
          })));
        
        this.performanceBuffer = [];
      } catch (error) {
        console.error('Error flushing performance buffer:', error);
      }
    }

    // Flush user journey
    if (this.currentJourney) {
      try {
        await supabaseAdmin
          .from('user_journeys')
          .upsert({
            session_id: this.currentJourney.sessionId,
            user_id: this.currentJourney.userId,
            start_time: this.currentJourney.startTime.toISOString(),
            end_time: this.currentJourney.endTime?.toISOString(),
            pages: this.currentJourney.pages,
            conversions: this.currentJourney.conversions,
            funnel_steps: this.currentJourney.funnelSteps,
            total_time_spent: this.currentJourney.totalTimeSpent,
            bounced: this.currentJourney.bounced,
            exit_reason: this.currentJourney.exitReason
          });
      } catch (error) {
        console.error('Error flushing user journey:', error);
      }
    }
  }
}

// Export singleton instance
export const vercelAnalytics = VercelAnalyticsEnhanced.getInstance();

// Convenience functions for common tracking
export const trackVote = (songId: string, voteType: 'up' | 'down') => {
  vercelAnalytics.trackCustomEvent({
    name: 'vote',
    data: {
      entityId: songId,
      entityType: 'song',
      voteType
    }
  });
  vercelAnalytics.trackConversion('vote');
};

export const trackArtistFollow = (artistId: string, artistName: string) => {
  vercelAnalytics.trackCustomEvent({
    name: 'follow',
    data: {
      entityId: artistId,
      entityType: 'artist',
      artistName
    }
  });
  vercelAnalytics.trackConversion('follow');
};

export const trackShowView = (showId: string, showName: string) => {
  vercelAnalytics.trackCustomEvent({
    name: 'show_view',
    data: {
      entityId: showId,
      entityType: 'show',
      showName
    }
  });
  vercelAnalytics.trackConversion('show_view');
};

export const trackSearch = (query: string, results: number) => {
  vercelAnalytics.trackCustomEvent({
    name: 'search',
    data: {
      query,
      results
    }
  });
};

export const trackShare = (entityType: 'show' | 'artist', entityId: string, platform: string) => {
  vercelAnalytics.trackCustomEvent({
    name: 'share',
    data: {
      entityId,
      entityType,
      platform
    }
  });
  vercelAnalytics.trackConversion('share');
};