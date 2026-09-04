import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw, Home, RotateCcw } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  showDetails: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error('[StreamLoop ErrorBoundary Caught Error]:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    } else {
      window.location.reload();
    }
  };

  handleResetState = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (window.location.pathname !== '/dashboard' && window.location.pathname !== '/') {
      window.history.pushState(null, '', '/dashboard');
      window.dispatchEvent(new PopStateEvent('popstate'));
    } else {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.message || 'An unexpected runtime error occurred.';
      const componentStack = this.state.errorInfo?.componentStack || '';

      return (
        <div className="flex min-h-[400px] w-full flex-1 items-center justify-center p-6 bg-[#080B12] text-slate-100 antialiased font-sans">
          <div className="w-full max-w-lg rounded-3xl border border-rose-500/30 bg-[#0e1322] p-8 shadow-2xl backdrop-blur-xl text-center space-y-6">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/30 shadow-lg shadow-rose-500/10">
              <AlertCircle className="h-8 w-8" />
            </div>

            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-rose-400 border border-rose-500/30">
                Application Protected
              </span>
              <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                {this.props.fallbackTitle || 'Component Recovered Safely'}
              </h2>
              <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                {this.props.fallbackMessage ||
                  'The application encountered a runtime issue, but was safely caught to prevent a blank white screen. Your livestream and server background tasks continue operating normally.'}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 p-4 text-left font-mono text-xs space-y-2 overflow-hidden">
              <div className="flex items-center justify-between text-slate-400">
                <span className="font-semibold text-rose-400 truncate max-w-[280px]">
                  {errorMessage}
                </span>
                <button
                  type="button"
                  onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                  className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
                >
                  {this.state.showDetails ? 'Hide Details' : 'View Details'}
                </button>
              </div>

              {this.state.showDetails && (
                <div className="mt-2 max-h-48 overflow-y-auto custom-scrollbar border-t border-slate-800/80 pt-2 text-[10px] text-slate-400 select-text leading-normal">
                  <p className="font-semibold text-rose-300 mb-1">{this.state.error?.stack || errorMessage}</p>
                  <pre className="whitespace-pre-wrap">{componentStack}</pre>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={this.handleResetState}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
              >
                <RotateCcw className="h-4 w-4 text-indigo-400" />
                <span>Recover View</span>
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                className="flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 border border-slate-700 hover:bg-slate-700 hover:text-white transition-all cursor-pointer"
              >
                <Home className="h-4 w-4 text-slate-400" />
                <span>Go to Dashboard</span>
              </button>

              <button
                type="button"
                onClick={this.handleReload}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 hover:from-indigo-500 hover:to-violet-500 transition-all cursor-pointer active:scale-95"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Reload Page</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
