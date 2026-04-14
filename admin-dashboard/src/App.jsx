/**
 * Main App Component
 * Sets up routing and authentication for IntelliSight Dashboard
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import SuperAdminDashboard from './pages/SuperAdminDashboard';
import Students from './pages/Students';
import StudentDetail from './pages/StudentDetail';
import Teachers from './pages/Teachers';
import TeacherDetail from './pages/TeacherDetail';
import Zones from './pages/Zones';
import ZoneDetail from './pages/ZoneDetail';
import Zone1 from './pages/Zone1';
import ZoneLive from './pages/ZoneLive';
import Cameras from './pages/Cameras';
import UnknownFaces from './pages/UnknownFaces';
import Logs from './pages/Logs';
import Settings from './pages/Settings';
import ActivePresence from './pages/ActivePresence';
import AttendanceAnalytics from './pages/AttendanceAnalytics';

console.log('%c📱 App.jsx - Component Loading', 'color: blue; font-size: 14px');

function App() {
  console.log('%c📱 App.jsx - Rendering App Component', 'color: blue; font-size: 12px');

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <Router>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/* Protected Routes */}
            <Route
              path="/super-admin"
              element={
                <ProtectedRoute>
                  <ErrorBoundary>
                    <SuperAdminDashboard />
                  </ErrorBoundary>
                </ProtectedRoute>
              }
            />

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
              path="/students/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <StudentDetail />
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
              path="/teachers/:id"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <TeacherDetail />
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
              path="/zones/zone1-live"
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
              path="/zones/:zoneId/live"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <ZoneLive />
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
              path="/cameras"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <Cameras />
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
              path="/attendance-analytics"
              element={
                <ProtectedRoute>
                  <Layout>
                    <ErrorBoundary>
                      <AttendanceAnalytics />
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
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
