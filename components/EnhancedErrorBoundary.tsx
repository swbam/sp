'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';
import { OptimizedIcon } from './LazyIcons';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  retryCount: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  level?: 'page' | 'component' | 'widget';
  maxRetries?: number;
  showDetails?: boolean;
  className?: string;
}

// Error reporting utility
const reportError = (error: Error, errorInfo: ErrorInfo, errorId: string, level: string) => {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error Boundary:', error);
    console.error('Error Info:', errorInfo);
  }
  
  // Send to error tracking service (e.g., Sentry)
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'exception', {
      description: error.message,
      fatal: level === 'page',
      error_id: errorId,
      component_stack: errorInfo.componentStack,
      retry_count: 0
    });
  }
  
  // Store in localStorage for debugging
  const errorReport = {
    timestamp: new Date().toISOString(),
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    errorInfo,
    errorId,
    level,
    url: window.location.href,
    userAgent: navigator.userAgent
  };
  
  try {
    const existingErrors = JSON.parse(localStorage.getItem('errorReports') || '[]');
    existingErrors.push(errorReport);
    // Keep only last 10 errors
    if (existingErrors.length > 10) {
      existingErrors.shift();
    }
    localStorage.setItem('errorReports', JSON.stringify(existingErrors));
  } catch (e) {
    console.warn('Failed to store error report:', e);
  }
};

// Generate unique error ID
const generateErrorId = (): string => {
  return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export class EnhancedErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimer: NodeJS.Timeout | null = null;
  
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: 0
    };
  }
  
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorId: generateErrorId()
    };
  }
  
  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      errorInfo
    });
    
    const { onError, level = 'component' } = this.props;
    
    // Report the error
    reportError(error, errorInfo, this.state.errorId, level);
    
    // Call custom error handler
    onError?.(error, errorInfo);
  }
  
  handleRetry = () => {
    const { maxRetries = 3 } = this.props;
    
    if (this.state.retryCount >= maxRetries) {
      return;
    }
    
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: '',
      retryCount: prevState.retryCount + 1
    }));
    
    // Auto-retry with exponential backoff
    if (this.state.retryCount < maxRetries - 1) {
      this.retryTimer = setTimeout(() => {
        if (this.state.hasError) {
          this.handleRetry();
        }
      }, Math.pow(2, this.state.retryCount) * 1000);
    }
  };
  
  componentWillUnmount() {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }
  }
  
  render() {
    if (this.state.hasError) {
      const { fallback, level = 'component', maxRetries = 3, showDetails = false, className } = this.props;
      
      if (fallback) {
        return fallback;
      }
      
      return (
        <ErrorFallback
          error={this.state.error}
          errorInfo={this.state.errorInfo}
          errorId={this.state.errorId}
          level={level}
          retryCount={this.state.retryCount}
          maxRetries={maxRetries}
          showDetails={showDetails}
          onRetry={this.handleRetry}
          className={className}
        />
      );
    }
    
    return this.props.children;
  }
}

