/**
 * Optimized Dashboard - Single Screen View
 * Compact, modern design with all information visible without scrolling
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUsers, 
  FiMapPin, 
  FiClock, 
  FiRefreshCw,
  FiAlertCircle,
  FiActivity,
  FiTrendingUp,
  FiZap,
  FiEye
} from 'react-icons/fi';
import { GiTeacher } from 'react-icons/gi';
import { HiSparkles } from 'react-icons/hi';
import { statsAPI, timetableAPI, zoneAPI } from '../api/api';
import { zone1API } from '../api/zone1';
import { format, subDays, getDaysInMonth, startOfMonth, parseISO } from 'date-fns';
import DailyDetectionChart from '../components/DailyDetectionChart';
import TopActiveStudentsChart from '../components/TopActiveStudentsChart';

const Dashboard = () => {
  const navigate = useNavigate();
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
  const [chartPeriod, setChartPeriod] = useState('weekly'); // 'daily', 'weekly', 'monthly'

  const POLLING_INTERVAL = parseInt(import.meta.env.VITE_POLLING_INTERVAL) || 5000;

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Generate zero-filled placeholder data when no real data exists yet
  const generateDummyData = (period) => {
    const today = new Date();
    const data = [];

    let daysCount;
    if (period === 'daily') {
      daysCount = 1;
    } else if (period === 'weekly') {
      daysCount = 7;
    } else {
      daysCount = getDaysInMonth(today);
    }

    for (let i = daysCount - 1; i >= 0; i--) {
      const date = subDays(today, i);
      const isToday = i === 0;

      data.push({
        date: format(date, 'yyyy-MM-dd'),
        dayOfWeek: format(date, 'EEE'),
        studentDetections: 0,
        teacherDetections: 0,
        totalDetections: 0,
        isToday: isToday
      });
    }

    return data;
  };

  // Filter chart data based on selected period
  const filteredChartData = useMemo(() => {
    const today = new Date();
    let sourceData = dailyDetectionData.length > 0 ? dailyDetectionData : generateDummyData(chartPeriod);
    
    if (chartPeriod === 'daily') {
      // Show only today
      const todayStr = format(today, 'yyyy-MM-dd');
      const todayData = sourceData.find(d => d.date === todayStr);
      return todayData ? [todayData] : [{
        date: todayStr,
        dayOfWeek: format(today, 'EEE'),
        studentDetections: 0,
        teacherDetections: 0,
        totalDetections: 0,
        isToday: true
      }];
    } else if (chartPeriod === 'weekly') {
      // Show last 7 days — use 0 for days with no recorded detections
      const last7Days = [];
      for (let i = 6; i >= 0; i--) {
        const date = subDays(today, i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const existingData = sourceData.find(d => d.date === dateStr);
        if (existingData) {
          last7Days.push(existingData);
        } else {
          last7Days.push({
            date: dateStr,
            dayOfWeek: format(date, 'EEE'),
            studentDetections: 0,
            teacherDetections: 0,
            totalDetections: 0,
            isToday: i === 0
          });
        }
      }
      return last7Days;
    } else {
      // Monthly - show all days of current month; 0 for missing or future days
      const daysInMonth = getDaysInMonth(today);
      const monthStart = startOfMonth(today);
      const monthData = [];

      for (let i = 0; i < daysInMonth; i++) {
        const date = new Date(monthStart);
        date.setDate(date.getDate() + i);
        const dateStr = format(date, 'yyyy-MM-dd');
        const existingData = sourceData.find(d => d.date === dateStr);
        const isToday = format(date, 'yyyy-MM-dd') === format(today, 'yyyy-MM-dd');

        if (existingData) {
          monthData.push(existingData);
        } else {
          monthData.push({
            date: dateStr,
            dayOfWeek: format(date, 'EEE'),
            studentDetections: 0,
            teacherDetections: 0,
            totalDetections: 0,
            isToday: isToday
          });
        }
      }
      return monthData;
    }
  }, [dailyDetectionData, chartPeriod]);

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
      
      // Handle zones data - support both array format and { success, data } format
      let zonesArray = [];
      if (zonesData?.success && Array.isArray(zonesData.data)) {
        zonesArray = zonesData.data;
      } else if (Array.isArray(zonesData)) {
        zonesArray = zonesData;
      } else if (zonesData?.data && Array.isArray(zonesData.data)) {
        zonesArray = zonesData.data;
      }
      
      console.log('Zones array to process:', zonesArray);
      
      if (zonesArray.length > 0) {
        console.log('Processing zones:', zonesArray);
        const zonePromises = zonesArray.map(async (zone) => {
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
                color: document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#003d82'
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
                  backgroundColor: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796',
                  boxShadow: document.documentElement.classList.contains('dark') ? '0 0 12px #22d3ee' : '0 0 8px #305796'
                }}
              />
              <span className="text-sm font-bold" style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}>Live</span>
            </div>
          </div>
        </div>

        {/* Live Date and Time Display - Minimal */}
        <div className="flex items-center space-x-4">
          {/* Compact Date Display */}
          <div className="text-right">
            <div className="text-xs font-medium" style={{ color: document.documentElement.classList.contains('dark') ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
              {format(currentTime, 'EEEE, MMMM d, yyyy')}
            </div>
            <div className="text-sm font-bold" style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}>
              {format(currentTime, 'HH:mm:ss')}
            </div>
          </div>
          
          {/* Divider */}
          <div className="w-px h-8" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.3)' : '#d1d5db' }} />
          
          {/* Last Update - Minimal */}
          <div className="text-right">
            <div className="text-xs font-medium" style={{ color: document.documentElement.classList.contains('dark') ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
              Last Update
            </div>
            <div className="text-sm font-bold" style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}>
              {format(lastUpdate, 'HH:mm:ss')}
            </div>
          </div>
          
          {/* Divider */}
          <div className="w-px h-8" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.3)' : '#d1d5db' }} />
          
          {/* Refresh Icon Only */}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleRefresh}
            className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300"
            style={{
              backgroundColor: document.documentElement.classList.contains('dark') 
                ? (loading ? 'rgba(6, 182, 212, 0.2)' : 'rgba(15, 23, 42, 0.8)')
                : (loading ? '#e5e7eb' : '#f3f4f6'),
              border: document.documentElement.classList.contains('dark') ? '1px solid rgba(6, 182, 212, 0.3)' : 'none',
              boxShadow: document.documentElement.classList.contains('dark') 
                ? '0 0 15px rgba(6, 182, 212, 0.1)' 
                : '0 2px 4px rgba(0, 0, 0, 0.06)'
            }}
            onMouseEnter={(e) => {
              if (document.documentElement.classList.contains('dark')) {
                e.currentTarget.style.backgroundColor = 'rgba(6, 182, 212, 0.3)';
                e.currentTarget.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.4)';
                const svg = e.currentTarget.querySelector('svg');
                if (svg) svg.style.color = '#22d3ee';
              } else {
                e.currentTarget.style.backgroundColor = '#305796';
                const svg = e.currentTarget.querySelector('svg');
                if (svg) svg.style.color = '#ffffff';
              }
            }}
            onMouseLeave={(e) => {
              if (document.documentElement.classList.contains('dark')) {
                e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.8)';
                e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.1)';
                const svg = e.currentTarget.querySelector('svg');
                if (svg) svg.style.color = '#22d3ee';
              } else {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                const svg = e.currentTarget.querySelector('svg');
                if (svg) svg.style.color = '#305796';
              }
            }}
          >
            <FiRefreshCw size={18} style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796', transition: 'color 0.3s' }} />
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
              className="relative p-5 rounded-2xl overflow-hidden transition-all duration-300 h-28 group"
                style={{
                  background: document.documentElement.classList.contains('dark')
                    ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                    : '#ffffff',
                  border: document.documentElement.classList.contains('dark')
                    ? '1px solid rgba(6, 182, 212, 0.2)'
                    : 'none',
                  boxShadow: document.documentElement.classList.contains('dark')
                    ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                    : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => {
                  if (document.documentElement.classList.contains('dark')) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(34, 211, 238, 0.08))';
                    e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(6, 182, 212, 0.3), 0 0 60px rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  } else {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (document.documentElement.classList.contains('dark')) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))';
                    e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.2)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  } else {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: document.documentElement.classList.contains('dark') ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
                      Students
                    </p>
                    <motion.p
                      key={stats.totalStudents}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black"
                      style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}
                    >
                      {stats.totalStudents}
                    </motion.p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(99, 102, 241, 0.8)' : '#6365baff',
                      boxShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(99, 102, 241, 0.4)' : 'none'
                    }}
                  >
                    <FiUsers className="text-white" size={22} />
                  </div>
                </div>
              </motion.div>


            {/* Faculty Card */}
            <motion.div
              className="relative p-5 rounded-2xl overflow-hidden transition-all duration-300 h-28 group"
                style={{
                  background: document.documentElement.classList.contains('dark')
                    ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                    : '#ffffff',
                  border: document.documentElement.classList.contains('dark')
                    ? '1px solid rgba(6, 182, 212, 0.2)'
                    : 'none',
                  boxShadow: document.documentElement.classList.contains('dark')
                    ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                    : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => {
                  if (document.documentElement.classList.contains('dark')) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(34, 211, 238, 0.08))';
                    e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(6, 182, 212, 0.3), 0 0 60px rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  } else {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (document.documentElement.classList.contains('dark')) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))';
                    e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.2)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  } else {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: document.documentElement.classList.contains('dark') ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
                      Faculty
                    </p>
                    <motion.p
                      key={stats.totalTeachers}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black"
                      style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}
                    >
                      {stats.totalTeachers}
                  </motion.p>
                </div>
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(16, 185, 129, 0.8)' : '#247e5bff',
                    boxShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(16, 185, 129, 0.4)' : 'none'
                  }}
                >
                  <GiTeacher className="text-white" size={22} />
                </div>
              </div>
            </motion.div>

            {/* Active Presence Card */}
            <motion.div
              className="relative p-5 rounded-2xl overflow-hidden transition-all duration-300 h-28 group"
                style={{
                  background: document.documentElement.classList.contains('dark')
                    ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                    : '#ffffff',
                  border: document.documentElement.classList.contains('dark')
                    ? '1px solid rgba(6, 182, 212, 0.2)'
                    : 'none',
                  boxShadow: document.documentElement.classList.contains('dark')
                    ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                    : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => {
                  if (document.documentElement.classList.contains('dark')) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(34, 211, 238, 0.08))';
                    e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(6, 182, 212, 0.3), 0 0 60px rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  } else {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (document.documentElement.classList.contains('dark')) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))';
                    e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.2)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  } else {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: document.documentElement.classList.contains('dark') ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
                      Active Presence
                    </p>
                    <motion.p
                      key={stats.activePersons}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black"
                      style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}
                    >
                      {stats.activePersons}
                    </motion.p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(168, 85, 247, 0.8)' : '#8849a1ff',
                      boxShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(168, 85, 247, 0.4)' : 'none'
                    }}
                  >
                    <FiActivity className="text-white" size={22} />
                  </div>
                </div>
              </motion.div>


            {/* Zones Card */}
            <motion.div
              className="relative p-5 rounded-2xl overflow-hidden transition-all duration-300 h-28 group"
                style={{
                  background: document.documentElement.classList.contains('dark')
                    ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                    : '#ffffff',
                  border: document.documentElement.classList.contains('dark')
                    ? '1px solid rgba(6, 182, 212, 0.2)'
                    : 'none',
                  boxShadow: document.documentElement.classList.contains('dark')
                    ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                    : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
                }}
                onMouseEnter={(e) => {
                  if (document.documentElement.classList.contains('dark')) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.15), rgba(34, 211, 238, 0.08))';
                    e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.5)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(6, 182, 212, 0.3), 0 0 60px rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  } else {
                    e.currentTarget.style.backgroundColor = '#f9fafb';
                  }
                }}
                onMouseLeave={(e) => {
                  if (document.documentElement.classList.contains('dark')) {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))';
                    e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.2)';
                    e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  } else {
                    e.currentTarget.style.backgroundColor = '#ffffff';
                  }
                }}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: document.documentElement.classList.contains('dark') ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
                      Zones
                    </p>
                    <motion.p
                      key={stats.totalZones}
                      initial={{ scale: 1.3, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="text-3xl font-black"
                      style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}
                    >
                      {stats.totalZones}
                    </motion.p>
                  </div>
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300"
                    style={{
                      backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff',
                      boxShadow: document.documentElement.classList.contains('dark') ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none'
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
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(224, 231, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(6, 182, 212, 0.2)'
                : '1px solid rgba(48, 87, 150, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                : '0 4px 16px rgba(48, 87, 150, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-300"
                  style={{
                    backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.8)' : '#305796',
                    boxShadow: document.documentElement.classList.contains('dark') ? '0 0 15px rgba(6, 182, 212, 0.4)' : 'none'
                  }}
                >
                  <FiTrendingUp className="text-white" size={16} />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#6b7280' }}>
                    Detection Tracking
                  </h2>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{ 
                    backgroundColor: chartPeriod === 'daily' 
                      ? (document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.8)' : '#305796')
                      : (document.documentElement.classList.contains('dark') ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6'), 
                    color: chartPeriod === 'daily' ? 'white' : (document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#6b7280'),
                    border: document.documentElement.classList.contains('dark') ? '1px solid rgba(6, 182, 212, 0.3)' : 'none',
                    boxShadow: chartPeriod === 'daily' && document.documentElement.classList.contains('dark') ? '0 0 15px rgba(6, 182, 212, 0.4)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (chartPeriod !== 'daily') {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.2)' : '#e5e7eb';
                      if (document.documentElement.classList.contains('dark')) e.currentTarget.style.boxShadow = '0 0 10px rgba(6, 182, 212, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (chartPeriod !== 'daily') {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                  onClick={() => setChartPeriod('daily')}
                >
                  Daily
                </button>
                <button 
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{ 
                    backgroundColor: chartPeriod === 'weekly' 
                      ? (document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.8)' : '#305796')
                      : (document.documentElement.classList.contains('dark') ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6'), 
                    color: chartPeriod === 'weekly' ? 'white' : (document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#6b7280'),
                    border: document.documentElement.classList.contains('dark') ? '1px solid rgba(6, 182, 212, 0.3)' : 'none',
                    boxShadow: chartPeriod === 'weekly' && document.documentElement.classList.contains('dark') ? '0 0 15px rgba(6, 182, 212, 0.4)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (chartPeriod !== 'weekly') {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.2)' : '#e5e7eb';
                      if (document.documentElement.classList.contains('dark')) e.currentTarget.style.boxShadow = '0 0 10px rgba(6, 182, 212, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (chartPeriod !== 'weekly') {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                  onClick={() => setChartPeriod('weekly')}
                >
                  Weekly
                </button>
                <button 
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer"
                  style={{ 
                    backgroundColor: chartPeriod === 'monthly' 
                      ? (document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.8)' : '#305796')
                      : (document.documentElement.classList.contains('dark') ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6'), 
                    color: chartPeriod === 'monthly' ? 'white' : (document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#6b7280'),
                    border: document.documentElement.classList.contains('dark') ? '1px solid rgba(6, 182, 212, 0.3)' : 'none',
                    boxShadow: chartPeriod === 'monthly' && document.documentElement.classList.contains('dark') ? '0 0 15px rgba(6, 182, 212, 0.4)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (chartPeriod !== 'monthly') {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.2)' : '#e5e7eb';
                      if (document.documentElement.classList.contains('dark')) e.currentTarget.style.boxShadow = '0 0 10px rgba(6, 182, 212, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (chartPeriod !== 'monthly') {
                      e.currentTarget.style.backgroundColor = document.documentElement.classList.contains('dark') ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6';
                      e.currentTarget.style.boxShadow = 'none';
                    }
                  }}
                  onClick={() => setChartPeriod('monthly')}
                >
                  Monthly
                </button>
              </div>
            </div>
            
            <div className="h-[calc(100%-60px)] relative">
              <DailyDetectionChart data={filteredChartData} loading={chartLoading} />
              {filteredChartData.length > 0 && (
                <div className="absolute bottom-2 left-2">
                  <p className="text-xs font-semibold" style={{ color: document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#003d82' }}>
                    Detected Today: <span className="font-black" style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}>{dailyDetectionData.find(d => d.isToday)?.totalDetections || 0}</span>
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
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(224, 231, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(6, 182, 212, 0.2)'
                : '1px solid rgba(48, 87, 150, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                : '0 4px 16px rgba(48, 87, 150, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold" style={{ color: document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#6b7280' }}>Recent Activity</h2>
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
                    className="p-3 rounded-xl activity-item-hover"
                    style={{
                      background: document.documentElement.classList.contains('dark')
                        ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.6))'
                        : 'rgba(48, 87, 150, 0.05)',
                      border: document.documentElement.classList.contains('dark')
                        ? '1px solid rgba(6, 182, 212, 0.15)'
                        : '1px solid rgba(48, 87, 150, 0.1)',
                      transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-semibold" style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }}>
                          {activity.student?.Name || activity.teacher?.Name || 'Unknown'}
                        </p>
                        <p className="text-xs font-medium" style={{ color: document.documentElement.classList.contains('dark') ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                          {activity.zone?.Zone_Name || 'Unknown'}
                        </p>
                        <p className="text-xs font-semibold mt-0.5" style={{ color: document.documentElement.classList.contains('dark') ? '#67e8f9' : '#305796' }}>
                          {activity.Timestamp ? format(new Date(activity.Timestamp), 'HH:mm') : 'N/A'}
                        </p>
                      </div>
                      <button 
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all cursor-pointer"
                        style={{ 
                          color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796',
                          backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.1)' : 'transparent'
                        }}
                        onClick={() => {
                          if (activity.student?.Student_ID) {
                            navigate(`/students/${activity.student.Student_ID}`);
                          } else if (activity.teacher?.Teacher_ID) {
                            navigate(`/teachers/${activity.teacher.Teacher_ID}`);
                          }
                        }}
                        title={activity.student ? 'View Student' : activity.teacher ? 'View Teacher' : 'View Details'}
                      >
                        <FiEye size={16} />
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
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.9), rgba(224, 231, 255, 0.9))',
              border: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(6, 182, 212, 0.2)'
                : '1px solid rgba(48, 87, 150, 0.3)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                : '0 4px 16px rgba(48, 87, 150, 0.15)',
              backdropFilter: 'blur(10px)',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold" style={{ color: document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#6b7280' }}>Zone Overview</h2>
              <span className="text-xs font-semibold px-2 py-1 rounded-lg" style={{ 
                backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.15)' : 'rgba(48, 87, 150, 0.1)', 
                color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796',
                border: document.documentElement.classList.contains('dark') ? '1px solid rgba(6, 182, 212, 0.3)' : 'none'
              }}>
                {zoneOverview.reduce((sum, z) => sum + (z.personCount || 0), 0)} Total
              </span>
            </div>
            
            <div className="h-[calc(100%-50px)] overflow-y-auto overflow-x-hidden custom-activity-scrollbar pr-1">
              {zoneOverview.length === 0 ? (
                <div className="text-center py-8">
                  <FiMapPin size={32} className="mx-auto mb-2" style={{ color: 'var(--text-soft)' }} />
                  <p style={{ color: 'var(--text-soft)' }} className="text-sm font-medium">No zones configured</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {zoneOverview.map((zone, index) => {
                    const personCount = zone.personCount || 0;
                    const capacity = zone.Capacity || 50;
                    const percentage = Math.min((personCount / capacity) * 100, 100);
                    
                    return (
                      <motion.div
                        key={zone.Zone_id || index}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="p-2.5 rounded-xl zone-item-hover"
                        style={{
                          background: document.documentElement.classList.contains('dark')
                            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.8), rgba(30, 41, 59, 0.6))'
                            : 'rgba(48, 87, 150, 0.05)',
                          border: document.documentElement.classList.contains('dark')
                            ? '1px solid rgba(6, 182, 212, 0.15)'
                            : '1px solid rgba(48, 87, 150, 0.1)',
                          transition: 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)'
                        }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                              style={{ 
                                backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.2)' : 'rgba(48, 87, 150, 0.15)',
                                boxShadow: document.documentElement.classList.contains('dark') ? '0 0 10px rgba(6, 182, 212, 0.2)' : 'none'
                              }}
                            >
                              <FiMapPin size={12} style={{ color: document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796' }} />
                            </div>
                            <span className="text-sm font-semibold" style={{ color: document.documentElement.classList.contains('dark') ? '#c0f0f0' : '#305796' }}>
                              {zone.Zone_Name}
                            </span>
                          </div>
                          <span className="text-sm font-bold" style={{ color: personCount > 0 ? (document.documentElement.classList.contains('dark') ? '#22d3ee' : '#305796') : '#9ca3af' }}>
                            {personCount}
                          </span>
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.1)' : 'rgba(48, 87, 150, 0.1)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${percentage}%` }}
                            transition={{ duration: 0.5, delay: index * 0.05 }}
                            className="h-full rounded-full"
                            style={{ 
                              backgroundColor: personCount > 0 
                                ? (document.documentElement.classList.contains('dark') ? '#06b6d4' : '#305796') 
                                : (document.documentElement.classList.contains('dark') ? 'rgba(6, 182, 212, 0.2)' : 'rgba(48, 87, 150, 0.2)'),
                              minWidth: personCount > 0 ? '4px' : '0',
                              boxShadow: personCount > 0 && document.documentElement.classList.contains('dark') ? '0 0 8px rgba(6, 182, 212, 0.5)' : 'none'
                            }}
                          />
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};

export default Dashboard;
