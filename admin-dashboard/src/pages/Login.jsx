import React, { useState } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { motion } from 'framer-motion';
import { FaLock, FaUser, FaEye, FaEyeSlash, FaBrain, FaShieldAlt, FaRobot } from 'react-icons/fa';
import { HiSparkles, HiLightningBolt } from 'react-icons/hi';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const result = await login(email, password);

    if (result.success) {
      navigate(from, { replace: true });
    } else {
      setError(result.message);
    }
    setIsLoading(false);
  };

  // Animation Variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5, ease: "easeOut" }
    }
  };

  const floatingVariants = {
    initial: { y: 0 },
    animate: {
      y: [-10, 10, -10],
      transition: {
        duration: 6,
        repeat: Infinity,
        ease: "easeInOut"
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 bg-gradient-to-br from-navy-darker via-navy-primary to-steel-900">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-20 left-10 w-72 h-72 bg-accent-blue/20 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent-cyan/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent-purple/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }}></div>
      </div>

      {/* Floating Icons */}
      <motion.div
        variants={floatingVariants}
        initial="initial"
        animate="animate"
        className="absolute top-20 right-1/4 text-accent-cyan/30"
      >
        <FaBrain size={40} />
      </motion.div>
      <motion.div
        variants={floatingVariants}
        initial="initial"
        animate="animate"
        className="absolute bottom-32 left-1/4 text-accent-blue/30"
        style={{ animationDelay: '1s' }}
      >
        <FaShieldAlt size={35} />
      </motion.div>
      <motion.div
        variants={floatingVariants}
        initial="initial"
        animate="animate"
        className="absolute top-1/3 left-20 text-accent-purple/30"
        style={{ animationDelay: '2s' }}
      >
        <FaRobot size={45} />
      </motion.div>

      {/* Login Card */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-md w-full z-10"
      >
        <motion.div
          variants={itemVariants}
          className="glass-card p-10 relative overflow-hidden"
        >
          {/* Glow Effect */}
          <div className="absolute -inset-1 bg-gradient-to-r from-accent-blue via-accent-cyan to-accent-purple opacity-20 blur-2xl -z-10"></div>

          {/* Header */}
          <motion.div variants={itemVariants} className="text-center mb-8">
            <motion.img
              src="/models/intellisight1.png"
              alt="IntelliSight Logo"
              className="w-32 h-32 object-contain mx-auto mb-4"
              initial={{ scale: 0 }}
              animate={{ 
                scale: 1,
                filter: [
                  'drop-shadow(0 0 12px rgba(0, 255, 255, 0.6))',
                  'drop-shadow(0 0 20px rgba(0, 255, 255, 0.9))',
                  'drop-shadow(0 0 12px rgba(0, 255, 255, 0.6))'
                ]
              }}
              transition={{ 
                scale: { type: "spring", stiffness: 200, damping: 15 },
                filter: { duration: 2, repeat: Infinity, ease: "easeInOut" }
              }}
            />
            
            <h2 className="text-4xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-accent-cyan via-accent-blue to-accent-purple mb-2">
              IntelliSight
            </h2>
            <div className="flex items-center justify-center gap-2 text-steel-600">
              <HiSparkles className="text-accent-cyan" />
              <p className="text-sm font-medium">Smart Movement Monitoring System</p>
            </div>
          </motion.div>

          {/* Form */}
          <motion.form
            variants={itemVariants}
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* Email Input */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-navy-primary mb-2">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaUser className="text-steel-500" />
                </div>
                <input
                  id="email-address"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-futuristic pl-11"
                  placeholder="admin@intellisight.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </motion.div>

            {/* Password Input */}
            <motion.div variants={itemVariants}>
              <label className="block text-sm font-semibold text-navy-primary mb-2">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <FaLock className="text-steel-500" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  className="input-futuristic pl-11 pr-11"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-4 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <FaEyeSlash className="text-steel-500 hover:text-accent-blue transition-colors" />
                  ) : (
                    <FaEye className="text-steel-500 hover:text-accent-blue transition-colors" />
                  )}
                </button>
              </div>
            </motion.div>

            {/* Error Message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 text-red-600 text-sm bg-red-50 border border-red-200 px-4 py-3 rounded-xl"
              >
                <span className="font-medium">{error}</span>
              </motion.div>
            )}

            {/* Submit Button */}
            <motion.div variants={itemVariants}>
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className={`btn-futuristic w-full text-center ${
                  isLoading ? 'opacity-75 cursor-not-allowed' : ''
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center gap-2">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                    />
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <HiLightningBolt />
                    Sign In to Dashboard
                  </span>
                )}
              </motion.button>
            </motion.div>

            {/* Register Link */}
            <motion.div variants={itemVariants} className="text-center pt-4">
              <p className="text-sm text-steel-600">
                Don't have an account?{' '}
                <Link
                  to="/register"
                  className="font-semibold text-transparent bg-clip-text bg-gradient-to-r from-accent-blue to-accent-cyan hover:from-accent-cyan hover:to-accent-blue transition-all"
                >
                  Create Account
                </Link>
              </p>
            </motion.div>
          </motion.form>

          {/* Features */}
          <motion.div variants={itemVariants} className="mt-8 pt-6 border-t border-steel-200">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="group cursor-pointer">
                <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-accent-blue/10 to-accent-cyan/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FaBrain className="text-accent-blue text-xl" />
                </div>
                <p className="text-xs text-steel-600 font-medium">AI Powered</p>
              </div>
              <div className="group cursor-pointer">
                <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-accent-cyan/10 to-accent-blue/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FaShieldAlt className="text-accent-cyan text-xl" />
                </div>
                <p className="text-xs text-steel-600 font-medium">Secure</p>
              </div>
              <div className="group cursor-pointer">
                <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-accent-purple/10 to-accent-pink/10 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <HiSparkles className="text-accent-purple text-xl" />
                </div>
                <p className="text-xs text-steel-600 font-medium">Real-time</p>
              </div>
            </div>
          </motion.div>
        </motion.div>

        {/* Footer Text */}
        <motion.p
          variants={itemVariants}
          className="text-center text-sm text-white/60 mt-6"
        >
          &copy; 2025 IntelliSight. All rights reserved.
        </motion.p>
      </motion.div>
    </div>
  );
};

export default Login;
