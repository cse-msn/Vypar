import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class StoreErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Storefront error caught by StoreErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.href = '/shop';
  };

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-12 text-center">
          <div className="rounded-full bg-rose-50 p-4 text-[#A61E57]">
            <AlertCircle className="h-10 w-10" />
          </div>
          <h2 className="mt-4 text-2xl font-bold text-gray-900">Something went wrong</h2>
          <p className="mt-2 max-w-md text-sm text-gray-600">
            We encountered an unexpected error while loading this page. You can try refreshing or go back to the shop home.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReload}
              className="flex items-center gap-2 rounded-xl bg-[#A61E57] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#8e1a4a]"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back to shop
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
