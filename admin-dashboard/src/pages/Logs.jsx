/**
 * Logs Page
 * Display zone tracking history and activity logs from TimeTable
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { FiFileText, FiRefreshCw, FiAlertCircle, FiFilter, FiClock, FiLogIn, FiLogOut } from 'react-icons/fi';
import { zone1API } from '../api/zone1';
import { format } from 'date-fns';

const Logs = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit, setLimit] = useState(50);
  const [personTypeFilter, setPersonTypeFilter] = useState('');
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const intervalRef = useRef(null);

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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600">Loading logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Activity Logs</h1>
          <div className="flex items-center space-x-2 mt-1">
            <p className="text-gray-600">Zone tracking history with Entry/Exit times</p>
            <span className="text-xs text-gray-400">
              • Last updated: {format(lastUpdate, 'HH:mm:ss')}
            </span>
            {isRefreshing && (
              <span className="flex items-center text-xs text-blue-600">
                <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse mr-1"></div>
                Auto-updating...
              </span>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <select
            value={personTypeFilter}
            onChange={(e) => setPersonTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="">All Types</option>
            <option value="Student">Students Only</option>
            <option value="Teacher">Teachers Only</option>
          </select>
          
          <select
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value={25}>Last 25 entries</option>
            <option value={50}>Last 50 entries</option>
            <option value={100}>Last 100 entries</option>
            <option value={200}>Last 200 entries</option>
          </select>
          
          <button
            onClick={() => fetchLogs(true)}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start">
          <FiAlertCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Logs Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {logs.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <FiFileText size={64} className="mx-auto mb-4 opacity-30" />
            <p className="text-lg">No activity logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Person
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Zone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Entry Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Exit Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.TimeTable_ID} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center">
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
      </div>
    </div>
  );
};

export default Logs;
