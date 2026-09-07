import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, PlayCircle, RotateCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Catches render-time exceptions anywhere below it so a single broken
 * component can never blank the whole page. React unmounts the entire tree
 * when an error escapes an ErrorBoundary — on a dark theme that reads as a
 * black screen — so this is the last line of defence for the UI.
 *
 * In development the message and stack are shown to aid debugging. In
 * production only a generic message is rendered, so nothing sensitive is
 * surfaced to end users.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[StreamVault] Unhandled UI error:", error, errorInfo.componentStack);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
        <div className="w-full max-w-lg text-center">
          <div className="mb-6 flex items-center justify-center gap-2">
            <PlayCircle className="h-7 w-7 text-primary" />
            <span className="text-xl font-bold tracking-tight">StreamVault</span>
          </div>

          <div className="rounded-2xl border border-border bg-card p-8 shadow-xl">
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-destructive" />
            <h1 className="text-lg font-semibold">Application Error</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Something went wrong while loading this page.
            </p>

            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 max-h-48 overflow-auto rounded-lg border border-border bg-secondary/60 p-3 text-left font-mono text-xs text-destructive">
                {this.state.error.message}
                {"\n\n"}
                {this.state.error.stack}
              </pre>
            )}

            <button
              onClick={this.handleReload}
              className="mt-6 inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <RotateCw className="h-4 w-4" />
              Reload Page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
