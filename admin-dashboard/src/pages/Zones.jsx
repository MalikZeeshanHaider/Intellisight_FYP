/**
 * Zones Page
 * Display all zones with management options
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiRefreshCw, FiPlus, FiAlertCircle, FiVideo, FiZap, FiX, FiEdit2, FiTrash2 } from 'react-icons/fi';
import { HiSparkles } from 'react-icons/hi';
import { zoneAPI } from '../api/api';
import { zone1API } from '../api/zone1';
import { MiniZoneGauge } from '../components/ZoneCapacityGauge';

const Zones = () => {
  const [zones, setZones] = useState([]);
  const [zoneCounts, setZoneCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newZone, setNewZone] = useState({ Zone_Name: '', Description: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingZone, setEditingZone] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingZone, setDeletingZone] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();

  // Fetch zones and person counts
  const fetchZones = async () => {
    try {
      setError(null);
      setLoading(true);

      const response = await zoneAPI.getAllZones();

      if (response.success && response.data) {
        setZones(response.data);

        // Fetch person count for each zone
        const counts = {};
        for (const zone of response.data) {
          try {
            if (zone.Zone_id === 1) {
              // For Zone 1, use Zone 1 Live API to get accurate count
              const [currentPersonsResponse, unknownCountResponse] = await Promise.all([
                zone1API.getCurrentPersons(),
                zone1API.getUnknownFacesCount()
              ]);
              
              const knownCount = currentPersonsResponse.success ? currentPersonsResponse.data.length : 0;
              const unknownCount = unknownCountResponse.success ? unknownCountResponse.count : 0;
              counts[zone.Zone_id] = knownCount + unknownCount;
            } else {
              // For other zones, use the existing API
              const personsData = await zoneAPI.getPersonsInZone(zone.Zone_id);
              counts[zone.Zone_id] = personsData.data?.length || 0;
            }
          } catch (err) {
            counts[zone.Zone_id] = 0;
          }
        }
        setZoneCounts(counts);
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching zones:', err);
      setError('Failed to load zones');
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
  }, []);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(fetchZones, 10000);
    return () => clearInterval(interval);
  }, []);

  // Create new zone
  const handleCreateZone = async () => {
    if (!newZone.Zone_Name.trim()) {
      setError('Zone name is required');
      return;
    }

    try {
      setIsCreating(true);
      setError(null);

      const response = await zoneAPI.createZone(newZone);
      
      if (response.success) {
        setShowAddModal(false);
        setNewZone({ Zone_Name: '', Description: '' });
        await fetchZones();
      }
    } catch (err) {
      console.error('Error creating zone:', err);
      setError('Failed to create zone');
    } finally {
      setIsCreating(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = (zone) => {
    setEditingZone({ ...zone });
    setShowEditModal(true);
  };

  // Update zone
  const handleUpdateZone = async () => {
    if (!editingZone.Zone_Name.trim()) {
      setError('Zone name is required');
      return;
    }

    try {
      setIsUpdating(true);
      setError(null);

      const response = await zoneAPI.updateZone(editingZone.Zone_id, {
        Zone_Name: editingZone.Zone_Name,
        Description: editingZone.Description
      });
      
      if (response.success) {
        setShowEditModal(false);
        setEditingZone(null);
        await fetchZones();
      }
    } catch (err) {
      console.error('Error updating zone:', err);
      setError('Failed to update zone');
    } finally {
      setIsUpdating(false);
    }
  };

  // Open delete modal
  const handleOpenDelete = (zone) => {
    setDeletingZone(zone);
    setShowDeleteModal(true);
  };

  // Delete zone
  const handleDeleteZone = async () => {
    try {
      setIsDeleting(true);
      setError(null);

      const response = await zoneAPI.deleteZone(deletingZone.Zone_id);
      
      if (response.success) {
        setShowDeleteModal(false);
        setDeletingZone(null);
        await fetchZones();
      }
    } catch (err) {
      console.error('Error deleting zone:', err);
      setError('Failed to delete zone');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading && zones.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="inline-block w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full mb-4"
            style={{ boxShadow: '0 0 20px rgba(0, 255, 255, 0.5)' }}
          />
          <p style={{ color: 'var(--text-soft)' }} className="font-medium">Loading zones...</p>
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
          <motion.div
            animate={{
              opacity: [0, 0.5, 0],
              x: [-5, 5, -5]
            }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 }}
            className="absolute inset-0 text-4xl font-display font-bold text-indigo-500 blur-sm"
          >
            Zones
          </motion.div>
          
          <h1 className="text-5xl font-display font-black relative"
            style={{
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #6366f1 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              textShadow: '0 0 30px rgba(99, 102, 241, 0.5)'
            }}
          >
            Zones
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
            <span className="font-semibold">Manage tracking zones</span>
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
            <span className="text-white relative z-10">Add Zone</span>
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)' }}
            whileTap={{ scale: 0.95 }}
            onClick={fetchZones}
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
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
            />
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

      {/* Zones Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 relative z-10 px-6"
      >
        {zones.map((zone, index) => (
          <motion.div
            key={zone.Zone_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.03, y: -8 }}
            className="relative p-6 rounded-3xl overflow-hidden group cursor-pointer dark:bg-gradient-to-br dark:from-indigo-500/10 dark:to-purple-500/10 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl dark:border-indigo-500/30 border-indigo-200"
            style={{
              boxShadow: document.documentElement.classList.contains('dark') 
                ? '0 8px 32px rgba(99, 102, 241, 0.2)' 
                : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
            }}
          >
            {/* Animated Background */}
            <motion.div
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{
                background: 'radial-gradient(circle at center, rgba(99, 102, 241, 0.2), transparent)'
              }}
            />
            
            {/* Scan Line */}
            <motion.div
              animate={{ y: ['-100%', '200%'] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: index * 0.5 }}
              className="absolute inset-0 h-20"
              style={{
                background: 'linear-gradient(180deg, transparent, rgba(99, 102, 241, 0.3), transparent)'
              }}
            />

            <div className="flex items-start justify-between mb-4 relative z-10">
              <motion.div
                whileHover={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
                className="w-14 h-14 rounded-2xl flex items-center justify-center relative"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                  boxShadow: '0 0 30px rgba(99, 102, 241, 0.6)'
                }}
              >
                <FiMapPin className="text-white" size={24} />
              </motion.div>
              <div className="text-right">
                <MiniZoneGauge 
                  current={zoneCounts[zone.Zone_id] || 0} 
                  capacity={zone.Capacity || 50} 
                />
              </div>
            </div>

            <h3 className="text-xl font-black mb-2 relative z-10" style={{ color: 'var(--text-main)' }}>
              {zone.Zone_Name}
            </h3>

            <p className="text-sm mb-4 relative z-10" style={{ color: 'var(--text-soft)' }}>
              {zone.Description || 'No description'}
            </p>

            <div className="pt-4 border-t relative z-10 space-y-2" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-soft)' }}>Zone ID: {zone.Zone_id}</span>
              </div>

              {/* Live View Button for all zones */}
              <motion.button
                whileHover={{ scale: 1.02, boxShadow: '0 0 25px rgba(16, 185, 129, 0.6)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(zone.Zone_id === 1 ? '/zones/zone1-live' : `/zones/${zone.Zone_id}/live`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold relative overflow-hidden group dark:bg-gradient-to-br dark:from-green-500 dark:to-emerald-500 bg-gradient-to-br from-green-600 to-green-700 border-2 dark:border-white/20 border-green-800/30"
                style={{
                  boxShadow: document.documentElement.classList.contains('dark') ? '0 4px 20px rgba(16, 185, 129, 0.4)' : '0 4px 20px rgba(5, 150, 105, 0.3)'
                }}
              >
                <FiVideo size={16} className="text-white" />
                <span className="text-white relative z-10">🔴 Live View</span>
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                  animate={{ x: ['-100%', '200%'] }}
                  transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
                />
              </motion.button>

              {zone.Zone_id === 1 ? (
                <Link
                  to="/logs"
                  className="block w-full text-center px-4 py-2.5 rounded-xl font-bold transition-all duration-300 dark:border-indigo-500/50 border-indigo-300 dark:text-indigo-400 text-indigo-600 hover:dark:bg-indigo-500/20 hover:bg-indigo-100 border-2"
                >
                  View Details →
                </Link>
              ) : (
                <Link
                  to={`/zones/${zone.Zone_id}`}
                  className="block w-full text-center px-4 py-2.5 rounded-xl font-bold transition-all duration-300 dark:border-indigo-500/50 border-indigo-300 dark:text-indigo-400 text-indigo-600 hover:dark:bg-indigo-500/20 hover:bg-indigo-100 border-2"
                >
                  View Details →
                </Link>
              )}

              {/* Edit and Delete Buttons */}
              <div className="flex gap-2 mt-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenEdit(zone)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-300 dark:bg-gradient-to-br dark:from-blue-500/20 dark:to-blue-600/20 bg-blue-100 dark:border-blue-500/50 border-blue-300 dark:text-blue-400 text-blue-600 hover:dark:bg-blue-500/30 hover:bg-blue-200 border-2"
                >
                  <FiEdit2 size={16} />
                  <span>Edit</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenDelete(zone)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-all duration-300 dark:bg-gradient-to-br dark:from-red-500/20 dark:to-red-600/20 bg-red-100 dark:border-red-500/50 border-red-300 dark:text-red-400 text-red-600 hover:dark:bg-red-500/30 hover:bg-red-200 border-2"
                >
                  <FiTrash2 size={16} />
                  <span>Delete</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Empty State */}
      {zones.length === 0 && !loading && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 px-6"
        >
          <div className="dark:bg-gradient-to-br dark:from-indigo-500/10 dark:to-purple-500/10 bg-gradient-to-br from-white/80 to-indigo-50/80 backdrop-blur-xl rounded-3xl p-12 text-center dark:border-indigo-500/30 border-indigo-200 border-2"
            style={{
              boxShadow: document.documentElement.classList.contains('dark') 
                ? '0 8px 32px rgba(99, 102, 241, 0.2)' 
                : '0 10px 40px rgba(99, 102, 241, 0.15), 0 4px 12px rgba(79, 70, 229, 0.1), inset 0 -2px 8px rgba(255, 255, 255, 0.8)'
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <FiMapPin size={64} className="mx-auto mb-4" style={{ color: 'var(--text-soft)', filter: 'drop-shadow(0 0 20px rgba(99, 102, 241, 0.5))' }} />
            </motion.div>
            <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-main)' }}>No Zones Found</h3>
            <p style={{ color: 'var(--text-soft)' }}>No tracking zones have been configured yet.</p>
          </div>
        </motion.div>
      )}

      {/* Add Zone Modal */}
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
              className="dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-2 dark:border-indigo-500/30 border-indigo-200"
              style={{
                boxShadow: '0 20px 60px rgba(99, 102, 241, 0.3)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                  Create New Zone
                </h2>
                <button
                  onClick={() => !isCreating && setShowAddModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isCreating}
                >
                  <FiX size={20} style={{ color: 'var(--text-soft)' }} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-main)' }}>
                    Zone Name *
                  </label>
                  <input
                    type="text"
                    value={newZone.Zone_Name}
                    onChange={(e) => setNewZone({ ...newZone, Zone_Name: e.target.value })}
                    placeholder="e.g., Zone 2"
                    className="w-full px-4 py-3 rounded-xl border-2 dark:border-indigo-500/30 border-indigo-200 dark:bg-gray-800 bg-white focus:outline-none focus:border-indigo-500 transition"
                    style={{ color: 'var(--text-main)' }}
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-main)' }}>
                    Description
                  </label>
                  <textarea
                    value={newZone.Description}
                    onChange={(e) => setNewZone({ ...newZone, Description: e.target.value })}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 dark:border-indigo-500/30 border-indigo-200 dark:bg-gray-800 bg-white focus:outline-none focus:border-indigo-500 transition resize-none"
                    style={{ color: 'var(--text-main)' }}
                    disabled={isCreating}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
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
                  onClick={handleCreateZone}
                  disabled={isCreating || !newZone.Zone_Name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl font-bold bg-gradient-to-br from-indigo-600 to-indigo-700 dark:from-indigo-500 dark:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    boxShadow: '0 4px 20px rgba(99, 102, 241, 0.4)'
                  }}
                >
                  {isCreating ? 'Creating...' : 'Create Zone'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Zone Modal */}
      <AnimatePresence>
        {showEditModal && editingZone && (
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
              className="dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-2 dark:border-blue-500/30 border-blue-200"
              style={{
                boxShadow: '0 20px 60px rgba(59, 130, 246, 0.3)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: 'var(--text-main)' }}>
                  Edit Zone
                </h2>
                <button
                  onClick={() => !isUpdating && setShowEditModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isUpdating}
                >
                  <FiX size={20} style={{ color: 'var(--text-soft)' }} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-main)' }}>
                    Zone Name *
                  </label>
                  <input
                    type="text"
                    value={editingZone.Zone_Name}
                    onChange={(e) => setEditingZone({ ...editingZone, Zone_Name: e.target.value })}
                    placeholder="e.g., Zone 2"
                    className="w-full px-4 py-3 rounded-xl border-2 dark:border-blue-500/30 border-blue-200 dark:bg-gray-800 bg-white focus:outline-none focus:border-blue-500 transition"
                    style={{ color: 'var(--text-main)' }}
                    disabled={isUpdating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--text-main)' }}>
                    Description
                  </label>
                  <textarea
                    value={editingZone.Description || ''}
                    onChange={(e) => setEditingZone({ ...editingZone, Description: e.target.value })}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 dark:border-blue-500/30 border-blue-200 dark:bg-gray-800 bg-white focus:outline-none focus:border-blue-500 transition resize-none"
                    style={{ color: 'var(--text-main)' }}
                    disabled={isUpdating}
                  />
                </div>
              </div>

              <div className="flex gap-3 mt-6">
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
                  onClick={handleUpdateZone}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 rounded-xl font-bold relative overflow-hidden dark:bg-gradient-to-br dark:from-blue-500 dark:to-blue-600 bg-gradient-to-br from-blue-600 to-blue-700 text-white disabled:opacity-50"
                  style={{
                    boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)'
                  }}
                >
                  {isUpdating ? 'Updating...' : 'Update Zone'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Zone Modal */}
      <AnimatePresence>
        {showDeleteModal && deletingZone && (
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
              className="dark:bg-gradient-to-br dark:from-gray-800 dark:to-gray-900 bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl border-2 dark:border-red-500/30 border-red-200"
              style={{
                boxShadow: '0 20px 60px rgba(239, 68, 68, 0.3)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-red-600 dark:text-red-400">
                  Delete Zone
                </h2>
                <button
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
                  disabled={isDeleting}
                >
                  <FiX size={20} style={{ color: 'var(--text-soft)' }} />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-lg mb-4" style={{ color: 'var(--text-main)' }}>
                  Are you sure you want to delete <strong>{deletingZone.Zone_Name}</strong>?
                </p>
                <div className="dark:bg-red-500/10 bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
                  <p className="text-sm text-red-600 dark:text-red-400">
                    ⚠️ This action cannot be undone. All cameras, logs, and data associated with this zone will be permanently deleted.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
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
                  onClick={handleDeleteZone}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-bold relative overflow-hidden dark:bg-gradient-to-br dark:from-red-500 dark:to-red-600 bg-gradient-to-br from-red-600 to-red-700 text-white disabled:opacity-50"
                  style={{
                    boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)'
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Zone'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default Zones;
