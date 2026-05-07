/**
 * Dynamic Zone Live Tracking Page
 * Works for any zone - automatically adapts based on route parameter
 * Supports IP camera configuration and real-time face recognition
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiAlertCircle, FiArrowLeft, FiCamera, FiPlus, FiX, FiVideo, FiEdit2, FiTrash2, FiCheckCircle } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { cameraAPI, zoneAPI, streamAPI } from '../api/api';
import { useWebRTCStream } from '../hooks/useWebRTCStream';
import { useDetectionEvents } from '../hooks/useDetectionEvents';
import DetectionOverlay from '../components/DetectionOverlay';
import MjpegFeed from '../components/MjpegFeed';
import { RealtimeDetectionChart, LiveDetectionCounter } from '../components/RealtimeDetectionChart';
import { RecognitionRateDonut, MiniRecognitionRate } from '../components/RecognitionRateDonut';

const ZoneLive = () => {
  const isDarkMode = document.documentElement.classList.contains('dark');
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
  const [isReloading, setIsReloading] = useState(false);
  const [newCamera, setNewCamera] = useState({
    Camera_URL: '',
    Camera_Type: 'Entry',
    Password: ''
  });

  // Live stats — fetched from DB + Python service
  const [knownInZone, setKnownInZone] = useState(0);
  const [unknownInZone, setUnknownInZone] = useState(0);
  const [embeddingStats, setEmbeddingStats] = useState(null); // {total_embeddings, persons}

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

  // Check camera service status + grab embedding info in one call
  const checkServiceStatus = async () => {
    try {
      const response = await fetch('http://localhost:5001/health');
      const data = await response.json();
      if (data.status === 'ok') {
        setServiceOnline(true);
        // Grab embedding details from the debug endpoint
        try {
          const embRes = await fetch('http://localhost:5001/debug/embeddings');
          const embData = await embRes.json();
          setEmbeddingStats(embData);
        } catch (_) {}
        return true;
      }
    } catch (err) {
      setServiceOnline(false);
    }
    return false;
  };

  // Fetch live zone stats from Node.js DB
  const fetchZoneStats = async () => {
    try {
      const [knownRes, unknownRes] = await Promise.all([
        zoneAPI.getPersonsInZone(zoneId),
        zoneAPI.getZoneUnknownCount(zoneId),
      ]);
      if (knownRes.success) setKnownInZone(knownRes.data?.length ?? 0);
      if (unknownRes.success) setUnknownInZone(unknownRes.data?.count ?? 0);
    } catch (_) {}
  };

  // Reload face embeddings in the Python AI service
  const handleReloadEmbeddings = async () => {
    try {
      setIsReloading(true);
      await streamAPI.reloadEmbeddings();
      await checkServiceStatus(); // refresh embedding count display
    } catch (err) {
      console.error('Failed to reload embeddings:', err);
    } finally {
      setIsReloading(false);
    }
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
    
    // Initial DB stats fetch
    fetchZoneStats();

    // Poll camera statuses every 3 s, DB stats every 10 s
    const statusInterval = setInterval(fetchCameraStatuses, 3000);
    const statsInterval  = setInterval(fetchZoneStats, 10000);

    return () => {
      clearInterval(statusInterval);
      clearInterval(statsInterval);
    };
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
      checkServiceStatus(),
      fetchZoneStats(),
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
              border: isDarkMode ? '4px solid rgba(0, 255, 255, 0.2)' : '4px solid rgba(0, 61, 130, 0.2)',
              borderTopColor: isDarkMode ? '#00ffff' : '#003d82'
            }}
          />
          <p className="font-medium" style={{ color: isDarkMode ? '#c0f0f0' : '#4b5563' }}>Loading zone...</p>
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
            className="flex items-center justify-center w-10 h-10 rounded-xl shadow-sm transition"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.9), rgba(30, 41, 59, 0.9))'
                : 'white',
              border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #e5e7eb'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = isDarkMode ? '0 0 15px rgba(0, 255, 255, 0.2)' : '0 4px 12px rgba(0, 0, 0, 0.1)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <FiArrowLeft size={20} style={{ color: isDarkMode ? '#00ffff' : '#003d82' }} />
          </button>
          <div>
            <h1 className="text-4xl font-display font-black" style={{ color: isDarkMode ? '#c0f0f0' : '#003d82' }}>
              {zone?.Zone_Name} - Live Tracking
            </h1>
          </div>
        </div>

        <div className="flex gap-3 flex-wrap justify-end">
          {/* Embedding stats badge */}
          {embeddingStats && (
            <div
              className="flex items-center space-x-3 px-4 py-2 rounded-xl border"
              style={{
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.9)' : 'white',
                border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.2)' : '1px solid #e5e7eb'
              }}
            >
              {Object.entries(embeddingStats.persons || {}).map(([name, count]) => (
                <span key={name} className="text-xs font-medium" style={{ color: isDarkMode ? 'rgba(192,240,240,0.8)' : '#374151' }}>
                  {name} ({count})
                </span>
              ))}
              <span className="text-xs font-bold" style={{ color: isDarkMode ? '#00ffff' : '#003d82' }}>
                {embeddingStats.total_embeddings} embeddings
              </span>
            </div>
          )}

          {!serviceOnline && (
            <div
              className="flex items-center space-x-2 px-4 py-2 rounded-xl border"
              style={{
                backgroundColor: isDarkMode ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                borderColor: 'rgba(245, 158, 11, 0.3)',
                color: '#d97706'
              }}
            >
              <FiAlertCircle size={18} />
              <span className="text-sm font-semibold">Service Offline</span>
            </div>
          )}
          {serviceOnline && (
            <div
              className="flex items-center space-x-2 px-4 py-2 rounded-xl border"
              style={{
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.15)' : 'rgba(16, 185, 129, 0.1)',
                borderColor: 'rgba(16, 185, 129, 0.3)',
                color: isDarkMode ? '#34d399' : '#10b981'
              }}
            >
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-semibold">AI Service Active</span>
            </div>
          )}

          {/* Reload embeddings — re-reads the JSON embedding file into memory */}
          {serviceOnline && (
            <button
              onClick={handleReloadEmbeddings}
              disabled={isReloading}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition disabled:opacity-50"
              style={{
                backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#10b981',
                color: isDarkMode ? '#34d399' : '#fff',
                border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.5)' : 'none',
              }}
            >
              <FiCheckCircle size={16} className={isReloading ? 'animate-spin' : ''} />
              <span>{isReloading ? 'Reloading...' : 'Reload Embeddings'}</span>
            </button>
          )}

          <button
            onClick={handleRefresh}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.15)' : '#003d82', 
              color: isDarkMode ? '#00ffff' : '#fff',
              border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.4)' : 'none',
              boxShadow: isDarkMode ? '0 0 15px rgba(0, 255, 255, 0.2)' : 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.25)' : '#305796';
              if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.15)' : '#003d82';
              if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.2)';
            }}
          >
            <FiRefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            onClick={() => setShowAddCameraModal(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl font-semibold transition"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#10b981', 
              color: isDarkMode ? '#34d399' : '#fff',
              border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.5)' : 'none',
              boxShadow: isDarkMode ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#059669';
              if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#10b981';
              if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.2)';
            }}
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
            className="border-l-4 border-red-500 rounded-lg p-4 flex items-start"
            style={{
              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgb(254, 242, 242)',
              border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : undefined,
              borderLeft: '4px solid #ef4444'
            }}
          >
            <FiAlertCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
            <p className="font-medium" style={{ color: isDarkMode ? '#fca5a5' : '#dc2626' }}>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cameras.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full rounded-xl p-12 text-center border-2 border-dashed"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.5)' : 'white',
              borderColor: isDarkMode ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 61, 130, 0.2)' 
            }}
          >
            <FiVideo size={48} className="mx-auto mb-4" style={{ color: isDarkMode ? '#00ffff' : '#003d82', opacity: 0.5 }} />
            <h3 className="text-xl font-bold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#003d82' }}>
              No Cameras Configured
            </h3>
            <p className="mb-4" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
              Add IP cameras to start live face recognition
            </p>
            <button
              onClick={() => setShowAddCameraModal(true)}
              className="px-6 py-2 rounded-xl font-semibold transition"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.2)' : '#003d82', 
                color: isDarkMode ? '#00ffff' : '#fff',
                border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.4)' : 'none'
              }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.3)' : '#305796'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.2)' : '#003d82'}
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
              className="rounded-xl overflow-hidden shadow-sm"
              style={{
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
                border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.2)' : '1px solid #e5e7eb'
              }}
            >
              {/* Camera Header */}
              <div 
                className="flex items-start justify-between p-4"
                style={{ borderBottom: isDarkMode ? '1px solid rgba(0, 255, 255, 0.15)' : '1px solid #e5e7eb' }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-bold" style={{ color: isDarkMode ? '#c0f0f0' : '#1f2937' }}>
                      Camera #{camera.Camara_Id}
                    </h3>
                    {/* Connection Status Indicator */}
                    {cameraStatuses[camera.Camara_Id] && (
                      <div className="flex items-center gap-1">
                        {cameraStatuses[camera.Camara_Id].is_connected ? (
                          <>
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs font-medium" style={{ color: isDarkMode ? '#34d399' : '#059669' }}>Live</span>
                          </>
                        ) : (
                          <>
                            <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                            <span className="text-xs font-medium" style={{ color: isDarkMode ? '#f87171' : '#dc2626' }}>Offline</span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span 
                      className="px-2 py-1 rounded-lg text-xs font-bold"
                      style={{
                        backgroundColor: camera.Camera_Type === 'Entry' 
                          ? (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7')
                          : camera.Camera_Type === 'Exit'
                          ? (isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2')
                          : (isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe'),
                        color: camera.Camera_Type === 'Entry' 
                          ? (isDarkMode ? '#34d399' : '#15803d')
                          : camera.Camera_Type === 'Exit'
                          ? (isDarkMode ? '#f87171' : '#b91c1c')
                          : (isDarkMode ? '#60a5fa' : '#1d4ed8')
                      }}
                    >
                      {camera.Camera_Type}
                    </span>
                    {camera.zone && (
                      <span className="text-sm" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>
                        • {camera.zone.Zone_Name}
                      </span>
                    )}
                    {/* FPS Counter */}
                    {cameraStatuses[camera.Camara_Id] && cameraStatuses[camera.Camara_Id].fps && (
                      <span className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>
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
                    className="p-2 rounded-lg transition"
                    style={{ 
                      color: isDarkMode ? '#60a5fa' : '#2563eb',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#dbeafe'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <FiEdit2 size={18} />
                  </button>
                  <button
                    onClick={() => handleDeleteCamera(camera.Camara_Id)}
                    className="p-2 rounded-lg transition"
                    style={{ 
                      color: isDarkMode ? '#f87171' : '#dc2626',
                      backgroundColor: 'transparent'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#fee2e2'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <FiTrash2 size={18} />
                  </button>
                </div>
              </div>

              {/* Live Video Stream — WebRTC from MediaMTX + AI overlay */}
              <ZoneCameraVideo
                camera={camera}
                isConnected={!!cameraStatuses[camera.Camara_Id]?.is_connected}
                onRetry={() => startCamera(camera.Camara_Id, camera.Camera_URL, camera.Camera_Type)}
                isDarkMode={isDarkMode}
              />

              {/* Camera Info */}
              {camera.Camera_URL && (
                <div 
                  className="p-4"
                  style={{ borderTop: isDarkMode ? '1px solid rgba(0, 255, 255, 0.15)' : '1px solid #e5e7eb' }}
                >
                  <p className="text-xs mb-1" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>RTSP URL</p>
                  <p 
                    className="text-sm font-mono rounded-lg p-2 truncate"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6',
                      color: isDarkMode ? '#c0f0f0' : '#1f2937'
                    }}
                  >
                    {camera.Camera_URL}
                  </p>
                </div>
              )}
            </motion.div>
          ))
        )}
      </div>

      {/* Stats — live from ActivePresence + UnknownFaces tables */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #e5e7eb'
          }}
        >
          <h3 className="text-sm font-medium mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Known in Zone</h3>
          <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#34d399' : '#059669' }}>{knownInZone}</p>
          <p className="text-xs mt-1" style={{ color: isDarkMode ? 'rgba(192,240,240,0.4)' : '#9ca3af' }}>People recognised by AI</p>
        </div>
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid #e5e7eb'
          }}
        >
          <h3 className="text-sm font-medium mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Unknown Detected</h3>
          <p className="text-3xl font-bold" style={{ color: '#d97706' }}>{unknownInZone}</p>
          <p className="text-xs mt-1" style={{ color: isDarkMode ? 'rgba(192,240,240,0.4)' : '#9ca3af' }}>Faces not in database</p>
        </div>
        <div
          className="rounded-xl p-6 shadow-sm"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #e5e7eb'
          }}
        >
          <h3 className="text-sm font-medium mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>Total Detected</h3>
          <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#00ffff' : '#003d82' }}>{knownInZone + unknownInZone}</p>
          <p className="text-xs mt-1" style={{ color: isDarkMode ? 'rgba(192,240,240,0.4)' : '#9ca3af' }}>Known + unknown</p>
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
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
              background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)'
            }}
            onClick={() => !isSubmitting && setShowAddCameraModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
              style={{
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                  : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(20px)',
                border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: isDarkMode 
                  ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 255, 255, 0.1)'
                  : '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#c0f0f0' : '#1f2937' }}>Add Camera</h2>
                <button
                  onClick={() => !isSubmitting && setShowAddCameraModal(false)}
                  className="p-2 rounded-lg transition"
                  disabled={isSubmitting}
                  style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                    Camera Type *
                  </label>
                  <select
                    value={newCamera.Camera_Type}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_Type: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg focus:outline-none"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                      border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #d1d5db',
                      color: isDarkMode ? '#c0f0f0' : '#1f2937'
                    }}
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                    RTSP URL *
                  </label>
                  <input
                    type="text"
                    value={newCamera.Camera_URL}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-lg focus:outline-none"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                      border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #d1d5db',
                      color: isDarkMode ? '#c0f0f0' : '#1f2937'
                    }}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>
                      <strong>With port:</strong> rtsp://user:pass@IP:554/cam/realmonitor?channel=1
                    </p>
                    <p className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>
                      <strong>Without port:</strong> rtsp://admin:password@192.168.10.4/cam/realmonitor?channel=1&subtype=0
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                    Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={newCamera.Password}
                    onChange={(e) => setNewCamera({ ...newCamera, Password: e.target.value })}
                    placeholder="Camera access password"
                    className="w-full px-4 py-3 rounded-lg focus:outline-none"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                      border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.3)' : '1px solid #d1d5db',
                      color: isDarkMode ? '#c0f0f0' : '#1f2937'
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddCameraModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50"
                  style={{
                    background: isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'transparent',
                    border: isDarkMode ? '1px solid rgba(107, 114, 128, 0.4)' : '2px solid #d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#4b5563'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDarkMode ? 'rgba(107, 114, 128, 0.3)' : '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'transparent'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCamera}
                  disabled={!newCamera.Camera_URL.trim() || isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.2)' : '#003d82', 
                    color: isDarkMode ? '#00ffff' : '#fff',
                    border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.5)' : 'none',
                    boxShadow: isDarkMode && newCamera.Camera_URL.trim() && !isSubmitting ? '0 0 15px rgba(0, 255, 255, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => { 
                    if (!isSubmitting && newCamera.Camera_URL.trim()) {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.3)' : '#305796';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(0, 255, 255, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => { 
                    if (!isSubmitting) {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(0, 255, 255, 0.2)' : '#003d82';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(0, 255, 255, 0.2)';
                    }
                  }}
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
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
            style={{
              background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
              backdropFilter: 'blur(8px)'
            }}
            onClick={() => !isSubmitting && setShowEditCameraModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
              style={{
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                  : 'rgba(255, 255, 255, 0.98)',
                backdropFilter: 'blur(20px)',
                border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid rgba(0, 0, 0, 0.1)',
                boxShadow: isDarkMode 
                  ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(59, 130, 246, 0.1)'
                  : '0 20px 60px rgba(0, 0, 0, 0.3)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#c0f0f0' : '#1f2937' }}>Edit Camera</h2>
                <button
                  onClick={() => !isSubmitting && setShowEditCameraModal(false)}
                  className="p-2 rounded-lg transition"
                  disabled={isSubmitting}
                  style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                    Camera Type *
                  </label>
                  <select
                    value={editingCamera.Camera_Type}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_Type: e.target.value })}
                    className="w-full px-4 py-3 rounded-lg focus:outline-none"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                      border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #d1d5db',
                      color: isDarkMode ? '#c0f0f0' : '#1f2937'
                    }}
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                    RTSP URL *
                  </label>
                  <input
                    type="text"
                    value={editingCamera.Camera_URL || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-lg focus:outline-none"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                      border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #d1d5db',
                      color: isDarkMode ? '#c0f0f0' : '#1f2937'
                    }}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                    Password (Optional)
                  </label>
                  <input
                    type="password"
                    value={editingCamera.Password || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Password: e.target.value })}
                    placeholder="Camera access password"
                    className="w-full px-4 py-3 rounded-lg focus:outline-none"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                      border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid #d1d5db',
                      color: isDarkMode ? '#c0f0f0' : '#1f2937'
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowEditCameraModal(false)}
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50"
                  style={{
                    background: isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'transparent',
                    border: isDarkMode ? '1px solid rgba(107, 114, 128, 0.4)' : '2px solid #d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#4b5563'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = isDarkMode ? 'rgba(107, 114, 128, 0.3)' : '#f3f4f6'}
                  onMouseLeave={(e) => e.currentTarget.style.background = isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'transparent'}
                >
                  Cancel
                </button>
                <button
                  onClick={handleEditCamera}
                  disabled={!editingCamera.Camera_URL.trim() || isSubmitting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#003d82', 
                    color: isDarkMode ? '#60a5fa' : '#fff',
                    border: isDarkMode ? '1px solid rgba(59, 130, 246, 0.5)' : 'none',
                    boxShadow: isDarkMode && editingCamera.Camera_URL?.trim() && !isSubmitting ? '0 0 15px rgba(59, 130, 246, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => { 
                    if (!isSubmitting && editingCamera.Camera_URL?.trim()) {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(59, 130, 246, 0.3)' : '#305796';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => { 
                    if (!isSubmitting) {
                      e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(59, 130, 246, 0.2)' : '#003d82';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(59, 130, 246, 0.2)';
                    }
                  }}
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

// Camera video tile — WebRTC from MediaMTX + AI bbox overlay.
// Connects only when the camera is reported connected by /cameras/status.
const ZoneCameraVideo = ({ camera, isConnected, onRetry, isDarkMode }) => {
  const whepUrl = streamAPI.getWebRTCUrl(camera.Camara_Id);
  const { videoRef, state: wrtcState, error: wrtcError } = useWebRTCStream(
    whepUrl,
    isConnected,
  );
  const mjpegRef = useRef(null);
  const useMjpeg = wrtcState === 'error';
  const events = useDetectionEvents(isConnected ? [camera.Camara_Id] : []);

  if (!isConnected) {
    return (
      <div className="relative bg-black aspect-video flex flex-col items-center justify-center text-white">
        <FiVideo size={48} className="mb-4 opacity-50" />
        <p className="text-sm opacity-75">Camera Offline</p>
        <p className="text-xs opacity-50 mt-2">Check connection</p>
        <button
          onClick={onRetry}
          className="mt-4 px-4 py-2 rounded-lg text-sm font-medium transition"
          style={{
            backgroundColor: isDarkMode ? 'rgba(0, 255, 255, 0.2)' : '#2563eb',
            color: isDarkMode ? '#00ffff' : '#fff',
            border: isDarkMode ? '1px solid rgba(0, 255, 255, 0.4)' : 'none',
          }}
        >
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div className="relative bg-black aspect-video">

      {/* Snapshot-polling fallback when MediaMTX is unreachable */}
      {useMjpeg ? (
        <MjpegFeed
          ref={mjpegRef}
          cameraId={camera.Camara_Id}
          fps={8}
          className="w-full h-full object-contain"
        />
      ) : (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className="w-full h-full object-contain"
        />
      )}
      <DetectionOverlay
        cameraId={camera.Camara_Id}
        videoRef={useMjpeg ? mjpegRef : videoRef}
        events={events}
      />

      {/* Spinner only while WebRTC is negotiating */}
      {wrtcState === 'connecting' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin mb-2" />
            <p className="text-white/60 text-xs">Connecting to MediaMTX...</p>
          </div>
        </div>
      )}

      {/* Live badge */}
      <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)' }}>
        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
        {wrtcState === 'error' ? 'LIVE (MJPEG)' : 'LIVE'}
      </div>

    </div>
  );
};

export default ZoneLive;
