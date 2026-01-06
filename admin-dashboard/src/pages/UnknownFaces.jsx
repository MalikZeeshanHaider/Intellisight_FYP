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
  const isDarkMode = document.documentElement.classList.contains('dark');
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
      PENDING: isDarkMode 
        ? 'bg-yellow-900/30 text-yellow-400 border-yellow-600/50' 
        : 'bg-yellow-100 text-yellow-800 border-yellow-300',
      IDENTIFIED: isDarkMode 
        ? 'bg-green-900/30 text-green-400 border-green-600/50' 
        : 'bg-green-100 text-green-800 border-green-300',
      IGNORED: isDarkMode 
        ? 'bg-gray-800/50 text-gray-400 border-gray-600/50' 
        : 'bg-gray-100 text-gray-800 border-gray-300'
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
          <h1 className="text-4xl font-display font-black" style={{ color: isDarkMode ? '#c0f0f0' : '#003d82' }}>
            Unknown Faces Log
          </h1>
        </div>

        <button
          onClick={() => fetchUnknownFaces()}
          disabled={loading}
          className="flex items-center space-x-2 px-4 py-2 rounded-lg transition disabled:opacity-50"
          style={{
            backgroundColor: loading 
              ? (isDarkMode ? '#374151' : '#e5e7eb') 
              : (isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#003d82'),
            color: '#fff',
            boxShadow: isDarkMode && !loading ? '0 0 20px rgba(6, 182, 212, 0.3)' : 'none'
          }}
          onMouseEnter={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 1)' : '#305796';
              if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 30px rgba(6, 182, 212, 0.5)';
            }
          }}
          onMouseLeave={(e) => {
            if (!loading) {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#003d82';
              if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(6, 182, 212, 0.3)';
            }
          }}
        >
          <FiRefreshCw className={loading ? 'animate-spin' : ''} size={16} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Alerts */}
      {error && (
        <div 
          className="rounded-lg p-4 flex items-center justify-between"
          style={{
            backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
            border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca'
          }}
        >
          <div className="flex items-center">
            <FiAlertCircle className="mr-3" size={20} style={{ color: isDarkMode ? '#f87171' : '#ef4444' }} />
            <p style={{ color: isDarkMode ? '#fca5a5' : '#b91c1c' }}>{error}</p>
          </div>
          <button 
            onClick={() => setError(null)} 
            style={{ color: isDarkMode ? '#f87171' : '#ef4444' }}
            onMouseEnter={(e) => e.currentTarget.style.color = isDarkMode ? '#fca5a5' : '#b91c1c'}
            onMouseLeave={(e) => e.currentTarget.style.color = isDarkMode ? '#f87171' : '#ef4444'}
          >
            ×
          </button>
        </div>
      )}

      {success && (
        <div 
          className="rounded-lg p-4 flex items-center justify-between"
          style={{
            backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#ecfdf5',
            border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #a7f3d0'
          }}
        >
          <div className="flex items-center">
            <FiAlertCircle className="mr-3" size={20} style={{ color: isDarkMode ? '#34d399' : '#10b981' }} />
            <p style={{ color: isDarkMode ? '#6ee7b7' : '#047857' }}>{success}</p>
          </div>
          <button 
            onClick={() => setSuccess(null)} 
            style={{ color: isDarkMode ? '#34d399' : '#10b981' }}
            onMouseEnter={(e) => e.currentTarget.style.color = isDarkMode ? '#6ee7b7' : '#047857'}
            onMouseLeave={(e) => e.currentTarget.style.color = isDarkMode ? '#34d399' : '#10b981'}
          >
            ×
          </button>
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div 
          className="rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid #e5e7eb',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>Total Unknown</p>
              <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#22d3ee' : '#003d82' }}>{unknownFaces.length}</p>
            </div>
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.2)' : 'rgba(0, 61, 130, 0.1)' }}
            >
              <FiAlertCircle size={24} style={{ color: isDarkMode ? '#22d3ee' : '#003d82' }} />
            </div>
          </div>
        </div>

        <div 
          className="rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(234, 179, 8, 0.2)' : '1px solid #e5e7eb',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>Pending</p>
              <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#fbbf24' : '#ca8a04' }}>
                {unknownFaces.filter(f => f.Status === 'PENDING').length}
              </p>
            </div>
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: isDarkMode ? 'rgba(234, 179, 8, 0.2)' : '#fef9c3' }}
            >
              <FiClock size={24} style={{ color: isDarkMode ? '#fbbf24' : '#ca8a04' }} />
            </div>
          </div>
        </div>

        <div 
          className="rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #e5e7eb',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>Identified</p>
              <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#34d399' : '#16a34a' }}>
                {unknownFaces.filter(f => f.Status === 'IDENTIFIED').length}
              </p>
            </div>
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7' }}
            >
              <FiUser size={24} style={{ color: isDarkMode ? '#34d399' : '#16a34a' }} />
            </div>
          </div>
        </div>

        <div 
          className="rounded-xl shadow-sm p-4"
          style={{
            backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
            border: isDarkMode ? '1px solid rgba(107, 114, 128, 0.2)' : '1px solid #e5e7eb',
            boxShadow: isDarkMode ? '0 4px 20px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.1)'
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>Ignored</p>
              <p className="text-3xl font-bold" style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }}>
                {unknownFaces.filter(f => f.Status === 'IGNORED').length}
              </p>
            </div>
            <div 
              className="w-12 h-12 rounded-full flex items-center justify-center"
              style={{ backgroundColor: isDarkMode ? 'rgba(107, 114, 128, 0.2)' : '#f3f4f6' }}
            >
              <FiTrash2 size={24} style={{ color: isDarkMode ? '#9ca3af' : '#4b5563' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div 
        className="rounded-xl shadow-sm p-4"
        style={{
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
          border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid #e5e7eb'
        }}
      >
        <div className="flex items-center space-x-2">
          <span className="text-sm font-semibold" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>Filter:</span>
          <button
            onClick={() => setFilter('all')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              backgroundColor: filter === 'all' 
                ? (isDarkMode ? 'rgba(6, 182, 212, 0.8)' : '#003d82') 
                : (isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f3f4f6'),
              color: filter === 'all' ? '#fff' : (isDarkMode ? '#c0f0f0' : '#374151'),
              boxShadow: filter === 'all' && isDarkMode ? '0 0 15px rgba(6, 182, 212, 0.3)' : 'none'
            }}
            onMouseEnter={(e) => {
              if (filter !== 'all') e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(30, 41, 59, 1)' : '#e5e7eb';
            }}
            onMouseLeave={(e) => {
              if (filter !== 'all') e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f3f4f6';
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilter('pending')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              backgroundColor: filter === 'pending' 
                ? (isDarkMode ? 'rgba(234, 179, 8, 0.8)' : '#ca8a04') 
                : (isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f3f4f6'),
              color: filter === 'pending' ? '#fff' : (isDarkMode ? '#c0f0f0' : '#374151')
            }}
          >
            Pending
          </button>
          <button
            onClick={() => setFilter('identified')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              backgroundColor: filter === 'identified' 
                ? (isDarkMode ? 'rgba(16, 185, 129, 0.8)' : '#16a34a') 
                : (isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f3f4f6'),
              color: filter === 'identified' ? '#fff' : (isDarkMode ? '#c0f0f0' : '#374151')
            }}
          >
            Identified
          </button>
          <button
            onClick={() => setFilter('ignored')}
            className="px-4 py-2 rounded-lg text-sm font-medium transition"
            style={{
              backgroundColor: filter === 'ignored' 
                ? (isDarkMode ? 'rgba(107, 114, 128, 0.8)' : '#4b5563') 
                : (isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#f3f4f6'),
              color: filter === 'ignored' ? '#fff' : (isDarkMode ? '#c0f0f0' : '#374151')
            }}
          >
            Ignored
          </button>
        </div>
      </div>

      {/* Unknown Faces Grid */}
      <div 
        className="rounded-xl shadow-sm p-6"
        style={{
          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
          border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid #e5e7eb'
        }}
      >
        <h2 className="text-xl font-bold mb-4" style={{ color: isDarkMode ? '#22d3ee' : '#003d82' }}>Detected Faces</h2>

        {loading && unknownFaces.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div 
                className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 mb-4" 
                style={{ borderColor: isDarkMode ? '#22d3ee' : '#003d82' }}
              ></div>
              <p style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>Loading unknown faces...</p>
            </div>
          </div>
        ) : unknownFaces.length === 0 ? (
          <div className="text-center py-12">
            <FiAlertCircle size={64} className="mx-auto mb-4" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.3)' : '#d1d5db' }} />
            <p className="text-lg" style={{ color: isDarkMode ? '#c0f0f0' : '#6b7280' }}>No unknown faces detected yet</p>
            <p className="text-sm mt-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9ca3af' }}>
              Unknown persons will appear here automatically
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {unknownFaces.map((face) => (
              <div
                key={face.Unknown_ID}
                className="rounded-lg p-4 shadow-sm hover:shadow-md transition"
                style={{
                  background: isDarkMode 
                    ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9))'
                    : 'linear-gradient(135deg, #fef2f2, #fff7ed)',
                  border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid #fecaca'
                }}
              >
                {/* Face Image */}
                <div className="mb-3">
                  {face.CapturedImage ? (
                    <img
                      src={face.CapturedImage}
                      alt="Unknown Person"
                      className="w-full h-48 object-cover rounded-lg shadow"
                      style={{ 
                        border: isDarkMode ? '2px solid rgba(239, 68, 68, 0.4)' : '2px solid #fca5a5'
                      }}
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
                    <span className="text-xs font-mono" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                      ID: {face.Unknown_ID}
                    </span>
                    {getStatusBadge(face.Status)}
                  </div>

                  {/* Detection Time */}
                  <div className="flex items-center text-sm" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    <FiClock className="mr-2" size={14} />
                    <span>{format(new Date(face.DetectedTime), 'MMM dd, yyyy HH:mm:ss')}</span>
                  </div>

                  {/* Zone */}
                  <div className="text-sm" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                    <span className="font-semibold">Zone:</span> Zone 1
                  </div>

                  {/* Confidence */}
                  {face.Confidence !== null && (
                    <div className="text-sm" style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>
                      <span className="font-semibold">Confidence:</span> {(face.Confidence * 100).toFixed(1)}%
                    </div>
                  )}

                  {/* Notes */}
                  {face.Notes && (
                    <div className="text-xs italic truncate" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }} title={face.Notes}>
                      {face.Notes}
                    </div>
                  )}

                  {/* Actions */}
                  <div 
                    className="flex items-center space-x-2 pt-2"
                    style={{ borderTop: isDarkMode ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid #fecaca' }}
                  >
                    {/* Custom Status Dropdown */}
                    <div 
                      className="relative flex-1" 
                      ref={(el) => dropdownRefs.current[face.Unknown_ID] = el}
                    >
                      <button
                        onClick={() => setOpenDropdownId(openDropdownId === face.Unknown_ID ? null : face.Unknown_ID)}
                        className="w-full flex items-center justify-between px-2 py-1.5 text-xs rounded cursor-pointer transition-all"
                        style={{
                          backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : 'white',
                          border: isDarkMode 
                            ? `1px solid ${openDropdownId === face.Unknown_ID ? '#22d3ee' : 'rgba(6, 182, 212, 0.3)'}`
                            : `1px solid ${openDropdownId === face.Unknown_ID ? '#003d82' : '#d1d5db'}`,
                        }}
                        onMouseEnter={(e) => {
                          if (openDropdownId !== face.Unknown_ID) {
                            e.currentTarget.style.borderColor = isDarkMode ? '#22d3ee' : '#003d82';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (openDropdownId !== face.Unknown_ID) {
                            e.currentTarget.style.borderColor = isDarkMode ? 'rgba(6, 182, 212, 0.3)' : '#d1d5db';
                          }
                        }}
                      >
                        <span className="font-medium" style={{
                          color: face.Status === 'PENDING' 
                            ? (isDarkMode ? '#fbbf24' : '#a16207')
                            : face.Status === 'IDENTIFIED' 
                            ? (isDarkMode ? '#34d399' : '#15803d')
                            : (isDarkMode ? '#9ca3af' : '#4b5563')
                        }}>
                          {face.Status === 'PENDING' ? 'Pending' : 
                           face.Status === 'IDENTIFIED' ? 'Identified' : 'Ignored'}
                        </span>
                        <FiChevronDown 
                          size={12} 
                          className={`transition-transform ${openDropdownId === face.Unknown_ID ? 'rotate-180' : ''}`}
                          style={{ color: isDarkMode ? '#c0f0f0' : '#6b7280' }}
                        />
                      </button>
                      
                      {openDropdownId === face.Unknown_ID && (
                        <div 
                          className="absolute top-full left-0 mt-1 w-full rounded-lg shadow-lg py-1 z-50"
                          style={{
                            backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.98)' : 'white',
                            border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.3)' : '1px solid #e5e7eb'
                          }}
                        >
                          {['PENDING', 'IDENTIFIED', 'IGNORED'].map((status) => (
                            <button
                              key={status}
                              onClick={() => {
                                handleStatusChange(face.Unknown_ID, status);
                                setOpenDropdownId(null);
                              }}
                              className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors"
                              style={{
                                backgroundColor: face.Status === status 
                                  ? (isDarkMode 
                                    ? status === 'PENDING' ? 'rgba(234, 179, 8, 0.2)' 
                                    : status === 'IDENTIFIED' ? 'rgba(16, 185, 129, 0.2)' 
                                    : 'rgba(107, 114, 128, 0.2)'
                                    : status === 'PENDING' ? '#fef9c3' 
                                    : status === 'IDENTIFIED' ? '#dcfce7' 
                                    : '#f3f4f6')
                                  : 'transparent',
                                color: face.Status === status 
                                  ? (isDarkMode 
                                    ? status === 'PENDING' ? '#fbbf24' 
                                    : status === 'IDENTIFIED' ? '#34d399' 
                                    : '#9ca3af'
                                    : status === 'PENDING' ? '#a16207' 
                                    : status === 'IDENTIFIED' ? '#15803d' 
                                    : '#4b5563')
                                  : (isDarkMode ? '#c0f0f0' : '#374151')
                              }}
                              onMouseEnter={(e) => {
                                if (face.Status !== status) {
                                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(6, 182, 212, 0.1)' : '#eff6ff';
                                  e.currentTarget.style.color = isDarkMode ? '#22d3ee' : '#1d4ed8';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (face.Status !== status) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151';
                                }
                              }}
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
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(16, 185, 129, 0.8)' : '#10b981',
                        boxShadow: isDarkMode ? '0 0 10px rgba(16, 185, 129, 0.3)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(16, 185, 129, 1)' : '#059669';
                        if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(16, 185, 129, 0.8)' : '#10b981';
                        if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 10px rgba(16, 185, 129, 0.3)';
                      }}
                      title="Identify person"
                    >
                      <FiEdit2 size={14} />
                    </button>

                    {/* Delete Button */}
                    <button
                      onClick={() => openDeleteConfirm(face)}
                      className="p-2 text-white rounded transition cursor-pointer"
                      style={{ 
                        backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.8)' : '#ef4444',
                        boxShadow: isDarkMode ? '0 0 10px rgba(239, 68, 68, 0.3)' : 'none'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 1)' : '#dc2626';
                        if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.5)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(239, 68, 68, 0.8)' : '#ef4444';
                        if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
                      }}
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
      <div 
        className="rounded-lg p-3 flex items-center justify-center"
        style={{ 
          backgroundColor: isDarkMode ? 'rgba(6, 182, 212, 0.1)' : 'rgba(0, 61, 130, 0.05)', 
          border: isDarkMode ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid rgba(0, 61, 130, 0.2)' 
        }}
      >
        <div className="flex items-center text-sm" style={{ color: isDarkMode ? '#22d3ee' : '#003d82' }}>
          <div 
            className="w-2 h-2 rounded-full mr-2 animate-pulse" 
            style={{ backgroundColor: isDarkMode ? '#22d3ee' : '#003d82' }}
          ></div>
          <span>Auto-refreshing every 5 seconds</span>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && faceToDelete && (
        <div 
          className="fixed inset-0 flex items-center justify-center z-50 p-4"
          style={{
            background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-8 max-w-md w-full shadow-2xl"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)',
              boxShadow: isDarkMode 
                ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(239, 68, 68, 0.1)'
                : '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}
          >
            {/* Close Button */}
            <button
              onClick={() => {
                setShowDeleteConfirm(false);
                setFaceToDelete(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-full transition-colors"
              style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FiX size={20} />
            </button>

            <div className="text-center">
              {/* Icon */}
              <div 
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
                  border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(239, 68, 68, 0.3)'
                }}
              >
                <FiTrash2 className="text-3xl" style={{ color: isDarkMode ? '#f87171' : '#dc2626' }} />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#1f2937' }}>
                Delete Unknown Face
              </h2>

              {/* Message */}
              <p className="mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}>
                Are you sure you want to delete this entry?
              </p>
              <p className="text-sm mb-6" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9ca3af' }}>
                ID: {faceToDelete.Unknown_ID} • Detected: {format(new Date(faceToDelete.DetectedTime), 'MMM dd, yyyy HH:mm')}
              </p>

              {/* Warning */}
              <p 
                className="text-sm mb-6 px-4 py-2 rounded-lg" 
                style={{ 
                  backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', 
                  color: isDarkMode ? '#f87171' : '#dc2626' 
                }}
              >
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
                    background: isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)',
                    border: isDarkMode ? '1px solid rgba(107, 114, 128, 0.4)' : '1px solid rgba(107, 114, 128, 0.3)',
                    color: isDarkMode ? '#c0f0f0' : '#4b5563'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isDarkMode ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.2)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)';
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    background: deleting 
                      ? (isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.3)')
                      : (isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)'),
                    border: isDarkMode ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(239, 68, 68, 0.4)',
                    color: isDarkMode ? '#f87171' : '#dc2626',
                    boxShadow: isDarkMode ? '0 0 15px rgba(239, 68, 68, 0.2)' : 'none'
                  }}
                  onMouseEnter={(e) => {
                    if (!deleting) {
                      e.currentTarget.style.background = isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(239, 68, 68, 0.3)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!deleting) {
                      e.currentTarget.style.background = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)';
                      if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(239, 68, 68, 0.2)';
                    }
                  }}
                >
                  {deleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: isDarkMode ? '#f87171' : '#dc2626', borderTopColor: 'transparent' }}></div>
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
            background: isDarkMode ? 'rgba(0, 0, 0, 0.7)' : 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'blur(8px)'
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-2xl p-6 max-w-lg w-full shadow-2xl"
            style={{
              background: isDarkMode 
                ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.95))'
                : 'rgba(255, 255, 255, 0.98)',
              backdropFilter: 'blur(20px)',
              border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)',
              boxShadow: isDarkMode 
                ? '0 20px 60px rgba(0, 0, 0, 0.5), 0 0 40px rgba(16, 185, 129, 0.1)'
                : '0 20px 60px rgba(0, 0, 0, 0.3)'
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
              style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#6b7280' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FiX size={20} />
            </button>

            <div className="text-center mb-6">
              {/* Icon */}
              <div 
                className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{
                  background: isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
                  border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(16, 185, 129, 0.3)'
                }}
              >
                <FiEdit2 className="text-3xl" style={{ color: isDarkMode ? '#34d399' : '#10b981' }} />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold mb-2" style={{ color: isDarkMode ? '#c0f0f0' : '#1f2937' }}>
                Identify Unknown Face
              </h2>
              <p className="text-sm" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.6)' : '#6b7280' }}>
                Link this face to a registered student or faculty member
              </p>
            </div>

            {/* Face Preview */}
            {faceToIdentify.CapturedImage && (
              <div className="flex justify-center mb-6">
                <img
                  src={faceToIdentify.CapturedImage}
                  alt="Unknown Face"
                  className="w-24 h-24 object-cover rounded-xl"
                  style={{ border: isDarkMode ? '2px solid rgba(16, 185, 129, 0.4)' : '2px solid rgba(16, 185, 129, 0.3)' }}
                />
              </div>
            )}

            {/* Person Type Dropdown */}
            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                Person Type
              </label>
              <div className="relative" ref={personTypeDropdownRef}>
                <button
                  onClick={() => setPersonTypeDropdownOpen(!personTypeDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm border transition-all cursor-pointer"
                  style={{
                    borderColor: personTypeDropdownOpen 
                      ? (isDarkMode ? '#34d399' : '#10b981')
                      : (isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#d1d5db'),
                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#fff'
                  }}
                  onMouseEnter={(e) => {
                    if (!personTypeDropdownOpen) e.currentTarget.style.borderColor = isDarkMode ? '#34d399' : '#10b981';
                  }}
                  onMouseLeave={(e) => {
                    if (!personTypeDropdownOpen) e.currentTarget.style.borderColor = isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#d1d5db';
                  }}
                >
                  <span style={{ color: isDarkMode ? '#c0f0f0' : '#374151' }}>{identifyPersonType}</span>
                  <FiChevronDown 
                    size={16} 
                    className={`transition-transform ${personTypeDropdownOpen ? 'rotate-180' : ''}`}
                    style={{ color: isDarkMode ? '#34d399' : '#6b7280' }}
                  />
                </button>
                
                {personTypeDropdownOpen && (
                  <div 
                    className="absolute top-full left-0 mt-1 w-full rounded-xl shadow-lg py-1 z-50"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.98)' : 'white',
                      border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #e5e7eb'
                    }}
                  >
                    {['Student', 'Faculty'].map((type) => (
                      <button
                        key={type}
                        onClick={() => {
                          setIdentifyPersonType(type);
                          setSelectedPersonId('');
                          setSearchQuery('');
                          setPersonTypeDropdownOpen(false);
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: identifyPersonType === type 
                            ? (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7')
                            : 'transparent',
                          color: identifyPersonType === type 
                            ? (isDarkMode ? '#34d399' : '#15803d')
                            : (isDarkMode ? '#c0f0f0' : '#374151')
                        }}
                        onMouseEnter={(e) => {
                          if (identifyPersonType !== type) {
                            e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#dcfce7';
                            e.currentTarget.style.color = isDarkMode ? '#34d399' : '#15803d';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (identifyPersonType !== type) {
                            e.currentTarget.style.backgroundColor = 'transparent';
                            e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151';
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

            {/* Person Selection Dropdown */}
            <div className="mb-6">
              <label className="block text-sm font-semibold mb-2" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.7)' : '#374151' }}>
                Select {identifyPersonType}
              </label>
              <div className="relative" ref={personDropdownRef}>
                <button
                  onClick={() => setPersonDropdownOpen(!personDropdownOpen)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl font-medium text-sm border transition-all cursor-pointer"
                  style={{
                    borderColor: personDropdownOpen 
                      ? (isDarkMode ? '#34d399' : '#10b981')
                      : (isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#d1d5db'),
                    backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.8)' : '#fff'
                  }}
                  onMouseEnter={(e) => {
                    if (!personDropdownOpen) e.currentTarget.style.borderColor = isDarkMode ? '#34d399' : '#10b981';
                  }}
                  onMouseLeave={(e) => {
                    if (!personDropdownOpen) e.currentTarget.style.borderColor = isDarkMode ? 'rgba(16, 185, 129, 0.3)' : '#d1d5db';
                  }}
                >
                  <span style={{ color: selectedPersonId ? (isDarkMode ? '#c0f0f0' : '#374151') : '#9ca3af' }}>
                    {getSelectedPersonName()}
                  </span>
                  <FiChevronDown 
                    size={16} 
                    className={`transition-transform ${personDropdownOpen ? 'rotate-180' : ''}`}
                    style={{ color: isDarkMode ? '#34d399' : '#6b7280' }}
                  />
                </button>
                
                {personDropdownOpen && (
                  <div 
                    className="absolute top-full left-0 mt-1 w-full rounded-xl shadow-lg py-1 z-50 max-h-60 overflow-hidden"
                    style={{
                      backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.98)' : 'white',
                      border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #e5e7eb'
                    }}
                  >
                    {/* Search Input */}
                    <div className="px-3 py-2" style={{ borderBottom: isDarkMode ? '1px solid rgba(16, 185, 129, 0.2)' : '1px solid #f3f4f6' }}>
                      <input
                        type="text"
                        placeholder={`Search ${identifyPersonType.toLowerCase()}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full px-3 py-2 text-sm rounded-lg focus:outline-none"
                        style={{
                          backgroundColor: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : 'white',
                          border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid #e5e7eb',
                          color: isDarkMode ? '#c0f0f0' : '#374151'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                    
                    {/* Person List */}
                    <div className="max-h-40 overflow-y-auto">
                      {getFilteredPersons().length === 0 ? (
                        <p className="px-4 py-3 text-sm text-center" style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9ca3af' }}>
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
                              className="w-full text-left px-4 py-2.5 text-sm font-medium transition-colors"
                              style={{
                                backgroundColor: selectedPersonId === personId.toString()
                                  ? (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : '#dcfce7')
                                  : 'transparent',
                                color: selectedPersonId === personId.toString()
                                  ? (isDarkMode ? '#34d399' : '#15803d')
                                  : (isDarkMode ? '#c0f0f0' : '#374151')
                              }}
                              onMouseEnter={(e) => {
                                if (selectedPersonId !== personId.toString()) {
                                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(16, 185, 129, 0.1)' : '#dcfce7';
                                  e.currentTarget.style.color = isDarkMode ? '#34d399' : '#15803d';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (selectedPersonId !== personId.toString()) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                  e.currentTarget.style.color = isDarkMode ? '#c0f0f0' : '#374151';
                                }
                              }}
                            >
                              <span className="font-semibold">{person.Name}</span>
                              <span style={{ color: isDarkMode ? 'rgba(192, 240, 240, 0.5)' : '#9ca3af', marginLeft: '8px' }}>ID: {personId}</span>
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
                  background: isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)',
                  border: isDarkMode ? '1px solid rgba(107, 114, 128, 0.4)' : '1px solid rgba(107, 114, 128, 0.3)',
                  color: isDarkMode ? '#c0f0f0' : '#4b5563'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDarkMode ? 'rgba(107, 114, 128, 0.3)' : 'rgba(107, 114, 128, 0.2)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDarkMode ? 'rgba(107, 114, 128, 0.2)' : 'rgba(107, 114, 128, 0.1)';
                }}
              >
                Cancel
              </button>
              <button
                onClick={confirmIdentify}
                disabled={identifying || !selectedPersonId}
                className="flex-1 px-6 py-3 rounded-xl font-medium transition-all duration-200 cursor-pointer flex items-center justify-center gap-2"
                style={{
                  background: (!selectedPersonId || identifying) 
                    ? (isDarkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.3)')
                    : (isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)'),
                  border: isDarkMode ? '1px solid rgba(16, 185, 129, 0.5)' : '1px solid rgba(16, 185, 129, 0.4)',
                  color: isDarkMode ? '#34d399' : '#059669',
                  opacity: (!selectedPersonId || identifying) ? 0.6 : 1,
                  boxShadow: isDarkMode && selectedPersonId && !identifying ? '0 0 15px rgba(16, 185, 129, 0.2)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (selectedPersonId && !identifying) {
                    e.currentTarget.style.background = isDarkMode ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)';
                    if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 20px rgba(16, 185, 129, 0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedPersonId && !identifying) {
                    e.currentTarget.style.background = isDarkMode ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)';
                    if (isDarkMode) e.currentTarget.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.2)';
                  }
                }}
              >
                {identifying ? (
                  <>
                    <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: isDarkMode ? '#34d399' : '#10b981', borderTopColor: 'transparent' }}></div>
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
