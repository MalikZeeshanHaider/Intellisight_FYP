import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiDownload, FiFilter, FiClock, FiMapPin, FiUsers, FiChevronRight } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi';
import { getAttendanceLogs } from '../api/faceRecognition';
import { zoneAPI } from '../api/api';

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
      className="space-y-8 p-6"
    >
      {/* Breadcrumb */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 text-sm"
        style={{ color: 'var(--text-soft)' }}
      >
        <span className="hover:opacity-80 cursor-pointer transition-opacity">Dashboard</span>
        <FiChevronRight size={14} />
        <span style={{ color: 'var(--primary)' }} className="font-semibold">Attendance Logs</span>
      </motion.div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex justify-between items-start"
      >
        <div>
          <h1
            className="text-4xl font-display font-bold mb-2"
            style={{
              background: `linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text'
            }}
          >
            Attendance Logs
          </h1>
          <p className="flex items-center gap-2" style={{ color: 'var(--text-soft)' }}>
            <HiSparkles style={{ color: 'var(--primary-light)' }} />
            View entry and exit history for all zones
          </p>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.05, boxShadow: `0 0 20px var(--glow)` }}
          whileTap={{ scale: 0.95 }}
          onClick={exportToCSV}
          disabled={logs.length === 0}
          className="px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{
            background: `linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)`,
            color: '#fff',
            border: `1px solid var(--border-color)`,
            boxShadow: `0 4px 16px var(--shadow)`
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
        className="rounded-3xl p-6 backdrop-blur-xl"
        style={{
          background: 'var(--surface-alt)',
          border: `1px solid var(--border-color)`,
          boxShadow: `0 8px 32px var(--shadow)`
        }}
      >
        <div className="flex items-center gap-2 mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              background: `linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)`,
              boxShadow: `0 0 20px var(--glow)`
            }}
          >
            <FiFilter className="text-white" size={18} />
          </div>
          <h3 className="text-lg font-display font-semibold" style={{ color: 'var(--text-main)' }}>
            Filter Logs
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
              <div className="flex items-center gap-2">
                <FiMapPin size={14} />
                Zone
              </div>
            </label>
            <select
              value={filters.zoneId}
              onChange={(e) => handleFilterChange('zoneId', e.target.value)}
              className="w-full px-4 py-3 rounded-xl transition-all duration-300 focus:outline-none"
              style={{
                background: 'var(--surface)',
                border: `2px solid var(--border-color)`,
                color: 'var(--text-main)',
                boxShadow: `0 2px 8px var(--shadow)`
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            >
              <option value="">All Zones</option>
              {zones.map(zone => (
                <option key={zone.Zone_id} value={zone.Zone_id}>{zone.Zone_Name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
              <div className="flex items-center gap-2">
                <FiUsers size={14} />
                Person Type
              </div>
            </label>
            <select
              value={filters.personType}
              onChange={(e) => handleFilterChange('personType', e.target.value)}
              className="w-full px-4 py-3 rounded-xl transition-all duration-300 focus:outline-none"
              style={{
                background: 'var(--surface)',
                border: `2px solid var(--border-color)`,
                color: 'var(--text-main)',
                boxShadow: `0 2px 8px var(--shadow)`
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            >
              <option value="">All Types</option>
              <option value="Student">Students</option>
              <option value="Teacher">Teachers</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
              <div className="flex items-center gap-2">
                <FiClock size={14} />
                Start Date
              </div>
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl transition-all duration-300 focus:outline-none"
              style={{
                background: 'var(--surface)',
                border: `2px solid var(--border-color)`,
                color: 'var(--text-main)',
                boxShadow: `0 2px 8px var(--shadow)`
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-soft)' }}>
              <div className="flex items-center gap-2">
                <FiClock size={14} />
                End Date
              </div>
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="w-full px-4 py-3 rounded-xl transition-all duration-300 focus:outline-none"
              style={{
                background: 'var(--surface)',
                border: `2px solid var(--border-color)`,
                color: 'var(--text-main)',
                boxShadow: `0 2px 8px var(--shadow)`
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--primary)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border-color)'}
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
            className="rounded-2xl p-4 backdrop-blur-xl"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '2px solid rgba(239, 68, 68, 0.3)',
              color: '#ef4444'
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Logs Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-3xl overflow-hidden backdrop-blur-xl"
        style={{
          background: 'var(--surface-alt)',
          border: `1px solid var(--border-color)`,
          boxShadow: `0 8px 32px var(--shadow)`
        }}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr style={{ background: 'var(--highlight)' }}>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Zone</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Name</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Type</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Department</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Entry Time</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Exit Time</th>
                <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Duration</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-12 h-12 rounded-full"
                        style={{
                          border: `3px solid var(--border-color)`,
                          borderTopColor: 'var(--primary)',
                          boxShadow: `0 0 20px var(--glow)`
                        }}
                      />
                      <span className="text-sm font-medium" style={{ color: 'var(--text-soft)' }}>
                        Loading attendance logs...
                      </span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan="7" className="px-6 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div
                        className="w-16 h-16 rounded-2xl flex items-center justify-center"
                        style={{
                          background: 'var(--highlight)',
                          border: `2px solid var(--border-color)`
                        }}
                      >
                        <FiClock size={32} style={{ color: 'var(--text-soft)', opacity: 0.5 }} />
                      </div>
                      <div>
                        <p className="font-semibold text-lg mb-1" style={{ color: 'var(--text-main)' }}>
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
                        transition={{ delay: index * 0.05 }}
                        className="transition-all duration-300"
                        style={{ borderBottom: `1px solid var(--border-color)` }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--highlight)'}
                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center"
                              style={{
                                background: `linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)`,
                                boxShadow: `0 0 12px var(--glow)`
                              }}
                            >
                              <FiMapPin className="text-white" size={14} />
                            </div>
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                              {log.zone?.Zone_Name || '-'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-lg"
                              style={{
                                background: isStudent 
                                  ? `linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)`
                                  : `linear-gradient(135deg, #10b981 0%, #34d399 100%)`,
                                boxShadow: `0 0 16px ${isStudent ? 'var(--glow)' : 'rgba(16, 185, 129, 0.4)'}`
                              }}
                            >
                              {person?.Name?.charAt(0) || '?'}
                            </div>
                            <span className="ml-3 text-sm font-semibold" style={{ color: 'var(--text-main)' }}>
                              {person?.Name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className="px-3 py-1 rounded-full text-xs font-bold"
                            style={{
                              background: isStudent ? 'var(--highlight)' : 'rgba(16, 185, 129, 0.15)',
                              color: isStudent ? 'var(--primary)' : '#10b981',
                              border: `1px solid ${isStudent ? 'var(--border-color)' : 'rgba(16, 185, 129, 0.3)'}`
                            }}
                          >
                            {log.personType}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: 'var(--text-soft)' }}>
                          {person?.Department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                          {formatDateTime(log.entryTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium" style={{ color: 'var(--text-main)' }}>
                          {formatDateTime(log.exitTime)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-bold" style={{ color: 'var(--primary)' }}>
                          {formatDuration(log.duration)}
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
            className="px-6 py-4 flex items-center justify-between"
            style={{
              background: 'var(--highlight)',
              borderTop: `1px solid var(--border-color)`
            }}
          >
            <div className="text-sm font-medium" style={{ color: 'var(--text-soft)' }}>
              Showing {pagination.offset + 1} to {Math.min(pagination.offset + pagination.limit, pagination.total)} of {pagination.total} results
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPagination(prev => ({ ...prev, offset: Math.max(0, prev.offset - prev.limit) }))}
                disabled={pagination.offset === 0}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'var(--surface)',
                  border: `1px solid var(--border-color)`,
                  color: 'var(--text-main)',
                  boxShadow: `0 2px 8px var(--shadow)`
                }}
              >
                Previous
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setPagination(prev => ({ ...prev, offset: prev.offset + prev.limit }))}
                disabled={pagination.offset + pagination.limit >= pagination.total}
                className="px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: `linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%)`,
                  color: '#fff',
                  border: `1px solid var(--border-color)`,
                  boxShadow: `0 4px 12px var(--glow)`
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
