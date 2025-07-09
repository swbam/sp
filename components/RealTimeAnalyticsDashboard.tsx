'use client';

import { useState, useEffect, useCallback } from 'react';
import { realTimeAnalytics } from '@/libs/real-time-analytics';
import { vercelAnalytics } from '@/libs/vercel-analytics-enhanced';
import { notificationSystem } from '@/libs/notification-system';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Activity, 
  Users, 
  TrendingUp, 
  Vote, 
  Clock, 
  AlertTriangle,
  Eye,
  Zap,
  Globe,
  Smartphone,
  Monitor,
  Mail,
  Bell,
  Target
} from 'lucide-react';
import type { 
  RealTimeMetrics, 
  AnalyticsAlert, 
  PredictionInsight 
} from '@/libs/real-time-analytics';
import type { BusinessMetrics } from '@/libs/vercel-analytics-enhanced';

interface RealTimeAnalyticsDashboardProps {
  adminMode?: boolean;
}

export const RealTimeAnalyticsDashboard: React.FC<RealTimeAnalyticsDashboardProps> = ({ 
  adminMode = false 
}) => {
  const [metrics, setMetrics] = useState<RealTimeMetrics | null>(null);
  const [businessMetrics, setBusinessMetrics] = useState<BusinessMetrics | null>(null);
  const [alerts, setAlerts] = useState<AnalyticsAlert[]>([]);
  const [insights, setInsights] = useState<PredictionInsight[]>([]);
  const [notificationAnalytics, setNotificationAnalytics] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Load initial data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        const [
          realTimeData,
          businessData,
          alertsData,
          insightsData,
          notificationData
        ] = await Promise.all([
          realTimeAnalytics.getRealTimeMetrics(),
          vercelAnalytics.getBusinessMetrics(),
          realTimeAnalytics.getActiveAlerts(),
          realTimeAnalytics.getInsights(selectedTimeframe),
          notificationSystem.getNotificationAnalytics(selectedTimeframe)
        ]);

        setMetrics(realTimeData);
        setBusinessMetrics(businessData);
        setAlerts(alertsData);
        setInsights(insightsData);
        setNotificationAnalytics(notificationData);
      } catch (error) {
        console.error('Error loading analytics data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedTimeframe]);

  // Set up real-time updates
  useEffect(() => {
    if (!autoRefresh) return;

    const unsubscribe = realTimeAnalytics.subscribeToMetrics((newMetrics) => {
      setMetrics(newMetrics);
    });

    const interval = setInterval(async () => {
      try {
        const [businessData, alertsData, insightsData] = await Promise.all([
          vercelAnalytics.getBusinessMetrics(),
          realTimeAnalytics.getActiveAlerts(),
          realTimeAnalytics.getInsights(selectedTimeframe)
        ]);

        setBusinessMetrics(businessData);
        setAlerts(alertsData);
        setInsights(insightsData);
      } catch (error) {
        console.error('Error updating analytics data:', error);
      }
    }, 30000); // Update every 30 seconds

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [autoRefresh, selectedTimeframe]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const formatDuration = (ms: number): string => {
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const getAlertIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'high':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'medium':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'trend':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'engagement':
        return <Users className="h-4 w-4 text-blue-500" />;
      case 'content':
        return <Target className="h-4 w-4 text-purple-500" />;
      default:
        return <Activity className="h-4 w-4 text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-white">Real-Time Analytics</h1>
          <p className="text-gray-400">Live insights and performance metrics</p>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400">Timeframe:</span>
            <select
              value={selectedTimeframe}
              onChange={(e) => setSelectedTimeframe(e.target.value as any)}
              className="bg-gray-800 text-white px-3 py-1 rounded border border-gray-700"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          <Button
            onClick={() => setAutoRefresh(!autoRefresh)}
            variant={autoRefresh ? "default" : "outline"}
            size="sm"
          >
            {autoRefresh ? 'Auto-refresh ON' : 'Auto-refresh OFF'}
          </Button>
        </div>
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-white mb-4">Active Alerts</h2>
          {alerts.slice(0, 3).map((alert) => (
            <Alert key={alert.id} className="bg-red-900/20 border-red-500/50">
              <div className="flex items-center space-x-2">
                {getAlertIcon(alert.severity)}
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{alert.title}</span>
                    <Badge variant={alert.severity === 'critical' ? 'destructive' : 'secondary'}>
                      {alert.severity}
                    </Badge>
                  </div>
                  <AlertDescription className="text-sm text-gray-300 mt-1">
                    {alert.message}
                  </AlertDescription>
                </div>
              </div>
            </Alert>
          ))}
        </div>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="realtime">Real-Time</TabsTrigger>
          <TabsTrigger value="business">Business</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Active Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(metrics?.activeUsers || 0)}</div>
                <p className="text-xs text-muted-foreground">
                  {businessMetrics?.metrics.dailyActiveUsers || 0} daily active
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Votes/Minute</CardTitle>
                <Vote className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(metrics?.votesPerSecond || 0).toFixed(1)}</div>
                <p className="text-xs text-muted-foreground">
                  {formatNumber(metrics?.totalVotes || 0)} total votes
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Session Duration</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatDuration(businessMetrics?.metrics.averageSessionDuration || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {(businessMetrics?.metrics.bounceRate || 0).toFixed(1)}% bounce rate
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">System Health</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {(metrics?.systemHealth.responseTime || 0).toFixed(0)}ms
                </div>
                <p className="text-xs text-muted-foreground">
                  {(metrics?.systemHealth.errorRate || 0).toFixed(2)}% error rate
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Top Shows */}
          <Card>
            <CardHeader>
              <CardTitle>Top Shows</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {metrics?.topShows.slice(0, 5).map((show, index) => (
                  <div key={show.id} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center text-xs font-bold">
                        {index + 1}
                      </div>
                      <div>
                        <p className="font-medium">{show.name}</p>
                        <p className="text-sm text-gray-400">{show.artist}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="secondary">{formatNumber(show.votes)} votes</Badge>
                      <div className={`w-2 h-2 rounded-full ${
                        show.trend === 'up' ? 'bg-green-500' : 
                        show.trend === 'down' ? 'bg-red-500' : 'bg-gray-500'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Real-Time Tab */}
        <TabsContent value="realtime" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Live Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span>Votes per second</span>
                    <span className="text-2xl font-bold text-green-500">
                      {(metrics?.votesPerSecond || 0).toFixed(1)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Active users</span>
                    <span className="text-2xl font-bold text-blue-500">
                      {formatNumber(metrics?.activeUsers || 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Response time</span>
                    <span className="text-2xl font-bold text-purple-500">
                      {(metrics?.systemHealth.responseTime || 0).toFixed(0)}ms
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Trending Artists</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {metrics?.trendingArtists.slice(0, 5).map((artist, index) => (
                    <div key={artist.id} className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="w-6 h-6 bg-purple-500 rounded-full flex items-center justify-center text-xs font-bold">
                          {index + 1}
                        </div>
                        <span className="font-medium">{artist.name}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant="outline">{formatNumber(artist.followers)} followers</Badge>
                        <span className="text-sm text-green-500">
                          +{artist.growthRate.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>System Health</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Response Time</span>
                      <span>{(metrics?.systemHealth.responseTime || 0).toFixed(0)}ms</span>
                    </div>
                    <Progress value={Math.min((metrics?.systemHealth.responseTime || 0) / 10, 100)} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Error Rate</span>
                      <span>{(metrics?.systemHealth.errorRate || 0).toFixed(2)}%</span>
                    </div>
                    <Progress value={metrics?.systemHealth.errorRate || 0} />
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Throughput</span>
                      <span>{formatNumber(metrics?.systemHealth.throughput || 0)} req/s</span>
                    </div>
                    <Progress value={Math.min((metrics?.systemHealth.throughput || 0) / 100, 100)} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>{(metrics?.systemHealth.memoryUsage || 0).toFixed(1)}%</span>
                    </div>
                    <Progress value={metrics?.systemHealth.memoryUsage || 0} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Tab */}
        <TabsContent value="business" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>User Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Daily Active Users</span>
                  <span className="font-bold">{formatNumber(businessMetrics?.metrics.dailyActiveUsers || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Weekly Active Users</span>
                  <span className="font-bold">{formatNumber(businessMetrics?.metrics.weeklyActiveUsers || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Monthly Active Users</span>
                  <span className="font-bold">{formatNumber(businessMetrics?.metrics.monthlyActiveUsers || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">New Signups</span>
                  <span className="font-bold">{formatNumber(businessMetrics?.metrics.newUserSignups || 0)}</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Engagement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Avg Session Duration</span>
                  <span className="font-bold">{formatDuration(businessMetrics?.metrics.averageSessionDuration || 0)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Bounce Rate</span>
                  <span className="font-bold">{(businessMetrics?.metrics.bounceRate || 0).toFixed(1)}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Pages/Session</span>
                  <span className="font-bold">{(businessMetrics?.metrics.pageViewsPerSession || 0).toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Conversion Rate</span>
                  <span className="font-bold">{(businessMetrics?.metrics.conversionRate || 0).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>User Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Votes per User</span>
                  <span className="font-bold">{(businessMetrics?.metrics.votesPerUser || 0).toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Artist Follows/User</span>
                  <span className="font-bold">{(businessMetrics?.metrics.artistFollowsPerUser || 0).toFixed(1)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Retention Rate</span>
                  <span className="font-bold">{(businessMetrics?.metrics.userRetentionRate || 0).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Device Segments */}
          <Card>
            <CardHeader>
              <CardTitle>Device Segments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {businessMetrics?.segments.deviceSegments.map((segment) => (
                  <div key={segment.type} className="text-center">
                    <div className="mb-2">
                      {segment.type === 'desktop' && <Monitor className="h-8 w-8 mx-auto text-blue-500" />}
                      {segment.type === 'mobile' && <Smartphone className="h-8 w-8 mx-auto text-green-500" />}
                      {segment.type === 'tablet' && <Globe className="h-8 w-8 mx-auto text-purple-500" />}
                    </div>
                    <div className="font-bold text-lg">{formatNumber(segment.users)}</div>
                    <div className="text-sm text-gray-400">{segment.type}</div>
                    <div className="text-xs text-gray-500">{segment.percentage.toFixed(1)}%</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Sent</CardTitle>
                <Mail className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatNumber(notificationAnalytics?.totalSent || 0)}</div>
                <p className="text-xs text-muted-foreground">notifications sent</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Delivery Rate</CardTitle>
                <Zap className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(notificationAnalytics?.deliveryRate || 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">successful deliveries</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Open Rate</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(notificationAnalytics?.openRate || 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">notifications opened</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Click Rate</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{(notificationAnalytics?.clickRate || 0).toFixed(1)}%</div>
                <p className="text-xs text-muted-foreground">notifications clicked</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>By Channel</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(notificationAnalytics?.byChannel || {}).map(([channel, count]) => (
                    <div key={channel} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {channel === 'email' && <Mail className="h-4 w-4 text-blue-500" />}
                        {channel === 'push' && <Bell className="h-4 w-4 text-green-500" />}
                        {channel === 'in_app' && <Activity className="h-4 w-4 text-purple-500" />}
                        <span className="capitalize">{channel}</span>
                      </div>
                      <span className="font-bold">{formatNumber(count as number)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>By Type</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Object.entries(notificationAnalytics?.byType || {}).map(([type, count]) => (
                    <div key={type} className="flex items-center justify-between">
                      <span className="capitalize">{type.replace('_', ' ')}</span>
                      <span className="font-bold">{formatNumber(count as number)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Insights Tab */}
        <TabsContent value="insights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>AI-Powered Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {insights.map((insight, index) => (
                  <div key={index} className="border border-gray-700 rounded-lg p-4">
                    <div className="flex items-start space-x-3">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium">{insight.prediction}</h4>
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline">{insight.type}</Badge>
                            <Badge variant={insight.impact === 'high' ? 'destructive' : 'secondary'}>
                              {insight.impact} impact
                            </Badge>
                          </div>
                        </div>
                        <div className="text-sm text-gray-400 mb-2">
                          Confidence: {(insight.confidence * 100).toFixed(0)}% • {insight.timeframe}
                        </div>
                        <div className="text-sm text-gray-300 mb-3">
                          <strong>Evidence:</strong>
                          <ul className="list-disc list-inside mt-1">
                            {insight.evidence.map((evidence, i) => (
                              <li key={i}>{evidence}</li>
                            ))}
                          </ul>
                        </div>
                        <div className="text-sm">
                          <strong>Recommendations:</strong>
                          <ul className="list-disc list-inside mt-1 text-green-400">
                            {insight.recommendations.map((rec, i) => (
                              <li key={i}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Response Times</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Average Response Time</span>
                      <span>{(metrics?.systemHealth.responseTime || 0).toFixed(0)}ms</span>
                    </div>
                    <Progress value={Math.min((metrics?.systemHealth.responseTime || 0) / 10, 100)} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Error Rate</span>
                      <span>{(metrics?.systemHealth.errorRate || 0).toFixed(2)}%</span>
                    </div>
                    <Progress value={metrics?.systemHealth.errorRate || 0} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Throughput</span>
                      <span>{formatNumber(metrics?.systemHealth.throughput || 0)} req/s</span>
                    </div>
                    <Progress value={Math.min((metrics?.systemHealth.throughput || 0) / 100, 100)} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Resources</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Memory Usage</span>
                      <span>{(metrics?.systemHealth.memoryUsage || 0).toFixed(1)}%</span>
                    </div>
                    <Progress value={metrics?.systemHealth.memoryUsage || 0} />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>CPU Usage</span>
                      <span>{(metrics?.systemHealth.cpuUsage || 0).toFixed(1)}%</span>
                    </div>
                    <Progress value={metrics?.systemHealth.cpuUsage || 0} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};