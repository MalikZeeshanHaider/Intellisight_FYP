/**
 * Optimized Dashboard - Single Screen View
 * Compact, modern design with all information visible without scrolling
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
import { HiSparkles } from 'react-icons/hi';
import { statsAPI, timetableAPI, zoneAPI } from '../api/api';
import { zone1API } from '../api/zone1';
import { format } from 'date-fns';
import DailyDetectionChart from '../components/DailyDetectionChart';
import DailyResetStats from '../components/DailyResetStats';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalStudents: 0,
    totalTeachers: 0,
    totalZones: 0,
    activePersons: 0,
  });
  const [recentActivity, setRecentActivity] = useState([]);
  const [zoneOverview, setZoneOverview] = useState([]);
  const [dailyDetectionData, setDailyDetectionData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [chartLoading, setChartLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());

  const POLLING_INTERVAL = parseInt(import.meta.env.VITE_POLLING_INTERVAL) || 5000;

  // Fetch daily detection statistics
  const fetchDailyDetectionStats = async () => {
    try {
      setChartLoading(true);
      const response = await statsAPI.getDailyDetectionStats();
      
      if (response?.success && response.data?.dailyStats) {
        setDailyDetectionData(response.data.dailyStats);
      } else {
        setDailyDetectionData([]);
      }
      setChartLoading(false);
    } catch (err) {
      console.error('Error fetching daily detection stats:', err);
      setDailyDetectionData([]);
      setChartLoading(false);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setError(null);
      
      const [dashboardStats, recentData, zonesData] = await Promise.all([
        statsAPI.getDashboardStats(),
        timetableAPI.getRecentActivity(5),
        zoneAPI.getAllZones(),
      ]);

      if (dashboardStats) {
        setStats({
          totalStudents: dashboardStats.totalStudents || 0,
          totalTeachers: dashboardStats.totalTeachers || 0,
          totalZones: dashboardStats.totalZones || 0,
          activePersons: dashboardStats.activePersons || 0,
        });
      }

      if (recentData?.success && Array.isArray(recentData.data)) {
        setRecentActivity(recentData.data.slice(0, 5));
      } else {
        setRecentActivity([]);
      }

      if (zonesData?.success && Array.isArray(zonesData.data)) {
        const zonePromises = zonesData.data.map(async (zone) => {
          try {
            let personCount = 0;
            
            if (zone.Zone_id === 1) {
              const [currentPersonsResponse, unknownCountResponse] = await Promise.all([
                zone1API.getCurrentPersons(),
                zone1API.getUnknownFacesCount()
              ]);
              
              const knownCount = currentPersonsResponse.success ? currentPersonsResponse.data.length : 0;
              const unknownCount = unknownCountResponse.success ? unknownCountResponse.count : 0;
              personCount = knownCount + unknownCount;
            } else {
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

  useEffect(() => {
    fetchDashboardData();
    fetchDailyDetectionStats();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchDashboardData();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [POLLING_INTERVAL]);

  const handleRefresh = () => {
    setLoading(true);
    fetchDashboardData();
    fetchDailyDetectionStats();
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.05 }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.3, ease: "easeOut" }
    }
  };

  if (loading && stats.totalZones === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mb-4"
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
      className="h-screen overflow-hidden p-4 relative"
    >
      {/* Subtle Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden dark:opacity-20 opacity-10">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            rotate: [0, 45, 0],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(0, 255, 255, 0.1) 0%, transparent 70%)'
          }}
        />
      </div>

      {/* Compact Header */}
      <motion.div variants={itemVariants} className="flex items-center justify-between mb-4 relative z-10">
        <div>
          <h1 className="text-3xl font-display font-black"
            style={{
              background: 'linear-gradient(135deg, #00ffff 0%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            IntelliSight Dashboard
          </h1>
          <p className="flex items-center gap-2 text-sm mt-1" style={{ color: 'var(--text-soft)' }}>
            <HiSparkles className="text-cyan-400" />
            <span className="font-semibold">Real-time Analytics</span>
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="px-4 py-2 rounded-xl flex items-center gap-2 dark:bg-cyan-500/10 bg-indigo-100 dark:border-cyan-500/30 border-indigo-300"
          >
            <FiClock className="text-cyan-400" size={16} />
            <div className="text-xs">
              <div className="font-bold text-cyan-300">Last Update</div>
              <div className="text-sm font-black text-white">
                {format(lastUpdate, 'HH:mm:ss')}
              </div>
            </div>
          </motion.div>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl flex items-center gap-2 font-bold dark:bg-gradient-to-br dark:from-cyan-500 dark:to-blue-500 bg-gradient-to-br from-indigo-600 to-indigo-700 border-2 dark:border-white/20 border-indigo-800/30"
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <FiRefreshCw size={16} className="text-white" />
            </motion.div>
            <span className="text-white text-sm">Refresh</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-3 p-3 rounded-xl flex items-start border-l-4 border-red-500 dark:bg-red-500/10 bg-red-50"
          >
            <FiAlertCircle className="text-red-500 mt-0.5 mr-2 flex-shrink-0" size={18} />
            <div>
              <p className="text-red-800 font-semibold text-sm">Error</p>
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content - Grid Layout */}
      <div className="grid grid-cols-12 gap-4 h-[calc(100vh-120px)]">
        
        {/* Left Column - Stats & Chart */}
        <div className="col-span-8 space-y-4 overflow-hidden">
          
          {/* Compact Stats Cards */}
          <motion.div variants={itemVariants} className="grid grid-cols-4 gap-3">
            {/* Students Card */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative p-4 rounded-2xl overflow-hidden group cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 255, 255, 0.1), rgba(0, 128, 255, 0.1))',
                border: '1px solid rgba(0, 255, 255, 0.3)',
                boxShadow: '0 4px 16px rgba(0, 255, 255, 0.2)'
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-soft)' }}>
                    Students
                  </p>
                  <motion.p
                    key={stats.totalStudents}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl font-black dark:text-[#00ffff] text-[#0369a1]"
                  >
                    {stats.totalStudents}
                  </motion.p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #00ffff, #0080ff)',
                    boxShadow: '0 0 20px rgba(0, 255, 255, 0.4)'
                  }}
                >
                  <FiUsers className="text-white" size={20} />
                </div>
              </div>
            </motion.div>

            {/* Teachers Card */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative p-4 rounded-2xl overflow-hidden group cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(5, 150, 105, 0.1))',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                boxShadow: '0 4px 16px rgba(16, 185, 129, 0.2)'
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-soft)' }}>
                    Teachers
                  </p>
                  <motion.p
                    key={stats.totalTeachers}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl font-black dark:text-[#10b981] text-[#047857]"
                  >
                    {stats.totalTeachers}
                  </motion.p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    boxShadow: '0 0 20px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <GiTeacher className="text-white" size={20} />
                </div>
              </div>
            </motion.div>

            {/* Active Persons Card */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative p-4 rounded-2xl overflow-hidden group cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(168, 85, 247, 0.1), rgba(147, 51, 234, 0.1))',
                border: '1px solid rgba(168, 85, 247, 0.3)',
                boxShadow: '0 4px 16px rgba(168, 85, 247, 0.2)'
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-soft)' }}>
                    In Building
                  </p>
                  <motion.p
                    key={stats.activePersons}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl font-black dark:text-[#a855f7] text-[#7c3aed]"
                  >
                    {stats.activePersons}
                  </motion.p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #a855f7, #9333ea)',
                    boxShadow: '0 0 20px rgba(168, 85, 247, 0.4)'
                  }}
                >
                  <FiActivity className="text-white" size={20} />
                </div>
              </div>
            </motion.div>

            {/* Zones Card */}
            <motion.div
              whileHover={{ scale: 1.02, y: -2 }}
              className="relative p-4 rounded-2xl overflow-hidden group cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.1))',
                border: '1px solid rgba(99, 102, 241, 0.3)',
                boxShadow: '0 4px 16px rgba(99, 102, 241, 0.2)'
              }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-soft)' }}>
                    Zones
                  </p>
                  <motion.p
                    key={stats.totalZones}
                    initial={{ scale: 1.3, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-3xl font-black dark:text-[#6366f1] text-[#4338ca]"
                  >
                    {stats.totalZones}
                  </motion.p>
                </div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  <FiMapPin className="text-white" size={20} />
                </div>
              </div>
            </motion.div>
          </motion.div>

          {/* Daily Reset Statistics */}
          <motion.div variants={itemVariants}>
            <DailyResetStats />
          </motion.div>

          {/* Daily Detection Chart - Compact */}
          <motion.div variants={itemVariants} className="relative p-4 rounded-2xl overflow-hidden h-[calc(100%-300px)]"
            style={{
              background: document.documentElement.classList.contains('dark')
                ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.05), rgba(99, 102, 241, 0.05))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(224, 231, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(0, 255, 255, 0.2)'
                : '1px solid rgba(99, 102, 241, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 16px rgba(0, 255, 255, 0.15)'
                : '0 4px 16px rgba(99, 102, 241, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #00ffff, #6366f1)',
                    boxShadow: '0 0 15px rgba(0, 255, 255, 0.4)',
                  }}
                >
                  <FiTrendingUp className="text-white" size={16} />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold" style={{ color: 'var(--text-main)' }}>
                    Daily Detection Statistics
                  </h2>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                    Population detected each day this month
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <div className="flex items-center gap-1 text-cyan-400">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-2 h-2 bg-cyan-400 rounded-full"
                    style={{ boxShadow: '0 0 8px #00ffff' }}
                  />
                  <span className="text-xs font-bold uppercase">Live</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>Today's Total</p>
                  <p className="text-2xl font-black text-cyan-400">
                    {dailyDetectionData.find(d => d.isToday)?.totalDetections || 0}
                  </p>
                </div>
              </div>
            </div>
            
            <div className="h-[calc(100%-60px)]">
              <DailyDetectionChart data={dailyDetectionData} loading={chartLoading} />
            </div>
          </motion.div>
        </div>

        {/* Right Column - Recent Activity & Zones */}
        <div className="col-span-4 space-y-4 overflow-hidden">
          
          {/* Recent Activity - Compact */}
          <motion.div variants={itemVariants} className="relative p-4 rounded-2xl overflow-hidden h-[50%]"
            style={{
              background: document.documentElement.classList.contains('dark')
                ? 'linear-gradient(135deg, rgba(0, 255, 255, 0.05), rgba(99, 102, 241, 0.05))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(224, 231, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(0, 255, 255, 0.2)'
                : '1px solid rgba(99, 102, 241, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 16px rgba(0, 255, 255, 0.15)'
                : '0 4px 16px rgba(99, 102, 241, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-display font-bold" style={{ color: 'var(--text-main)' }}>Recent Activity</h2>
              <div className="flex items-center gap-1 text-cyan-400">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 bg-cyan-400 rounded-full"
                  style={{ boxShadow: '0 0 8px #00ffff' }}
                />
                <span className="text-xs font-bold uppercase">Live</span>
              </div>
            </div>
            
            <div className="space-y-2 overflow-y-auto max-h-[calc(100%-50px)] custom-scrollbar">
              {recentActivity.length === 0 ? (
                <div className="text-center py-8">
                  <FiClock size={32} className="mx-auto mb-2" style={{ color: 'var(--text-soft)' }} />
                  <p style={{ color: 'var(--text-soft)' }} className="text-sm font-medium">No recent activity</p>
                </div>
              ) : (
                recentActivity.map((activity, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-3 rounded-xl transition-all duration-200"
                    style={{
                      background: 'rgba(0, 255, 255, 0.05)',
                      border: '1px solid rgba(0, 255, 255, 0.1)'
                    }}
                    whileHover={{
                      background: 'rgba(0, 255, 255, 0.1)',
                      borderColor: 'rgba(0, 255, 255, 0.3)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-lg flex items-center justify-center">
                          <span className="text-white font-bold text-xs">
                            {activity.student?.Name?.[0] || activity.teacher?.Name?.[0] || '?'}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>
                            {activity.student?.Name || activity.teacher?.Name || 'Unknown'}
                          </p>
                          <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>
                            {activity.zone?.Zone_Name || 'Unknown'}
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold text-cyan-400">
                        {activity.Timestamp ? format(new Date(activity.Timestamp), 'HH:mm') : 'N/A'}
                      </span>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>

          {/* Zone Overview - Compact */}
          <motion.div variants={itemVariants} className="relative p-4 rounded-2xl overflow-hidden h-[calc(50%-16px)]"
            style={{
              background: document.documentElement.classList.contains('dark')
                ? 'linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(243, 232, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(99, 102, 241, 0.2)'
                : '1px solid rgba(168, 85, 247, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 16px rgba(99, 102, 241, 0.15)'
                : '0 4px 16px rgba(168, 85, 247, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-display font-bold" style={{ color: 'var(--text-main)' }}>Zone Overview</h2>
              <div className="flex items-center gap-1 text-indigo-400">
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-2 h-2 bg-indigo-400 rounded-full"
                  style={{ boxShadow: '0 0 8px #6366f1' }}
                />
                <span className="text-xs font-bold uppercase">Active</span>
              </div>
            </div>
            
            <div className="space-y-2 overflow-y-auto max-h-[calc(100%-50px)] custom-scrollbar">
              {zoneOverview.length === 0 ? (
                <div className="text-center py-8">
                  <FiMapPin size={32} className="mx-auto mb-2" style={{ color: 'var(--text-soft)' }} />
                  <p style={{ color: 'var(--text-soft)' }} className="text-sm font-medium">No zones configured</p>
                </div>
              ) : (
                zoneOverview.map((zone, index) => (
                  <motion.div
                    key={zone.Zone_id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                  >
                    <Link
                      to={zone.Zone_id === 1 ? '/zones/zone1-live' : `/zones/${zone.Zone_id}/live`}
                      className="block p-3 rounded-xl transition-all duration-200"
                      style={{
                        background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(79, 70, 229, 0.1))',
                        border: '1px solid rgba(99, 102, 241, 0.2)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                            style={{
                              background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                              boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
                            }}
                          >
                            <FiMapPin className="text-white" size={14} />
                          </div>
                          <div>
                            <p className="text-sm font-bold" style={{ color: 'var(--text-main)' }}>{zone.Zone_Name}</p>
                            <p className="text-xs font-medium" style={{ color: 'var(--text-soft)' }}>Zone {zone.Zone_id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <motion.p
                            key={zone.personCount}
                            initial={{ scale: 1.3, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="text-2xl font-black dark:text-[#6366f1] text-[#4338ca]"
                          >
                            {zone.personCount}
                          </motion.p>
                          <p className="text-xs font-bold uppercase" style={{ color: 'var(--text-soft)' }}>persons</p>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
