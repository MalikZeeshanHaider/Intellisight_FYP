/**
 * Dynamic Zone Live Tracking Page
 * Works for any zone - automatically adapts based on route parameter
 * Supports IP camera configuration and real-time face recognition
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiAlertCircle, FiArrowLeft, FiCamera, FiPlus, FiX, FiVideo, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { cameraAPI, zoneAPI } from '../api/api';
import { RealtimeDetectionChart, LiveDetectionCounter } from '../components/RealtimeDetectionChart';
import { RecognitionRateDonut, MiniRecognitionRate } from '../components/RecognitionRateDonut';

const ZoneLive = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  
  const [zone, setZone] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [cameraStatuses, setCameraStatuses] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [showEditCameraModal, setShowEditCameraModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serviceOnline, setServiceOnline] = useState(false);
  const [newCamera, setNewCamera] = useState({
    Camera_URL: '',
    Camera_Type: 'Entry',
    Password: ''
  });

  // Fetch zone details and cameras
  const fetchZoneData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [zoneResponse, camerasResponse] = await Promise.all([
        zoneAPI.getZoneById(zoneId),
        cameraAPI.getAllCameras()
      ]);

      if (zoneResponse.success && zoneResponse.data) {
        setZone(zoneResponse.data);
      }

      if (camerasResponse.success && camerasResponse.data) {
        // Filter cameras for this zone
        const zoneCameras = camerasResponse.data.filter(
          cam => cam.Zone_id === parseInt(zoneId)
        );
        setCameras(zoneCameras);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error loading zone:', err);
      setError('Failed to load zone data');
      setLoading(false);
    }
  };

  // Check camera service status
  const checkServiceStatus = async () => {
    try {
      const response = await fetch('http://localhost:5001/health');
      const data = await response.json();
      if (data.status === 'ok') {
        setServiceOnline(true);
        return true;
      }
    } catch (err) {
      setServiceOnline(false);
    }
    return false;
  };

  // Fetch camera statuses from persistent service
  const fetchCameraStatuses = async () => {
    try {
      const response = await fetch('http://localhost:5001/cameras/status');
      const data = await response.json();
      
      if (data.success) {
        // Create a map of camera_id -> status
        const statusMap = {};
        Object.values(data.cameras).forEach(status => {
          statusMap[status.camera_id] = status;
        });
        setCameraStatuses(statusMap);
      }
    } catch (err) {
      console.error('Failed to fetch camera statuses:', err);
    }
  };

  // Start all cameras for the zone
  const startZoneCameras = async () => {
    try {
      const response = await fetch(`http://localhost:5001/zones/${zoneId}/start_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        console.log(`Started cameras for zone ${zoneId}:`, data);
      }
    } catch (err) {
      console.error('Failed to start zone cameras:', err);
    }
  };

  // Start a single camera
  const startCamera = async (cameraId, cameraUrl, cameraType) => {
    try {
      const response = await fetch('http://localhost:5001/cameras/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camera_id: cameraId,
          camera_url: cameraUrl,
          camera_type: cameraType,
          zone_id: parseInt(zoneId)
        })
      });
      const data = await response.json();
      console.log(`Camera ${cameraId} start result:`, data);
      return data.success;
    } catch (err) {
      console.error(`Failed to start camera ${cameraId}:`, err);
      return false;
    }
  };

  useEffect(() => {
    fetchZoneData();
    checkServiceStatus();
    
    // Poll for camera statuses every 3 seconds
    const statusInterval = setInterval(() => {
      fetchCameraStatuses();
    }, 3000);
    
    return () => clearInterval(statusInterval);
  }, [zoneId]);

  // Auto-start cameras when service is online and cameras are loaded
  useEffect(() => {
    if (serviceOnline && cameras.length > 0) {
      // Start all cameras for this zone
      startZoneCameras();
    }
  }, [serviceOnline, cameras.length, zoneId]);

  // Refresh data
  const handleRefresh = async () => {
    await Promise.all([
      fetchZoneData(),
      fetchCameraStatuses(),
      checkServiceStatus()
    ]);
  };

  // Add new camera
  const handleAddCamera = async () => {
    if (!newCamera.Camera_URL.trim()) {
      setError('Please enter a camera URL');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await cameraAPI.createCamera({
        ...newCamera,
        Zone_id: parseInt(zoneId)
      });

      if (response.success) {
        setShowAddCameraModal(false);
        setNewCamera({
          Camera_URL: '',
          Camera_Type: 'Entry',
          Password: ''
        });
        await fetchZoneData();
      }
    } catch (err) {
      console.error('Error adding camera:', err);
      setError(err.response?.data?.message || 'Failed to add camera');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Edit camera
  const handleEditCamera = async () => {
    if (!editingCamera.Camera_URL.trim()) {
      setError('Please enter a camera URL');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await cameraAPI.updateCamera(editingCamera.Camara_Id, {
        Camera_URL: editingCamera.Camera_URL,
        Camera_Type: editingCamera.Camera_Type,
        Password: editingCamera.Password,
        Zone_id: parseInt(zoneId)
      });

      if (response.success) {
        setShowEditCameraModal(false);
        setEditingCamera(null);
        await fetchZoneData();
      }
    } catch (err) {
      console.error('Error updating camera:', err);
      setError(err.response?.data?.message || 'Failed to update camera');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete camera
  const handleDeleteCamera = async (cameraId) => {
    if (!window.confirm('Are you sure you want to delete this camera?')) {
      return;
    }

    try {
      setError(null);
      const response = await cameraAPI.deleteCamera(cameraId);

      if (response.success) {
        await fetchZoneData();
      }
    } catch (err) {
      console.error('Error deleting camera:', err);
      setError(err.response?.data?.message || 'Failed to delete camera');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-16 h-16 rounded-full mb-4"
            style={{
              border: '4px solid rgba(0, 61, 130, 0.2)',
              borderTopColor: '#003d82'
            }}
          />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading zone...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/zones')}
            className="flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition"
          >
            <FiArrowLeft size={20} style={{ color: '#003d82' }} />
          </button>
          <div>
            <h1 className="text-4xl font-display font-black" style={{ color: '#003d82' }}>
              {zone?.Zone_Name} - Live Tracking
            </h1>
          </div>
        </div>

        <div className="flex gap-3">
          {!serviceOnline && (
            <div className="flex items-center space-x-2 px-4 py-2 rounded-xl border" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)', color: '#d97706' }}>
              <FiAlertCircle size={18} />
              <span className="text-sm font-semibold">Service Offline</span>
            </div>
          )}
          {serviceOnline && (
            <div className="flex items-center space-x-2 px-4 py-2 rounded-xl border" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.3)', color: '#10b981' }}>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold">Service Running</span>
            </div>
          )}
          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition"
            style={{ backgroundColor: '#003d82', color: '#fff' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#305796'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#003d82'}
          >
            <FiRefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddCameraModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition"
            style={{ backgroundColor: '#10b981', color: '#fff' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
          >
            <FiPlus size={18} />
            <span>Add Camera</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 flex items-start"
          >
            <FiAlertCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
            <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cameras.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full bg-white dark:bg-gray-800 rounded-xl p-12 text-center border-2 border-dashed" style={{ borderColor: 'rgba(0, 61, 130, 0.2)' }}
          >
            <FiVideo size={48} className="mx-auto mb-4" style={{ color: '#003d82', opacity: 0.5 }} />
            <h3 className="text-xl font-bold mb-2" style={{ color: '#003d82' }}>
              No Cameras Configured
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add IP cameras to start live face recognition
            </p>
            <button
              onClick={() => setShowAddCameraModal(true)}
              className="px-6 py-2 rounded-xl font-semibold transition"
              style={{ backgroundColor: '#003d82', color: '#fff' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#305796'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#003d82'}
            >
              Configure First Camera
            </button>
          </motion.div>
        ) : (
          cameras.map((camera) => (
            <motion.div
              key={camera.Camara_Id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700"
            >
              {/* Camera Header */}
              <div className="flex items-start justify-between p-4 border-b dark:border-gray-700">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold text-gray-800 dark:text-white">
                      Camera #{camera.Camara_Id}
                    </h3>
                    {/* Connection Status Indicator */}
                    {cameraStatuses[camera.Camara_Id] && (
                      <div className="flex items-center gap-1">
                        {cameraStatuses[camera.Camara_Id].is_connected ? (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-green-600 dark:text-green-400 font-medium">Live</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-xs text-red-600 dark:text-red-400 font-medium">Offline</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`px-2 py-1 rounded-lg text-xs font-bold ${
                      camera.Camera_Type === 'Entry' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                        : camera.Camera_Type === 'Exit'
                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                        : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                    }`}>
                      {camera.Camera_Type}
                    </span>
                    {camera.zone && (
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        • {camera.zone.Zone_Name}
                      </span>
                    )}
                    {/* FPS Counter */}
                    {cameraStatuses[camera.Camara_Id] && cameraStatuses[camera.Camara_Id].fps && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        • {cameraStatuses[camera.Camara_Id].fps.toFixed(1)} FPS
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingCamera(camera);
                      setShowEditCameraModal(true);
                    }}
                    className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition"
                  >
                    <FiEdit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteCamera(camera.Camara_Id)}
                    className="p-2 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition"
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Live Video Stream */}
              <div className="relative bg-black aspect-video">
                {cameraStatuses[camera.Camara_Id]?.is_connected ? (
                  <img
                    src={`http://localhost:5001/stream/${camera.Camara_Id}?t=${Date.now()}`}
                    alt={`Camera ${camera.Camara_Id}`}
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      e.target.style.display = 'none';
                      if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                    }}
                  />
                ) : null}
                <div className={`${cameraStatuses[camera.Camara_Id]?.is_connected ? 'hidden' : 'flex'} absolute inset-0 flex-col items-center justify-center bg-gray-900 text-white`}>
                  <FiVideo size={48} className="mb-4 opacity-50" />
                  <p className="text-sm opacity-75">Camera Offline</p>
                  <p className="text-xs opacity-50 mt-2">Check connection</p>
                  <button
                    onClick={() => startCamera(camera.Camara_Id, camera.Camera_URL, camera.Camera_Type)}
                    className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition"
                  >
                    Retry Connection
                  </button>
                </div>
              </div>

              {/* Camera Info */}
              {camera.Camera_URL && (
                <div className="p-4 border-t dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">RTSP URL</p>
                  <p className="text-sm font-mono bg-gray-100 dark:bg-gray-900 rounded-lg p-2 truncate">
                    {camera.Camera_URL}
                  </p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Known in Zone</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Unknown in Zone</h3>
          <p className="text-3xl font-bold" style={{ color: '#d97706' }}>0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <h3 className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-2">Total Recognized</h3>
          <p className="text-3xl font-bold" style={{ color: '#003d82' }}>0</p>
        </div>
      </div>

      {/* Live Detection Charts */}
      {cameras.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          <div className="lg:col-span-2">
            <RealtimeDetectionChart 
              title={`${zone?.Zone_Name || 'Zone'} - Live Detections`}
              refreshInterval={2000}
            />
          </div>
          <div className="space-y-6">
            <RecognitionRateDonut 
              known={45}
              unknown={5}
              title="Recognition Accuracy"
            />
            <LiveDetectionCounter />
          </div>
        </motion.div>
      )}

      {/* Add Camera Modal */}
      <AnimatePresence>
        {showAddCameraModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isSubmitting && setShowAddCameraModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Add Camera</h2>
                <button
                  onClick={() => !isSubmitting && setShowAddCameraModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isSubmitting}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Camera Type *
                  </label>
                  <select
                    value={newCamera.Camera_Type}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_Type: e.target.value })}
                    className="custom-zones-dropdown w-full px-4 py-3 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none"
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    RTSP URL *
                  </label>
                  <input
                    type="text"
                    value={newCamera.Camera_URL}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <strong>With port:</strong> rtsp://user:pass@IP:554/cam/realmonitor?channel=1
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      <strong>Without port:</strong> rtsp://admin:password@192.168.10.4/cam/realmonitor?channel=1&subtype=0
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={newCamera.Password}
                    onChange={(e) => setNewCamera({ ...newCamera, Password: e.target.value })}
                    placeholder="Camera access password"
                    className="w-full px-4 py-3 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddCameraModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCamera}
                  disabled={!newCamera.Camera_URL.trim() || isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#003d82', color: '#fff' }}
                  onMouseEnter={(e) => { if (!isSubmitting && newCamera.Camera_URL.trim()) e.currentTarget.style.backgroundColor = '#305796'; }}
                  onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#003d82'; }}
                >
                  {isSubmitting ? 'Adding...' : 'Add Camera'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Camera Modal */}
      <AnimatePresence>
        {showEditCameraModal && editingCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isSubmitting && setShowEditCameraModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Edit Camera</h2>
                <button
                  onClick={() => !isSubmitting && setShowEditCameraModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isSubmitting}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Camera Type *
                  </label>
                  <select
                    value={editingCamera.Camera_Type}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_Type: e.target.value })}
                    className="custom-zones-dropdown w-full px-4 py-3 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none"
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    RTSP URL *
                  </label>
                  <input
                    type="text"
                    value={editingCamera.Camera_URL || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">
                    Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={editingCamera.Password || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Password: e.target.value })}
                    placeholder="Camera access password"
                    className="w-full px-4 py-3 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditCameraModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditCamera}
                  disabled={!editingCamera.Camera_URL.trim() || isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ backgroundColor: '#003d82', color: '#fff' }}
                  onMouseEnter={(e) => { if (!isSubmitting && editingCamera.Camera_URL.trim()) e.currentTarget.style.backgroundColor = '#305796'; }}
                  onMouseLeave={(e) => { if (!isSubmitting) e.currentTarget.style.backgroundColor = '#003d82'; }}
                >
                  {isSubmitting ? 'Updating...' : 'Update Camera'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ZoneLive;
