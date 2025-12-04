/**
 * Dynamic Zone Live Tracking Page
 * Works for any zone - automatically adapts based on route parameter
 * Supports IP camera configuration and real-time face recognition
 */

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { FiRefreshCw, FiAlertCircle, FiArrowLeft, FiCamera, FiPlus, FiX, FiVideo } from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';

const ZoneLive = () => {
  const { zoneId } = useParams();
  const navigate = useNavigate();
  
  const [zone, setZone] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddCameraModal, setShowAddCameraModal] = useState(false);
  const [newCamera, setNewCamera] = useState({
    label: '',
    type: 'Entry',
    ipAddress: '',
    port: '554',
    username: '',
    password: '',
    streamPath: '/stream'
  });

  // Fetch zone details
  useEffect(() => {
    const fetchZoneData = async () => {
      try {
        setLoading(true);
        // Fetch zone details and cameras from API
        // This would need backend endpoints for dynamic zones
        setZone({
          Zone_id: parseInt(zoneId),
          Zone_Name: `Zone ${zoneId}`,
          Description: 'Live tracking zone'
        });
        
        // Fetch cameras for this zone
        // setCameras(await fetchZoneCameras(zoneId));
        
        setLoading(false);
      } catch (err) {
        console.error('Error loading zone:', err);
        setError('Failed to load zone');
        setLoading(false);
      }
    };

    fetchZoneData();
  }, [zoneId]);

  const handleAddCamera = () => {
    const camera = {
      id: Date.now(),
      ...newCamera,
      enabled: true
    };
    
    setCameras([...cameras, camera]);
    setShowAddCameraModal(false);
    setNewCamera({
      label: '',
      type: 'Entry',
      ipAddress: '',
      port: '554',
      username: '',
      password: '',
      streamPath: '/stream'
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mb-4"
          />
          <p className="text-gray-600 dark:text-gray-400">Loading zone...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/zones')}
            className="flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition"
          >
            <FiArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
              {zone?.Zone_Name} - Live Tracking
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Real-time face recognition and monitoring
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowAddCameraModal(true)}
          className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
        >
          <FiPlus size={18} />
          <span>Add IP Camera</span>
        </button>
      </div>

      {/* Camera Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {cameras.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="col-span-full bg-white dark:bg-gray-800 rounded-lg p-12 text-center border-2 border-dashed border-gray-300 dark:border-gray-700"
          >
            <FiVideo size={48} className="mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
              No Cameras Configured
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Add IP cameras to start live face recognition for this zone
            </p>
            <button
              onClick={() => setShowAddCameraModal(true)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Configure First Camera
            </button>
          </motion.div>
        ) : (
          cameras.map((camera) => (
            <div
              key={camera.id}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow"
            >
              <h3 className="text-lg font-bold mb-2">{camera.label}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {camera.type} Camera • {camera.ipAddress}:{camera.port}
              </p>
              {/* Camera feed would go here */}
              <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
                <FiCamera size={48} className="text-gray-600" />
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Known in Zone</h3>
          <p className="text-3xl font-bold text-green-600">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Unknown in Zone</h3>
          <p className="text-3xl font-bold text-red-600">0</p>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow">
          <h3 className="text-sm text-gray-600 dark:text-gray-400 mb-2">Total Recognized</h3>
          <p className="text-3xl font-bold text-blue-600">0</p>
        </div>
      </div>

      {/* Add Camera Modal */}
      <AnimatePresence>
        {showAddCameraModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddCameraModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl p-8 max-w-2xl w-full shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">Add IP Camera</h2>
                <button
                  onClick={() => setShowAddCameraModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Camera Label *</label>
                    <input
                      type="text"
                      value={newCamera.label}
                      onChange={(e) => setNewCamera({ ...newCamera, label: e.target.value })}
                      placeholder="e.g., Main Entrance"
                      className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Camera Type</label>
                    <select
                      value={newCamera.type}
                      onChange={(e) => setNewCamera({ ...newCamera, type: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                    >
                      <option value="Entry">Entry</option>
                      <option value="Exit">Exit</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-semibold mb-2">IP Address *</label>
                    <input
                      type="text"
                      value={newCamera.ipAddress}
                      onChange={(e) => setNewCamera({ ...newCamera, ipAddress: e.target.value })}
                      placeholder="192.168.1.100"
                      className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Port</label>
                    <input
                      type="text"
                      value={newCamera.port}
                      onChange={(e) => setNewCamera({ ...newCamera, port: e.target.value })}
                      placeholder="554"
                      className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Username</label>
                    <input
                      type="text"
                      value={newCamera.username}
                      onChange={(e) => setNewCamera({ ...newCamera, username: e.target.value })}
                      placeholder="admin"
                      className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Password</label>
                    <input
                      type="password"
                      value={newCamera.password}
                      onChange={(e) => setNewCamera({ ...newCamera, password: e.target.value })}
                      placeholder="••••••••"
                      className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2">Stream Path</label>
                  <input
                    type="text"
                    value={newCamera.streamPath}
                    onChange={(e) => setNewCamera({ ...newCamera, streamPath: e.target.value })}
                    placeholder="/stream or /h264"
                    className="w-full px-4 py-2 rounded-lg border dark:border-gray-700 dark:bg-gray-900 focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Full URL: rtsp://{newCamera.username}:{newCamera.password || '****'}@{newCamera.ipAddress || 'IP'}:{newCamera.port}{newCamera.streamPath}
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowAddCameraModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg font-bold border-2 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddCamera}
                  disabled={!newCamera.label.trim() || !newCamera.ipAddress.trim()}
                  className="flex-1 px-4 py-3 rounded-lg font-bold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  Add Camera
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ZoneLive;
