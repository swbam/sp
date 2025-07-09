/**
 * Circuit Breaker and Health Monitoring System for MySetlist
 * Advanced error handling, retry mechanisms, and system reliability
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeout: number;
  monitoringWindow: number;
  halfOpenMaxCalls: number;
  errorTypes: string[];
}

export interface HealthCheckConfig {
  timeout: number;
  retries: number;
  interval: number;
  criticalServices: string[];
}

export interface ServiceHealth {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  responseTime: number;
  errorRate: number;
  uptime: number;
  dependencies: ServiceHealth[];
}

export interface SystemHealthReport {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealth[];
  alerts: HealthAlert[];
  metrics: {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
    uptimePercentage: number;
  };
  timestamp: Date;
}

export interface HealthAlert {
  id: string;
  service: string;
  type: 'warning' | 'error' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  metadata?: Record<string, any>;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttempt = 0;
  private halfOpenCalls = 0;

  constructor(
    private name: string,
    private config: CircuitBreakerConfig
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() > this.nextAttempt) {
        this.state = CircuitState.HALF_OPEN;
        this.halfOpenCalls = 0;
        console.log(`Circuit breaker ${this.name} transitioning to HALF_OPEN`);
      } else {
        throw new Error(`Circuit breaker ${this.name} is OPEN. Service unavailable.`);
      }
    }

    if (this.state === CircuitState.HALF_OPEN && this.halfOpenCalls >= this.config.halfOpenMaxCalls) {
      throw new Error(`Circuit breaker ${this.name} is HALF_OPEN with max calls reached`);
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.CLOSED;
      console.log(`Circuit breaker ${this.name} reset to CLOSED`);
    }
  }

  private onFailure(error: any): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenCalls++;
    }

    // Check if error type should trigger circuit breaker
    const shouldTrip = this.config.errorTypes.length === 0 || 
      this.config.errorTypes.some(errorType => 
        error.message?.includes(errorType) || error.code === errorType
      );

    if (shouldTrip && this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.config.resetTimeout;
      console.log(`Circuit breaker ${this.name} tripped to OPEN state`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttempt = 0;
    this.halfOpenCalls = 0;
  }
}

export class RetryManager {
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000,
    backoffMultiplier: number = 2,
    jitter: boolean = true
  ): Promise<T> {
    let attempt = 0;
    let lastError: any;

    while (attempt < maxRetries) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        attempt++;

        if (attempt >= maxRetries) {
          break;
        }

        // Calculate delay with exponential backoff
        let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
        
        // Add jitter to prevent thundering herd
        if (jitter) {
          delay += Math.random() * delay * 0.1;
        }

        console.log(`Retry ${attempt}/${maxRetries} after ${delay}ms for operation`);
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

export class HealthMonitor {
  private services = new Map<string, ServiceHealth>();
  private alerts = new Map<string, HealthAlert>();
  private checkIntervals = new Map<string, NodeJS.Timeout>();
  private circuitBreakers = new Map<string, CircuitBreaker>();

  constructor(private config: HealthCheckConfig) {}

  registerService(
    name: string,
    healthCheck: () => Promise<boolean>,
    circuitBreakerConfig?: CircuitBreakerConfig
  ): void {
    // Initialize service health
    this.services.set(name, {
      name,
      status: 'healthy',
      lastCheck: new Date(),
      responseTime: 0,
      errorRate: 0,
      uptime: 100,
      dependencies: []
    });

    // Set up circuit breaker if configured
    if (circuitBreakerConfig) {
      this.circuitBreakers.set(name, new CircuitBreaker(name, circuitBreakerConfig));
    }

    // Start health check interval
    const interval = setInterval(async () => {
      await this.checkServiceHealth(name, healthCheck);
    }, this.config.interval);

    this.checkIntervals.set(name, interval);
    console.log(`Health monitoring started for service: ${name}`);
  }

  private async checkServiceHealth(name: string, healthCheck: () => Promise<boolean>): Promise<void> {
    const startTime = Date.now();
    const service = this.services.get(name);
    if (!service) return;

    try {
      const circuitBreaker = this.circuitBreakers.get(name);
      
      let isHealthy: boolean;
      if (circuitBreaker) {
        isHealthy = await circuitBreaker.execute(healthCheck);
      } else {
        isHealthy = await this.executeWithTimeout(healthCheck, this.config.timeout);
      }

      const responseTime = Date.now() - startTime;
      
      service.lastCheck = new Date();
      service.responseTime = responseTime;
      service.status = isHealthy ? 'healthy' : 'unhealthy';

      // Clear any existing alerts if service is healthy
      if (isHealthy) {
        this.resolveAlertsForService(name);
      } else {
        this.createAlert(name, 'error', 'Health check failed');
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      service.lastCheck = new Date();
      service.responseTime = responseTime;
      service.status = 'unhealthy';
      service.errorRate = Math.min(service.errorRate + 0.1, 1); // Increase error rate

      this.createAlert(name, 'error', `Health check error: ${error.message}`);
      console.error(`Health check failed for ${name}:`, error);
    }
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>,
    timeout: number
  ): Promise<T> {
    return Promise.race([
      operation(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Health check timeout')), timeout)
      )
    ]);
  }

  getServiceHealth(name: string): ServiceHealth | undefined {
    return this.services.get(name);
  }

  getAllServices(): ServiceHealth[] {
    return Array.from(this.services.values());
  }

  getSystemHealth(): SystemHealthReport {
    const services = this.getAllServices();
    const alerts = Array.from(this.alerts.values()).filter(alert => !alert.resolved);
    
    // Calculate overall health
    const unhealthyServices = services.filter(s => s.status === 'unhealthy').length;
    const degradedServices = services.filter(s => s.status === 'degraded').length;
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices > 0) {
      overall = 'unhealthy';
    } else if (degradedServices > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    // Calculate metrics
    const totalServices = services.length;
    const healthyServices = services.filter(s => s.status === 'healthy').length;
    const averageResponseTime = services.reduce((sum, s) => sum + s.responseTime, 0) / totalServices;
    const averageErrorRate = services.reduce((sum, s) => sum + s.errorRate, 0) / totalServices;
    const uptimePercentage = (healthyServices / totalServices) * 100;

    return {
      overall,
      services,
      alerts,
      metrics: {
        totalRequests: 0, // Would track in production
        errorRate: averageErrorRate,
        averageResponseTime,
        uptimePercentage
      },
      timestamp: new Date()
    };
  }

  private createAlert(
    service: string,
    type: 'warning' | 'error' | 'critical',
    message: string,
    metadata?: Record<string, any>
  ): void {
    const alertId = `${service}_${type}_${Date.now()}`;
    
    const alert: HealthAlert = {
      id: alertId,
      service,
      type,
      message,
      timestamp: new Date(),
      resolved: false,
      metadata
    };

    this.alerts.set(alertId, alert);

    // Trigger alert notifications (webhook, email, etc.)
    this.triggerAlertNotification(alert);
  }

  private resolveAlertsForService(service: string): void {
    for (const [id, alert] of this.alerts) {
      if (alert.service === service && !alert.resolved) {
        alert.resolved = true;
        console.log(`Resolved alert for service ${service}: ${alert.message}`);
      }
    }
  }

  private triggerAlertNotification(alert: HealthAlert): void {
    // Implementation would send notifications via webhook, email, Slack, etc.
    console.log(`ALERT [${alert.type.toUpperCase()}] ${alert.service}: ${alert.message}`);
    
    // For critical alerts in production environment
    if (alert.type === 'critical' && process.env.NODE_ENV === 'production') {
      // Send immediate notifications
      this.sendCriticalAlert(alert);
    }
  }

  private async sendCriticalAlert(alert: HealthAlert): Promise<void> {
    try {
      // Send webhook notification
      if (process.env.ALERT_WEBHOOK_URL) {
        await fetch(process.env.ALERT_WEBHOOK_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'critical_alert',
            service: alert.service,
            message: alert.message,
            timestamp: alert.timestamp,
            metadata: alert.metadata
          })
        });
      }

      // Send to monitoring service (e.g., DataDog, New Relic)
      if (process.env.MONITORING_API_KEY) {
        // Implementation for monitoring service
      }

    } catch (error) {
      console.error('Failed to send critical alert notification:', error);
    }
  }

  shutdown(): void {
    // Stop all health check intervals
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    
    console.log('Health monitoring shutdown completed');
  }
}

// Pre-configured health monitors for common services
export class MySetlistHealthMonitor extends HealthMonitor {
  constructor() {
    super({
      timeout: 5000,
      retries: 3,
      interval: 30000, // 30 seconds
      criticalServices: ['database', 'auth', 'storage']
    });

    this.setupCommonServices();
  }

  private setupCommonServices(): void {
    // Database health check
    this.registerService(
      'database',
      async () => {
        // Simple query to check database connectivity
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        
        const { error } = await supabase.from('artists').select('id').limit(1);
        return !error;
      },
      {
        failureThreshold: 3,
        resetTimeout: 60000,
        monitoringWindow: 300000,
        halfOpenMaxCalls: 2,
        errorTypes: ['PGRST', 'connection', 'timeout']
      }
    );

    // Auth service health check
    this.registerService(
      'auth',
      async () => {
        const { createClient } = await import('@supabase/supabase-js');
        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL || '',
          process.env.SUPABASE_SERVICE_ROLE_KEY || ''
        );
        
        // Check auth service availability
        const { error } = await supabase.auth.getSession();
        return !error;
      },
      {
        failureThreshold: 5,
        resetTimeout: 30000,
        monitoringWindow: 300000,
        halfOpenMaxCalls: 3,
        errorTypes: ['auth', 'token', 'unauthorized']
      }
    );

    // External APIs health check
    this.registerService(
      'external_apis',
      async () => {
        // Check Spotify API availability
        try {
          const response = await fetch('https://api.spotify.com/v1/', {
            method: 'HEAD',
            headers: { 'User-Agent': 'MySetlist-HealthCheck' }
          });
          return response.status < 500;
        } catch {
          return false;
        }
      }
    );
  }
}

// Export singleton instances
export const retryManager = new RetryManager();
export const healthMonitor = new MySetlistHealthMonitor();