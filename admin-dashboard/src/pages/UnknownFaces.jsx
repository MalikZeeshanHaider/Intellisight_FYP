/**
 * Unknown Faces Page
 * Displays all detected unknown faces with real-time updates
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FiAlertCircle, FiTrash2, FiRefreshCw, FiClock, FiUser, FiChevronDown, FiX, FiEdit2, FiCheck } from 'react-icons/fi';
import { format } from 'date-fns';
import { unknownFacesAPI } from '../api/unknownFaces';
import { studentAPI, teacherAPI } from '../api/api';

const UnknownFaces = () => {
  const [unknownFaces, setUnknownFaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, identified, ignored
  const [openDropdownId, setOpenDropdownId] = useState(null); // Track which card's dropdown is open
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [faceToDelete, setFaceToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  
  // Identify modal state
  const [showIdentifyModal, setShowIdentifyModal] = useState(false);
  const [faceToIdentify, setFaceToIdentify] = useState(null);
  const [identifyPersonType, setIdentifyPersonType] = useState('Student');
  const [students, setStudents] = useState([]);
  const [faculty, setFaculty] = useState([]);
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [personTypeDropdownOpen, setPersonTypeDropdownOpen] = useState(false);
  const [personDropdownOpen, setPersonDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [identifying, setIdentifying] = useState(false);
  
  const dropdownRefs = useRef({});
  const personTypeDropdownRef = useRef(null);
  const personDropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (openDropdownId !== null) {
        const currentRef = dropdownRefs.current[openDropdownId];
        if (currentRef && !currentRef.contains(event.target)) {
          setOpenDropdownId(null);
        }
      }
      // Close identify modal dropdowns when clicking outside
      if (personTypeDropdownRef.current && !personTypeDropdownRef.current.contains(event.target)) {
        setPersonTypeDropdownOpen(false);
      }
      if (personDropdownRef.current && !personDropdownRef.current.contains(event.target)) {
        setPersonDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openDropdownId]);

  // Load students and faculty when identify modal opens
  useEffect(() => {
    if (showIdentifyModal) {
      fetchStudentsAndFaculty();
    }
  }, [showIdentifyModal]);

  const fetchStudentsAndFaculty = async () => {
    try {
      const [studentsRes, facultyRes] = await Promise.all([
        studentAPI.getAllStudents(),
        teacherAPI.getAllTeachers()
      ]);
      
      if (studentsRes?.success) {
        setStudents(studentsRes.data || []);
      } else if (Array.isArray(studentsRes?.data)) {
        setStudents(studentsRes.data);
      }
      
      if (facultyRes?.success) {
        setFaculty(facultyRes.data || []);
      } else if (Array.isArray(facultyRes?.data)) {
        setFaculty(facultyRes.data);
      }
    } catch (err) {
      console.error('Error fetching students/faculty:', err);
    }
  };

  // Load unknown faces on mount
  useEffect(() => {
    fetchUnknownFaces();
  }, [filter]);

  // Auto-refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetchUnknownFaces(true); // Silent refresh
    }, 5000);

    return () => clearInterval(interval);
  }, [filter]);

  const fetchUnknownFaces = async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const status = filter === 'all' ? null : filter.toUpperCase();
      const response = await unknownFacesAPI.getUnknownFaces(100, status);

      if (response.success) {
        setUnknownFaces(response.data);
      }
    } catch (err) {
      if (!silent) {
        setError('Failed to load unknown faces');
      }
      console.error('Error fetching unknown faces:', err);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const openDeleteConfirm = (face) => {
    setFaceToDelete(face);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!faceToDelete) return;
    
    setDeleting(true);
    try {
      await unknownFacesAPI.deleteUnknownFace(faceToDelete.Unknown_ID);
      setSuccess('Entry deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      setShowDeleteConfirm(false);
      setFaceToDelete(null);
      fetchUnknownFaces();
    } catch (err) {
      setError('Failed to delete entry: ' + (err.response?.data?.message || err.message));
      setTimeout(() => setError(null), 5000);
    } finally {
      setDeleting(false);
    }
  };

  const handleStatusChange = async (unknownId, newStatus) => {
    try {
      await unknownFacesAPI.updateStatus(unknownId, newStatus);
      setSuccess(`Status updated to ${newStatus}`);
      setTimeout(() => setSuccess(null), 3000);
      fetchUnknownFaces();
    } catch (err) {
      setError('Failed to update status: ' + (err.response?.data?.message || err.message));
      setTimeout(() => setError(null), 5000);
    }
  };

  // Identify modal functions
  const openIdentifyModal = (face) => {
    setFaceToIdentify(face);
    setIdentifyPersonType('Student');
    setSelectedPersonId('');
    setSearchQuery('');
    setShowIdentifyModal(true);
  };

  const confirmIdentify = async () => {
    if (!faceToIdentify || !selectedPersonId) return;
    
    setIdentifying(true);
    try {
      // Update status to IDENTIFIED with notes containing the person info
      const person = identifyPersonType === 'Student' 
        ? students.find(s => s.Student_ID.toString() === selectedPersonId)
        : faculty.find(f => f.Teacher_ID.toString() === selectedPersonId);
      
      const notes = `Identified as ${identifyPersonType}: ${person?.Name || 'Unknown'} (ID: ${selectedPersonId})`;
      
      await unknownFacesAPI.updateStatus(faceToIdentify.Unknown_ID, 'IDENTIFIED', notes);
      
      setSuccess(`Successfully identified as ${person?.Name || selectedPersonId}`);
      setTimeout(() => setSuccess(null), 3000);
      setShowIdentifyModal(false);
      setFaceToIdentify(null);
      setSelectedPersonId('');
      fetchUnknownFaces();
    } catch (err) {
      setError('Failed to identify: ' + (err.response?.data?.message || err.message));
      setTimeout(() => setError(null), 5000);
    } finally {
      setIdentifying(false);
    }
  };

  // Get filtered list based on search
  const getFilteredPersons = () => {
    const list = identifyPersonType === 'Student' ? students : faculty;
    if (!searchQuery.trim()) return list;
    
    const query = searchQuery.toLowerCase();
    return list.filter(person => {
      const name = person.Name?.toLowerCase() || '';
      const id = identifyPersonType === 'Student' 
        ? person.Student_ID?.toString() 
        : person.Teacher_ID?.toString();
      return name.includes(query) || id?.includes(query);
    });
  };

  // Get selected person name
  const getSelectedPersonName = () => {
    if (!selectedPersonId) return 'Select a person...';
    const list = identifyPersonType === 'Student' ? students : faculty;
    const person = list.find(p => 
      (identifyPersonType === 'Student' ? p.Student_ID : p.Teacher_ID)?.toString() === selectedPersonId
    );
    return person ? `${person.Name} (ID: ${selectedPersonId})` : 'Select a person...';
  };

  const getStatusBadge = (status) => {
    const styles = {
      PENDING: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      IDENTIFIED: 'bg-green-100 text-green-800 border-green-300',
      IGNORED: 'bg-gray-100 text-gray-800 border-gray-300'
    };

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles.PENDING}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-display font-black" style={{ color: '#003d82' }}>
            Unknown Faces Log
          </h1>
        </div>

        <button
          onClick={() => fetchUnknownFaces()}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg transition disabled:opacity-50"
          style={{
            backgroundColor: loading ? '#e5e7eb' : '#003d82',
            color: '#fff'
          }}
          onMouseEnter={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#305796';
          }}
          onMouseLeave={(e) => {
            if (!loading) e.currentTarget.style.backgroundColor = '#003d82';
          }}
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <FiAlertCircle className="text-red-500 mr-3" size={20} />
            <p className="text-red-700">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            ×
          </button>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center">
            <FiAlertCircle className="text-green-500 mr-3" size={20} />
            <p className="text-green-700">{success}</p>
          </div>
          <button onClick={() => setSuccess(null)} className="text-green-500 hover:text-green-700">
            ×
          </button>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Total Unknown</p>
              <p className="text-3xl font-bold" style={{ color: '#003d82' }}>{unknownFaces.length}</p>
            </div>
            <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 61, 130, 0.1)' }}>
              <FiAlertCircle style={{ color: '#003d82' }} size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Pending</p>
              <p className="text-3xl font-bold text-yellow-600">
                {unknownFaces.filter(f => f.Status === 'PENDING').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
              <FiClock className="text-yellow-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Identified</p>
              <p className="text-3xl font-bold text-green-600">
                {unknownFaces.filter(f => f.Status === 'IDENTIFIED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <FiUser className="text-green-600" size={24} />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 font-medium">Ignored</p>
              <p className="text-3xl font-bold text-gray-600">
                {unknownFaces.filter(f => f.Status === 'IGNORED').length}
              </p>
            </div>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <FiTrash2 className="text-gray-600" size={24} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold text-gray-700">Filter:</span>
          <button
            onClick={() => setFilter('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition`}
            style={{
              backgroundColor: filter === 'all' ? '#003d82' : '#f3f4f6',
              color: filter === 'all' ? '#fff' : '#374151'
            }}
            onMouseEnter={(e) => {
              if (filter !== 'all') e.currentTarget.style.backgroundColor = '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              if (filter !== 'all') e.currentTarget.style.backgroundColor = '#f3f4f6';
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'pending'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('identified')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'identified'
                ? 'bg-green-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Identified
          </button>
          <button
            onClick={() => setFilter('ignored')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              filter === 'ignored'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Ignored
          </button>
        </div>
      </div>

      {/* Unknown Faces Grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-bold mb-4" style={{ color: '#003d82' }}>Detected Faces</h2>

        {loading && unknownFaces.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4" style={{ borderColor: '#003d82' }}></div>
              <p className="text-gray-600">Loading unknown faces...</p>
            </div>
          </div>
        ) : unknownFaces.length === 0 ? (
          <div className="text-center py-12">
            <FiAlertCircle size={64} className="mx-auto mb-4 text-gray-300" />
            <p className="text-gray-600 text-lg">No unknown faces detected yet</p>
            <p className="text-gray-500 text-sm mt-2">
              Unknown persons will appear here automatically
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {unknownFaces.map((face) => (
              <div
                key={face.Unknown_ID}
                className="bg-gradient-to-br from-red-50 to-orange-50 rounded-lg p-4 shadow-sm hover:shadow-md transition border border-red-200"
              >
                {/* Face Image */}
                <div className="mb-3">
                  {face.CapturedImage ? (
                    <img
                      src={face.CapturedImage}
                      alt="Unknown Person"
                      className="w-full h-48 object-cover rounded-lg border-2 border-red-300 shadow"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-red-400 to-orange-500 rounded-lg flex items-center justify-center">
                      <FiUser size={64} className="text-white opacity-50" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="space-y-2">
                  {/* ID and Status */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-gray-600">
                      ID: {face.Unknown_ID}
                    </span>
                    {getStatusBadge(face.Status)}
                  </div>

                  {/* Detection Time */}
                  <div className="flex items-center text-sm text-gray-700">
                    <FiClock className="mr-2" size={14} />
                    <span>{format(new Date(face.DetectedTime), 'MMM dd, yyyy HH:mm:ss')}</span>
                  </div>

                  {/* Zone */}
                  <div className="text-sm text-gray-700">
                    <span className="font-semibold">Zone:</span> Zone 1
                  </div>

                  {/* Confidence */}
                  {face.Confidence !== null && (
                    <div className="text-sm text-gray-700">
                      <span className="font-semibold">Confidence:</span> {(face.Confidence * 100).toFixed(1)}%
                    </div>
                  )}

                  {/* Notes */}
                  {face.Notes && (
                    <div className="text-xs text-gray-600 italic truncate" title={face.Notes}>
                      {face.Notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center space-x-2 pt-2 border-t border-red-200">
                    {/* Custom Status Dropdown */}
                    <div 
                      className="relative flex-1" 
                      ref={(el) => dropdownRefs.current[face.Unknown_ID] = el}
                    >
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === face.Unknown_ID ? null : face.Unknown_ID)}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-xs border border-gray-300 rounded bg-white cursor-pointer transition-all"
                        style={{
                          borderColor: openDropdownId === face.Unknown_ID ? '#003d82' : '#d1d5db',
                        }}
                        onMouseEnter={(e) => {
                          if (openDropdownId !== face.Unknown_ID) e.currentTarget.style.borderColor = '#003d82';
                        }}
                        onMouseLeave={(e) => {
                          if (openDropdownId !== face.Unknown_ID) e.currentTarget.style.borderColor = '#d1d5db';
                        }}
                      >
                        <span className={`font-medium ${
                          face.Status === 'PENDING' ? 'text-yellow-700' : 
                          face.Status === 'IDENTIFIED' ? 'text-green-700' : 'text-gray-700'
                        }`}>
                          {face.Status === 'PENDING' ? 'Pending' : 
                           face.Status === 'IDENTIFIED' ? 'Identified' : 'Ignored'}
                        </span>
                        <FiChevronDown 
                          size={12} 
                          className={`transition-transform ${openDropdownId === face.Unknown_ID ? 'rotate-180' : ''}`}
                          style={{ color: '#6b7280' }}
                        />
                      </button>
                      
                      {openDropdownId === face.Unknown_ID && (
                        <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                          {['PENDING', 'IDENTIFIED', 'IGNORED'].map((status) => (
                            <button
                              key={status}
                              onClick={() => {
                                handleStatusChange(face.Unknown_ID, status);
                                setOpenDropdownId(null);
                              }}
                              className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                                face.Status === status 
                                  ? status === 'PENDING' ? 'bg-yellow-50 text-yellow-700'
                                    : status === 'IDENTIFIED' ? 'bg-green-50 text-green-700'
                                    : 'bg-gray-100 text-gray-700'
                                  : 'text-gray-700 hover:bg-blue-50 hover:text-blue-700'
                              }`}
                            >
                              {status === 'PENDING' ? 'Pending' : 
                               status === 'IDENTIFIED' ? 'Identified' : 'Ignored'}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Identify Button */}
                    <button
                      onClick={() => openIdentifyModal(face)}
                      className="p-2 text-white rounded transition cursor-pointer"
                      style={{ backgroundColor: '#10b981' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#059669'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#10b981'}
                      title="Identify person"
                    >
                      <FiEdit2 size={14} />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => openDeleteConfirm(face)}
                      className="p-2 bg-red-500 text-white rounded transition cursor-pointer"
                      style={{ backgroundColor: '#ef4444' }}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#dc2626'}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#ef4444'}
                      title="Delete entry"
                    >
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      <div className="rounded-lg p-3 flex items-center justify-center" style={{ backgroundColor: 'rgba(0, 61, 130, 0.05)', border: '1px solid rgba(0, 61, 130, 0.2)' }}>
        <div className="flex items-center text-sm" style={{ color: '#003d82' }}>
          <div className="w-2 h-2 rounded-full mr-2 animate-pulse" style={{ backgroundColor: '#003d82' }}></div>
          <span>Auto-refreshing every 5 seconds</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && faceToDelete && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setFaceToDelete(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-full transition-colors"
              style={{ color: '#6b7280' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FiX size={20} />
            </button>

            <div className="text-center">
              {/* Icon */}
              <div 
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                <FiTrash2 className="text-3xl" style={{ color: '#dc2626' }} />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#1f2937' }}>
                Delete Unknown Face
              </h2>

              {/* Message */}
              <p className="mb-2" style={{ color: '#6b7280' }}>
                Are you sure you want to delete this entry?
              </p>
              <p className="text-sm mb-6" style={{ color: '#9ca3af' }}>
                ID: {faceToDelete.Unknown_ID} • Detected: {format(new Date(faceToDelete.DetectedTime), 'MMM dd, yyyy HH:mm')}
              </p>

              {/* Warning */}
              <p className="text-sm mb-6 px-4 py-2 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' }}>
                This action cannot be undone.
              </p>

              {/* Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setFaceToDelete(null);
                  }}
                  disabled={deleting}
                  className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer"
                  style={{
                    background: 'rgba(107, 114, 128, 0.1)',
                    border: '1px solid rgba(107, 114, 128, 0.3)',
                    color: '#4b5563'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(107, 114, 128, 0.1)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: deleting ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.4)',
                    color: '#dc2626'
                  }}
                  onMouseEnter={(e) => {
                    if (!deleting) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!deleting) {
                      e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)';
                    }
                  }}
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <FiTrash2 size={16} />
                      Delete
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Identify Person Modal */}
      {showIdentifyModal && faceToIdentify && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{
            background: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowIdentifyModal(false);
                setFaceToIdentify(null);
                setSelectedPersonId('');
                setSearchQuery('');
              }}
              className="absolute top-4 right-4 p-2 rounded-full transition-colors cursor-pointer"
              style={{ color: '#6b7280' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FiX size={20} />
            </button>

            <div className="text-center mb-6">
              {/* Icon */}
              <div 
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                <FiEdit2 className="text-3xl" style={{ color: '#10b981' }} />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold mb-2" style={{ color: '#1f2937' }}>
                Identify Unknown Face
              </h2>
              <p className="text-sm" style={{ color: '#6b7280' }}>
                Link this face to a registered student or faculty member
              </p>
            </div>

            {/* Face Preview */}
            {faceToIdentify.CapturedImage && (
              <div className="flex justify-center mb-6">
                <img
                  src={faceToIdentify.CapturedImage}
                  alt="Unknown Face"
                  className="w-24 h-24 object-cover rounded-xl border-2"
                  style={{ borderColor: 'rgba(16, 185, 129, 0.3)' }}
                />
              </div>
            )}

            {/* Person Type Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#374151' }}>
                Person Type
              </label>
              <div className="relative" ref={personTypeDropdownRef}>
                <button
                  onClick={() => setPersonTypeDropdownOpen(!personTypeDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm border transition-all cursor-pointer"
                  style={{
                    borderColor: personTypeDropdownOpen ? '#10b981' : '#d1d5db',
                    backgroundColor: '#fff'
                  }}
                  onMouseEnter={(e) => {
                    if (!personTypeDropdownOpen) e.currentTarget.style.borderColor = '#10b981';
                  }}
                  onMouseLeave={(e) => {
                    if (!personTypeDropdownOpen) e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  <span style={{ color: '#374151' }}>{identifyPersonType}</span>
                  <FiChevronDown 
                    size={16} 
                    className={`transition-transform ${personTypeDropdownOpen ? 'rotate-180' : ''}`}
                    style={{ color: '#6b7280' }}
                  />
                </button>
                
                {personTypeDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50">
                    {['Student', 'Faculty'].map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setIdentifyPersonType(type);
                          setSelectedPersonId('');
                          setSearchQuery('');
                          setPersonTypeDropdownOpen(false);
                        }}
                        className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                          identifyPersonType === type 
                            ? 'bg-green-50 text-green-700'
                            : 'text-gray-700 hover:bg-green-50 hover:text-green-700'
                        }`}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Person Selection Dropdown */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: '#374151' }}>
                Select {identifyPersonType}
              </label>
              <div className="relative" ref={personDropdownRef}>
                <button
                  onClick={() => setPersonDropdownOpen(!personDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm border transition-all cursor-pointer"
                  style={{
                    borderColor: personDropdownOpen ? '#10b981' : '#d1d5db',
                    backgroundColor: '#fff'
                  }}
                  onMouseEnter={(e) => {
                    if (!personDropdownOpen) e.currentTarget.style.borderColor = '#10b981';
                  }}
                  onMouseLeave={(e) => {
                    if (!personDropdownOpen) e.currentTarget.style.borderColor = '#d1d5db';
                  }}
                >
                  <span style={{ color: selectedPersonId ? '#374151' : '#9ca3af' }}>
                    {getSelectedPersonName()}
                  </span>
                  <FiChevronDown 
                    size={16} 
                    className={`transition-transform ${personDropdownOpen ? 'rotate-180' : ''}`}
                    style={{ color: '#6b7280' }}
                  />
                </button>
                
                {personDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white rounded-xl shadow-lg border border-gray-200 py-1 z-50 max-h-60 overflow-hidden">
                    {/* Search Input */}
                    <div className="px-3 py-2 border-b border-gray-100">
                      <input
                        type="text"
                        placeholder={`Search ${identifyPersonType.toLowerCase()}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-green-500"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {/* Person List */}
                    <div className="max-h-40 overflow-y-auto">
                      {getFilteredPersons().length === 0 ? (
                        <p className="px-4 py-3 text-sm text-gray-500 text-center">
                          No {identifyPersonType.toLowerCase()} found
                        </p>
                      ) : (
                        getFilteredPersons().map((person) => {
                          const personId = identifyPersonType === 'Student' 
                            ? person.Student_ID 
                            : person.Teacher_ID;
                          return (
                            <button
                              key={personId}
                              onClick={() => {
                                setSelectedPersonId(personId.toString());
                                setPersonDropdownOpen(false);
                                setSearchQuery('');
                              }}
                              className={`w-full text-left px-4 py-2.5 text-sm font-medium transition-colors ${
                                selectedPersonId === personId.toString()
                                  ? 'bg-green-50 text-green-700'
                                  : 'text-gray-700 hover:bg-green-50 hover:text-green-700'
                              }`}
                            >
                              <span className="font-semibold">{person.Name}</span>
                              <span className="text-gray-400 ml-2">ID: {personId}</span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowIdentifyModal(false);
                  setFaceToIdentify(null);
                  setSelectedPersonId('');
                  setSearchQuery('');
                }}
                disabled={identifying}
                className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer"
                style={{
                  background: 'rgba(107, 114, 128, 0.1)',
                  border: '1px solid rgba(107, 114, 128, 0.3)',
                  color: '#4b5563'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(107, 114, 128, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(107, 114, 128, 0.1)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmIdentify}
                disabled={identifying || !selectedPersonId}
                className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                style={{
                  background: (!selectedPersonId || identifying) ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.1)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#059669',
                  opacity: (!selectedPersonId || identifying) ? 0.6 : 1
                }}
                onMouseEnter={(e) => {
                  if (selectedPersonId && !identifying) {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.2)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPersonId && !identifying) {
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.1)';
                  }
                }}
              >
                {identifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin"></div>
                    Identifying...
                  </>
                ) : (
                  <>
                    <FiCheck size={16} />
                    Confirm Identity
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default UnknownFaces;
