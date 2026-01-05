/**
 * Error Boundary Component
 * Catches React errors and displays fallback UI
 */

import React from 'react';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('%c❌ ErrorBoundary caught an error:', 'color: red; font-size: 14px; font-weight: bold');
    console.error('Error:', error);
    console.error('Error Info:', errorInfo);
    
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full bg-white rounded-2xl shadow-2xl p-8">
            {/* Header */}
            <div className="text-center mb-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FiAlertTriangle className="text-red-600" size={40} />
              </div>
              <h1 className="text-3xl font-bold text-gray-800 mb-2">
                Oops! Something went wrong
              </h1>
              <p className="text-gray-600">
                We encountered an unexpected error. Don't worry, we're here to help!
              </p>
            </div>

            {/* Error Details (Development Mode) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mb-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                <h3 className="text-sm font-semibold text-gray-700 mb-2">
                  Error Details (Development Mode Only):
                </h3>
                <div className="bg-red-50 rounded p-3 mb-2 border border-red-200">
                  <code className="text-xs text-red-800 break-all">
                    {this.state.error.toString()}
                  </code>
                </div>
                {this.state.errorInfo?.componentStack && (
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer font-medium hover:text-gray-800">
                      Component Stack
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap bg-gray-100 p-2 rounded border border-gray-300 overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium shadow-md hover:shadow-lg"
              >
                <FiRefreshCw size={18} />
                <span>Reload Page</span>
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition font-medium shadow-md hover:shadow-lg"
              >
                <FiHome size={18} />
                <span>Go to Dashboard</span>
              </button>
            </div>

            {/* Help Text */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                Troubleshooting Tips:
              </h3>
              <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                <li>Try refreshing the page</li>
                <li>Clear your browser cache and cookies</li>
                <li>Check your internet connection</li>
                <li>Ensure the backend server is running on port 3000</li>
                <li>Check browser console (F12) for more details</li>
              </ul>
            </div>

            {/* Reset Button (for testing) */}
            {import.meta.env.DEV && (
              <div className="mt-4 text-center">
                <button
                  onClick={this.handleReset}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Try recovering without reload (dev only)
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
