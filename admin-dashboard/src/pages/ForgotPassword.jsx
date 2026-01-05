import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaEnvelope, FaKey, FaCheckCircle, FaShieldAlt } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // System theme detection
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    setIsDarkMode(mediaQuery.matches);

    const handleChange = (e) => setIsDarkMode(e.matches);
    mediaQuery.addEventListener('change', handleChange);

    return () => mediaQuery.removeEventListener('change', handleChange);
  }, []);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      if (user.isSuperAdmin) {
        navigate('/super-admin', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div 
        className="h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-300"
        style={{
          background: isDarkMode 
            ? 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0f1729 100%)'
            : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)'
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 w-full max-w-md mx-6 rounded-3xl shadow-2xl p-8 transition-colors duration-300 text-center"
          style={{
            background: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            border: isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.15)' 
              : '1px solid rgba(15, 23, 42, 0.15)',
            boxShadow: isDarkMode 
              ? '0 8px 32px 0 rgba(0, 0, 0, 0.5)' 
              : '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
          }}
        >
          <FaCheckCircle 
            className="text-6xl mx-auto mb-4" 
            style={{ color: '#22c55e' }}
          />
          <h2 
            className="text-2xl font-bold mb-2 transition-colors duration-300"
            style={{ color: isDarkMode ? '#E5E7EB' : '#0F172A' }}
          >
            Check Your Email
          </h2>
          <p 
            className="mb-4 text-sm transition-colors duration-300"
            style={{ color: isDarkMode ? '#94a3b8' : '#475569' }}
          >
            We've sent a password reset link to <strong>{email}</strong>
          </p>
          <p 
            className="text-xs mb-6 transition-colors duration-300"
            style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
          >
            The link will expire in 15 minutes. Please check your spam folder if you don't see it.
          </p>
          <Link
            to="/login"
            className="inline-block px-6 py-2.5 rounded-xl font-medium text-white text-sm transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
              boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
            }}
          >
            Back to Login
          </Link>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-300"
      style={{
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0f1729 100%)'
          : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)'
      }}
    >
      {/* Animated Background Grid */}
      <div className="absolute inset-0" style={{ opacity: isDarkMode ? 0.1 : 0.15 }}>
        <div className="absolute inset-0" style={{
          backgroundImage: `
            linear-gradient(${isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(100, 116, 139, 0.4)'} 1px, transparent 1px),
            linear-gradient(90deg, ${isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(100, 116, 139, 0.4)'} 1px, transparent 1px)
          `,
          backgroundSize: '40px 40px'
        }} />
      </div>

      {/* Ambient Glow Effects */}
      <div 
        className="absolute top-20 left-20 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: isDarkMode ? 'radial-gradient(circle, #06b6d4 0%, transparent 70%)' : 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: isDarkMode ? 0.15 : 0.2
        }}
      />
      <div 
        className="absolute bottom-20 right-20 w-96 h-96 rounded-full pointer-events-none"
        style={{
          background: isDarkMode ? 'radial-gradient(circle, #3b82f6 0%, transparent 70%)' : 'radial-gradient(circle, #06b6d4 0%, transparent 70%)',
          filter: 'blur(80px)',
          opacity: isDarkMode ? 0.15 : 0.2
        }}
      />

      {/* Animated Network Nodes */}
      <motion.div
        animate={{ x: [0, 30, 0], y: [0, -40, 0], opacity: [0.4, 0.7, 0.4] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute pointer-events-none"
        style={{ top: '15%', right: '15%' }}
      >
        <svg width="120" height="120" viewBox="0 0 120 120">
          <circle cx="20" cy="20" r="3" fill={isDarkMode ? '#06b6d4' : '#3b82f6'} opacity="0.6" />
          <circle cx="100" cy="40" r="4" fill={isDarkMode ? '#3b82f6' : '#06b6d4'} opacity="0.5" />
          <circle cx="60" cy="100" r="3" fill={isDarkMode ? '#06b6d4' : '#3b82f6'} opacity="0.6" />
          <line x1="20" y1="20" x2="100" y2="40" stroke={isDarkMode ? '#06b6d4' : '#3b82f6'} strokeWidth="1" opacity="0.3" />
          <line x1="100" y1="40" x2="60" y2="100" stroke={isDarkMode ? '#3b82f6' : '#06b6d4'} strokeWidth="1" opacity="0.3" />
          <line x1="60" y1="100" x2="20" y2="20" stroke={isDarkMode ? '#06b6d4' : '#3b82f6'} strokeWidth="1" opacity="0.3" />
        </svg>
      </motion.div>

      <motion.div
        animate={{ rotate: [0, 360], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute pointer-events-none"
        style={{ top: '40%', left: '8%' }}
      >
        <svg width="60" height="60" viewBox="0 0 60 60">
          <path 
            d="M30 5 L50 20 L50 40 L30 55 L10 40 L10 20 Z" 
            fill="none" 
            stroke={isDarkMode ? '#06b6d4' : '#3b82f6'} 
            strokeWidth="1.5" 
            opacity="0.4"
          />
        </svg>
      </motion.div>

      <div className="relative z-10 w-full max-w-md px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl shadow-2xl transition-colors duration-300 px-8 py-6"
          style={{
            background: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.7)',
            backdropFilter: 'blur(20px)',
            border: isDarkMode 
              ? '1px solid rgba(255, 255, 255, 0.15)' 
              : '1px solid rgba(15, 23, 42, 0.15)',
            boxShadow: isDarkMode 
              ? '0 8px 32px 0 rgba(0, 0, 0, 0.5)' 
              : '0 8px 32px 0 rgba(0, 0, 0, 0.15)'
          }}
        >
          <div className="text-center mb-5">
            <div 
              className="w-14 h-14 rounded-xl flex items-center justify-center mx-auto mb-3 transition-colors duration-300"
              style={{
                background: isDarkMode ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.5)',
                border: isDarkMode 
                  ? '1px solid rgba(148, 163, 184, 0.3)' 
                  : '1px solid rgba(100, 116, 139, 0.3)'
              }}
            >
              <FaKey 
                className="text-xl" 
                style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
              />
            </div>
            <h2 
              className="text-2xl font-bold mb-1 transition-colors duration-300"
              style={{ color: isDarkMode ? '#E5E7EB' : '#0F172A' }}
            >
              Forgot Password?
            </h2>
            <p 
              className="text-sm transition-colors duration-300"
              style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
            >
              We'll send you a reset link
            </p>
          </div>

          {/* Info Notice */}
          <div 
            className="mb-4 p-3 rounded-xl transition-colors duration-300"
            style={{
              background: isDarkMode ? 'rgba(59, 130, 246, 0.15)' : 'rgba(59, 130, 246, 0.1)',
              border: isDarkMode 
                ? '1px solid rgba(59, 130, 246, 0.3)' 
                : '1px solid rgba(59, 130, 246, 0.2)'
            }}
          >
            <p 
              className="text-xs text-center transition-colors duration-300"
              style={{ color: isDarkMode ? '#93c5fd' : '#3b82f6' }}
            >
              We'll send you a reset link valid for 15 minutes
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 p-3 rounded-xl text-sm transition-colors duration-300"
              style={{
                background: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                border: isDarkMode 
                  ? '1px solid rgba(239, 68, 68, 0.3)' 
                  : '1px solid rgba(239, 68, 68, 0.2)',
                color: isDarkMode ? '#fca5a5' : '#dc2626'
              }}
            >
              {error}
            </motion.div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email Input */}
            <div>
              <div className="relative">
                <FaEnvelope 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-base pointer-events-none transition-colors duration-300" 
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#305796';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: isDarkMode ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.5)',
                    border: '2px solid',
                    borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    color: isDarkMode ? '#E5E7EB' : '#0F172A',
                    transition: 'border-color 0.15s ease'
                  }}
                  placeholder="Email Address"
                />
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl font-medium text-white text-sm transition-all duration-300"
              style={{
                background: isLoading 
                  ? (isDarkMode ? 'rgba(71, 85, 105, 0.4)' : 'rgba(148, 163, 184, 0.4)')
                  : 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                boxShadow: isLoading ? 'none' : '0 2px 8px rgba(79, 70, 229, 0.25)',
                cursor: isLoading ? 'not-allowed' : 'pointer'
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div 
                    className="w-4 h-4 rounded-full animate-spin"
                    style={{
                      border: '2px solid rgba(255, 255, 255, 0.3)',
                      borderTopColor: '#ffffff'
                    }}
                  />
                  <span>Sending...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <HiLightningBolt />
                  <span>Send Reset Link</span>
                </div>
              )}
            </motion.button>
          </form>

          {/* Back to Login */}
          <div className="mt-5 text-center">
            <p 
              className="text-xs transition-colors duration-300"
              style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
            >
              Remember your password?{' '}
              <Link
                to="/login"
                className="font-medium transition-colors duration-300"
                style={{ 
                  color: isDarkMode ? '#93c5fd' : '#3b82f6',
                  textDecoration: 'none'
                }}
                onMouseEnter={(e) => {
                  e.target.style.color = isDarkMode ? '#60a5fa' : '#2563eb';
                  e.target.style.textDecoration = 'underline';
                }}
                onMouseLeave={(e) => {
                  e.target.style.color = isDarkMode ? '#93c5fd' : '#3b82f6';
                  e.target.style.textDecoration = 'none';
                }}
              >
                Sign In
              </Link>
            </p>
          </div>
        </motion.div>

        {/* Footer */}
        <p 
          className="text-center text-xs mt-5 transition-colors duration-300"
          style={{ color: isDarkMode ? 'rgba(148, 163, 184, 0.5)' : 'rgba(100, 116, 139, 0.6)' }}
        >
          &copy; 2025 IntelliSight. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
