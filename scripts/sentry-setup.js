#!/usr/bin/env node

/**
 * Sentry Integration Setup Script
 * Configures Sentry for comprehensive error tracking and performance monitoring
 */

const fs = require('fs');
const path = require('path');

// Sentry configuration
const sentryConfig = {
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  release: process.env.GITHUB_SHA || 'dev',
  tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  integrations: [
    'Http',
    'OnUncaughtException',
    'OnUnhandledRejection',
    'ContextLines',
    'LinkedErrors',
    'Modules',
    'InboundFilters',
    'FunctionToString',
    'Breadcrumbs',
    'GlobalHandlers',
    'HttpContext',
    'Dedupe'
  ],
  beforeSend(event, hint) {
    // Filter out expected errors
    const error = hint.originalException || hint.syntheticException;
    if (error && error.message) {
      // Skip expected errors
      if (error.message.includes('Non-Error promise rejection captured')) {
        return null;
      }
      if (error.message.includes('Network Error')) {
        return null;
      }
      if (error.message.includes('ChunkLoadError')) {
        return null;
      }
    }
    return event;
  },
  ignoreErrors: [
    'Network Error',
    'Non-Error promise rejection captured',
    'ChunkLoadError',
    'Loading chunk',
    'ResizeObserver loop limit exceeded',
    'Script error.',
    'cancelled'
  ]
};

// Generate Sentry configuration files
function generateSentryConfig() {
  console.log('🔧 Generating Sentry configuration files...');

  // Next.js Sentry configuration
  const nextConfigPath = path.join(__dirname, '..', 'sentry.client.config.js');
  const nextConfig = `
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  release: process.env.GITHUB_SHA || 'dev',
  tracesSampleRate: ${sentryConfig.tracesSampleRate},
  profilesSampleRate: ${sentryConfig.profilesSampleRate},
  
  integrations: [
    new Sentry.Replay({
      // Capture 10% of all sessions in production
      sessionSampleRate: 0.1,
      // Capture 100% of sessions with an error
      errorSampleRate: 1.0,
    }),
  ],
  
  beforeSend(event, hint) {
    ${sentryConfig.beforeSend.toString()}
    return event;
  },
  
  ignoreErrors: ${JSON.stringify(sentryConfig.ignoreErrors, null, 2)},
  
  // Custom tags
  tags: {
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
    version: process.env.GITHUB_SHA || 'dev',
  },
  
  // Custom context
  contexts: {
    app: {
      name: 'MySetlist',
      version: process.env.GITHUB_SHA || 'dev',
    },
  },
});
`;

  // Server-side Sentry configuration
  const serverConfigPath = path.join(__dirname, '..', 'sentry.server.config.js');
  const serverConfig = `
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  release: process.env.GITHUB_SHA || 'dev',
  tracesSampleRate: ${sentryConfig.tracesSampleRate},
  profilesSampleRate: ${sentryConfig.profilesSampleRate},
  
  integrations: [
    new Sentry.Integrations.Http({ tracing: true }),
    new Sentry.Integrations.OnUncaughtException({ exitEvenIfOtherHandlersAreRegistered: false }),
    new Sentry.Integrations.OnUnhandledRejection({ mode: 'warn' }),
  ],
  
  beforeSend(event, hint) {
    ${sentryConfig.beforeSend.toString()}
    return event;
  },
  
  ignoreErrors: ${JSON.stringify(sentryConfig.ignoreErrors, null, 2)},
  
  // Custom tags
  tags: {
    environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
    version: process.env.GITHUB_SHA || 'dev',
  },
  
  // Custom context
  contexts: {
    app: {
      name: 'MySetlist',
      version: process.env.GITHUB_SHA || 'dev',
    },
  },
});
`;

  // Edge runtime configuration
  const edgeConfigPath = path.join(__dirname, '..', 'sentry.edge.config.js');
  const edgeConfig = `
import * as Sentry from "@sentry/nextjs";

const SENTRY_DSN = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
  dsn: SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
  release: process.env.GITHUB_SHA || 'dev',
  tracesSampleRate: ${sentryConfig.tracesSampleRate},
  
  beforeSend(event, hint) {
    ${sentryConfig.beforeSend.toString()}
    return event;
  },
  
  ignoreErrors: ${JSON.stringify(sentryConfig.ignoreErrors, null, 2)},
});
`;

  // Write configuration files
  fs.writeFileSync(nextConfigPath, nextConfig.trim());
  fs.writeFileSync(serverConfigPath, serverConfig.trim());
  fs.writeFileSync(edgeConfigPath, edgeConfig.trim());

  console.log('✅ Sentry configuration files generated successfully');
}

