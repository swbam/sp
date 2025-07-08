'use client';

import { Component } from 'react';
import type { ReactNode, ErrorInfo } from 'react';
import { Box } from './Box';
import { Button } from './Button';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }
    
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Box className="h-full flex flex-col items-center justify-center p-8">
          <div className="text-center space-y-4">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-white text-xl font-semibold">
              Something went wrong
            </h2>
            <p className="text-neutral-400 text-sm max-w-md">
              We encountered an unexpected error. Please try refreshing the page or navigating back.
            </p>
            
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="text-neutral-300 text-sm cursor-pointer">
                  Error details (development only)
                </summary>
                <pre className="mt-2 text-xs text-red-400 bg-neutral-800 p-2 rounded overflow-auto">
                  {this.state.error.message}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            
            <div className="flex gap-2 mt-6">
              <Button
                onClick={() => window.location.reload()}
                className="bg-green-500 hover:bg-green-600"
              >
                Refresh Page
              </Button>
              <Button
                onClick={() => window.location.href = '/'}
                className="bg-neutral-700 hover:bg-neutral-600"
              >
                Go Home
              </Button>
            </div>
          </div>
        </Box>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easy wrapping
export function withErrorBoundary<T extends {}>(
  Component: React.ComponentType<T>,
  fallback?: ReactNode
) {
  return function WrappedComponent(props: T) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}