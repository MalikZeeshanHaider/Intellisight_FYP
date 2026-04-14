/**
 * Cameras Page
 * Manage cameras for each zone with Entry/Exit configuration
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiVideo, FiRefreshCw, FiPlus, FiAlertCircle, FiX, FiEdit2, FiTrash2, FiMapPin, FiChevronDown, FiPlay, FiSquare, FiEye, FiEyeOff, FiWifi, FiWifiOff } from 'react-icons/fi';
import { cameraAPI, zoneAPI, streamAPI } from '../api/api';

const Cameras = () => {
  const [cameras, setCameras] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Streaming state: which cameras are active in the Flask service
  const [streamingCameras, setStreamingCameras] = useState({}); // { cameraId: true/false }
  const [streamActionLoading, setStreamActionLoading] = useState({}); // { cameraId: true/false }
  const [streamServiceOnline, setStreamServiceOnline] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCamera, setNewCamera] = useState({
    Camera_URL: '',
    Camera_Type: 'Entry',
    Password: '',
    Zone_id: ''
  });
  const [isCreating, setIsCreating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCamera, setEditingCamera] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingCamera, setDeletingCamera] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Dropdown states for Add Modal
  const [addZoneDropdownOpen, setAddZoneDropdownOpen] = useState(false);
  const [addTypeDropdownOpen, setAddTypeDropdownOpen] = useState(false);
  const addZoneDropdownRef = useRef(null);
  const addTypeDropdownRef = useRef(null);
  
  // Dropdown states for Edit Modal
  const [editZoneDropdownOpen, setEditZoneDropdownOpen] = useState(false);
  const [editTypeDropdownOpen, setEditTypeDropdownOpen] = useState(false);
  const editZoneDropdownRef = useRef(null);
  const editTypeDropdownRef = useRef(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addZoneDropdownRef.current && !addZoneDropdownRef.current.contains(event.target)) {
        setAddZoneDropdownOpen(false);
      }
      if (addTypeDropdownRef.current && !addTypeDropdownRef.current.contains(event.target)) {
        setAddTypeDropdownOpen(false);
      }
      if (editZoneDropdownRef.current && !editZoneDropdownRef.current.contains(event.target)) {
        setEditZoneDropdownOpen(false);
      }
      if (editTypeDropdownRef.current && !editTypeDropdownRef.current.contains(event.target)) {
        setEditTypeDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Poll streaming service status (camera active states)
  const fetchStreamStatus = useCallback(async () => {
    try {
      const data = await streamAPI.getCameraStatuses();
      setStreamServiceOnline(true);
      // data is expected to be { cameras: { "<id>": { is_running: bool, ... }, ... } }
      const cameras = data?.cameras || {};
      const activeMap = {};
      Object.entries(cameras).forEach(([id, info]) => {
        activeMap[parseInt(id)] = info?.is_running === true;
      });
      setStreamingCameras(activeMap);
    } catch {
      setStreamServiceOnline(false);
    }
  }, []);

  // Fetch cameras and zones from Node.js backend
  const fetchData = async () => {
    try {
      setError(null);
      setLoading(true);

      const [camerasResponse, zonesResponse] = await Promise.all([
        cameraAPI.getAllCameras(),
        zoneAPI.getAllZones()
      ]);

      if (camerasResponse.success && camerasResponse.data) {
        setCameras(camerasResponse.data);
      }

      if (zonesResponse.success && zonesResponse.data) {
        setZones(zonesResponse.data);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load cameras');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchStreamStatus();
    // Poll streaming status every 5 seconds
    const interval = setInterval(fetchStreamStatus, 5000);
    return () => clearInterval(interval);
  }, [fetchStreamStatus]);

  // Start a camera stream in the Python Flask service
  const handleStartStream = async (camera) => {
    const id = camera.Camara_Id;
    setStreamActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await streamAPI.startCamera(id, camera.Camera_URL, camera.Camera_Type, camera.Zone_id);
      setStreamingCameras(prev => ({ ...prev, [id]: true }));
    } catch (err) {
      setError(`Failed to start stream for Camera #${id}: ${err.message}`);
    } finally {
      setStreamActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // Stop a camera stream in the Python Flask service
  const handleStopStream = async (camera) => {
    const id = camera.Camara_Id;
    setStreamActionLoading(prev => ({ ...prev, [id]: true }));
    try {
      await streamAPI.stopCamera(id);
      setStreamingCameras(prev => ({ ...prev, [id]: false }));
    } catch (err) {
      setError(`Failed to stop stream for Camera #${id}: ${err.message}`);
    } finally {
      setStreamActionLoading(prev => ({ ...prev, [id]: false }));
    }
  };

  // Create new camera
  const handleCreateCamera = async () => {
    if (!newCamera.Zone_id) {
      setError('Please select a zone');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const response = await cameraAPI.createCamera({
        ...newCamera,
        Zone_id: parseInt(newCamera.Zone_id)
      });
      
      if (response.success) {
        setShowAddModal(false);
        setNewCamera({
          Camera_URL: '',
          Camera_Type: 'Entry',
          Password: '',
          Zone_id: ''
        });
        await fetchData();
      }
    } catch (err) {
      console.error('Error creating camera:', err);
      setError(err.response?.data?.message || 'Failed to create camera');
    } finally {
      setIsCreating(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = (camera) => {
    setEditingCamera({ ...camera });
    setShowEditModal(true);
  };

  // Update camera
  const handleUpdateCamera = async () => {
    if (!editingCamera.Zone_id) {
      setError('Please select a zone');
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);

      const response = await cameraAPI.updateCamera(editingCamera.Camara_Id, {
        Camera_URL: editingCamera.Camera_URL,
        Camera_Type: editingCamera.Camera_Type,
        Password: editingCamera.Password,
        Zone_id: parseInt(editingCamera.Zone_id)
      });
      
      if (response.success) {
        setShowEditModal(false);
        setEditingCamera(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Error updating camera:', err);
      setError(err.response?.data?.message || 'Failed to update camera');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open delete modal
  const handleOpenDelete = (camera) => {
    setDeletingCamera(camera);
    setShowDeleteModal(true);
  };

  // Delete camera
  const handleDeleteCamera = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      const response = await cameraAPI.deleteCamera(deletingCamera.Camara_Id);
      
      if (response.success) {
        setShowDeleteModal(false);
        setDeletingCamera(null);
        await fetchData();
      }
    } catch (err) {
      console.error('Error deleting camera:', err);
      setError(err.response?.data?.message || 'Failed to delete camera');
    } finally {
      setIsDeleting(false);
    }
  };

  // Group cameras by zone
  const camerasByZone = cameras.reduce((acc, camera) => {
    const zoneId = camera.Zone_id || 'unassigned';
    if (!acc[zoneId]) {
      acc[zoneId] = [];
    }
    acc[zoneId].push(camera);
    return acc;
  }, {});

  const isDarkMode = document.documentElement.classList.contains('dark');

  if (loading && cameras.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: isDarkMode ? '#22d3ee' : '#305796' }}></div>
          <p className="mt-4 font-medium" style={{ color: isDarkMode ? '#c0f0f0' : '#6b7280' }}>Loading cameras...</p>
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
          border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none',
          boxShadow: isDarkMode 
            ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
            : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2" style={{ color: isDarkMode ? '#22d3ee' : '#305796' }}>
              Cameras
            </h1>
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
                Manage zone cameras
              </p>
              {/* Streaming service status pill */}
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold"
                style={{
                  backgroundColor: streamServiceOnline
                    ? (isDarkMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)')
                    : (isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)'),
                  color: streamServiceOnline ? '#22c55e' : (isDarkMode ? '#9ca3af' : '#6b7280'),
                  border: `1px solid ${streamServiceOnline ? 'rgba(34, 197, 94, 0.3)' : 'rgba(107, 114, 128, 0.2)'}`
                }}
              >
                {streamServiceOnline ? <FiWifi size={11} /> : <FiWifiOff size={11} />}
                {streamServiceOnline ? 'Stream Service Online' : 'Stream Service Offline'}
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796', 
                boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.4)' : '0 2px 8px rgba(48, 87, 150, 0.25)' 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(34, 211, 238, 0.9)' : '#274370';
                if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 30px rgba(34, 211, 238, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796';
                if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.4)';
              }}
            >
              <FiPlus size={16} />
              <span>Add Camera</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6', 
                color: isDarkMode ? '#c0f0f0' : '#6b7280',
                border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.2)' : 'rgba(48, 87, 150, 0.1)';
                e.currentTarget.style.color = isDarkMode ? '#22d3ee' : '#305796';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6';
                e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#6b7280';
              }}
            >
              <FiRefreshCw size={16} />
              <span>Refresh</span>
            </motion.button>
          </div>
        </div>
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
          <p className="text-sm font-medium" style={{ color: '#ef4444' }}>{error}</p>
        </motion.div>
      )}

      {/* Cameras by Zone */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {zones.map((zone) => {
          const zoneCameras = camerasByZone[zone.Zone_id] || [];
          const entryCameras = zoneCameras.filter(c => c.Camera_Type === 'Entry');
          const exitCameras = zoneCameras.filter(c => c.Camera_Type === 'Exit');
          
          return (
            <motion.div
              key={zone.Zone_id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-6"
              style={{ 
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                  : '#ffffff',
                border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none',
                boxShadow: isDarkMode 
                  ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                  : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796',
                    boxShadow: isDarkMode ? '0 0 15px rgba(6, 182, 212, 0.4)' : 'none'
                  }}
                >
                  <FiMapPin className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                    {zone.Zone_Name}
                  </h2>
                  <p className="text-sm" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                    {zoneCameras.length} camera{zoneCameras.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Entry and Exit Cameras Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Entry Camera */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                    <div className="w-3 h-3 rounded-full bg-green-500" style={{ boxShadow: isDarkMode ? '0 0 8px rgba(34, 197, 94, 0.5)' : 'none' }}></div>
                    Entry Camera
                  </h3>
                  {entryCameras.length > 0 ? (
                    entryCameras.map((camera) => (
                      <CameraCard
                        key={camera.Camara_Id}
                        camera={camera}
                        onEdit={handleOpenEdit}
                        onDelete={handleOpenDelete}
                        isDarkMode={isDarkMode}
                        isStreaming={streamingCameras[camera.Camara_Id] === true}
                        streamActionLoading={streamActionLoading[camera.Camara_Id] === true}
                        streamServiceOnline={streamServiceOnline}
                        onStartStream={handleStartStream}
                        onStopStream={handleStopStream}
                      />
                    ))
                  ) : (
                    <div className="rounded-xl p-4 text-center border-2 border-dashed" 
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#f9fafb',
                        borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#d1d5db'
                      }}
                    >
                      <FiVideo size={32} className="mx-auto mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#9ca3af' }} />
                      <p className="text-sm" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>No entry camera configured</p>
                    </div>
                  )}
                </div>

                {/* Exit Camera */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                    <div className="w-3 h-3 rounded-full bg-red-500" style={{ boxShadow: isDarkMode ? '0 0 8px rgba(239, 68, 68, 0.5)' : 'none' }}></div>
                    Exit Camera
                  </h3>
                  {exitCameras.length > 0 ? (
                    exitCameras.map((camera) => (
                      <CameraCard
                        key={camera.Camara_Id}
                        camera={camera}
                        onEdit={handleOpenEdit}
                        onDelete={handleOpenDelete}
                        isDarkMode={isDarkMode}
                        isStreaming={streamingCameras[camera.Camara_Id] === true}
                        streamActionLoading={streamActionLoading[camera.Camara_Id] === true}
                        streamServiceOnline={streamServiceOnline}
                        onStartStream={handleStartStream}
                        onStopStream={handleStopStream}
                      />
                    ))
                  ) : (
                    <div className="rounded-xl p-4 text-center border-2 border-dashed" 
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#f9fafb',
                        borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#d1d5db'
                      }}
                    >
                      <FiVideo size={32} className="mx-auto mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#9ca3af' }} />
                      <p className="text-sm" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#6b7280' }}>No exit camera configured</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Add Camera Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isCreating && setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border"
              style={{ 
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                  : '#ffffff',
                borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.2)',
                boxShadow: isDarkMode ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(6, 182, 212, 0.15)' : '0 20px 60px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="flex items-center justify-between p-6" style={{ borderBottom: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid #e5e7eb' }}>
                <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#22d3ee' : '#111827' }}>
                  Add Camera
                </h2>
                <button
                  onClick={() => !isCreating && setShowAddModal(false)}
                  className="p-2 rounded-lg transition"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    color: isDarkMode ? '#f87171' : '#6b7280'
                  }}
                  disabled={isCreating}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Zone *
                  </label>
                  <div className="relative" ref={addZoneDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setAddZoneDropdownOpen(!addZoneDropdownOpen)}
                      className="w-full px-4 py-3 rounded-xl border-2 outline-none text-left flex items-center justify-between"
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f9fafb',
                        borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#e5e7eb',
                        color: newCamera.Zone_id ? (isDarkMode ? '#c0f0f0' : '#111827') : (isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9CA3AF')
                      }}
                    >
                      <span>{newCamera.Zone_id ? zones.find(z => z.Zone_id.toString() === newCamera.Zone_id.toString())?.Zone_Name || 'Select Zone' : 'Select Zone'}</span>
                      <FiChevronDown className={`transition-transform ${addZoneDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isDarkMode ? '#22d3ee' : '#ea580c' }} />
                    </button>
                    
                    {addZoneDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full rounded-xl shadow-lg border py-1 z-50 max-h-48 overflow-y-auto"
                        style={{ 
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                          borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#e5e7eb'
                        }}
                      >
                        {zones.map((zone) => (
                          <button
                            key={zone.Zone_id}
                            type="button"
                            onClick={() => { setNewCamera({ ...newCamera, Zone_id: zone.Zone_id }); setAddZoneDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm font-medium transition-all"
                            style={{ 
                              backgroundColor: newCamera.Zone_id?.toString() === zone.Zone_id.toString() 
                                ? (isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#dbeafe') 
                                : 'transparent',
                              color: newCamera.Zone_id?.toString() === zone.Zone_id.toString() 
                                ? (isDarkMode ? '#22d3ee' : '#1d4ed8') 
                                : (isDarkMode ? '#c0f0f0' : '#374151')
                            }}
                            onMouseEnter={(e) => {
                              if (newCamera.Zone_id?.toString() !== zone.Zone_id.toString()) {
                                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.1)' : '#f3f4f6';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (newCamera.Zone_id?.toString() !== zone.Zone_id.toString()) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            {zone.Zone_Name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Camera Type *
                  </label>
                  <div className="relative" ref={addTypeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setAddTypeDropdownOpen(!addTypeDropdownOpen)}
                      className="w-full px-4 py-3 rounded-xl border-2 outline-none text-left flex items-center justify-between"
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f9fafb',
                        borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#e5e7eb',
                        color: isDarkMode ? '#c0f0f0' : '#111827'
                      }}
                    >
                      <span>{newCamera.Camera_Type}</span>
                      <FiChevronDown className={`transition-transform ${addTypeDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isDarkMode ? '#22d3ee' : '#ea580c' }} />
                    </button>
                    
                    {addTypeDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full rounded-xl shadow-lg border py-1 z-50"
                        style={{ 
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                          borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#e5e7eb'
                        }}
                      >
                        {['Entry', 'Exit', 'Both'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => { setNewCamera({ ...newCamera, Camera_Type: type }); setAddTypeDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm font-medium transition-all"
                            style={{ 
                              backgroundColor: newCamera.Camera_Type === type 
                                ? (isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#dbeafe') 
                                : 'transparent',
                              color: newCamera.Camera_Type === type 
                                ? (isDarkMode ? '#22d3ee' : '#1d4ed8') 
                                : (isDarkMode ? '#c0f0f0' : '#374151')
                            }}
                            onMouseEnter={(e) => {
                              if (newCamera.Camera_Type !== type) {
                                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.1)' : '#f3f4f6';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (newCamera.Camera_Type !== type) {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    RTSP URL
                  </label>
                  <input
                    type="text"
                    value={newCamera.Camera_URL}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-xl border-2 outline-none transition"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f9fafb',
                      borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.3)',
                      color: isDarkMode ? '#c0f0f0' : '#111827',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#305796';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                      <strong>With port:</strong> rtsp://user:pass@192.168.1.100:554/cam/realmonitor?channel=1
                    </p>
                    <p className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                      <strong>Without port:</strong> rtsp://user:pass@192.168.1.100/cam/realmonitor?channel=1&subtype=0
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={newCamera.Password}
                    onChange={(e) => setNewCamera({ ...newCamera, Password: e.target.value })}
                    placeholder="Camera password"
                    className="w-full px-4 py-3 rounded-xl border-2 outline-none transition"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f9fafb',
                      borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.3)',
                      color: isDarkMode ? '#c0f0f0' : '#111827',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#305796';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6" style={{ borderTop: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid #e5e7eb' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 transition disabled:opacity-50"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent',
                    borderColor: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#374151'
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateCamera}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796',
                    boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.4)' : '0 4px 20px rgba(48, 87, 150, 0.3)'
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create Camera'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Camera Modal */}
      <AnimatePresence>
        {showEditModal && editingCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isUpdating && setShowEditModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border"
              style={{ 
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                  : '#ffffff',
                borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.2)',
                boxShadow: isDarkMode ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(6, 182, 212, 0.15)' : '0 20px 60px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="flex items-center justify-between p-6" style={{ borderBottom: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid #e5e7eb' }}>
                <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#22d3ee' : '#111827' }}>
                  Edit Camera
                </h2>
                <button
                  onClick={() => !isUpdating && setShowEditModal(false)}
                  className="p-2 rounded-lg transition"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    color: isDarkMode ? '#f87171' : '#6b7280'
                  }}
                  disabled={isUpdating}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Zone *
                  </label>
                  <div className="relative" ref={editZoneDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setEditZoneDropdownOpen(!editZoneDropdownOpen)}
                      className="w-full px-4 py-3 rounded-xl border-2 outline-none text-left flex items-center justify-between"
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f9fafb',
                        borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#e5e7eb',
                        color: editingCamera.Zone_id ? (isDarkMode ? '#c0f0f0' : '#111827') : (isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9CA3AF')
                      }}
                    >
                      <span>{editingCamera.Zone_id ? zones.find(z => z.Zone_id.toString() === editingCamera.Zone_id.toString())?.Zone_Name || 'Select Zone' : 'Select Zone'}</span>
                      <FiChevronDown className={`transition-transform ${editZoneDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isDarkMode ? '#22d3ee' : '#ea580c' }} />
                    </button>
                    
                    {editZoneDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full rounded-xl shadow-lg border py-1 z-50 max-h-48 overflow-y-auto"
                        style={{ 
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                          borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#e5e7eb'
                        }}
                      >
                        {zones.map((zone) => (
                          <button
                            key={zone.Zone_id}
                            type="button"
                            onClick={() => { setEditingCamera({ ...editingCamera, Zone_id: zone.Zone_id }); setEditZoneDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm font-medium transition-all"
                            style={{ 
                              backgroundColor: editingCamera.Zone_id?.toString() === zone.Zone_id.toString() 
                                ? (isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#dbeafe') 
                                : 'transparent',
                              color: editingCamera.Zone_id?.toString() === zone.Zone_id.toString() 
                                ? (isDarkMode ? '#22d3ee' : '#1d4ed8') 
                                : (isDarkMode ? '#c0f0f0' : '#374151')
                            }}
                          >
                            {zone.Zone_Name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Camera Type *
                  </label>
                  <div className="relative" ref={editTypeDropdownRef}>
                    <button
                      type="button"
                      onClick={() => setEditTypeDropdownOpen(!editTypeDropdownOpen)}
                      className="w-full px-4 py-3 rounded-xl border-2 outline-none text-left flex items-center justify-between"
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f9fafb',
                        borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#e5e7eb',
                        color: isDarkMode ? '#c0f0f0' : '#111827'
                      }}
                    >
                      <span>{editingCamera.Camera_Type}</span>
                      <FiChevronDown className={`transition-transform ${editTypeDropdownOpen ? 'rotate-180' : ''}`} style={{ color: isDarkMode ? '#22d3ee' : '#ea580c' }} />
                    </button>
                    
                    {editTypeDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full rounded-xl shadow-lg border py-1 z-50"
                        style={{ 
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.98)' : '#ffffff',
                          borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#e5e7eb'
                        }}
                      >
                        {['Entry', 'Exit', 'Both'].map((type) => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => { setEditingCamera({ ...editingCamera, Camera_Type: type }); setEditTypeDropdownOpen(false); }}
                            className="w-full text-left px-4 py-2 text-sm font-medium transition-all"
                            style={{ 
                              backgroundColor: editingCamera.Camera_Type === type 
                                ? (isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#dbeafe') 
                                : 'transparent',
                              color: editingCamera.Camera_Type === type 
                                ? (isDarkMode ? '#22d3ee' : '#1d4ed8') 
                                : (isDarkMode ? '#c0f0f0' : '#374151')
                            }}
                          >
                            {type}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    RTSP URL
                  </label>
                  <input
                    type="text"
                    value={editingCamera.Camera_URL || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-xl border-2 outline-none transition"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f9fafb',
                      borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.3)',
                      color: isDarkMode ? '#c0f0f0' : '#111827',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#305796';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                      <strong>With port:</strong> rtsp://user:pass@IP:554/cam/realmonitor?channel=1
                    </p>
                    <p className="text-xs" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                      <strong>Without port:</strong> rtsp://user:pass@192.168.1.100/cam/realmonitor?channel=1&subtype=0
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={editingCamera.Password || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Password: e.target.value })}
                    placeholder="Camera password"
                    className="w-full px-4 py-3 rounded-xl border-2 outline-none transition"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f9fafb',
                      borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.3)',
                      color: isDarkMode ? '#c0f0f0' : '#111827',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#305796';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(48, 87, 150, 0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6" style={{ borderTop: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid #e5e7eb' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditModal(false)}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 transition disabled:opacity-50"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent',
                    borderColor: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#374151'
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateCamera}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#305796',
                    boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.4)' : '0 4px 20px rgba(48, 87, 150, 0.3)'
                  }}
                >
                  {isUpdating ? 'Updating...' : 'Update Camera'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Camera Modal */}
      <AnimatePresence>
        {showDeleteModal && deletingCamera && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => !isDeleting && setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border"
              style={{ 
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                  : '#ffffff',
                borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                boxShadow: isDarkMode ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(239, 68, 68, 0.15)' : '0 20px 60px rgba(0, 0, 0, 0.2)'
              }}
            >
              <div className="flex items-center justify-between p-6" style={{ borderBottom: isDarkMode ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid #e5e7eb' }}>
                <h2 className="text-2xl font-bold text-red-500">
                  Delete Camera
                </h2>
                <button
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  className="p-2 rounded-lg transition"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    color: isDarkMode ? '#f87171' : '#6b7280'
                  }}
                  disabled={isDeleting}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="p-6">
                <p className="text-lg mb-4" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                  Are you sure you want to delete this camera?
                </p>
                <div className="rounded-lg p-4" style={{ 
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.05)',
                  borderLeft: '4px solid #ef4444'
                }}>
                  <p className="text-sm" style={{ color: isDarkMode ? '#f87171' : '#dc2626' }}>
                    ⚠️ This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-6" style={{ borderTop: isDarkMode ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid #e5e7eb' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 transition disabled:opacity-50"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent',
                    borderColor: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#374151'
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteCamera}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{
                    backgroundColor: '#ef4444',
                    boxShadow: isDarkMode ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 4px 20px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Camera'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Camera Card Component — with live stream preview and start/stop controls
const CameraCard = ({
  camera, onEdit, onDelete, isDarkMode,
  isStreaming, streamActionLoading, streamServiceOnline,
  onStartStream, onStopStream,
}) => {
  const [showPreview, setShowPreview] = useState(false);
  const [frameSrc, setFrameSrc]       = useState(null);
  const wsRef      = useRef(null);
  const prevBlobRef = useRef(null);

  // Hide preview automatically when stream stops
  useEffect(() => {
    if (!isStreaming) setShowPreview(false);
  }, [isStreaming]);

  // Open / close WebSocket connection whenever preview visibility changes
  useEffect(() => {
    // Close any existing WS first
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    if (prevBlobRef.current) {
      URL.revokeObjectURL(prevBlobRef.current);
      prevBlobRef.current = null;
    }
    setFrameSrc(null);

    if (!showPreview || !isStreaming) return;  // nothing to open

    const wsUrl = streamAPI.getWsStreamUrl(camera.Camara_Id);
    const ws    = new WebSocket(wsUrl);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const blob = new Blob([event.data], { type: 'image/jpeg' });
      const url  = URL.createObjectURL(blob);
      // Revoke the previous blob URL to free memory
      if (prevBlobRef.current) URL.revokeObjectURL(prevBlobRef.current);
      prevBlobRef.current = url;
      setFrameSrc(url);
    };

    ws.onerror = () => setShowPreview(false);
    ws.onclose = () => setFrameSrc(null);

    return () => {
      ws.close();
      if (prevBlobRef.current) {
        URL.revokeObjectURL(prevBlobRef.current);
        prevBlobRef.current = null;
      }
    };
  }, [showPreview, isStreaming, camera.Camara_Id]);

  return (
    <motion.div
      className="rounded-xl border-2 mb-3 overflow-hidden"
      style={{
        backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
        borderColor: isStreaming
          ? (isDarkMode ? 'rgba(34, 197, 94, 0.4)' : 'rgba(34, 197, 94, 0.5)')
          : (isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#e5e7eb'),
      }}
    >
      {/* Live stream preview panel — WebSocket push frames */}
      <AnimatePresence>
        {showPreview && isStreaming && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
              {frameSrc ? (
                <img
                  src={frameSrc}
                  alt={`Camera ${camera.Camara_Id} live feed`}
                  className="w-full h-full object-contain"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="inline-block w-8 h-8 border-2 border-white/40 border-t-white rounded-full animate-spin mb-2" />
                    <p className="text-white/60 text-xs">Connecting...</p>
                  </div>
                </div>
              )}
              {/* Live badge */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-bold text-white"
                style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                LIVE
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2">
            <FiVideo style={{ color: isDarkMode ? '#22d3ee' : '#305796' }} size={20} />
            <span className="font-bold text-sm" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
              Camera #{camera.Camara_Id}
            </span>
            {/* Streaming status dot */}
            {streamServiceOnline && (
              <span
                className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-green-500' : 'bg-gray-400'}`}
                title={isStreaming ? 'Stream active' : 'Stream inactive'}
                style={{ boxShadow: isStreaming && isDarkMode ? '0 0 6px #22c55e' : 'none' }}
              />
            )}
          </div>
          <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
            camera.Camera_Type === 'Entry'
              ? (isDarkMode ? 'bg-green-500/20 text-green-400' : 'bg-green-500/20 text-green-600')
              : (isDarkMode ? 'bg-red-500/20 text-red-400' : 'bg-red-500/20 text-red-600')
          }`}>
            {camera.Camera_Type}
          </div>
        </div>

        {camera.Camera_URL && (
          <p className="text-xs mb-3 font-mono truncate" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
            {camera.Camera_URL}
          </p>
        )}

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          {/* Start / Stop stream */}
          {streamServiceOnline && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={streamActionLoading}
              onClick={() => isStreaming ? onStopStream(camera) : onStartStream(camera)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50"
              style={{
                backgroundColor: isStreaming
                  ? (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)')
                  : (isDarkMode ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)'),
                color: isStreaming ? '#ef4444' : '#22c55e',
                border: `1px solid ${isStreaming ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`,
              }}
            >
              {streamActionLoading ? (
                <span className="inline-block w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : isStreaming ? (
                <FiSquare size={12} />
              ) : (
                <FiPlay size={12} />
              )}
              {streamActionLoading ? 'Wait...' : isStreaming ? 'Stop' : 'Start'}
            </motion.button>
          )}

          {/* Preview toggle — only when streaming */}
          {isStreaming && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowPreview(v => !v)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
              style={{
                backgroundColor: showPreview
                  ? (isDarkMode ? 'rgba(6, 182, 212, 0.25)' : 'rgba(48, 87, 150, 0.15)')
                  : (isDarkMode ? 'rgba(6, 182, 212, 0.1)' : 'rgba(48, 87, 150, 0.08)'),
                color: isDarkMode ? '#22d3ee' : '#305796',
                border: isDarkMode ? '1px solid rgba(6,182,212,0.3)' : 'none',
              }}
            >
              {showPreview ? <FiEyeOff size={12} /> : <FiEye size={12} />}
              {showPreview ? 'Hide' : 'Preview'}
            </motion.button>
          )}

          {/* Edit */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onEdit(camera)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(48, 87, 150, 0.1)',
              color: isDarkMode ? '#22d3ee' : '#305796',
              border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none',
            }}
          >
            <FiEdit2 size={12} />
            Edit
          </motion.button>

          {/* Delete */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onDelete(camera)}
            className="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all"
            style={{
              backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.2)' : 'none',
            }}
          >
            <FiTrash2 size={12} />
            Delete
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default Cameras;