// Generate Sentry monitoring utilities
function generateMonitoringUtils() {
  console.log('🔧 Generating Sentry monitoring utilities...');

  const utilsPath = path.join(__dirname, '..', 'lib', 'sentry-utils.js');
  const utilsContent = `
import * as Sentry from "@sentry/nextjs";

/**
 * Custom Sentry utilities for MySetlist
 */

// Performance monitoring
export const withPerformanceMonitoring = (name, fn) => {
  return async (...args) => {
    const transaction = Sentry.startTransaction({
      name,
      op: 'function',
    });
    
    try {
      const result = await fn(...args);
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('internal_error');
      Sentry.captureException(error, {
        tags: {
          function: name,
        },
      });
      throw error;
    } finally {
      transaction.finish();
    }
  };
};

// API monitoring
export const withApiMonitoring = (handler) => {
  return async (req, res) => {
    const transaction = Sentry.startTransaction({
      name: \`\${req.method} \${req.url}\`,
      op: 'http.server',
    });
    
    Sentry.configureScope((scope) => {
      scope.setTag('http.method', req.method);
      scope.setTag('http.url', req.url);
      scope.setContext('request', {
        method: req.method,
        url: req.url,
        headers: req.headers,
      });
    });
    
    try {
      await handler(req, res);
      transaction.setStatus('ok');
    } catch (error) {
      transaction.setStatus('internal_error');
      Sentry.captureException(error, {
        tags: {
          api: true,
          method: req.method,
          url: req.url,
        },
      });
      throw error;
    } finally {
      transaction.finish();
    }
  };
};

// Database monitoring
export const withDatabaseMonitoring = (operation, query) => {
  return async (client, ...args) => {
    const span = Sentry.startSpan({
      name: operation,
      op: 'db',
    });
    
    span.setData('db.statement', query);
    
    try {
      const result = await client.query(query, ...args);
      span.setData('db.rows_affected', result.rowCount);
      return result;
    } catch (error) {
      span.setStatus('internal_error');
      Sentry.captureException(error, {
        tags: {
          database: true,
          operation,
        },
      });
      throw error;
    } finally {
      span.finish();
    }
  };
};

// User feedback capture
export const captureUserFeedback = (feedback) => {
  const user = Sentry.getCurrentHub().getScope()?.getUser();
  
  Sentry.captureUserFeedback({
    event_id: Sentry.lastEventId(),
    name: user?.username || 'Anonymous',
    email: user?.email || 'anonymous@example.com',
    comments: feedback,
  });
};

// Custom error boundaries
export const withErrorBoundary = (Component, options = {}) => {
  return Sentry.withErrorBoundary(Component, {
    fallback: ({ error, resetError }) => (
      <div className="error-boundary">
        <h2>Something went wrong</h2>
        <p>We've been notified about this error.</p>
        <button onClick={resetError}>Try again</button>
      </div>
    ),
    beforeCapture: (scope, error, errorInfo) => {
      scope.setTag('errorBoundary', true);
      scope.setContext('errorInfo', errorInfo);
    },
    ...options,
  });
};

// Custom metrics
export const recordMetric = (name, value, unit = 'none', tags = {}) => {
  Sentry.metrics.distribution(name, value, {
    unit,
    tags: {
      environment: process.env.NEXT_PUBLIC_APP_ENV || 'development',
      ...tags,
    },
  });
};

// Application performance monitoring
export const startPageLoadTransaction = (pageName) => {
  return Sentry.startTransaction({
    name: pageName,
    op: 'pageload',
  });
};

// Search monitoring
export const monitorSearch = (query, results) => {
  Sentry.addBreadcrumb({
    category: 'search',
    message: \`Search performed: "\${query}"\`,
    level: 'info',
    data: {
      query,
      resultCount: results.length,
    },
  });
  
  recordMetric('search.query', 1, 'none', {
    hasResults: results.length > 0,
  });
};

// Voting monitoring
export const monitorVote = (action, showId, songId) => {
  Sentry.addBreadcrumb({
    category: 'vote',
    message: \`Vote \${action} for song \${songId}\`,
    level: 'info',
    data: {
      action,
      showId,
      songId,
    },
  });
  
  recordMetric('vote.action', 1, 'none', {
    action,
  });
};

// Authentication monitoring
export const monitorAuth = (action, success = true) => {
  Sentry.addBreadcrumb({
    category: 'auth',
    message: \`Authentication \${action}\`,
    level: success ? 'info' : 'error',
    data: {
      action,
      success,
    },
  });
  
  recordMetric('auth.action', 1, 'none', {
    action,
    success,
  });
};

export default {
  withPerformanceMonitoring,
  withApiMonitoring,
  withDatabaseMonitoring,
  captureUserFeedback,
  withErrorBoundary,
  recordMetric,
  startPageLoadTransaction,
  monitorSearch,
  monitorVote,
  monitorAuth,
};
`;

  // Ensure lib directory exists
  const libDir = path.join(__dirname, '..', 'lib');
  if (!fs.existsSync(libDir)) {
    fs.mkdirSync(libDir, { recursive: true });
  }

  fs.writeFileSync(utilsPath, utilsContent.trim());
  console.log('✅ Sentry monitoring utilities generated successfully');
}

