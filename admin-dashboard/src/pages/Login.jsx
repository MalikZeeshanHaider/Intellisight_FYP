import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaLock, FaEnvelope, FaEye, FaEyeSlash, FaShieldAlt } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);

  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

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

  // Load persisted error on mount
  useEffect(() => {
    const persistedError = localStorage.getItem('loginError');
    if (persistedError) {
      setError(persistedError);
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    localStorage.removeItem('loginError'); // Clear any previous error
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      localStorage.removeItem('loginError'); // Ensure error is cleared on success
      
      // Check if user is super admin
      const storedUser = JSON.parse(localStorage.getItem('user'));
      if (storedUser && storedUser.isSuperAdmin) {
        navigate('/super-admin', { replace: true });
      } else {
        navigate(from, { replace: true });
      }
    } else {
      const errorMessage = result.message;
      setError(errorMessage);
      localStorage.setItem('loginError', errorMessage); // Persist error
    }
    setIsLoading(false);
  };

  // Clear error when user starts typing
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
    if (error) {
      setError('');
      localStorage.removeItem('loginError');
    }
  };

  const handlePasswordChange = (e) => {
    setPassword(e.target.value);
    if (error) {
      setError('');
      localStorage.removeItem('loginError');
    }
  };

  return (
    <div 
      className="h-screen flex items-center justify-center relative overflow-hidden transition-colors duration-300"
      style={{
        background: isDarkMode 
          ? 'linear-gradient(180deg, #0a0e27 0%, #1a1f3a 50%, #0f1729 100%)'
          : 'linear-gradient(180deg, #f8fafc 0%, #e2e8f0 50%, #f1f5f9 100%)'
      }}
    >
      {/* Animated Background Grid - Tech Lines */}
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
        animate={{
          x: [0, 30, 0],
          y: [0, -40, 0],
          opacity: [0.4, 0.7, 0.4]
        }}
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
        animate={{
          x: [0, -40, 0],
          y: [0, 30, 0],
          opacity: [0.4, 0.6, 0.4]
        }}
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
        animate={{
          rotate: [0, 360],
          opacity: [0.3, 0.5, 0.3]
        }}
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
        animate={{
          rotate: [360, 0],
          opacity: [0.3, 0.5, 0.3]
        }}
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
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="rounded-3xl shadow-2xl p-6 transition-colors duration-300"
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
          {/* Logo and Title */}
          <div className="text-center mb-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center mb-4"
            >
              <div 
                className="rounded-2xl p-3 transition-all duration-300"
                style={{
                  background: isDarkMode 
                    ? 'rgba(15, 23, 42, 0.8)' 
                    : 'rgba(255, 255, 255, 0.9)',
                  border: isDarkMode 
                    ? '2px solid rgba(6, 182, 212, 0.3)' 
                    : '2px solid rgba(59, 130, 246, 0.3)',
                  boxShadow: isDarkMode 
                    ? '0 4px 16px rgba(0, 0, 0, 0.3)' 
                    : '0 4px 16px rgba(0, 0, 0, 0.1)'
                }}
              >
                <img 
                  src="/models/intellisight1.png" 
                  alt="IntelliSight Logo" 
                  className="h-14 w-auto"
                />
              </div>
            </motion.div>
            <h1 
              className="text-2xl font-bold mb-1 transition-colors duration-300"
              style={{ color: isDarkMode ? '#E5E7EB' : '#0F172A' }}
            >
              Welcome Back
            </h1>
            <p 
              className="text-xs transition-colors duration-300"
              style={{ color: isDarkMode ? '#94a3b8' : '#475569' }}
            >
              Sign in to your IntelliSight account
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="mb-4 p-3 rounded-xl border text-sm transition-colors duration-300"
              style={{
                background: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(239, 68, 68, 0.4)',
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
              <label 
                className="block text-xs font-semibold mb-1.5 transition-colors duration-300"
                style={{ color: isDarkMode ? '#E5E7EB' : '#1e293b' }}
              >
                Email Address
              </label>
              <div className="relative">
                <FaEnvelope 
                  className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300 text-sm"
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  required
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.8)',
                    border: '2px solid',
                    borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)',
                    color: isDarkMode ? '#E5E7EB' : '#0F172A',
                    transition: 'border-color 0.15s ease'
                  }}
                  placeholder="Enter your email"
                  disabled={isLoading}
                  onFocus={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#305796';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label 
                className="block text-xs font-semibold mb-1.5 transition-colors duration-300"
                style={{ color: isDarkMode ? '#E5E7EB' : '#1e293b' }}
              >
                Password
              </label>
              <div className="relative">
                <FaLock 
                  className="absolute left-3 top-1/2 -translate-y-1/2 transition-colors duration-300 text-sm"
                  style={{ color: isDarkMode ? '#06b6d4' : '#0891b2' }}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl text-sm focus:outline-none"
                  style={{
                    background: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'rgba(255, 255, 255, 0.5)',
                    border: '2px solid',
                    borderColor: isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.5)',
                    color: isDarkMode ? '#E5E7EB' : '#0F172A',
                    transition: 'border-color 0.15s ease'
                  }}
                  placeholder="Enter your password"
                  disabled={isLoading}
                  onFocus={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#305796';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = isDarkMode ? 'rgba(148, 163, 184, 0.2)' : 'rgba(148, 163, 184, 0.3)';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-300 text-sm"
                  style={{
                    color: isDarkMode ? '#64748b' : '#94a3b8'
                  }}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link */}
            <div className="text-right">
              <Link
                to="/forgot-password"
                className="text-xs font-semibold transition-all duration-300 inline-block hover:underline"
                style={{
                  color: isDarkMode ? '#06b6d4' : '#3b82f6'
                }}
              >
                Forgot password?
              </Link>
            </div>

            {/* Submit Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={isLoading}
              className="w-full py-3 px-4 rounded-xl font-semibold text-white transition-all duration-300"
              style={{
                background: isLoading
                  ? 'linear-gradient(135deg, #94a3b8 0%, #64748b 100%)'
                  : 'linear-gradient(135deg, #4f46e5 0%, #2563eb 100%)',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                boxShadow: !isLoading ? '0 2px 8px rgba(79, 70, 229, 0.25)' : 'none'
              }}
            >
              {isLoading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <HiLightningBolt />
                  <span>Sign In</span>
                </div>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div 
                className="w-full border-t transition-colors duration-300"
                style={{
                  borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.15)'
                }}
              ></div>
            </div>
            <div className="relative flex justify-center text-xs">
              <span 
                className="px-3 transition-colors duration-300"
                style={{
                  background: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : 'rgba(255, 255, 255, 0.7)',
                  color: isDarkMode ? '#94a3b8' : '#64748b'
                }}
              >
                New to IntelliSight?
              </span>
            </div>
          </div>

          {/* Register Link */}
          <motion.div whileHover={{ scale: 1.01 }}>
            <Link
              to="/register"
              className="block w-full py-2.5 px-4 border-2 rounded-xl font-semibold text-center transition-all duration-300 text-sm"
              style={{
                border: isDarkMode 
                  ? '2px solid rgba(255, 255, 255, 0.15)' 
                  : '2px solid rgba(15, 23, 42, 0.2)',
                color: isDarkMode ? '#E5E7EB' : '#0F172A',
                background: isDarkMode ? 'rgba(15, 23, 42, 0.3)' : 'rgba(255, 255, 255, 0.5)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = isDarkMode 
                  ? '2px solid rgba(6, 182, 212, 0.5)' 
                  : '2px solid rgba(59, 130, 246, 0.5)';
                e.currentTarget.style.background = isDarkMode 
                  ? 'rgba(6, 182, 212, 0.1)' 
                  : 'rgba(59, 130, 246, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = isDarkMode 
                  ? '2px solid rgba(255, 255, 255, 0.15)' 
                  : '2px solid rgba(15, 23, 42, 0.2)';
                e.currentTarget.style.background = isDarkMode 
                  ? 'rgba(15, 23, 42, 0.3)' 
                  : 'rgba(255, 255, 255, 0.5)';
              }}
            >
              Create Account
            </Link>
          </motion.div>

          {/* Features */}
          <div 
            className="mt-5 pt-5 border-t transition-colors duration-300"
            style={{
              borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(15, 23, 42, 0.15)'
            }}
          >
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center">
                <div 
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-1.5 transition-colors duration-300"
                  style={{
                    background: isDarkMode ? 'rgba(6, 182, 212, 0.1)' : 'rgba(59, 130, 246, 0.15)',
                    border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid rgba(59, 130, 246, 0.3)'
                  }}
                >
                  <FaShieldAlt 
                    className="text-sm"
                    style={{ 
                      color: isDarkMode ? '#06b6d4' : '#3b82f6' 
                    }} 
                  />
                </div>
                <p 
                  className="text-xs transition-colors duration-300"
                  style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
                >
                  Secure Access
                </p>
              </div>
              <div className="text-center">
                <div 
                  className="inline-flex items-center justify-center w-9 h-9 rounded-lg mb-1.5 transition-colors duration-300"
                  style={{
                    background: isDarkMode ? 'rgba(59, 130, 246, 0.1)' : 'rgba(6, 182, 212, 0.15)',
                    border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(6, 182, 212, 0.3)'
                  }}
                >
                  <HiLightningBolt 
                    className="text-sm"
                    style={{ 
                      color: isDarkMode ? '#3b82f6' : '#06b6d4' 
                    }} 
                  />
                </div>
                <p 
                  className="text-xs transition-colors duration-300"
                  style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}
                >
                  Real-time Tracking
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <p 
          className="text-center text-xs mt-4 transition-colors duration-300"
          style={{ color: isDarkMode ? '#64748b' : '#64748b' }}
        >
          &copy; 2025 IntelliSight. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
