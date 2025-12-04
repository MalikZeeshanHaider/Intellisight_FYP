import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiFilter, FiClock, FiMapPin, FiUsers, FiChevronRight } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi';
import { getAttendanceLogs } from '../api/faceRecognition';
import { zoneAPI } from '../api/api';
import CustomSelect from '../components/CustomSelect';

export default function AttendanceLogs() {
  const [logs, setLogs] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({ total: 0, limit: 50, offset: 0 });
  
  // Filters
  const [filters, setFilters] = useState({
    zoneId: '',
    personType: '',
    startDate: '',
    endDate: ''
  });

  useEffect(() => {
    fetchZones();
    fetchLogs();
  }, [filters, pagination.offset]);

  const fetchZones = async () => {
    try {
      const response = await zoneAPI.getAllZones();
      setZones(response.data || []);
    } catch (err) {
      console.error('Error fetching zones:', err);
    }
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await getAttendanceLogs({
        ...filters,
        limit: pagination.limit,
        offset: pagination.offset
      });
      setLogs(response.data || []);
      setPagination(prev => ({ ...prev, total: response.pagination?.total || 0 }));
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load attendance logs');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, offset: 0 }));
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes) => {
    if (!minutes) return '-';
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const exportToCSV = () => {
    const headers = ['Date', 'Zone', 'Name', 'Type', 'Department', 'Entry Time', 'Exit Time', 'Duration'];
    const rows = logs.map(log => [
      new Date(log.entryTime).toLocaleDateString(),
      log.zone?.Zone_Name || '',
      log.person?.Name || '',
      log.personType,
      log.person?.Department || '',
      formatDateTime(log.entryTime),
      formatDateTime(log.exitTime),
      formatDuration(log.duration)
    ]);
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-6 relative"
    >
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden" style={{ zIndex: -1, pointerEvents: 'none' }}>
        {/* Gradient Orbs */}
        <div className="absolute top-20 right-20 w-96 h-96 rounded-full opacity-20 blur-3xl dark:opacity-30"
          style={{ background: 'radial-gradient(circle, #8b5cf6 0%, transparent 70%)' }} />
        <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full opacity-20 blur-3xl dark:opacity-30"
          style={{ background: 'radial-gradient(circle, #6366f1 0%, transparent 70%)' }} />
        
        {/* Scan Lines Effect */}
        <svg className="absolute inset-0 w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id="log-line-gradient-1" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
              <stop offset="50%" stopColor="rgb(139, 92, 246)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="rgb(139, 92, 246)" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="log-line-gradient-2" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
              <stop offset="50%" stopColor="rgb(99, 102, 241)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="rgb(99, 102, 241)" stopOpacity="0" />
            </linearGradient>
          </defs>
          
          {/* Diagonal scan lines */}
          <motion.line 
            x1="-10%" y1="20%" x2="110%" y2="25%" 
            stroke="url(#log-line-gradient-1)" 
            strokeWidth="1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 0],
              opacity: [0, 0.5, 0],
              x1: ["-10%", "10%", "30%"],
              x2: ["110%", "130%", "150%"]
            }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
          />
          
          <motion.line 
            x1="-10%" y1="60%" x2="110%" y2="55%" 
            stroke="url(#log-line-gradient-2)" 
            strokeWidth="1.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ 
              pathLength: [0, 1, 0],
              opacity: [0, 0.5, 0],
              x1: ["-10%", "10%", "30%"],
              x2: ["110%", "130%", "150%"]
            }}
            transition={{ duration: 22, repeat: Infinity, ease: "linear", delay: 5 }}
          />
        </svg>
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex justify-between items-start relative mb-8"
        style={{ zIndex: 20 }}
      >
        <div>
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-display font-bold mb-2 relative"
          >
            <span
              style={{
                background: document.documentElement.classList.contains('dark')
                  ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)'
                  : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                textShadow: document.documentElement.classList.contains('dark')
                  ? '0 0 40px rgba(139, 92, 246, 0.4), 0 0 20px rgba(139, 92, 246, 0.3)'
                  : '0 0 30px rgba(124, 58, 237, 0.2), 0 0 15px rgba(124, 58, 237, 0.15)'
              }}
            >
              Attendance Logs
            </span>
          </motion.h1>
          <p className="flex items-center gap-2" style={{ color: 'var(--text-soft)' }}>
            <HiSparkles className="text-purple-400" />
            View entry and exit history for all zones
          </p>
        </div>
        
        <motion.button
          whileHover={{ 
            scale: 1.05,
            boxShadow: document.documentElement.classList.contains('dark')
              ? '0 0 40px rgba(139, 92, 246, 0.6), 0 8px 32px rgba(139, 92, 246, 0.4)'
              : '0 0 30px rgba(124, 58, 237, 0.4), 0 8px 24px rgba(124, 58, 237, 0.3)'
          }}
          whileTap={{ scale: 0.95 }}
          onClick={exportToCSV}
          disabled={logs.length === 0}
          className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 backdrop-blur-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: document.documentElement.classList.contains('dark')
              ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)'
              : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
            color: '#fff',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            boxShadow: document.documentElement.classList.contains('dark')
              ? '0 8px 32px rgba(139, 92, 246, 0.4)'
              : '0 8px 16px rgba(124, 58, 237, 0.15), 0 4px 8px rgba(124, 58, 237, 0.1), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
          }}
        >
          <FiDownload size={18} />
          <span>Export CSV</span>
        </motion.button>
      </motion.div>

      {/* Filters Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="relative p-6 rounded-3xl overflow-visible dark:bg-gradient-to-br dark:from-purple-500/5 dark:to-indigo-500/5 bg-gradient-to-br from-white/80 to-purple-50/80 backdrop-blur-xl dark:border-purple-500/20 border-purple-200 mt-8"
        style={{
          boxShadow: document.documentElement.classList.contains('dark') 
            ? '0 8px 32px rgba(139, 92, 246, 0.15)' 
            : '0 10px 40px rgba(124, 58, 237, 0.15), 0 4px 12px rgba(139, 92, 246, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
        }}
      >
        {/* Glass shimmer effect */}
        <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none" />
        
        <div className="flex items-center gap-3 mb-6 relative z-10">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{
              background: document.documentElement.classList.contains('dark')
                ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)'
                : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
              boxShadow: document.documentElement.classList.contains('dark')
                ? '0 0 24px rgba(139, 92, 246, 0.5)'
                : '0 8px 16px rgba(124, 58, 237, 0.25)'
            }}
          >
            <FiFilter className="text-white" size={20} />
          </div>
          <h3 className="text-2xl font-display font-bold" style={{ color: 'var(--text-main)' }}>
            Filter Logs
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 relative z-10">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
              <div className="flex items-center gap-2">
                <FiMapPin size={14} className="text-purple-400" />
                Zone
              </div>
            </label>
            <CustomSelect
              value={filters.zoneId}
              onChange={(e) => handleFilterChange('zoneId', e.target.value)}
              placeholder="All Zones"
              options={[
                { value: '', label: 'All Zones' },
                ...zones.map(zone => ({
                  value: zone.Zone_id,
                  label: zone.Zone_Name
                }))
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
              <div className="flex items-center gap-2">
                <FiUsers size={14} className="text-purple-400" />
                Person Type
              </div>
            </label>
            <CustomSelect
              value={filters.personType}
              onChange={(e) => handleFilterChange('personType', e.target.value)}
              placeholder="All Types"
              options={[
                { value: '', label: 'All Types' },
                { value: 'Student', label: 'Students' },
                { value: 'Teacher', label: 'Teachers' }
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
              <div className="flex items-center gap-2">
                <FiClock size={14} className="text-purple-400" />
                Start Date
              </div>
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl transition-all duration-300 focus:outline-none"
              style={{
                background: 'transparent',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                color: 'var(--text-main)',
                boxShadow: document.documentElement.classList.contains('dark')
                  ? '0 0 10px rgba(139, 92, 246, 0.3)'
                  : '0 0 8px rgba(124, 58, 237, 0.2)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8b5cf6';
                e.target.style.boxShadow = document.documentElement.classList.contains('dark')
                  ? '0 0 20px rgba(139, 92, 246, 0.6), 0 0 40px rgba(139, 92, 246, 0.3)'
                  : '0 0 15px rgba(124, 58, 237, 0.5), 0 0 30px rgba(124, 58, 237, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                e.target.style.boxShadow = document.documentElement.classList.contains('dark')
                  ? '0 0 10px rgba(139, 92, 246, 0.3)'
                  : '0 0 8px rgba(124, 58, 237, 0.2)';
              }}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
              <div className="flex items-center gap-2">
                <FiClock size={14} className="text-purple-400" />
                End Date
              </div>
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl transition-all duration-300 focus:outline-none"
              style={{
                background: 'transparent',
                border: '2px solid rgba(139, 92, 246, 0.3)',
                color: 'var(--text-main)',
                boxShadow: document.documentElement.classList.contains('dark')
                  ? '0 0 10px rgba(139, 92, 246, 0.3)'
                  : '0 0 8px rgba(124, 58, 237, 0.2)'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#8b5cf6';
                e.target.style.boxShadow = document.documentElement.classList.contains('dark')
                  ? '0 0 20px rgba(139, 92, 246, 0.6), 0 0 40px rgba(139, 92, 246, 0.3)'
                  : '0 0 15px rgba(124, 58, 237, 0.5), 0 0 30px rgba(124, 58, 237, 0.2)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = 'rgba(139, 92, 246, 0.3)';
                e.target.style.boxShadow = document.documentElement.classList.contains('dark')
                  ? '0 0 10px rgba(139, 92, 246, 0.3)'
                  : '0 0 8px rgba(124, 58, 237, 0.2)';
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="rounded-2xl p-4 backdrop-blur-xl relative z-10 mt-8"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444',
              boxShadow: '0 8px 32px rgba(239, 68, 68, 0.2)'
            }}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-500 font-bold">!</span>
              </div>
              {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-3xl overflow-hidden backdrop-blur-xl relative z-10 dark:bg-gradient-to-br dark:from-purple-500/5 dark:via-transparent dark:to-indigo-500/5 mt-8"
        style={{
          background: document.documentElement.classList.contains('dark')
            ? 'rgba(13, 27, 36, 0.6)'
            : 'rgba(255, 255, 255, 0.8)',
          border: document.documentElement.classList.contains('dark')
            ? '1px solid rgba(139, 92, 246, 0.2)'
            : '1px solid rgba(124, 58, 237, 0.15)',
          boxShadow: document.documentElement.classList.contains('dark')
            ? '0 8px 32px rgba(0, 0, 0, 0.3)'
            : '0 8px 32px rgba(124, 58, 237, 0.08), 0 4px 16px rgba(124, 58, 237, 0.05), inset 0 1px 0 rgba(255, 255, 255, 0.1)'
        }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="backdrop-blur-sm" style={{ 
                background: document.documentElement.classList.contains('dark')
                  ? 'rgba(139, 92, 246, 0.1)'
                  : 'rgba(124, 58, 237, 0.05)'
              }}>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                  <div className="flex items-center gap-2">
                    <FiMapPin className="text-purple-400" size={14} />
                    Zone
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Department</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                  <div className="flex items-center gap-2">
                    <FiClock className="text-purple-400" size={14} />
                    Entry Time
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>
                  <div className="flex items-center gap-2">
                    <FiClock className="text-purple-400" size={14} />
                    Exit Time
                  </div>
                </th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{
                          background: document.documentElement.classList.contains('dark')
                            ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)'
                            : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                          boxShadow: document.documentElement.classList.contains('dark')
                            ? '0 0 40px rgba(139, 92, 246, 0.5)'
                            : '0 8px 32px rgba(124, 58, 237, 0.3)'
                        }}
                      >
                        <FiClock className="text-white" size={28} />
                      </motion.div>
                      <div>
                        <motion.p 
                          className="text-base font-semibold mb-1"
                          style={{ color: 'var(--text-main)' }}
                          animate={{ opacity: [0.5, 1, 0.5] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                        >
                          Loading attendance logs...
                        </motion.p>
                        <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                          Please wait while we fetch the data
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-4">
                      <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="w-20 h-20 rounded-2xl flex items-center justify-center backdrop-blur-sm"
                        style={{
                          background: document.documentElement.classList.contains('dark')
                            ? 'rgba(139, 92, 246, 0.1)'
                            : 'rgba(124, 58, 237, 0.05)',
                          border: document.documentElement.classList.contains('dark')
                            ? '2px solid rgba(139, 92, 246, 0.3)'
                            : '2px solid rgba(124, 58, 237, 0.2)'
                        }}
                      >
                        <FiClock size={40} className="text-purple-400 opacity-50" />
                      </motion.div>
                      <div>
                        <p className="font-bold text-xl mb-2" style={{ color: 'var(--text-main)' }}>
                          No attendance logs found
                        </p>
                        <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                          Try adjusting your filters or check back later
                        </p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {logs.map((log, index) => {
                    const person = log.person;
                    const isStudent = log.personType === 'Student';
                    
                    return (
                      <motion.tr
                        key={log.logId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        transition={{ delay: index * 0.03 }}
                        className="transition-all duration-300 cursor-pointer"
                        style={{ 
                          borderBottom: document.documentElement.classList.contains('dark')
                            ? '1px solid rgba(139, 92, 246, 0.1)'
                            : '1px solid rgba(124, 58, 237, 0.08)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = document.documentElement.classList.contains('dark')
                            ? 'rgba(139, 92, 246, 0.08)'
                            : 'rgba(124, 58, 237, 0.03)';
                          e.currentTarget.style.transform = 'translateX(4px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.transform = 'translateX(0)';
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <motion.div
                              whileHover={{ scale: 1.1, rotate: 5 }}
                              className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{
                                background: document.documentElement.classList.contains('dark')
                                  ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)'
                                  : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                                boxShadow: document.documentElement.classList.contains('dark')
                                  ? '0 0 20px rgba(139, 92, 246, 0.4)'
                                  : '0 4px 12px rgba(124, 58, 237, 0.3)'
                              }}
                            >
                              <FiMapPin className="text-white" size={16} />
                            </motion.div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                              {log.zone?.Zone_Name || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-11 h-11 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg backdrop-blur-sm"
                              style={{
                                background: isStudent 
                                  ? 'linear-gradient(135deg, #06b6d4 0%, #0ea5e9 100%)'
                                  : 'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
                                boxShadow: isStudent
                                  ? '0 0 20px rgba(6, 182, 212, 0.4)'
                                  : '0 0 20px rgba(16, 185, 129, 0.4)'
                              }}
                            >
                              {person?.Name?.charAt(0) || '?'}
                            </div>
                            <div>
                              <span className="block text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                                {person?.Name || 'Unknown'}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className="px-3 py-1.5 rounded-full text-xs font-bold backdrop-blur-sm"
                            style={{
                              background: isStudent 
                                ? (document.documentElement.classList.contains('dark')
                                  ? 'rgba(6, 182, 212, 0.2)'
                                  : 'rgba(6, 182, 212, 0.1)')
                                : (document.documentElement.classList.contains('dark')
                                  ? 'rgba(16, 185, 129, 0.2)'
                                  : 'rgba(16, 185, 129, 0.1)'),
                              color: isStudent ? '#06b6d4' : '#10b981',
                              border: `1px solid ${isStudent ? 'rgba(6, 182, 212, 0.3)' : 'rgba(16, 185, 129, 0.3)'}`
                            }}
                          >
                            {log.personType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: 'var(--text-soft)' }}>
                          {person?.Department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                          {formatDateTime(log.entryTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                          {formatDateTime(log.exitTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-bold px-3 py-1 rounded-lg backdrop-blur-sm" style={{ 
                            color: '#8b5cf6',
                            background: document.documentElement.classList.contains('dark')
                              ? 'rgba(139, 92, 246, 0.15)'
                              : 'rgba(124, 58, 237, 0.08)'
                          }}>
                            {formatDuration(log.duration)}
                          </span>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total > pagination.limit && (
          <div
            className="px-6 py-5 flex items-center justify-between backdrop-blur-sm"
            style={{
              background: document.documentElement.classList.contains('dark')
                ? 'rgba(139, 92, 246, 0.05)'
                : 'rgba(124, 58, 237, 0.03)',
              borderTop: document.documentElement.classList.contains('dark')
                ? '1px solid rgba(139, 92, 246, 0.2)'
                : '1px solid rgba(124, 58, 237, 0.15)'
            }}
          >
            <div className="text-sm font-semibold" style={{ color: 'var(--text-soft)' }}>
              Showing <span className="text-purple-500 font-bold">{pagination.offset + 1}</span> to{' '}
              <span className="text-purple-500 font-bold">{Math.min(pagination.offset + pagination.limit, pagination.total)}</span> of{' '}
              <span className="text-purple-500 font-bold">{pagination.total}</span> results
            </div>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={pagination.offset === 0}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
                style={{
                  background: document.documentElement.classList.contains('dark')
                    ? 'rgba(13, 27, 36, 0.8)'
                    : 'rgba(255, 255, 255, 0.8)',
                  border: document.documentElement.classList.contains('dark')
                    ? '1px solid rgba(139, 92, 246, 0.3)'
                    : '1px solid rgba(124, 58, 237, 0.2)',
                  color: 'var(--text-main)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)'
                }}
              >
                Previous
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed backdrop-blur-sm"
                style={{
                  background: document.documentElement.classList.contains('dark')
                    ? 'linear-gradient(135deg, #8b5cf6 0%, #a78bfa 100%)'
                    : 'linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)',
                  color: '#fff',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  boxShadow: document.documentElement.classList.contains('dark')
                    ? '0 4px 16px rgba(139, 92, 246, 0.4)'
                    : '0 4px 12px rgba(124, 58, 237, 0.3)'
                }}
              >
                Next
              </motion.button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
