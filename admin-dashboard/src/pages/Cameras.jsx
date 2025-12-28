/**
 * Cameras Page
 * Manage cameras for each zone with Entry/Exit configuration
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiVideo, FiRefreshCw, FiPlus, FiAlertCircle, FiX, FiEdit2, FiTrash2, FiMapPin } from 'react-icons/fi';
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
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: '#305796' }}></div>
          <p className="text-gray-600 mt-4 font-medium">Loading cameras...</p>
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
              Cameras
            </h1>
            <p className="text-sm font-medium" style={{ color: '#6b7280' }}>
              Manage zone cameras
            </p>
          </div>

          <div className="flex gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl"
              style={{ backgroundColor: '#305796', boxShadow: '0 2px 8px rgba(48, 87, 150, 0.25)' }}
            >
              <FiPlus size={16} />
              <span>Add Camera</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-all"
              style={{ backgroundColor: '#f3f4f6', color: '#6b7280' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(48, 87, 150, 0.1)';
                e.currentTarget.style.color = '#305796';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#f3f4f6';
                e.currentTarget.style.color = '#6b7280';
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
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)' }}
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
              className="bg-white rounded-2xl p-6"
              style={{ boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: '#305796' }}
                >
                  <FiMapPin className="text-white" size={20} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {zone.Zone_Name}
                  </h2>
                  <p className="text-sm text-gray-600">
                    {zoneCameras.length} camera{zoneCameras.length !== 1 ? 's' : ''}
                  </p>
                </div>
              </div>

              {/* Entry and Exit Cameras Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Entry Camera */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-900">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
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
                    <div className="bg-gray-50 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
                      <FiVideo size={32} className="mx-auto mb-2 opacity-30 text-gray-400" />
                      <p className="text-sm text-gray-600">No entry camera configured</p>
                    </div>
                  )}
                </div>

                {/* Exit Camera */}
                <div>
                  <h3 className="text-lg font-bold mb-3 flex items-center gap-2 text-gray-900">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
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
                    <div className="bg-gray-50 rounded-xl p-4 text-center border-2 border-dashed border-gray-300">
                      <FiVideo size={32} className="mx-auto mb-2 opacity-30 text-gray-400" />
                      <p className="text-sm text-gray-600">No exit camera configured</p>
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
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border"
              style={{ borderColor: 'rgba(48, 87, 150, 0.2)' }}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  Add Camera
                </h2>
                <button
                  onClick={() => !isCreating && setShowAddModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  disabled={isCreating}
                >
                  <FiX size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Zone *
                  </label>
                  <select
                    value={newCamera.Zone_id}
                    onChange={(e) => setNewCamera({ ...newCamera, Zone_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 outline-none transition text-gray-900"
                    style={{ borderColor: 'rgba(48, 87, 150, 0.3)' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#305796'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(48, 87, 150, 0.3)'}
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
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Camera Type *
                  </label>
                  <select
                    value={newCamera.Camera_Type}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_Type: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 outline-none transition text-gray-900"
                    style={{ borderColor: 'rgba(48, 87, 150, 0.3)' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#305796'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(48, 87, 150, 0.3)'}
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    RTSP URL
                  </label>
                  <input
                    type="text"
                    value={newCamera.Camera_URL}
                    onChange={(e) => setNewCamera({ ...newCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 outline-none transition text-gray-900"
                    style={{ borderColor: 'rgba(48, 87, 150, 0.3)' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#305796'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(48, 87, 150, 0.3)'}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-600">
                      <strong>With port:</strong> rtsp://user:pass@192.168.1.100:554/cam/realmonitor?channel=1
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>Without port:</strong> rtsp://admin:ozair123@192.168.10.4/cam/realmonitor?channel=1&subtype=0
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Password
                  </label>
                  <input
                    type="password"
                    value={newCamera.Password}
                    onChange={(e) => setNewCamera({ ...newCamera, Password: e.target.value })}
                    placeholder="Camera password"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 outline-none transition text-gray-900"
                    style={{ borderColor: 'rgba(48, 87, 150, 0.3)' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#305796'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(48, 87, 150, 0.3)'}
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowAddModal(false)}
                  disabled={isCreating}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 border-gray-300 hover:bg-gray-100 transition disabled:opacity-50 text-gray-700"
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
                    backgroundColor: '#305796',
                    boxShadow: '0 4px 20px rgba(48, 87, 150, 0.3)'
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
              className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border"
              style={{ borderColor: 'rgba(48, 87, 150, 0.2)' }}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-gray-900">
                  Edit Camera
                </h2>
                <button
                  onClick={() => !isUpdating && setShowEditModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  disabled={isUpdating}
                >
                  <FiX size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Zone *
                  </label>
                  <select
                    value={editingCamera.Zone_id}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Zone_id: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 outline-none transition text-gray-900"
                    style={{ borderColor: 'rgba(48, 87, 150, 0.3)' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#305796'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(48, 87, 150, 0.3)'}
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
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Camera Type *
                  </label>
                  <select
                    value={editingCamera.Camera_Type}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_Type: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 outline-none transition text-gray-900"
                    style={{ borderColor: 'rgba(48, 87, 150, 0.3)' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#305796'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(48, 87, 150, 0.3)'}
                  >
                    <option value="Entry">Entry</option>
                    <option value="Exit">Exit</option>
                    <option value="Both">Both</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    RTSP URL
                  </label>
                  <input
                    type="text"
                    value={editingCamera.Camera_URL || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Camera_URL: e.target.value })}
                    placeholder="rtsp://username:password@192.168.1.100/stream"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 outline-none transition text-gray-900"
                    style={{ borderColor: 'rgba(48, 87, 150, 0.3)' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#305796'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(48, 87, 150, 0.3)'}
                  />
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-gray-600">
                      <strong>With port:</strong> rtsp://user:pass@IP:554/cam/realmonitor?channel=1
                    </p>
                    <p className="text-xs text-gray-600">
                      <strong>Without port:</strong> rtsp://admin:ozair123@192.168.10.4/cam/realmonitor?channel=1&subtype=0
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-gray-700">
                    Password
                  </label>
                  <input
                    type="password"
                    value={editingCamera.Password || ''}
                    onChange={(e) => setEditingCamera({ ...editingCamera, Password: e.target.value })}
                    placeholder="Camera password"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-2 border-gray-200 outline-none transition text-gray-900"
                    style={{ borderColor: 'rgba(48, 87, 150, 0.3)' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = '#305796'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(48, 87, 150, 0.3)'}
                  />
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowEditModal(false)}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 border-gray-300 hover:bg-gray-100 transition disabled:opacity-50 text-gray-700"
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
                    backgroundColor: '#305796',
                    boxShadow: '0 4px 20px rgba(48, 87, 150, 0.3)'
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
              className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border"
              style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}
            >
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-2xl font-bold text-red-600">
                  Delete Camera
                </h2>
                <button
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition"
                  disabled={isDeleting}
                >
                  <FiX size={20} className="text-gray-500" />
                </button>
              </div>

              <div className="p-6">
                <p className="text-lg mb-4 text-gray-900">
                  Are you sure you want to delete this camera?
                </p>
                <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <p className="text-sm text-red-600">
                    ⚠️ This action cannot be undone.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 p-6 border-t border-gray-200">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 border-gray-300 hover:bg-gray-100 transition disabled:opacity-50 text-gray-700"
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
                    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.3)'
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

// Camera Card Component
const CameraCard = ({ camera, onEdit, onDelete }) => {
  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      className="bg-white rounded-xl p-4 border-2 border-gray-200 mb-3"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <FiVideo style={{ color: '#305796' }} size={20} />
          <span className="font-bold text-sm text-gray-900">
            Camera #{camera.Camara_Id}
          </span>
        </div>
        <div className={`px-2 py-1 rounded-lg text-xs font-bold ${
          camera.Camera_Type === 'Entry' 
            ? 'bg-green-500/20 text-green-600' 
            : 'bg-red-500/20 text-red-600'
        }`}>
          {camera.Camera_Type}
        </div>
      </div>
      
      {camera.Camera_URL && (
        <p className="text-xs mb-2 font-mono truncate text-gray-600">
          {camera.Camera_URL}
        </p>
      )}

      <div className="flex gap-2 mt-3">
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onEdit(camera)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ backgroundColor: 'rgba(48, 87, 150, 0.1)', color: '#305796' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(48, 87, 150, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(48, 87, 150, 0.1)'}
        >
          <FiEdit2 size={14} />
          <span>Edit</span>
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onDelete(camera)}
          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all"
          style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
        >
          <FiTrash2 size={14} />
          <span>Delete</span>
        </motion.button>
      </div>
    </motion.div>
  );
};

export default Cameras;
