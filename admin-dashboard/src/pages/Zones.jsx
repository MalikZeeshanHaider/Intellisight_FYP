/**
 * Zones Page
 * Display all zones with management options
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMapPin, FiRefreshCw, FiPlus, FiAlertCircle, FiVideo, FiX, FiEdit2, FiTrash2 } from 'react-icons/fi';
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

  const isDarkMode = document.documentElement.classList.contains('dark');

  if (loading && zones.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: isDarkMode ? '#22d3ee' : '#3ca1afff' }}></div>
          <p className="mt-4 font-medium" style={{ color: isDarkMode ? '#c0f0f0' : '#6b7280' }}>Loading zones...</p>
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
            <h1 className="text-3xl font-bold mb-2" style={{ color: isDarkMode ? '#22d3ee' : '#3ca1afff' }}>
              Zones
            </h1>
            <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
              {zones.length} tracking zones configured
            </p>
          </div>

          <div className="flex items-center gap-3">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-xl font-semibold text-sm transition-all"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff', 
                boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.4)' : '0 2px 8px rgba(60, 161, 175, 0.25)' 
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(34, 211, 238, 0.9)' : '#319ba8';
                if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 30px rgba(34, 211, 238, 0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff';
                if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.4)';
              }}
            >
              <FiPlus size={16} />
              <span>Add Zone</span>
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchZones}
              className="flex items-center gap-2 px-4 py-2 rounded-xl font-medium text-sm transition-all"
              style={{ 
                backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6', 
                color: isDarkMode ? '#c0f0f0' : '#6b7280',
                border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.2)' : '#e5e7eb';
                if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <FiRefreshCw size={16} className={loading ? 'animate-spin' : ''} />
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

      {/* Zones Grid */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {zones.map((zone, index) => (
          <motion.div
            key={zone.Zone_id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="relative p-6 rounded-2xl transition-all duration-200"
            style={{ 
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))'
                : '#ffffff',
              border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none',
              boxShadow: isDarkMode 
                ? '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)'
                : '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)'
            }}
            onMouseEnter={(e) => {
              if (isDarkMode) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(6, 182, 212, 0.1), rgba(34, 211, 238, 0.05))';
                e.currentTarget.style.borderColor = 'rgba(34, 211, 238, 0.4)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(6, 182, 212, 0.3)';
              } else {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(60, 161, 175, 0.2)';
              }
            }}
            onMouseLeave={(e) => {
              if (isDarkMode) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(15, 23, 42, 0.95), rgba(30, 41, 59, 0.90))';
                e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.2)';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(6, 182, 212, 0.1)';
              } else {
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.08), 0 2px 4px rgba(0, 0, 0, 0.06)';
              }
            }}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-14 h-14 rounded-2xl flex items-center justify-center" 
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff',
                  boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.4)' : 'none'
                }}
              >
                <FiMapPin className="text-white" size={24} />
              </div>
              <div>
                <MiniZoneGauge 
                  current={zoneCounts[zone.Zone_id] || 0} 
                  capacity={zone.Capacity || 50} 
                />
              </div>
            </div>

            <h3 className="text-xl font-bold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
              {zone.Zone_Name}
            </h3>

            <p className="text-sm mb-4" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
              {zone.Description || 'No description'}
            </p>

            <div className="pt-4 space-y-3" style={{ borderTop: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid #e5e7eb' }}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9ca3af' }}>Zone ID: {zone.Zone_id}</span>
                <span className="text-xs font-semibold px-3 py-1 rounded-full" 
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(60, 161, 175, 0.1)', 
                    color: isDarkMode ? '#22d3ee' : '#3ca1afff',
                    border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : 'none'
                  }}
                >
                  {zoneCounts[zone.Zone_id] || 0} / {zone.Capacity || 50} persons
                </span>
              </div>

              {/* Live View Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate(`/zones/${zone.Zone_id}/live`)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm text-white transition-all"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff', 
                  boxShadow: isDarkMode ? '0 0 15px rgba(6, 182, 212, 0.4)' : '0 2px 8px rgba(60, 161, 175, 0.25)' 
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(34, 211, 238, 0.9)' : '#319ba8';
                  if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 25px rgba(34, 211, 238, 0.5)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff';
                  if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.4)';
                }}
              >
                <FiVideo size={16} />
                <span>🔴 Live View</span>
              </motion.button>

              {/* View Details Button */}
              <Link
                to={zone.Zone_id === 1 ? "/logs" : `/zones/${zone.Zone_id}`}
                className="block w-full text-center px-4 py-2.5 rounded-xl font-medium text-sm transition-all"
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6', 
                  color: isDarkMode ? '#c0f0f0' : '#6b7280',
                  border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(60, 161, 175, 0.1)';
                  e.currentTarget.style.color = isDarkMode ? '#22d3ee' : '#3ca1afff';
                  if (isDarkMode) e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.4)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#f3f4f6';
                  e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#6b7280';
                  if (isDarkMode) e.currentTarget.style.borderColor = 'rgba(6, 182, 212, 0.2)';
                }}
              >
                View Details →
              </Link>

              {/* Edit and Delete Buttons */}
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenEdit(zone)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(60, 161, 175, 0.1)', 
                    color: isDarkMode ? '#22d3ee' : '#3ca1afff',
                    border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.25)' : 'rgba(60, 161, 175, 0.2)';
                    if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(60, 161, 175, 0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <FiEdit2 size={16} />
                  <span>Edit</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleOpenDelete(zone)}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', 
                    color: '#ef4444',
                    border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.25)' : 'rgba(239, 68, 68, 0.2)';
                    if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
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
          className="flex flex-col items-center justify-center py-20"
        >
          <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-6" 
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.15)' : 'rgba(60, 161, 175, 0.1)',
              border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : 'none'
            }}
          >
            <FiMapPin size={40} style={{ color: isDarkMode ? '#22d3ee' : '#3ca1afff' }} />
          </div>
          <h3 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
            No Zones Found
          </h3>
          <p className="text-center max-w-md mb-6" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
            No tracking zones have been configured yet.
          </p>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-xl font-semibold text-white"
            style={{ 
              backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff', 
              boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.4)' : '0 2px 8px rgba(60, 161, 175, 0.25)' 
            }}
          >
            <FiPlus size={20} />
            <span>Create First Zone</span>
          </motion.button>
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
              className="rounded-3xl p-8 max-w-md w-full border"
              style={{
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                  : '#ffffff',
                boxShadow: isDarkMode 
                  ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(6, 182, 212, 0.15)'
                  : '0 20px 60px rgba(0, 0, 0, 0.2)',
                borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#22d3ee' : '#111827' }}>
                  Create New Zone
                </h2>
                <button
                  onClick={() => !isCreating && setShowAddModal(false)}
                  className="p-2 rounded-lg transition"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    color: isDarkMode ? '#f87171' : '#6b7280'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent';
                  }}
                  disabled={isCreating}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Zone Name *
                  </label>
                  <input
                    type="text"
                    value={newZone.Zone_Name}
                    onChange={(e) => setNewZone({ ...newZone, Zone_Name: e.target.value })}
                    placeholder="e.g., Zone 2"
                    className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none transition"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
                      borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.3)',
                      color: isDarkMode ? '#c0f0f0' : '#111827',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#3ca1afff';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    disabled={isCreating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Description
                  </label>
                  <textarea
                    value={newZone.Description}
                    onChange={(e) => setNewZone({ ...newZone, Description: e.target.value })}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none transition resize-none"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
                      borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.3)',
                      color: isDarkMode ? '#c0f0f0' : '#111827',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#3ca1afff';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
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
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 transition disabled:opacity-50"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent',
                    borderColor: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#374151'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(192, 240, 240, 0.1)' : '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent';
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleCreateZone}
                  disabled={isCreating || !newZone.Zone_Name.trim()}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff',
                    boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.4)' : '0 4px 20px rgba(60, 161, 175, 0.3)'
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
              className="rounded-3xl p-8 max-w-md w-full border"
              style={{
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                  : '#ffffff',
                boxShadow: isDarkMode 
                  ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(6, 182, 212, 0.15)'
                  : '0 20px 60px rgba(0, 0, 0, 0.2)',
                borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold" style={{ color: isDarkMode ? '#22d3ee' : '#111827' }}>
                  Edit Zone
                </h2>
                <button
                  onClick={() => !isUpdating && setShowEditModal(false)}
                  className="p-2 rounded-lg transition"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    color: isDarkMode ? '#f87171' : '#6b7280'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent';
                  }}
                  disabled={isUpdating}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Zone Name *
                  </label>
                  <input
                    type="text"
                    value={editingZone.Zone_Name}
                    onChange={(e) => setEditingZone({ ...editingZone, Zone_Name: e.target.value })}
                    placeholder="e.g., Zone 2"
                    className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none transition"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
                      borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.3)',
                      color: isDarkMode ? '#c0f0f0' : '#111827',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#3ca1afff';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                    disabled={isUpdating}
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    Description
                  </label>
                  <textarea
                    value={editingZone.Description || ''}
                    onChange={(e) => setEditingZone({ ...editingZone, Description: e.target.value })}
                    placeholder="Optional description"
                    rows={3}
                    className="w-full px-4 py-3 rounded-xl border-2 focus:outline-none transition resize-none"
                    style={{ 
                      backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
                      borderColor: isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.3)',
                      color: isDarkMode ? '#c0f0f0' : '#111827',
                      transition: 'border-color 0.3s ease, box-shadow 0.3s ease'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#3ca1afff';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(6, 182, 212, 0.3)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : 'rgba(60, 161, 175, 0.3)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
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
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 transition disabled:opacity-50"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent',
                    borderColor: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#374151'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(192, 240, 240, 0.1)' : '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent';
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleUpdateZone}
                  disabled={isUpdating}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{
                    backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#3ca1afff',
                    boxShadow: isDarkMode ? '0 0 20px rgba(6, 182, 212, 0.4)' : '0 4px 20px rgba(60, 161, 175, 0.3)'
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
              className="rounded-3xl p-8 max-w-md w-full border"
              style={{
                background: isDarkMode 
                  ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                  : '#ffffff',
                boxShadow: isDarkMode 
                  ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(239, 68, 68, 0.15)'
                  : '0 20px 60px rgba(0, 0, 0, 0.2)',
                borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-red-500">
                  Delete Zone
                </h2>
                <button
                  onClick={() => !isDeleting && setShowDeleteModal(false)}
                  className="p-2 rounded-lg transition"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                    color: isDarkMode ? '#f87171' : '#6b7280'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'transparent';
                  }}
                  disabled={isDeleting}
                >
                  <FiX size={20} />
                </button>
              </div>

              <div className="mb-6">
                <p className="text-lg mb-4" style={{ color: isDarkMode ? '#c0f0f0' : '#111827' }}>
                  Are you sure you want to delete <strong style={{ color: isDarkMode ? '#22d3ee' : '#3ca1afff' }}>{deletingZone.Zone_Name}</strong>?
                </p>
                <div className="rounded-lg p-4" style={{ 
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.05)',
                  borderLeft: '4px solid #ef4444'
                }}>
                  <p className="text-sm" style={{ color: isDarkMode ? '#f87171' : '#dc2626' }}>
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
                  className="flex-1 px-4 py-3 rounded-xl font-semibold border-2 transition disabled:opacity-50"
                  style={{ 
                    backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent',
                    borderColor: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#d1d5db',
                    color: isDarkMode ? '#c0f0f0' : '#374151'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(192, 240, 240, 0.1)' : '#f3f4f6';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'transparent';
                  }}
                >
                  Cancel
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleDeleteZone}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-3 rounded-xl font-semibold text-white disabled:opacity-50"
                  style={{
                    backgroundColor: '#ef4444',
                    boxShadow: isDarkMode ? '0 0 20px rgba(239, 68, 68, 0.4)' : '0 4px 20px rgba(239, 68, 68, 0.3)'
                  }}
                >
                  {isDeleting ? 'Deleting...' : 'Delete Zone'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Zones;
