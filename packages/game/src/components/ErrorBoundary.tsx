import React, { Component, ErrorInfo, ReactNode } from 'react';
import { createLogger } from '../utils/logger';

const logger = createLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: (error: Error, resetError: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  errorCount: number;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorInfo: null,
      errorCount: 0,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to our logging service
    logger.error('React error boundary caught an error', error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
    });

    // Update state with error info
    this.setState((prevState) => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // In production, you might want to send this to an error reporting service
    if (import.meta.env.PROD) {
      // Could send to Sentry, LogRocket, etc.
      this.reportErrorToService(error, errorInfo);
    }
  }

  reportErrorToService(error: Error, errorInfo: ErrorInfo) {
    // This is where you'd integrate with an error reporting service
    // For now, we'll store it in localStorage for debugging
    try {
      const errorReport = {
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          stack: error.stack,
        },
        errorInfo: {
          componentStack: errorInfo.componentStack,
        },
        userAgent: navigator.userAgent,
        url: window.location.href,
      };

      const existingErrors = JSON.parse(localStorage.getItem('error_reports') || '[]');
      existingErrors.push(errorReport);

      // Keep only last 50 errors
      if (existingErrors.length > 50) {
        existingErrors.splice(0, existingErrors.length - 50);
      }

      localStorage.setItem('error_reports', JSON.stringify(existingErrors));
    } catch (e) {
      // Ignore localStorage errors
      logger.error('Failed to store error report', e);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI provided via props
      if (this.props.fallback) {
        return this.props.fallback(this.state.error!, this.resetError);
      }

      // Default error UI
      return (
        <div className="flex items-center justify-center min-h-screen bg-black p-8">
          <div className="max-w-lg w-full bg-gradient-to-br from-gray-900 to-black border border-terminal-red-border p-8">
            <div className="text-6xl text-center mb-4">⚠️</div>
            <h1 className="text-2xl font-bold text-terminal-red text-center mb-4">Oops! Something went wrong</h1>
            <p className="text-terminal-green text-center mb-6">
              We encountered an unexpected error. The issue has been logged and we'll look into it.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <details className="mb-6 p-4 bg-black/60 border border-terminal-green-border">
                <summary className="cursor-pointer text-terminal-yellow font-mono text-sm hover:text-terminal-yellow/80">
                  Error Details (Development Only)
                </summary>
                <div className="mt-4 space-y-4 text-xs font-mono">
                  <div>
                    <h3 className="text-terminal-green font-bold mb-2">Error Message:</h3>
                    <pre className="p-2 bg-black/80 border border-terminal-green/20 text-terminal-red overflow-x-auto">
                      {this.state.error.message}
                    </pre>
                  </div>

                  <div>
                    <h3 className="text-terminal-green font-bold mb-2">Stack Trace:</h3>
                    <pre className="p-2 bg-black/80 border border-terminal-green/20 text-gray-400 overflow-x-auto text-[10px]">
                      {this.state.error.stack}
                    </pre>
                  </div>

                  {this.state.errorInfo && (
                    <div>
                      <h3 className="text-terminal-green font-bold mb-2">Component Stack:</h3>
                      <pre className="p-2 bg-black/80 border border-terminal-green/20 text-gray-400 overflow-x-auto text-[10px]">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            <div className="flex gap-4 justify-center">
              <button 
                onClick={this.resetError} 
                className="py-2 px-6 bg-terminal-green/20 border border-terminal-green text-terminal-green font-mono text-sm uppercase hover:bg-terminal-green/30 hover:border-terminal-green transition-none"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()} 
                className="py-2 px-6 bg-terminal-blue/20 border border-terminal-blue text-terminal-blue font-mono text-sm uppercase hover:bg-terminal-blue/30 hover:border-terminal-blue transition-none"
              >
                Reload Page
              </button>
            </div>

            {this.state.errorCount > 2 && (
              <div className="mt-6 p-4 bg-terminal-yellow/10 border border-terminal-yellow text-terminal-yellow text-xs">
                <p>
                  This error has occurred multiple times. Please try refreshing the page or contact
                  support if the issue persists.
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components to reset error boundary
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return (error: Error) => {
    logger.error('Error thrown via useErrorHandler', error);
    setError(error);
  };
}

// Higher-order component for easy error boundary wrapping
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: (error: Error, resetError: () => void) => ReactNode
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary fallback={fallback}>
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}