/**
 * Dashboard Page
 * Main dashboard showing real-time zone tracking, statistics, and recent activity
 * Matches the IntelliSight design reference with futuristic UI
 */

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUsers, 
  FiMapPin, 
  FiClock, 
  FiRefreshCw,
  FiAlertCircle,
  FiActivity,
  FiTrendingUp,
  FiZap
} from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';
import { HiSparkles, HiLightningBolt } from 'react-icons/hi';
import { statsAPI, timetableAPI, zoneAPI } from '../api/api';
import { zone1API } from '../api/zone1';
import { format } from 'date-fns';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalZones: 0,
    activePersons: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [zoneOverview, setZoneOverview] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  // Polling interval (5 seconds)
  const POLLING_INTERVAL = parseInt(import.meta.env.VITE_POLLING_INTERVAL) || 5000;

  // Fetch dashboard data
  const fetchDashboardData = async () => {
    try {
      setError(null);
      
      // Fetch all data in parallel
      const [dashboardStats, recentData, zonesData] = await Promise.all([
        statsAPI.getDashboardStats(),
        timetableAPI.getRecentActivity(10),
        zoneAPI.getAllZones(),
      ]);

      // Update stats with defensive checks
      if (dashboardStats) {
        setStats({
          totalStudents: dashboardStats.totalStudents || 0,
          totalTeachers: dashboardStats.totalTeachers || 0,
          totalZones: dashboardStats.totalZones || 0,
          activePersons: dashboardStats.activePersons || 0,
        });
      }

      // Update recent activity with validation
      if (recentData?.success && Array.isArray(recentData.data)) {
        setRecentActivity(recentData.data.slice(0, 10));
      } else {
        setRecentActivity([]);
      }

      // Fetch persons in each zone for zone overview
      if (zonesData?.success && Array.isArray(zonesData.data)) {
        const zonePromises = zonesData.data.map(async (zone) => {
          try {
            let personCount = 0;
            
            if (zone.Zone_id === 1) {
              // For Zone 1, use Zone 1 Live API to get accurate count
              const [currentPersonsResponse, unknownCountResponse] = await Promise.all([
                zone1API.getCurrentPersons(),
                zone1API.getUnknownFacesCount()
              ]);
              
              const knownCount = currentPersonsResponse.success ? currentPersonsResponse.data.length : 0;
              const unknownCount = unknownCountResponse.success ? unknownCountResponse.count : 0;
              personCount = knownCount + unknownCount;
            } else {
              // For other zones, use the generic API
              const personsData = await zoneAPI.getPersonsInZone(zone.Zone_id);
              personCount = personsData.data?.length || 0;
            }
            
            return {
              ...zone,
              personCount,
            };
          } catch (err) {
            console.error(`Error fetching persons for zone ${zone.Zone_id}:`, err);
            return {
              ...zone,
              personCount: 0,
            };
          }
        });

        const zonesWithCounts = await Promise.all(zonePromises);
        setZoneOverview(zonesWithCounts);
      } else {
        setZoneOverview([]);
      }

      setLastUpdate(new Date());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(`Failed to load dashboard data: ${err.message || 'Unknown error'}`);
      setLoading(false);
      
      // Set safe defaults on error
      setStats(prev => prev.totalZones === 0 ? {
        totalStudents: 0,
        totalTeachers: 0,
        totalZones: 0,
        activePersons: 0,
      } : prev);
      setRecentActivity([]);
      setZoneOverview([]);
    }
  };

  // Initial load
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Real-time polling
  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [POLLING_INTERVAL]);

  // Manual refresh
  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
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

  if (loading && stats.totalZones === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-16 h-16 border-4 border-accent-blue border-t-transparent rounded-full mb-4"
          />
          <p className="text-steel-600 font-medium">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 relative"
    >
      {/* Animated Background Elements - Theme Aware */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden dark:opacity-30 opacity-15">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0, 255, 255, 0.15) 0%, transparent 70%)'
          }}
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [90, 0, 90],
            opacity: [0.6, 0.3, 0.6]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
          }}
        />
      </div>

      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between relative z-10 px-6">
        <div className="relative">
          {/* Glitch Effect Background */}
          <motion.div
            animate={{
              opacity: [0, 0.5, 0],
              x: [-5, 5, -5]
            }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 }}
            className="absolute inset-0 text-4xl font-display font-bold text-cyan-500 blur-sm"
          >
            Dashboard
          </motion.div>
          
          <h1 className="text-5xl font-display font-black relative"
            style={{
              background: 'linear-gradient(135deg, #00ffff 0%, #6366f1 50%, #00ffff 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 30px rgba(0, 255, 255, 0.5)'
            }}
          >
            Dashboard
          </h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 mt-2"
            style={{ color: 'var(--text-soft)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <HiSparkles className="text-cyan-400" />
            </motion.div>
            <span className="font-semibold">Real-time zone tracking & analytics</span>
          </motion.p>
        </div>
        
        <div className="flex items-center space-x-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            whileHover={{ scale: 1.05 }}
            className="px-6 py-3 rounded-2xl flex items-center gap-3 relative overflow-hidden dark:bg-gradient-to-br dark:from-cyan-500/10 dark:to-blue-500/10 bg-gradient-to-br from-indigo-100 to-cyan-100 dark:border-cyan-500/30 border-indigo-300"
            style={{
              boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(0, 255, 255, 0.2)' : '0 4px 20px rgba(99, 102, 241, 0.15)'
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <FiClock className="text-cyan-400" size={20} />
            </motion.div>
            <div>
              <div className="text-xs font-bold text-cyan-300 uppercase tracking-wider">Last Update</div>
              <div className="text-sm font-black text-white">
                {format(lastUpdate, 'HH:mm:ss')}
              </div>
            </div>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
            />
          </motion.div>
          
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(0, 255, 255, 0.6)' }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="px-6 py-3 rounded-2xl flex items-center gap-3 font-bold relative overflow-hidden group dark:bg-gradient-to-br dark:from-cyan-500 dark:to-blue-500 bg-gradient-to-br from-indigo-600 to-indigo-700 border-2 dark:border-white/20 border-indigo-800/30"
            style={{
              boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(0, 255, 255, 0.4)' : '0 4px 20px rgba(99, 102, 241, 0.3)'
            }}
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <FiRefreshCw size={18} className="text-white" />
            </motion.div>
            <span className="text-white relative z-10">Refresh</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
          </motion.button>
        </div>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-card p-4 flex items-start border-l-4 border-red-500"
          >
            <FiAlertCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
            <div>
              <p className="text-red-800 font-semibold">Error</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Statistics Cards */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10 px-6">
        {/* Students Card */}
        <motion.div
          whileHover={{ scale: 1.03, y: -8 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative p-6 rounded-3xl overflow-hidden group cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(0, 128, 255, 0.1))',
            border: '1px solid rgba(0, 255, 255, 0.3)',
            boxShadow: '0 8px 32px rgba(0, 255, 255, 0.2)'
          }}
        >
          {/* Animated Background */}
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(circle at center, rgba(0, 255, 255, 0.2), transparent)'
            }}
          />
          
          {/* Scan Line */}
          <motion.div
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 h-20"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(0, 255, 255, 0.3), transparent)'
            }}
          />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-soft)' }}>
                Students
              </p>
              <motion.p
                key={stats.totalStudents}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black mb-3 dark:text-[#00ffff] text-[#0369a1]"
                style={{
                  textShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(0, 255, 255, 0.8)' : '0 0 10px rgba(3, 105, 161, 0.3)'
                }}
              >
                {stats.totalStudents}
              </motion.p>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-green-400"
                  style={{ boxShadow: '0 0 10px #00ff00' }}
                />
                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Active</span>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.1, y: -3 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, #00ffff, #0080ff)',
                boxShadow: '0 0 30px rgba(0, 255, 255, 0.6)'
              }}
            >
              <FiUsers className="text-white" size={28} />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                }}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Teachers Card */}
        <motion.div
          whileHover={{ scale: 1.03, y: -8 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative p-6 rounded-3xl overflow-hidden group cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            boxShadow: '0 8px 32px rgba(16, 185, 129, 0.2)'
          }}
        >
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(circle at center, rgba(16, 185, 129, 0.2), transparent)'
            }}
          />
          
          <motion.div
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 0.5 }}
            className="absolute inset-0 h-20"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(16, 185, 129, 0.3), transparent)'
            }}
          />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-soft)' }}>
                Teachers
              </p>
              <motion.p
                key={stats.totalTeachers}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black mb-3 dark:text-[#10b981] text-[#047857]"
                style={{
                  textShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(16, 185, 129, 0.8)' : '0 0 10px rgba(4, 120, 87, 0.3)'
                }}
              >
                {stats.totalTeachers}
              </motion.p>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 rounded-full bg-green-400"
                  style={{ boxShadow: '0 0 10px #00ff00' }}
                />
                <span className="text-xs font-bold text-green-400 uppercase tracking-wider">Active</span>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.1, y: -3 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, #10b981, #059669)',
                boxShadow: '0 0 30px rgba(16, 185, 129, 0.6)'
              }}
            >
              <GiTeacher className="text-white" size={28} />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                }}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Active Persons Card */}
        <motion.div
          whileHover={{ scale: 1.03, y: -8 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative p-6 rounded-3xl overflow-hidden group cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(147, 51, 234, 0.1))',
            border: '1px solid rgba(168, 85, 247, 0.3)',
            boxShadow: '0 8px 32px rgba(168, 85, 247, 0.2)'
          }}
        >
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(circle at center, rgba(168, 85, 247, 0.2), transparent)'
            }}
          />
          
          <motion.div
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1 }}
            className="absolute inset-0 h-20"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(168, 85, 247, 0.3), transparent)'
            }}
          />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-soft)' }}>
                In Building
              </p>
              <motion.p
                key={stats.activePersons}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black mb-3 dark:text-[#a855f7] text-[#7c3aed]"
                style={{
                  textShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(168, 85, 247, 0.8)' : '0 0 10px rgba(124, 58, 237, 0.3)'
                }}
              >
                {stats.activePersons}
              </motion.p>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <FiZap size={14} className="text-yellow-400" />
                </motion.div>
                <span className="text-xs font-bold text-purple-400 uppercase tracking-wider">Live</span>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.1, y: -3 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, #a855f7, #9333ea)',
                boxShadow: '0 0 30px rgba(168, 85, 247, 0.6)'
              }}
            >
              <FiActivity className="text-white" size={28} />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                }}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Active Zones Card */}
        <motion.div
          whileHover={{ scale: 1.03, y: -8 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="relative p-6 rounded-3xl overflow-hidden group cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.1))',
            border: '1px solid rgba(99, 102, 241, 0.3)',
            boxShadow: '0 8px 32px rgba(99, 102, 241, 0.2)'
          }}
        >
          <motion.div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
            style={{
              background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.2), transparent)'
            }}
          />
          
          <motion.div
            animate={{ y: ['-100%', '200%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: 1.5 }}
            className="absolute inset-0 h-20"
            style={{
              background: 'linear-gradient(180deg, transparent, rgba(99, 102, 241, 0.3), transparent)'
            }}
          />

          <div className="flex items-start justify-between relative z-10">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-soft)' }}>
                Zones
              </p>
              <motion.p
                key={stats.totalZones}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-5xl font-black mb-3 dark:text-[#6366f1] text-[#4338ca]"
                style={{
                  textShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(99, 102, 241, 0.8)' : '0 0 10px rgba(67, 56, 202, 0.3)'
                }}
              >
                {stats.totalZones}
              </motion.p>
              <div className="flex items-center gap-2">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                >
                  <HiLightningBolt size={14} className="text-yellow-400" />
                </motion.div>
                <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">Monitoring</span>
              </div>
            </div>
            <motion.div
              whileHover={{ scale: 1.1, y: -3 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center relative"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)'
              }}
            >
              <FiMapPin className="text-white" size={28} />
              <motion.div
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                className="absolute inset-0 rounded-2xl"
                style={{
                  background: 'conic-gradient(from 0deg, transparent, rgba(255, 255, 255, 0.3), transparent)',
                }}
              />
            </motion.div>
          </div>
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative z-10 px-6 pb-6">
        {/* Recent Activity */}
        <div className="lg:col-span-2 relative p-6 rounded-3xl overflow-hidden dark:bg-gradient-to-br dark:from-cyan-500/5 dark:to-blue-500/5 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl dark:border-cyan-500/20 border-indigo-200"
          style={{
            boxShadow: document.documentElement.classList.contains('dark') 
              ? '0 8px 32px rgba(0, 255, 255, 0.1)' 
              : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
          }}
        >
          {/* Glass shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h2 className="text-2xl font-display font-bold" style={{ color: 'var(--text-main)' }}>Recent Activity</h2>
            <div className="flex items-center gap-2 text-cyan-400">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-cyan-400 rounded-full"
                style={{ boxShadow: '0 0 10px #00ffff' }}
              />
              <span className="text-sm font-bold uppercase tracking-wider">Live</span>
            </div>
          </div>
          
          {recentActivity.length === 0 ? (
            <div className="text-center py-12 relative z-10">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <FiClock size={48} className="mx-auto mb-4" style={{ color: 'var(--text-soft)' }} />
              </motion.div>
              <p style={{ color: 'var(--text-soft)' }} className="font-medium">No recent activity</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto custom-scrollbar relative z-10 max-h-[400px]">
              <table className="min-w-full">
                <thead className="sticky top-0 z-20 dark:bg-gradient-to-br dark:from-cyan-500/5 dark:to-blue-500/5 bg-gradient-to-br from-white/95 to-indigo-50/95 backdrop-blur-sm">
                  <tr style={{ borderBottom: '1px solid rgba(0, 255, 255, 0.2)' }}>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                      Person
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                      Zone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {recentActivity.map((activity, index) => (
                      <motion.tr
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.05 }}
                        className="transition-all duration-300"
                        style={{ borderBottom: '1px solid rgba(0, 255, 255, 0.1)' }}
                        whileHover={{
                          backgroundColor: 'rgba(0, 255, 255, 0.05)'
                        }}
                      >
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-accent-blue to-accent-cyan rounded-xl flex items-center justify-center shadow-soft">
                              <span className="text-white font-bold text-sm">
                                {activity.student?.Name?.[0] || activity.teacher?.Name?.[0] || '?'}
                              </span>
                            </div>
                            <div className="ml-3">
                              <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                                {activity.student?.Name || activity.teacher?.Name || 'Unknown'}
                              </p>
                              <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                                {activity.PersonType}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider dark:text-[#00ffff] text-[#0369a1] dark:bg-gradient-to-br dark:from-cyan-500/20 dark:to-blue-500/20 bg-gradient-to-br from-sky-200 to-blue-200 dark:border-cyan-500/30 border-sky-600"
                          >
                            {activity.zone?.Zone_Name || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                          {activity.Timestamp ? format(new Date(activity.Timestamp), 'HH:mm a') : 'N/A'}
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Zone Overview */}
        <div className="relative p-6 rounded-3xl overflow-hidden transition-all duration-300 group dark:bg-gradient-to-br dark:from-indigo-500/5 dark:to-purple-500/5 bg-gradient-to-br from-white/80 to-purple-50/80 backdrop-blur-xl dark:border-indigo-500/20 border-purple-200"
          style={{
            boxShadow: document.documentElement.classList.contains('dark') 
              ? '0 8px 32px rgba(99, 102, 241, 0.1)' 
              : '0 10px 40px rgba(139, 92, 246, 0.15), 0 4px 12px rgba(124, 58, 237, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
          }}
          onMouseEnter={(e) => {
            const isDark = document.documentElement.classList.contains('dark');
            e.currentTarget.style.boxShadow = isDark 
              ? '0 8px 40px rgba(99, 102, 241, 0.25)' 
              : '0 12px 50px rgba(139, 92, 246, 0.2), 0 6px 16px rgba(124, 58, 237, 0.15), inset 0 -2px 8px rgba(255, 255, 255, 0.8)';
          }}
          onMouseLeave={(e) => {
            const isDark = document.documentElement.classList.contains('dark');
            e.currentTarget.style.boxShadow = isDark 
              ? '0 8px 32px rgba(99, 102, 241, 0.1)' 
              : '0 10px 40px rgba(139, 92, 246, 0.15), 0 4px 12px rgba(124, 58, 237, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)';
          }}
        >
          {/* Glass shimmer effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
          
          <div className="flex items-center justify-between mb-6 relative z-10">
            <h2 className="text-2xl font-display font-bold" style={{ color: 'var(--text-main)' }}>Zone Overview</h2>
            <div className="flex items-center gap-2 text-indigo-400">
              <motion.div
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2 h-2 bg-indigo-400 rounded-full"
                style={{ boxShadow: '0 0 10px #6366f1' }}
              />
              <span className="text-sm font-bold uppercase tracking-wider">Active</span>
            </div>
          </div>
          
          {zoneOverview.length === 0 ? (
            <div className="text-center py-12 relative z-10">
              <motion.div
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <FiMapPin size={48} className="mx-auto mb-4" style={{ color: 'var(--text-soft)' }} />
              </motion.div>
              <p style={{ color: 'var(--text-soft)' }} className="font-medium">No zones configured</p>
            </div>
          ) : (
            <div className="space-y-3 relative z-10">
              {zoneOverview.map((zone, index) => (
                <motion.div
                  key={zone.Zone_id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.03, x: 5 }}
                >
                  <Link
                    to={zone.Zone_id === 1 ? '/zones/zone1-live' : `/zones/${zone.Zone_id}/live`}
                    className="block p-4 rounded-2xl transition-all duration-300 relative overflow-hidden group"
                    style={{
                      background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.1))',
                      border: '1px solid rgba(99, 102, 241, 0.3)'
                    }}
                  >
                    {/* Hover glow effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                      style={{
                        background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.15), transparent)',
                        boxShadow: '0 0 20px rgba(99, 102, 241, 0.3)'
                      }}
                    />
                    
                    <div className="flex items-center justify-between relative z-10">
                      <div className="flex items-center space-x-3">
                        <div className="w-12 h-12 rounded-2xl flex items-center justify-center relative"
                          style={{
                            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                            boxShadow: '0 0 20px rgba(99, 102, 241, 0.5)'
                          }}
                        >
                          <FiMapPin className="text-white" size={20} />
                        </div>
                        <div>
                          <p className="font-bold" style={{ color: 'var(--text-main)' }}>{zone.Zone_Name}</p>
                          <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>Zone {zone.Zone_id}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <motion.p
                          key={zone.personCount}
                          initial={{ scale: 1.5, opacity: 0 }}
                          animate={{ scale: 1, opacity: 1 }}
                          className="text-3xl font-black dark:text-[#6366f1] text-[#4338ca]"
                          style={{
                            textShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(99, 102, 241, 0.8)' : '0 0 10px rgba(67, 56, 202, 0.3)'
                          }}
                        >
                          {zone.personCount}
                        </motion.p>
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>persons</p>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default Dashboard;
