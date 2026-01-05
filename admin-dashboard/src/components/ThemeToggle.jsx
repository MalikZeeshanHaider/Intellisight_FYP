/**
 * Theme Toggle Component
 * Modern toggle button for light/dark mode switching
 */

import React from 'react';
import { motion } from 'framer-motion';
import { FiSun, FiMoon } from 'react-icons/fi';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = ({ className = '' }) => {
  const { isDarkMode, toggleTheme } = useTheme();

  return (
    <motion.button
      onClick={toggleTheme}
      className={`relative flex items-center justify-center w-14 h-8 rounded-full transition-all duration-300 ${
        isDarkMode 
          ? 'bg-slate-700 border border-slate-600' 
          : 'bg-sky-100 border border-sky-200'
      } ${className}`}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {/* Toggle Circle */}
      <motion.div
        className={`absolute w-6 h-6 rounded-full flex items-center justify-center shadow-md ${
          isDarkMode 
            ? 'bg-slate-900' 
            : 'bg-white'
        }`}
        animate={{
          x: isDarkMode ? 12 : -12,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
      >
        {isDarkMode ? (
          <FiMoon className="w-3.5 h-3.5 text-yellow-400" />
        ) : (
          <FiSun className="w-3.5 h-3.5 text-amber-500" />
        )}
      </motion.div>
    </motion.button>
  );
};

export default ThemeToggle;