// Error fallback component
const ErrorFallback: React.FC<{
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorId: string;
  level: string;
  retryCount: number;
  maxRetries: number;
  showDetails: boolean;
  onRetry: () => void;
  className?: string;
}> = ({ error, errorInfo, errorId, level, retryCount, maxRetries, showDetails, onRetry, className }) => {
  const [detailsVisible, setDetailsVisible] = React.useState(false);
  const [reported, setReported] = React.useState(false);
  
  const levelConfig = {
    page: {
      title: 'Page Error',
      message: 'Something went wrong with this page. Please try refreshing.',
      icon: 'AlertCircle',
      color: 'text-red-400'
    },
    component: {
      title: 'Component Error',
      message: 'This component encountered an error. You can try again or continue using the app.',
      icon: 'AlertTriangle',
      color: 'text-yellow-400'
    },
    widget: {
      title: 'Widget Error',
      message: 'This widget is temporarily unavailable. Other features should still work.',
      icon: 'Info',
      color: 'text-blue-400'
    }
  };
  
  const config = levelConfig[level as keyof typeof levelConfig] || levelConfig.component;
  
  const handleReport = () => {
    if (reported) return;
    
    // Simulate reporting to support
    console.log('Error reported:', errorId);
    setReported(true);
    
    // In a real app, send to error tracking service
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'error_report', {
        error_id: errorId,
        user_initiated: true
      });
    }
  };
  
  const canRetry = retryCount < maxRetries;
  
  return (
    <div className={twMerge(
      "flex flex-col items-center justify-center p-6 bg-neutral-900 rounded-lg border border-neutral-700",
      level === 'page' && "min-h-screen",
      level === 'component' && "min-h-[200px]",
      level === 'widget' && "min-h-[100px]",
      className
    )}>
      <div className="text-center max-w-md">
        <div className="mb-4">
          <OptimizedIcon 
            iconSet="lucide" 
            iconName={config.icon} 
            size={48} 
            className={twMerge("mx-auto", config.color)} 
          />
        </div>
        
        <h2 className="text-xl font-semibold text-white mb-2">
          {config.title}
        </h2>
        
        <p className="text-neutral-400 mb-6">
          {config.message}
        </p>
        
        {/* Error ID */}
        <div className="mb-4 p-2 bg-neutral-800 rounded text-xs text-neutral-500 font-mono">
          Error ID: {errorId}
        </div>
        
        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {canRetry && (
            <button
              onClick={onRetry}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <OptimizedIcon 
                iconSet="lucide" 
                iconName="RefreshCw" 
                size={16} 
                className="inline mr-2" 
              />
              Try Again {retryCount > 0 && `(${retryCount}/${maxRetries})`}
            </button>
          )}
          
          {level === 'page' && (
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-neutral-700 text-white rounded-lg hover:bg-neutral-600 transition-colors focus:outline-none focus:ring-2 focus:ring-neutral-500"
            >
              <OptimizedIcon 
                iconSet="lucide" 
                iconName="RotateCcw" 
                size={16} 
                className="inline mr-2" 
              />
              Refresh Page
            </button>
          )}
          
          <button
            onClick={handleReport}
            disabled={reported}
            className={twMerge(
              "px-4 py-2 rounded-lg transition-colors focus:outline-none focus:ring-2",
              reported 
                ? "bg-green-600 text-white focus:ring-green-500"
                : "bg-neutral-700 text-white hover:bg-neutral-600 focus:ring-neutral-500"
            )}
          >
            <OptimizedIcon 
              iconSet="lucide" 
              iconName={reported ? "Check" : "Send"} 
              size={16} 
              className="inline mr-2" 
            />
            {reported ? 'Reported' : 'Report Issue'}
          </button>
        </div>
        
        {/* Error details toggle */}
        {showDetails && error && (
          <div className="mt-6">
            <button
              onClick={() => setDetailsVisible(!detailsVisible)}
              className="text-sm text-neutral-400 hover:text-white transition-colors"
            >
              <OptimizedIcon 
                iconSet="lucide" 
                iconName={detailsVisible ? "ChevronUp" : "ChevronDown"} 
                size={16} 
                className="inline mr-1" 
              />
              {detailsVisible ? 'Hide' : 'Show'} Technical Details
            </button>
            
            {detailsVisible && (
              <div className="mt-4 p-4 bg-neutral-800 rounded-lg text-left">
                <h4 className="text-sm font-semibold text-red-400 mb-2">Error Details:</h4>
                <pre className="text-xs text-neutral-400 whitespace-pre-wrap break-words">
                  {error.message}
                </pre>
                
                {error.stack && (
                  <>
                    <h4 className="text-sm font-semibold text-red-400 mt-4 mb-2">Stack Trace:</h4>
                    <pre className="text-xs text-neutral-500 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {error.stack}
                    </pre>
                  </>
                )}
                
                {errorInfo?.componentStack && (
                  <>
                    <h4 className="text-sm font-semibold text-red-400 mt-4 mb-2">Component Stack:</h4>
                    <pre className="text-xs text-neutral-500 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                      {errorInfo.componentStack}
                    </pre>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// HOC for wrapping components with error boundaries
export const withErrorBoundary = <P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Partial<ErrorBoundaryProps>
) => {
  const WrappedComponent = (props: P) => (
    <EnhancedErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </EnhancedErrorBoundary>
  );
  
  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
};

// Specialized error boundaries for different use cases
export const PageErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <EnhancedErrorBoundary level="page" maxRetries={1} showDetails={process.env.NODE_ENV === 'development'}>
    {children}
  </EnhancedErrorBoundary>
);

export const ComponentErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <EnhancedErrorBoundary level="component" maxRetries={3} showDetails={false}>
    {children}
  </EnhancedErrorBoundary>
);

export const WidgetErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => (
  <EnhancedErrorBoundary level="widget" maxRetries={2} showDetails={false}>
    {children}
  </EnhancedErrorBoundary>
);

// Error boundary for async operations
export const AsyncErrorBoundary: React.FC<{ 
  children: ReactNode;
  fallback?: ReactNode;
}> = ({ children, fallback }) => {
  const [asyncError, setAsyncError] = React.useState<Error | null>(null);
  
  React.useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setAsyncError(new Error(`Unhandled promise rejection: ${event.reason}`));
    };
    
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    
    return () => {
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);
  
  if (asyncError) {
    throw asyncError;
  }
  
  return (
    <EnhancedErrorBoundary 
      level="component" 
      fallback={fallback}
      onError={(error) => {
        console.error('Async error caught:', error);
      }}
    >
      {children}
    </EnhancedErrorBoundary>
  );
};