// Generate Sentry alerting rules
function generateAlertingRules() {
  console.log('🔧 Generating Sentry alerting rules...');

  const alertsPath = path.join(__dirname, '..', 'sentry-alerts.json');
  const alertsConfig = {
    alerts: [
      {
        name: 'High Error Rate',
        conditions: [
          {
            metric: 'error_rate',
            threshold: 5,
            timeWindow: '1m',
            comparison: 'above'
          }
        ],
        actions: [
          {
            type: 'email',
            targetType: 'team',
            targetIdentifier: 'developers'
          },
          {
            type: 'slack',
            targetType: 'channel',
            targetIdentifier: '#alerts'
          }
        ]
      },
      {
        name: 'Performance Degradation',
        conditions: [
          {
            metric: 'response_time',
            threshold: 2000,
            timeWindow: '5m',
            comparison: 'above'
          }
        ],
        actions: [
          {
            type: 'email',
            targetType: 'team',
            targetIdentifier: 'developers'
          }
        ]
      },
      {
        name: 'Database Connection Issues',
        conditions: [
          {
            metric: 'database_errors',
            threshold: 10,
            timeWindow: '1m',
            comparison: 'above'
          }
        ],
        actions: [
          {
            type: 'pagerduty',
            targetType: 'service',
            targetIdentifier: 'database-service'
          }
        ]
      },
      {
        name: 'API Rate Limiting',
        conditions: [
          {
            metric: 'rate_limit_errors',
            threshold: 50,
            timeWindow: '1m',
            comparison: 'above'
          }
        ],
        actions: [
          {
            type: 'slack',
            targetType: 'channel',
            targetIdentifier: '#api-alerts'
          }
        ]
      }
    ]
  };

  fs.writeFileSync(alertsPath, JSON.stringify(alertsConfig, null, 2));
  console.log('✅ Sentry alerting rules generated successfully');
}

// Main execution
function main() {
  console.log('🚀 Setting up Sentry integration for MySetlist...');

  // Check if Sentry DSN is configured
  if (!process.env.SENTRY_DSN && !process.env.NEXT_PUBLIC_SENTRY_DSN) {
    console.warn('⚠️  SENTRY_DSN not configured. Sentry integration will be disabled.');
  }

  try {
    generateSentryConfig();
    generateMonitoringUtils();
    generateAlertingRules();
    
    console.log('✅ Sentry integration setup completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('1. Set SENTRY_DSN environment variable');
    console.log('2. Install Sentry dependencies: npm install @sentry/nextjs');
    console.log('3. Configure Sentry in your project settings');
    console.log('4. Set up alerting rules in Sentry dashboard');
    console.log('');
  } catch (error) {
    console.error('❌ Error setting up Sentry integration:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  generateSentryConfig,
  generateMonitoringUtils,
  generateAlertingRules,
  sentryConfig,
};