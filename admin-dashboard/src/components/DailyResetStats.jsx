/**
 * Daily Reset Statistics Widget
 * Shows daily/weekly stats and manual reset control
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiCalendar, FiClock, FiUsers, FiRefreshCw, FiAlertCircle } from 'react-icons/fi';
import { dailyResetAPI } from '../api/api';

const DailyResetStats = () => {
  const [stats, setStats] = useState({
    today: 0,
    last7Days: 0,
    currentActive: 0,
  });
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await dailyResetAPI.getStatistics();
      
      if (response?.success) {
        setStats(response.data);
      }
    } catch (err) {
      console.error('Error fetching daily stats:', err);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleManualReset = async () => {
    if (!confirm('Are you sure you want to manually reset active presence? This will:\n• Clear all current active presence\n• Move active users to attendance logs\n• Reset daily counters\n\nThis action cannot be undone.')) {
      return;
    }

    try {
      setResetting(true);
      setError(null);
      setSuccess(null);
      
      const response = await dailyResetAPI.manualReset();
      
      if (response?.success) {
        setSuccess(`Reset successful! Cleared ${response.data.recordsCleared} active presence records.`);
        fetchStats();
        
        // Clear success message after 5 seconds
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err) {
      console.error('Error during manual reset:', err);
      setError(err.response?.data?.message || 'Failed to reset. Please try again.');
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg">
            <FiCalendar className="text-white" size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 dark:text-white">Daily Statistics</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">Auto-resets at midnight</p>
          </div>
        </div>
        
        {/* Manual Reset Button (Admin Only) */}
        <button
          onClick={handleManualReset}
          disabled={resetting || loading}
          className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-red-500 to-pink-600 text-white rounded-lg hover:from-red-600 hover:to-pink-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
        >
          <FiRefreshCw className={resetting ? 'animate-spin' : ''} size={16} />
          {resetting ? 'Resetting...' : 'Manual Reset'}
        </button>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded-lg flex items-start gap-2"
        >
          <FiAlertCircle className="text-red-600 dark:text-red-400 mt-0.5" size={18} />
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        </motion.div>
      )}

      {success && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg flex items-start gap-2"
        >
          <FiRefreshCw className="text-green-600 dark:text-green-400 mt-0.5" size={18} />
          <p className="text-sm text-green-600 dark:text-green-400">{success}</p>
        </motion.div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-3 gap-4">
        {/* Today's Count */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-center gap-2 mb-2">
            <FiClock className="text-blue-600 dark:text-blue-400" size={18} />
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400">Today</p>
          </div>
          <p className="text-3xl font-black text-blue-700 dark:text-blue-300">
            {loading ? '...' : stats.today}
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">Detections</p>
        </motion.div>

        {/* Last 7 Days */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-lg p-4 border border-purple-200 dark:border-purple-800"
        >
          <div className="flex items-center gap-2 mb-2">
            <FiCalendar className="text-purple-600 dark:text-purple-400" size={18} />
            <p className="text-xs font-medium text-purple-600 dark:text-purple-400">Last 7 Days</p>
          </div>
          <p className="text-3xl font-black text-purple-700 dark:text-purple-300">
            {loading ? '...' : stats.last7Days}
          </p>
          <p className="text-xs text-purple-600 dark:text-purple-500 mt-1">Total</p>
        </motion.div>

        {/* Currently Active */}
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800 relative overflow-hidden"
        >
          {/* Live indicator */}
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full"
          />
          
          <div className="flex items-center gap-2 mb-2">
            <FiUsers className="text-green-600 dark:text-green-400" size={18} />
            <p className="text-xs font-medium text-green-600 dark:text-green-400">Active Now</p>
          </div>
          <p className="text-3xl font-black text-green-700 dark:text-green-300">
            {loading ? '...' : stats.currentActive}
          </p>
          <p className="text-xs text-green-600 dark:text-green-500 mt-1">Live</p>
        </motion.div>
      </div>

      {/* Info */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-2">
          <FiAlertCircle className="text-cyan-500 mt-0.5" size={14} />
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Daily statistics reset automatically at midnight. All attendance history is preserved in logs.
          </p>
        </div>
      </div>
    </div>
  );
};

export default DailyResetStats;
