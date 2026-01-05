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
import ZoneDistributionPieChart from '../components/ZoneDistributionPieChart';
import TopActiveStudentsChart from '../components/TopActiveStudentsChart';
import WeeklyTrendsChart, { TrendSparkline } from '../components/WeeklyTrendsChart';

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
  const [currentTime, setCurrentTime] = useState(new Date());

  const POLLING_INTERVAL = parseInt(import.meta.env.VITE_POLLING_INTERVAL) || 5000;

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Fetch daily detection statistics
  const fetchDailyDetectionStats = async () => {
    try {
      setChartLoading(true);
      console.log('Fetching daily detection stats...');
      const response = await statsAPI.getDailyDetectionStats();
      
      console.log('Daily detection stats response:', response);
      
      if (response?.success && response.data?.dailyStats) {
        console.log('Daily stats data:', response.data.dailyStats);
        setDailyDetectionData(response.data.dailyStats);
      } else {
        console.warn('No daily stats data in response');
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

      console.log('Zones API Response:', zonesData);
      
      if (zonesData?.success && Array.isArray(zonesData.data)) {
        console.log('Processing zones:', zonesData.data);
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
        console.log('Zones with counts:', zonesWithCounts);
        setZoneOverview(zonesWithCounts);
      } else {
        console.warn('No zones data or invalid format:', zonesData);
        // If we have zone count in stats but no zone data, create placeholder zones
        if (dashboardStats?.totalZones > 0) {
          console.log('Creating placeholder zones based on totalZones:', dashboardStats.totalZones);
          const placeholderZones = Array.from({ length: dashboardStats.totalZones }, (_, i) => ({
            Zone_id: i + 1,
            Zone_Name: `Zone ${i + 1}`,
            personCount: 0,
            Capacity: 50
          }));
          setZoneOverview(placeholderZones);
        } else {
          setZoneOverview([]);
        }
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
          <div className="flex items-center gap-3">
            <h1 className="text-4xl font-display font-black"
              style={{
                color: '#003d82'
              }}
            >
              Dashboard
            </h1>
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-2.5 h-2.5 rounded-full"
                style={{ 
                  backgroundColor: '#305796',
                  boxShadow: '0 0 8px #305796'
                }}
              />
              <span className="text-sm font-bold" style={{ color: '#305796' }}>Live</span>
            </div>
          </div>
        </div>

        {/* Live Date and Time Display - Minimal */}
        <div className="flex items-center space-x-4">
          {/* Compact Date Display */}
          <div className="text-right">
            <div className="text-xs font-medium text-gray-500">
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="text-sm font-bold" style={{ color: '#305796' }}>
              {format(currentTime, 'HH:mm:ss')}
            </div>
          </div>
          
          {/* Divider */}
          <div className="w-px h-8 bg-gray-300" />
          
          {/* Last Update - Minimal */}
          <div className="text-right">
            <div className="text-xs font-medium text-gray-500">
              Last Update
            </div>
            <div className="text-sm font-bold" style={{ color: '#305796' }}>
              {format(lastUpdate, 'HH:mm:ss')}
            </div>
          </div>
          
          {/* Divider */}
          <div className="w-px h-8 bg-gray-300" />
          
          {/* Refresh Icon Only */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleRefresh}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              backgroundColor: loading ? '#e5e7eb' : '#f3f4f6',
              boxShadow: '0 2px 4px rgba(0, 0, 0, 0.06)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#305796';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) svg.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f3f4f6';
              const svg = e.currentTarget.querySelector('svg');
              if (svg) svg.style.color = '#305796';
            }}
          >
            <FiRefreshCw size={18} style={{ color: '#305796', transition: 'color 0.3s' }} />
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
              className="relative p-5 rounded-2xl overflow-hidden transition-all duration-200 h-28"
                style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-600">
                      Students
                    </p>
                    <motion.p
                      key={stats.totalStudents}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black"
                      style={{ color: '#305796' }}
                    >
                      {stats.totalStudents}
                    </motion.p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      backgroundColor: '#6365baff'
                    }}
                  >
                    <FiUsers className="text-white" size={22} />
                  </div>
                </div>
              </motion.div>


            {/* Teachers Card */}
            <motion.div
              className="relative p-5 rounded-2xl overflow-hidden transition-all duration-200 h-28"
                style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-600">
                      Teachers
                    </p>
                    <motion.p
                      key={stats.totalTeachers}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black"
                      style={{ color: '#305796' }}
                    >
                      {stats.totalTeachers}
                  </motion.p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                  style={{
                    backgroundColor: '#247e5bff'
                  }}
                >
                  <GiTeacher className="text-white" size={22} />
                </div>
              </div>
            </motion.div>

            {/* Active Presence Card */}
            <motion.div
              className="relative p-5 rounded-2xl overflow-hidden transition-all duration-200 h-28"
                style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-600">
                      Active Presence
                    </p>
                    <motion.p
                      key={stats.activePersons}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black"
                      style={{ color: '#305796' }}
                    >
                      {stats.activePersons}
                    </motion.p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      backgroundColor: '#8849a1ff'
                    }}
                  >
                    <FiActivity className="text-white" size={22} />
                  </div>
                </div>
              </motion.div>


            {/* Zones Card */}
            <motion.div
              className="relative p-5 rounded-2xl overflow-hidden transition-all duration-200 h-28"
                style={{
                  backgroundColor: '#ffffff',
                  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1 text-gray-600">
                      Zones
                    </p>
                    <motion.p
                      key={stats.totalZones}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black"
                      style={{ color: '#305796' }}
                    >
                      {stats.totalZones}
                    </motion.p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{
                      backgroundColor: '#3ca1afff'
                    }}
                  >
                    <FiMapPin className="text-white" size={22} />
                  </div>
                </div>
              </motion.div>
          </motion.div>

          {/* Daily Detection Chart - Compact */}
          <motion.div variants={itemVariants} className="relative p-4 rounded-2xl overflow-hidden h-[calc(100%-140px)]"
            style={{
              background: document.documentElement.classList.contains('dark')
                ? 'linear-gradient(135deg, rgba(48, 87, 150, 0.05), rgba(48, 87, 150, 0.05))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(224, 231, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(48, 87, 150, 0.2)'
                : '1px solid rgba(48, 87, 150, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 16px rgba(48, 87, 150, 0.15)'
                : '0 4px 16px rgba(48, 87, 150, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center"
                  style={{
                    backgroundColor: '#305796'
                  }}
                >
                  <FiTrendingUp className="text-white" size={16} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: '#6b7280' }}>
                    Detection Tracking
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#305796', color: 'white' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#244170'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#305796'}
                  onClick={() => console.log('Daily filter clicked')}
                >
                  Daily
                </button>
                <button 
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onClick={() => console.log('Weekly filter clicked')}
                >
                  Weekly
                </button>
                <button 
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e5e7eb'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f3f4f6'}
                  onClick={() => console.log('Monthly filter clicked')}
                >
                  Monthly
                </button>
              </div>
            </div>
            
            <div className="h-[calc(100%-60px)] relative">
              <DailyDetectionChart data={dailyDetectionData} loading={chartLoading} />
              {dailyDetectionData.length > 0 && (
                <div className="absolute bottom-2 left-2">
                  <p className="text-xs font-semibold" style={{ color: '#6b7280' }}>
                    Detected Today: <span className="font-black" style={{ color: '#305796' }}>{dailyDetectionData.find(d => d.isToday)?.totalDetections || 0}</span>
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Right Column - Recent Activity & Zones */}
        <div className="col-span-4 space-y-4 overflow-hidden">
          
          {/* Recent Activity - Compact */}
          <motion.div variants={itemVariants} className="relative p-4 rounded-2xl overflow-hidden h-[50%]"
            style={{
              background: document.documentElement.classList.contains('dark')
                ? 'linear-gradient(135deg, rgba(48, 87, 150, 0.05), rgba(48, 87, 150, 0.05))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(224, 231, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(48, 87, 150, 0.2)'
                : '1px solid rgba(48, 87, 150, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 16px rgba(48, 87, 150, 0.15)'
                : '0 4px 16px rgba(48, 87, 150, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold" style={{ color: '#6b7280' }}>Recent Activity</h2>
            </div>
            
            <div className="space-y-2 overflow-y-auto overflow-x-hidden max-h-[calc(100%-50px)] custom-activity-scrollbar">
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
                    whileHover={{
                      background: 'rgba(48, 87, 150, 0.12)',
                      borderColor: 'rgba(48, 87, 150, 0.3)'
                    }}
                    className="p-3 rounded-xl transition-all duration-150"
                    style={{
                      background: 'rgba(48, 87, 150, 0.05)',
                      border: '1px solid rgba(48, 87, 150, 0.1)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: '#305796' }}>
                          {activity.student?.Name || activity.teacher?.Name || 'Unknown'}
                        </p>
                        <p className="text-xs font-medium" style={{ color: '#6b7280' }}>
                          {activity.zone?.Zone_Name || 'Unknown'}
                        </p>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: '#305796' }}>
                          {activity.Timestamp ? format(new Date(activity.Timestamp), 'HH:mm') : 'N/A'}
                        </p>
                      </div>
                      <button 
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:bg-white"
                        style={{ color: '#305796' }}
                        onClick={() => console.log('View details:', activity)}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      </button>
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
                ? 'linear-gradient(135deg, rgba(48, 87, 150, 0.05), rgba(48, 87, 150, 0.05))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(224, 231, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(48, 87, 150, 0.2)'
                : '1px solid rgba(48, 87, 150, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 16px rgba(48, 87, 150, 0.15)'
                : '0 4px 16px rgba(48, 87, 150, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold" style={{ color: '#6b7280' }}>Zone Overview</h2>
            </div>
            
            <div className="h-[calc(100%-50px)] flex items-center justify-center">
              {zoneOverview.length === 0 ? (
                <div className="text-center py-8">
                  <FiMapPin size={32} className="mx-auto mb-2" style={{ color: 'var(--text-soft)' }} />
                  <p style={{ color: 'var(--text-soft)' }} className="text-sm font-medium">No zones configured</p>
                </div>
              ) : (
                <ZoneDistributionPieChart 
                  data={zoneOverview.map(zone => ({
                    name: zone.Zone_Name,
                    value: zone.personCount || 0,
                    capacity: zone.Capacity || 50
                  }))}
                  showLegend={true}
                  height={180}
                />
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
