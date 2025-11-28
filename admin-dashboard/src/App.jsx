/**
 * Main App Component
 * Sets up routing and authentication for IntelliSight Dashboard
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Students from './pages/Students';
import Teachers from './pages/Teachers';
import Zones from './pages/Zones';
import ZoneDetail from './pages/ZoneDetail';
import Zone1 from './pages/Zone1';
import UnknownFaces from './pages/UnknownFaces';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import ActivePresence from './pages/ActivePresence';
import AttendanceLogs from './pages/AttendanceLogs';

console.log('%c📱 App.jsx - Component Loading', 'color: blue; font-size: 14px');

function App() {
  console.log('%c📱 App.jsx - Rendering App Component', 'color: blue; font-size: 12px');

  return (
    <ErrorBoundary>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <Dashboard />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/students"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <Students />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/teachers"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <Teachers />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/zones"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <Zones />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/zones/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <ZoneDetail />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/zone1-live"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <Zone1 />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/unknown-faces"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <UnknownFaces />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/logs"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <Logs />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <Settings />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/active-presence"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <ActivePresence />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            <Route
              path="/attendance-logs"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <AttendanceLogs />
                    </ErrorBoundary>
                  </Layout>
                </ProtectedRoute>
              }
            />

            {/* Default Redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            {/* 404 - Redirect to dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
