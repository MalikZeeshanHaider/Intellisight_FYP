/**
 * Main Entry Point
 * Renders the IntelliSight Dashboard application
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/index.css';

// Error boundary for the entire app
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('React Error Boundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '50px', fontFamily: 'sans-serif' }}>
          <h1 style={{ color: 'red' }}>Application Error</h1>
          <details style={{ whiteSpace: 'pre-wrap', background: '#f5f5f5', padding: '20px', marginTop: '20px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 'bold' }}>Error Details</summary>
            <p><strong>Error:</strong> {this.state.error && this.state.error.toString()}</p>
            <p><strong>Component Stack:</strong></p>
            <pre>{this.state.errorInfo && this.state.errorInfo.componentStack}</pre>
          </details>
          <button 
            onClick={() => window.location.reload()} 
            style={{ marginTop: '20px', padding: '10px 20px', cursor: 'pointer' }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

// Add console log to verify script is loading
console.log('%c✅ IntelliSight Dashboard - main.jsx loaded', 'color: green; font-size: 16px; font-weight: bold');
console.log('React version:', React.version);
console.log('Root element:', document.getElementById('root'));

try {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found! Make sure index.html has <div id="root"></div>');
  }

  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  );

  console.log('%c✅ React app rendered successfully', 'color: green; font-size: 14px');
} catch (error) {
  console.error('%c❌ Fatal Error during React initialization:', 'color: red; font-size: 16px; font-weight: bold', error);
  document.body.innerHTML = `
    <div style="padding: 50px; font-family: sans-serif;">
      <h1 style="color: red;">Fatal Initialization Error</h1>
      <p>The React application failed to initialize. Check the console for details.</p>
      <pre style="background: #f5f5f5; padding: 20px; overflow: auto;">${error.stack}</pre>
    </div>
  `;
}
