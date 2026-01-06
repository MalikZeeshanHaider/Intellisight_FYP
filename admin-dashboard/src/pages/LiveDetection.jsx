import { useState, useEffect } from 'react';
import { getDetectionLogs, getLiveActivePresence, startLiveRecognition, stopLiveRecognition, getRecognitionStatus } from '../api/liveRecognition';
import { zoneAPI } from '../api/api';
import { FiPlay, FiSquare, FiRefreshCw, FiUsers, FiAlertCircle, FiCheckCircle } from 'react-icons/fi';

const LiveDetection = () => {
  const [logs, setLogs] = useState([]);
  const [activePresence, setActivePresence] = useState([]);
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [recognitionStatus, setRecognitionStatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [error, setError] = useState(null);

  // Fetch zones
  useEffect(() => {
    const fetchZones = async () => {
      try {
        const response = await zoneAPI.getAllZones();
        setZones(response.data);
        if (response.data.length > 0 && !selectedZone) {
          setSelectedZone(response.data[0].Zone_id);
        }
      } catch (err) {
        console.error('Failed to fetch zones:', err);
      }
    };
    fetchZones();
  }, []);

  // Fetch data
  const fetchData = async () => {
    if (!selectedZone) return;
    
    try {
      setLoading(true);
      const [logsRes, activeRes, statusRes] = await Promise.all([
        getDetectionLogs({ zoneId: selectedZone, limit: 50 }),
        getLiveActivePresence(selectedZone),
        getRecognitionStatus()
      ]);

      setLogs(logsRes.data || []);
      setActivePresence(activeRes.data || []);
      setRecognitionStatus(statusRes.data || []);
      setError(null);
    } catch (err) {
      setError('Failed to fetch detection data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 3 seconds
  useEffect(() => {
    if (autoRefresh && selectedZone) {
      fetchData();
      const interval = setInterval(fetchData, 3000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedZone]);

  // Manual refresh
  useEffect(() => {
    if (!autoRefresh && selectedZone) {
      fetchData();
    }
  }, [selectedZone]);

  const handleStartRecognition = async () => {
    if (!selectedZone) return;
    
    try {
      setLoading(true);
      await startLiveRecognition(selectedZone);
      await fetchData();
      alert('Live recognition started successfully!');
    } catch (err) {
      alert('Failed to start recognition: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleStopRecognition = async () => {
    if (!selectedZone) return;
    
    try {
      setLoading(true);
      await stopLiveRecognition(selectedZone);
      await fetchData();
      alert('Live recognition stopped');
    } catch (err) {
      alert('Failed to stop recognition: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  const isRunning = recognitionStatus.some(s => s.zoneId === selectedZone);

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const getLogBadgeColor = (type) => {
    switch (type) {
      case 'known': return 'bg-green-100 text-green-800';
      case 'unknown': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Live Face Detection</h1>
        <p className="text-gray-600">Real-time face recognition with automatic logging</p>
      </div>

      {/* Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Zone Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Zone
            </label>
            <select
              value={selectedZone || ''}
              onChange={(e) => setSelectedZone(parseInt(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              {zones.map(zone => (
                <option key={zone.Zone_id} value={zone.Zone_id}>
                  {zone.Zone_Name}
                </option>
              ))}
            </select>
          </div>

          {/* Control Buttons */}
          <div className="flex items-end gap-2">
            {!isRunning ? (
              <button
                onClick={handleStartRecognition}
                disabled={loading || !selectedZone}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                <FiPlay /> Start
              </button>
            ) : (
              <button
                onClick={handleStopRecognition}
                disabled={loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <FiSquare /> Stop
              </button>
            )}
          </div>

          {/* Auto Refresh Toggle */}
          <div className="flex items-end">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 text-blue-600"
              />
              <span className="text-sm text-gray-700">Auto-refresh (3s)</span>
            </label>
          </div>

          {/* Manual Refresh */}
          <div className="flex items-end">
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Refresh
            </button>
          </div>
        </div>

        {/* Status Indicator */}
        {selectedZone && (
          <div className="mt-4 p-3 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2">
              {isRunning ? (
                <>
                  <FiCheckCircle className="text-green-600" />
                  <span className="text-sm font-medium text-green-700">
                    Recognition Active - Auto-detecting faces
                  </span>
                  <div className="ml-auto">
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded text-xs">
                      <span className="w-2 h-2 bg-green-600 rounded-full animate-pulse"></span>
                      LIVE
                    </span>
                  </div>
                </>
              ) : (
                <>
                  <FiAlertCircle className="text-gray-400" />
                  <span className="text-sm text-gray-600">
                    Recognition Stopped - Click Start to begin auto-detection
                  </span>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Presence */}
        <div className="lg:col-span-1 bg-white rounded-lg shadow-md p-6">
          <div className="flex items-center gap-2 mb-4">
            <FiUsers className="text-blue-600" size={20} />
            <h2 className="text-xl font-semibold text-gray-900">Active Now</h2>
            <span className="ml-auto text-sm font-medium text-gray-600">
              {activePresence.length}
            </span>
          </div>
          
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {activePresence.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No one currently detected</p>
            ) : (
              activePresence.map((person) => (
                <div key={person.presenceId} className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium text-gray-900">{person.person.Name}</p>
                      <p className="text-xs text-gray-600">
                        {person.personType} • {person.person.Department}
                      </p>
                      <p className="text-xs text-blue-600 mt-1">{person.duration}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                      IN
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Detection Logs */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Detection Logs</h2>
          
          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {error && (
              <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>
            )}
            
            {logs.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {isRunning ? 'Waiting for detections...' : 'Start recognition to see logs'}
              </p>
            ) : (
              logs.map((log, idx) => (
                <div key={`${log.type}-${log.logId}-${idx}`} className="p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${getLogBadgeColor(log.type)}`}>
                          {log.type === 'known' ? log.personType : 'Unknown'}
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {log.person.Name}
                        </span>
                      </div>
                      
                      {log.type === 'known' ? (
                        <div className="text-xs text-gray-600 space-y-1">
                          <p>{log.person.Department}</p>
                          <div className="flex gap-4">
                            <span>Entry: {formatTimestamp(log.entryTime)}</span>
                            {log.exitTime && (
                              <span>Exit: {formatTimestamp(log.exitTime)}</span>
                            )}
                          </div>
                          {log.duration && (
                            <p className="text-blue-600 font-medium">Duration: {log.duration} min</p>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-gray-600">
                          <p>Detected: {formatTimestamp(log.detectedTime)}</p>
                          <p className="text-red-600">Status: {log.status}</p>
                        </div>
                      )}
                    </div>
                    
                    <div className="text-right">
                      <p className="text-xs text-gray-500">{log.zone.Zone_Name}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveDetection;
