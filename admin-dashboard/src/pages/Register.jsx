import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash, FaCheckCircle, FaShieldAlt } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const Register = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Detect system theme preference
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

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setError('');
  };

  const validateForm = () => {
    if (!formData.name.trim()) {
      setError('Name is required');
      return false;
    }
    if (!formData.email.trim()) {
      setError('Email is required');
      return false;
    }
    if (formData.password.length < 8 || formData.password.length > 16) {
      setError('Password must be between 8 and 16 characters');
      return false;
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      const response = await axios.post(`${API_URL}/auth/register`, {
        name: formData.name,
        email: formData.email,
        password: formData.password,
        confirmPassword: formData.confirmPassword
      });

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        navigate('/login');
      }, 3000);

    } catch (err) {
      setError(err.response?.data?.message || 'Registration failed. Please try again.');
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
            Registration Submitted!
          </h2>
          <p 
            className="mb-4 transition-colors duration-300"
            style={{ color: isDarkMode ? '#94a3b8' : '#475569' }}
          >
            Your registration request has been sent to the administrator for approval.
          </p>
          <p 
            className="text-sm transition-colors duration-300"
            style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
          >
            You will receive an email notification once your account is approved.
          </p>
          <p 
            className="text-sm mt-4 transition-colors duration-300"
            style={{ color: isDarkMode ? '#64748b' : '#94a3b8' }}
          >
            Redirecting to login...
          </p>
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
        animate={{ x: [0, -40, 0], y: [0, 30, 0], opacity: [0.4, 0.6, 0.4] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        className="absolute pointer-events-none"
        style={{ bottom: '20%', left: '12%' }}
      >
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="30" cy="30" r="4" fill={isDarkMode ? '#3b82f6' : '#06b6d4'} opacity="0.6" />
          <circle cx="70" cy="30" r="3" fill={isDarkMode ? '#06b6d4' : '#3b82f6'} opacity="0.5" />
          <circle cx="50" cy="70" r="3" fill={isDarkMode ? '#3b82f6' : '#06b6d4'} opacity="0.6" />
          <line x1="30" y1="30" x2="70" y2="30" stroke={isDarkMode ? '#3b82f6' : '#06b6d4'} strokeWidth="1" opacity="0.3" />
          <line x1="70" y1="30" x2="50" y2="70" stroke={isDarkMode ? '#06b6d4' : '#3b82f6'} strokeWidth="1" opacity="0.3" />
          <line x1="50" y1="70" x2="30" y2="30" stroke={isDarkMode ? '#3b82f6' : '#06b6d4'} strokeWidth="1" opacity="0.3" />
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

      <motion.div
        animate={{ rotate: [360, 0], opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
        className="absolute pointer-events-none"
        style={{ top: '60%', right: '10%' }}
      >
        <svg width="70" height="70" viewBox="0 0 70 70">
          <rect 
            x="10" y="10" width="50" height="50" 
            fill="none" 
            stroke={isDarkMode ? '#3b82f6' : '#06b6d4'} 
            strokeWidth="1.5" 
            opacity="0.4"
            rx="5"
          />
          <circle cx="35" cy="35" r="8" fill="none" stroke={isDarkMode ? '#06b6d4' : '#3b82f6'} strokeWidth="1.5" opacity="0.4" />
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
              <FaShieldAlt 
                className="text-xl" 
                style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
              />
            </div>
            <h2 
              className="text-2xl font-bold mb-1 transition-colors duration-300"
              style={{ color: isDarkMode ? '#E5E7EB' : '#0F172A' }}
            >
              Create Account
            </h2>
            <p 
              className="text-sm transition-colors duration-300"
              style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
            >
              Join IntelliSight Platform
            </p>
          </div>

          {/* Admin Approval Notice */}
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
              ⓘ Your account requires administrator approval before you can sign in
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
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Name Input */}
            <div>
              <div className="relative">
                <FaUser 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-base pointer-events-none transition-colors duration-300" 
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                />
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  onFocus={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#305796';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: isDarkMode ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.5)',
                    border: '2px solid',
                    borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    color: isDarkMode ? '#E5E7EB' : '#0F172A',
                    transition: 'border-color 0.15s ease'
                  }}
                  placeholder="Full Name"
                />
              </div>
            </div>

            {/* Email Input */}
            <div>
              <div className="relative">
                <FaEnvelope 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-base pointer-events-none transition-colors duration-300" 
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onFocus={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#305796';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
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

            {/* Password Input */}
            <div>
              <div className="relative">
                <FaLock 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-base pointer-events-none transition-colors duration-300" 
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  onFocus={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#305796';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: isDarkMode ? 'rgba(15, 23, 42, 0.4)' : 'rgba(255, 255, 255, 0.5)',
                    border: '2px solid',
                    borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    color: isDarkMode ? '#E5E7EB' : '#0F172A',
                    transition: 'border-color 0.15s ease'
                  }}
                  placeholder="Password (8-16 characters)"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-base transition-colors duration-300"
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Confirm Password Input */}
            <div>
              <div className="relative">
                <FaLock 
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-base pointer-events-none transition-colors duration-300" 
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  onFocus={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#305796';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.3)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.8)',
                    border: '2px solid',
                    borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    color: isDarkMode ? '#E5E7EB' : '#0F172A',
                    transition: 'border-color 0.15s ease'
                  }}
                  placeholder="Confirm Password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!setShowConfirmPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-base transition-colors duration-300"
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                >
                  {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: isLoading ? 1 : 1.01 }}
              whileTap={{ scale: isLoading ? 1 : 0.99 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 rounded-xl font-medium text-white text-sm transition-all duration-300 mt-4"
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
                  <span>Creating account...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <HiLightningBolt />
                  <span>Create Account</span>
                </div>
              )}
            </motion.button>
          </form>

          {/* Login Link */}
          <div className="mt-5 text-center">
            <p 
              className="text-xs transition-colors duration-300"
              style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
            >
              Already have an account?{' '}
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

export default Register;
