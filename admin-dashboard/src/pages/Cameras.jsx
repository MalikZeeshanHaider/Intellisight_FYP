/**
 * Cameras Page
 * Manage cameras for each zone with Entry/Exit configuration
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiVideo, FiRefreshCw, FiPlus, FiAlertCircle, FiX, FiEdit2, FiTrash2, FiMapPin } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi';
import { cameraAPI, zoneAPI } from '../api/api';

const Cameras = () => {
  const [cameras, setCameras] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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

  // Fetch cameras and zones
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
  }, []);

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

  if (loading && cameras.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mb-4"
            style={{ boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)' }}
          />
          <p style={{ color: 'var(--text-soft)' }} className="font-medium">Loading cameras...</p>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 relative"
    >
      {/* Animated Background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden dark:opacity-30 opacity-15 z-0">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 90, 0],
            opacity: [0.3, 0.6, 0.3]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(99, 102, 241, 0.15) 0%, transparent 70%)'
          }}
        />
      </div>

      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between relative z-10 px-6"
      >
        <div className="relative">
          <h1 className="text-5xl font-display font-black relative"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 30px rgba(99, 102, 241, 0.5)'
            }}
          >
            Cameras
          </h1>
          <motion.p
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="flex items-center gap-2 mt-2"
            style={{ color: 'var(--text-soft)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <HiSparkles className="text-indigo-400" />
            </motion.div>
            <span className="font-semibold">Manage zone cameras</span>
          </motion.p>
        </div>

        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(16, 185, 129, 0.6)' }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl font-bold relative overflow-hidden group dark:bg-gradient-to-br dark:from-green-500 dark:to-emerald-500 bg-gradient-to-br from-green-600 to-green-700 border-2 dark:border-white/20 border-green-800/30"
            style={{
              boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(16, 185, 129, 0.4)' : '0 4px 20px rgba(5, 150, 105, 0.3)'
            }}
          >
            <FiPlus size={18} className="text-white" />
            <span className="text-white relative z-10">Add Camera</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)' }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchData}
            className="flex items-center gap-3 px-6 py-3 rounded-2xl font-bold relative overflow-hidden group dark:bg-gradient-to-br dark:from-indigo-500 dark:to-purple-500 bg-gradient-to-br from-indigo-600 to-indigo-700 border-2 dark:border-white/20 border-indigo-800/30"
            style={{
              boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(99, 102, 241, 0.4)' : '0 4px 20px rgba(99, 102, 241, 0.3)'
            }}
          >
            <motion.div
              animate={loading ? { rotate: 360 } : {}}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <FiRefreshCw size={18} className="text-white" />
            </motion.div>
            <span className="text-white relative z-10">Refresh</span>
          </motion.button>
        </div>
      </motion.div>

      {/* Error Alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative z-10 px-6"
          >
            <div className="dark:bg-gradient-to-br dark:from-red-500/10 dark:to-red-600/10 bg-red-50 border-l-4 border-red-500 rounded-2xl p-4 flex items-start backdrop-blur-xl"
              style={{
                boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(239, 68, 68, 0.2)' : '0 4px 20px rgba(239, 68, 68, 0.1)'
              }}
            >
              <FiAlertCircle className="text-red-500 mt-0.5 mr-3 flex-shrink-0" size={20} />
              <p className="text-red-600 dark:text-red-400 font-medium">{error}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cameras by Zone */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="space-y-6 relative z-10 px-6"
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
              className="dark:bg-gradient-to-br dark:from-indigo-500/10 dark:to-purple-500/10 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl rounded-3xl p-6 dark:border-indigo-500/30 border-indigo-200 border-2"
              style={{
                boxShadow: document.documentElement.classList.contains('dark') 
                  ? '0 8px 32px rgba(99, 102, 241, 0.2)' 
                  : '0 10px 40px rgba(99, 102, 241, 0.15)'
              }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                    boxShadow: '0 0 20px rgba(99, 102, 241, 0.6)'
                  }}
                >
                  <FiMapPin className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                    {zone.Zone_Name}
                  </h2>
                  <p className="text-sm" style={{ color: 'var(--text-soft)' }}>
                    {zoneCameras.length} camera{zoneCameras.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Entry and Exit Cameras Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Entry Camera */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                    <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></div>
                    Entry Camera
                  </h3>
                  {entryCameras.length > 0 ? (
                    entryCameras.map((camera) => (
                      <CameraCard 
                        key={camera.Camara_Id} 
                        camera={camera} 
                        onEdit={handleOpenEdit}
                        onDelete={handleOpenDelete}
                      />
                    ))
                  ) : (
                    <div className="dark:bg-white/5 bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed dark:border-gray-700 border-gray-300">
                      <FiVideo size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-soft)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-soft)' }}>No entry camera configured</p>
                    </div>
                  )}
                </div>

                {/* Exit Camera */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2" style={{ color: 'var(--text-main)' }}>
                    <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></div>
                    Exit Camera
                  </h3>
                  {exitCameras.length > 0 ? (
                    exitCameras.map((camera) => (
                      <CameraCard 
                        key={camera.Camara_Id} 
                        camera={camera} 
                        onEdit={handleOpenEdit}
                        onDelete={handleOpenDelete}
                      />
                    ))
                  ) : (
                    <div className="dark:bg-white/5 bg-gray-100 rounded-xl p-4 text-center border-2 border-dashed dark:border-gray-700 border-gray-300">
                      <FiVideo size={32} className="mx-auto mb-2 opacity-30" style={{ color: 'var(--text-soft)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-soft)' }}>No exit camera configured</p>
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
              className="w-full max-w-lg dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 bg-white rounded-3xl shadow-2xl overflow-hidden border-2 dark:border-indigo-500/30 border-indigo-200"
            >
              <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                  Add Camera
                </h2>
                <button
                  onClick={() => !isCreating && setShowAddModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isCreating}
                >
                  <FiX size={20} style={{ color: 'var(--text-soft)' }} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    Zone *
                  </label>
                  <select
                    value={newCamera.Zone_id}
                    onChange={(e) => setNewCamera({ ...newCamera, Zone_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl dark:bg-gray-700 bg-gray-50 border-2 dark:border-gray-600 border-gray-300 focus:dark:border-indigo-500 focus:border-indigo-500 outline-none transition"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <option value="">Select Zone</option>
                    {zones.map((zone) => (
                      <option key={zone.Zone_id} value={zone.Zone_id}>
                        {zone.Zone_Name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    Camera Type *
                  </label>
                  <select
                    value={newCamera.Camera_Type}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_Type: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl dark:bg-gray-700 bg-gray-50 border-2 dark:border-gray-600 border-gray-300 focus:dark:border-indigo-500 focus:border-indigo-500 outline-none transition"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    RTSP URL
                  </label>
                  <input
                    type="text"
                    value={newCamera.Camera_URL}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-xl dark:bg-gray-700 bg-gray-50 border-2 dark:border-gray-600 border-gray-300 focus:dark:border-indigo-500 focus:border-indigo-500 outline-none transition"
                    style={{ color: 'var(--text-main)' }}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
                      <strong>With port:</strong> rtsp://user:pass@192.168.1.100:554/cam/realmonitor?channel=1
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
                      <strong>Without port:</strong> rtsp://admin:ozair123@192.168.10.4/cam/realmonitor?channel=1&subtype=0
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={newCamera.Password}
                    onChange={(e) => setNewCamera({ ...newCamera, Password: e.target.value })}
                    placeholder="Camera password"
                    className="w-full px-4 py-3 rounded-xl dark:bg-gray-700 bg-gray-50 border-2 dark:border-gray-600 border-gray-300 focus:dark:border-indigo-500 focus:border-indigo-500 outline-none transition"
                    style={{ color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 rounded-xl font-bold border-2 dark:border-gray-600 border-gray-300 dark:hover:bg-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                  style={{ color: 'var(--text-main)' }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateCamera}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 rounded-xl font-bold dark:bg-gradient-to-br dark:from-green-500 dark:to-emerald-500 bg-gradient-to-br from-green-600 to-green-700 text-white disabled:opacity-50"
                  style={{
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.4)'
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
              className="w-full max-w-lg dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 bg-white rounded-3xl shadow-2xl overflow-hidden border-2 dark:border-indigo-500/30 border-indigo-200"
            >
              <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                  Edit Camera
                </h2>
                <button
                  onClick={() => !isUpdating && setShowEditModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isUpdating}
                >
                  <FiX size={20} style={{ color: 'var(--text-soft)' }} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    Zone *
                  </label>
                  <select
                    value={editingCamera.Zone_id}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Zone_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl dark:bg-gray-700 bg-gray-50 border-2 dark:border-gray-600 border-gray-300 focus:dark:border-indigo-500 focus:border-indigo-500 outline-none transition"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <option value="">Select Zone</option>
                    {zones.map((zone) => (
                      <option key={zone.Zone_id} value={zone.Zone_id}>
                        {zone.Zone_Name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    Camera Type *
                  </label>
                  <select
                    value={editingCamera.Camera_Type}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_Type: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl dark:bg-gray-700 bg-gray-50 border-2 dark:border-gray-600 border-gray-300 focus:dark:border-indigo-500 focus:border-indigo-500 outline-none transition"
                    style={{ color: 'var(--text-main)' }}
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    RTSP URL
                  </label>
                  <input
                    type="text"
                    value={editingCamera.Camera_URL || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-xl dark:bg-gray-700 bg-gray-50 border-2 dark:border-gray-600 border-gray-300 focus:dark:border-indigo-500 focus:border-indigo-500 outline-none transition"
                    style={{ color: 'var(--text-main)' }}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
                      <strong>With port:</strong> rtsp://user:pass@IP:554/cam/realmonitor?channel=1
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-soft)' }}>
                      <strong>Without port:</strong> rtsp://admin:ozair123@192.168.10.4/cam/realmonitor?channel=1&subtype=0
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-main)' }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={editingCamera.Password || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Password: e.target.value })}
                    placeholder="Camera password"
                    className="w-full px-4 py-3 rounded-xl dark:bg-gray-700 bg-gray-50 border-2 dark:border-gray-600 border-gray-300 focus:dark:border-indigo-500 focus:border-indigo-500 outline-none transition"
                    style={{ color: 'var(--text-main)' }}
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditModal(false)}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 rounded-xl font-bold border-2 dark:border-gray-600 border-gray-300 dark:hover:bg-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                  style={{ color: 'var(--text-main)' }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateCamera}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 rounded-xl font-bold dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-600 bg-gradient-to-br from-blue-600 to-blue-700 text-white disabled:opacity-50"
                  style={{
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)'
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
              className="w-full max-w-md dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 bg-white rounded-3xl shadow-2xl overflow-hidden border-2 dark:border-red-500/30 border-red-200"
            >
              <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
                  Delete Camera
                </h2>
                <button
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isDeleting}
                >
                  <FiX size={20} style={{ color: 'var(--text-soft)' }} />
                </button>
              </div>

              <div className="p-6">
                <p className="text-lg mb-4" style={{ color: 'var(--text-main)' }}>
                  Are you sure you want to delete this camera?
                </p>
                <div className="dark:bg-red-500/10 bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    ⚠️ This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold border-2 dark:border-gray-600 border-gray-300 dark:hover:bg-gray-700 hover:bg-gray-100 transition disabled:opacity-50"
                  style={{ color: 'var(--text-main)' }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteCamera}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold dark:bg-gradient-to-br dark:from-red-500 dark:to-red-600 bg-gradient-to-br from-red-600 to-red-700 text-white disabled:opacity-50"
                  style={{
                    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Camera'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// Camera Card Component
const CameraCard = ({ camera, onEdit, onDelete }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="dark:bg-white/5 bg-white rounded-xl p-4 border-2 dark:border-gray-700 border-gray-200 mb-3"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <FiVideo className="text-indigo-500" size={20} />
          <span className="font-bold text-sm" style={{ color: 'var(--text-main)' }}>
            Camera #{camera.Camara_Id}
          </span>
        </div>
        <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
          camera.Camera_Type === 'Entry' 
            ? 'bg-green-500/20 text-green-600 dark:text-green-400' 
            : 'bg-red-500/20 text-red-600 dark:text-red-400'
        }`}>
          {camera.Camera_Type}
        </div>
      </div>
      
      {camera.Camera_URL && (
        <p className="text-xs mb-2 font-mono truncate" style={{ color: 'var(--text-soft)' }}>
          {camera.Camera_URL}
        </p>
      )}

      <div className="flex gap-2 mt-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onEdit(camera)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold dark:bg-blue-500/20 bg-blue-100 dark:text-blue-400 text-blue-600 hover:dark:bg-blue-500/30 hover:bg-blue-200 transition"
        >
          <FiEdit2 size={14} />
          <span>Edit</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onDelete(camera)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold dark:bg-red-500/20 bg-red-100 dark:text-red-400 text-red-600 hover:dark:bg-red-500/30 hover:bg-red-200 transition"
        >
          <FiTrash2 size={14} />
          <span>Delete</span>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Cameras;
