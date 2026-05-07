/**
 * Logs Page
 * Display zone tracking history and activity logs from TimeTable
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiFileText, FiRefreshCw, FiAlertCircle, FiFilter, FiClock, FiLogIn, FiLogOut, FiChevronDown, FiDownload } from 'react-icons/fi';
import { zone1API } from '../api/zone1';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

const calcDuration = (entryTime, exitTime, dbMinutes) => {
  if (dbMinutes === null || dbMinutes === undefined) return null;
  if (dbMinutes >= 1) return `${dbMinutes} min`;
  // DB stored 0 min (sub-minute visit) — calculate precise seconds from timestamps
  if (entryTime && exitTime) {
    const secs = Math.max(0, Math.floor((new Date(exitTime) - new Date(entryTime)) / 1000));
    if (secs < 60) return `${secs} sec`;
    return `${Math.floor(secs / 60)} min`;
  }
  return '< 1 min';
};

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(50);
  const [personTypeFilter, setPersonTypeFilter] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);
  
  // Dropdown states
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false);
  const [limitDropdownOpen, setLimitDropdownOpen] = useState(false);
  const typeDropdownRef = useRef(null);
  const limitDropdownRef = useRef(null);

  // Dark mode detection
  const isDarkMode = document.documentElement.classList.contains('dark');

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (typeDropdownRef.current && !typeDropdownRef.current.contains(event.target)) {
        setTypeDropdownOpen(false);
      }
      if (limitDropdownRef.current && !limitDropdownRef.current.contains(event.target)) {
        setLimitDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch logs from TimeTable
  const fetchLogs = useCallback(async (showLoading = true) => {
    try {
      setError(null);
      if (showLoading) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }

      console.log('🔄 Fetching logs...', new Date().toLocaleTimeString());
      console.log('📊 Parameters:', { limit, personTypeFilter });
      
      const response = await zone1API.getTimeTableLogs(limit, 0, personTypeFilter || null);
      
      console.log('📦 Response received:', response);
      
      if (response.success && response.data) {
        setLogs(response.data);
        setLastUpdate(new Date());
        console.log('✅ Logs updated:', response.data.length, 'entries');
      } else {
        console.warn('⚠️ Response not successful:', response);
      }

      setLoading(false);
      setIsRefreshing(false);
    } catch (err) {
      console.error('❌ Error fetching logs:', err);
      console.error('Error details:', err.response?.data || err.message);
      setError(`Failed to load logs: ${err.response?.data?.message || err.message}`);
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [limit, personTypeFilter]);

  // Initial fetch and when filters change
  useEffect(() => {
    fetchLogs(true);
  }, [fetchLogs]);

  // Auto-refresh every 5 seconds (background updates)
  useEffect(() => {
    // Clear existing interval
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Set new interval
    intervalRef.current = setInterval(() => {
      console.log('⏰ Auto-refresh triggered');
      fetchLogs(false); // Don't show loading spinner on auto-refresh
    }, 5000); // 5 seconds for real-time feel

    // Cleanup
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchLogs]);

  const exportToCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Person', 'Type', 'Zone', 'Entry Time', 'Exit Time', 'Duration (min)', 'Status'];
    const rows = logs.map(log => [
      log.Name || 'Unknown',
      log.PersonType || '',
      log.Zone || '',
      log.EntryTime ? format(new Date(log.EntryTime), 'yyyy-MM-dd HH:mm:ss') : '',
      log.ExitTime ? format(new Date(log.ExitTime), 'yyyy-MM-dd HH:mm:ss') : '',
      calcDuration(log.EntryTime, log.ExitTime, log.Duration) ?? '',
      log.Status || '',
    ]);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `activity-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: isDarkMode ? '#22d3ee' : '#305796' }}></div>
          <p style={{ color: isDarkMode ? '#c0f0f0' : '#6b7280' }}>Loading logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative p-6 rounded-2xl"
        style={{ 
          background: isDarkMode 
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
            : '#ffffff',
          boxShadow: isDarkMode 
            ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
            : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
          border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
              Activity Logs
            </h1>
            <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
              Zone tracking history • {logs.length} total entries
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Auto-update indicator */}
            {isRefreshing && (
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: isDarkMode ? '#22d3ee' : '#305796' }}></div>
                Auto-updating...
              </div>
            )}
            
            {/* Last update time */}
            <div className="text-xs font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
              Last updated: {format(lastUpdate, 'HH:mm:ss')}
            </div>

            {/* Export CSV button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={exportToCSV}
              disabled={logs.length === 0}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796',
                boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.3)' : '0 2px 8px rgba(48, 87, 150, 0.25)'
              }}
              onMouseEnter={(e) => {
                if (logs.length > 0) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 1)' : '#274370';
                }
              }}
              onMouseLeave={(e) => {
                if (logs.length > 0) {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796';
                }
              }}
            >
              <FiDownload size={16} />
              <span>Export CSV</span>
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative p-4 rounded-2xl flex items-center justify-between"
        style={{ 
          background: isDarkMode 
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
            : '#ffffff',
          boxShadow: isDarkMode 
            ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
            : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
          border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none'
        }}
      >
        <div className="flex items-center gap-3">
          {/* Person Type Filter - Custom Dropdown */}
          <div className="relative" ref={typeDropdownRef}>
            <button
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all"
              style={{ 
                minWidth: '140px',
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6',
                color: isDarkMode ? '#c0f0f0' : '#374151',
                border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.15)' : '#dbeafe';
                e.currentTarget.style.color = isDarkMode ? '#22d3ee' : '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6';
                e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151';
              }}
            >
              <span>{personTypeFilter === '' ? 'All Types' : personTypeFilter === 'Student' ? 'Students Only' : 'Faculty Only'}</span>
              <FiChevronDown className={`transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isDarkMode ? '#22d3ee' : '#305796' }} />
            </button>
            
            {typeDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full min-w-[150px] rounded-xl shadow-lg py-1 z-50"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                  border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid #e5e7eb'
                }}
              >
                {[
                  { value: '', label: 'All Types' },
                  { value: 'Student', label: 'Students Only' },
                  { value: 'Teacher', label: 'Faculty Only' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setPersonTypeFilter(option.value); setTypeDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm font-medium transition-all"
                    style={{ 
                      backgroundColor: personTypeFilter === option.value 
                        ? (isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#dbeafe') 
                        : 'transparent',
                      color: personTypeFilter === option.value 
                        ? (isDarkMode ? '#22d3ee' : '#1d4ed8') 
                        : (isDarkMode ? '#c0f0f0' : '#374151')
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          
          {/* Limit Filter - Custom Dropdown */}
          <div className="relative" ref={limitDropdownRef}>
            <button
              onClick={() => setLimitDropdownOpen(!limitDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all"
              style={{ 
                minWidth: '150px',
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6',
                color: isDarkMode ? '#c0f0f0' : '#374151',
                border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.15)' : '#dbeafe';
                e.currentTarget.style.color = isDarkMode ? '#22d3ee' : '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6';
                e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151';
              }}
            >
              <span>Last {limit} entries</span>
              <FiChevronDown className={`transition-transform ${limitDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isDarkMode ? '#22d3ee' : '#305796' }} />
            </button>
            
            {limitDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] rounded-xl shadow-lg py-1 z-50"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                  border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid #e5e7eb'
                }}
              >
                {[25, 50, 100, 200].map((value) => (
                  <button
                    key={value}
                    onClick={() => { setLimit(value); setLimitDropdownOpen(false); }}
                    className="w-full text-left px-4 py-2 text-sm font-medium transition-all"
                    style={{ 
                      backgroundColor: limit === value 
                        ? (isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#dbeafe') 
                        : 'transparent',
                      color: limit === value 
                        ? (isDarkMode ? '#22d3ee' : '#1d4ed8') 
                        : (isDarkMode ? '#c0f0f0' : '#374151')
                    }}
                  >
                    Last {value} entries
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => fetchLogs(true)}
          className="flex items-center gap-2 px-4 py-2 text-white rounded-xl font-semibold text-sm transition-all"
          style={{ 
            backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796', 
            boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.3)' : '0 2px 8px rgba(48, 87, 150, 0.25)' 
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 1)' : '#274370';
            if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 30px rgba(6, 182, 212, 0.5)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796';
            if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.3)';
          }}
        >
          <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          <span>Refresh</span>
        </motion.button>
      </motion.div>

      {/* Error Alert */}
      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl border flex items-start"
          style={{ 
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', 
            borderColor: 'rgba(239, 68, 68, 0.3)' 
          }}
        >
          <FiAlertCircle className="mt-0.5 mr-3 flex-shrink-0" style={{ color: '#ef4444' }} size={20} />
          <p className="text-sm font-medium" style={{ color: isDarkMode ? '#f87171' : '#ef4444' }}>{error}</p>
        </motion.div>
      )}

      {/* Logs Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl overflow-hidden"
        style={{ 
          background: isDarkMode 
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
            : '#ffffff',
          boxShadow: isDarkMode 
            ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
            : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)',
          border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none'
        }}
      >
        {logs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(48, 87, 150, 0.1)' }}>
              <FiFileText style={{ color: isDarkMode ? '#22d3ee' : '#305796' }} size={40} />
            </div>
            <h3 className="text-lg font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>No Activity Logs</h3>
            <p style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>No logs found for the selected filters</p>
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)', overflowX: 'hidden' }}>
            <table className="w-full divide-y" style={{ borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.1)' : 'rgba(48, 87, 150, 0.1)' }}>
              <thead style={{ backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.1)' : 'rgba(48, 87, 150, 0.05)' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
                    Person
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
                    Zone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
                    Entry Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
                    Exit Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.05)' : 'rgba(48, 87, 150, 0.05)' }}>
                {logs.map((log) => (
                  <tr 
                    key={log.TimeTable_ID} 
                    className="transition-all duration-200"
                    style={{ cursor: 'default', backgroundColor: 'transparent' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.08)' : 'rgba(48, 87, 150, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center" style={{ background: isDarkMode ? 'linear-gradient(135deg, rgba(6, 182, 212, 0.8) 0%, rgba(34, 211, 238, 0.6) 100%)' : 'linear-gradient(135deg, #305796 0%, #4a7cb8 100%)' }}>
                          <span className="text-white font-semibold text-sm">
                            {log.Name?.[0] || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                            {log.Name || 'Unknown'}
                          </p>
                          <p className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>
                            {log.RollNumber || log.Email || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.PersonType === 'Student' 
                          ? (isDarkMode ? 'bg-blue-500/20 text-blue-400' : 'bg-blue-100 text-blue-800')
                          : (isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800')
                      }`}>
                        {log.PersonType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                      {log.Zone || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                      <div className="flex items-center space-x-1">
                        <FiLogIn className="text-green-500" size={14} />
                        <span>
                          {log.EntryTime ? format(new Date(log.EntryTime), 'MMM dd, HH:mm:ss') : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                      {log.ExitTime ? (
                        <div className="flex items-center space-x-1">
                          <FiLogOut className="text-red-500" size={14} />
                          <span>
                            {format(new Date(log.ExitTime), 'MMM dd, HH:mm:ss')}
                          </span>
                        </div>
                      ) : (
                        <span style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.4)' : '#9ca3af', fontStyle: 'italic' }}>Still inside</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                      {(() => {
                        const dur = calcDuration(log.EntryTime, log.ExitTime, log.Duration);
                        return dur !== null ? (
                          <div className="flex items-center space-x-1">
                            <FiClock style={{ color: isDarkMode ? '#22d3ee' : '#3b82f6' }} size={14} />
                            <span className="font-medium">{dur}</span>
                          </div>
                        ) : (
                          <span style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.4)' : '#9ca3af' }}>-</span>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.Status === 'Completed'
                          ? (isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-800')
                          : (isDarkMode ? 'bg-yellow-500/20 text-yellow-400' : 'bg-yellow-100 text-yellow-800')
                      }`}>
                        {log.Status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default Logs;
