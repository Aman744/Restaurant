import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { Logger } from '../../services/Logger';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  correlationId: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    correlationId: null
  };

  private static globalListenersBound = false;

  public static getDerivedStateFromError(error: Error): State {
    const correlationId = Logger.generateCorrelationId();
    return { hasError: true, error, correlationId };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    Logger.error(`React Error Boundary caught exception: ${error.message}`, {
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      correlationId: this.state.correlationId || undefined
    });
  }

  public componentDidMount() {
    if (!ErrorBoundary.globalListenersBound) {
      ErrorBoundary.globalListenersBound = true;

      // Handle uncaught JavaScript errors
      window.addEventListener('error', (event) => {
        Logger.error(`Uncaught JavaScript error: ${event.message}`, {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno,
          stack: event.error?.stack
        });
      });

      // Handle unhandled Promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        const message = event.reason?.message || String(event.reason);
        Logger.error(`Unhandled promise rejection: ${message}`, {
          stack: event.reason?.stack,
          reason: event.reason
        });
      });
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, correlationId: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, correlationId: null });
    window.location.hash = '#/';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-zinc-950 border border-zinc-900 rounded-3xl p-8 max-w-md w-full text-center space-y-6 shadow-2xl">
            <div className="flex justify-center">
              <div className="p-4 bg-red-500/10 rounded-full border border-red-500/20 text-red-500 animate-pulse">
                <AlertOctagon className="h-10 w-10" />
              </div>
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-black text-white">Oops, something went wrong!</h2>
              <p className="text-xs text-zinc-500">
                The application encountered an unexpected rendering failure. We have logged this error automatically.
              </p>
            </div>

            {this.state.correlationId && (
              <div className="bg-zinc-900/60 rounded-xl p-3 border border-zinc-800 font-mono text-[10px] text-zinc-400 select-all">
                Error Reference ID: <span className="text-emerald-400 font-bold">{this.state.correlationId}</span>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-black font-black text-xs uppercase rounded-xl transition cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retry & Reload
              </button>

              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 font-bold text-xs uppercase rounded-xl border border-zinc-800 transition cursor-pointer"
              >
                <Home className="h-3.5 w-3.5 text-emerald-400" />
                Return Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
