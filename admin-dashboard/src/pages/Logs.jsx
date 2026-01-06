/**
 * Logs Page
 * Display zone tracking history and activity logs from TimeTable
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiFileText, FiRefreshCw, FiAlertCircle, FiFilter, FiClock, FiLogIn, FiLogOut, FiChevronDown } from 'react-icons/fi';
import { zone1API } from '../api/zone1';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

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

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#305796' }}></div>
          <p className="text-gray-600">Loading logs...</p>
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
        className="relative p-6 rounded-2xl bg-white"
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)' }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: '#305796' }}>
              Activity Logs
            </h1>
            <p className="text-sm font-medium" style={{ color: '#6b7280' }}>
              Zone tracking history • {logs.length} total entries
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Auto-update indicator */}
            {isRefreshing && (
              <div className="flex items-center gap-2 text-sm font-medium" style={{ color: '#305796' }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: '#305796' }}></div>
                Auto-updating...
              </div>
            )}
            
            {/* Last update time */}
            <div className="text-xs font-medium text-gray-500">
              Last updated: {format(lastUpdate, 'HH:mm:ss')}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="relative p-4 rounded-2xl bg-white flex items-center justify-between"
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)' }}
      >
        <div className="flex items-center gap-3">
          {/* Person Type Filter - Custom Dropdown */}
          <div className="relative" ref={typeDropdownRef}>
            <button
              onClick={() => setTypeDropdownOpen(!typeDropdownOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700"
              style={{ minWidth: '140px' }}
            >
              <span>{personTypeFilter === '' ? 'All Types' : personTypeFilter === 'Student' ? 'Students Only' : 'Faculty Only'}</span>
              <FiChevronDown className={`transition-transform ${typeDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {typeDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full min-w-[150px] bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                {[
                  { value: '', label: 'All Types' },
                  { value: 'Student', label: 'Students Only' },
                  { value: 'Teacher', label: 'Faculty Only' }
                ].map((option) => (
                  <button
                    key={option.value}
                    onClick={() => { setPersonTypeFilter(option.value); setTypeDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-blue-100 hover:text-blue-700 ${personTypeFilter === option.value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
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
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm bg-gray-100 hover:bg-blue-100 text-gray-700 hover:text-blue-700"
              style={{ minWidth: '150px' }}
            >
              <span>Last {limit} entries</span>
              <FiChevronDown className={`transition-transform ${limitDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {limitDropdownOpen && (
              <div className="absolute top-full left-0 mt-1 w-full min-w-[160px] bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                {[25, 50, 100, 200].map((value) => (
                  <button
                    key={value}
                    onClick={() => { setLimit(value); setLimitDropdownOpen(false); }}
                    className={`w-full text-left px-4 py-2 text-sm font-medium hover:bg-blue-100 hover:text-blue-700 ${limit === value ? 'bg-blue-50 text-blue-700' : 'text-gray-700'}`}
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
          style={{ backgroundColor: '#305796', boxShadow: '0 2px 8px rgba(48, 87, 150, 0.25)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#274370'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#305796'}
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
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
        >
          <FiAlertCircle className="mt-0.5 mr-3 flex-shrink-0" style={{ color: '#ef4444' }} size={20} />
          <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{error}</p>
        </motion.div>
      )}

      {/* Logs Table */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)' }}
      >
        {logs.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto rounded-full flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(48, 87, 150, 0.1)' }}>
              <FiFileText style={{ color: '#305796' }} size={40} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activity Logs</h3>
            <p className="text-gray-600">No logs found for the selected filters</p>
          </div>
        ) : (
          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 400px)', overflowX: 'hidden' }}>
            <table className="w-full divide-y" style={{ borderColor: 'rgba(48, 87, 150, 0.1)' }}>
              <thead style={{ backgroundColor: 'rgba(48, 87, 150, 0.05)' }}>
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#305796' }}>
                    Person
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#305796' }}>
                    Type
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#305796' }}>
                    Zone
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#305796' }}>
                    Entry Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#305796' }}>
                    Exit Time
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#305796' }}>
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#305796' }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y" style={{ borderColor: 'rgba(48, 87, 150, 0.05)' }}>
                {logs.map((log) => (
                  <tr 
                    key={log.TimeTable_ID} 
                    className="transition-all duration-200"
                    style={{ cursor: 'default' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(48, 87, 150, 0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #305796 0%, #4a7cb8 100%)' }}>
                          <span className="text-white font-semibold text-sm">
                            {log.Name?.[0] || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <p className="text-sm font-medium text-gray-900">
                            {log.Name || 'Unknown'}
                          </p>
                          <p className="text-xs text-gray-500">
                            {log.RollNumber || log.Email || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.PersonType === 'Student' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-green-100 text-green-800'
                      }`}>
                        {log.PersonType}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.Zone || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex items-center space-x-1">
                        <FiLogIn className="text-green-500" size={14} />
                        <span>
                          {log.EntryTime ? format(new Date(log.EntryTime), 'MMM dd, HH:mm:ss') : 'N/A'}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.ExitTime ? (
                        <div className="flex items-center space-x-1">
                          <FiLogOut className="text-red-500" size={14} />
                          <span>
                            {format(new Date(log.ExitTime), 'MMM dd, HH:mm:ss')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Still inside</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {log.Duration !== null ? (
                        <div className="flex items-center space-x-1">
                          <FiClock className="text-blue-500" size={14} />
                          <span className="font-medium">{log.Duration} min</span>
                        </div>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        log.Status === 'Completed'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
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
