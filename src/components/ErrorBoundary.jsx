import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error('Handoff crashed:', error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 px-6">
        <div className="max-w-sm text-center space-y-3">
          <h1 className="text-base font-semibold">Something went wrong</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Your data never left this tab. Refresh to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-medium bg-slate-900 dark:bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-slate-700 dark:hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-indigo-400 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>
    );
  }
}
