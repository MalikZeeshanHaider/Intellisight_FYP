/**
 * Unknown Faces Page
 * Displays all detected unknown faces with real-time updates
 */

import React, { useState, useEffect } from 'react';
import { FiAlertCircle, FiTrash2, FiRefreshCw, FiClock, FiUser } from 'react-icons/fi';
import { format } from 'date-fns';
import { unknownFacesAPI } from '../api/unknownFaces';

const UnknownFaces = () => {
  const [unknownFaces, setUnknownFaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [filter, setFilter] = useState('all'); // all, pending, identified, ignored

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

  const handleDelete = async (unknownId) => {
    try {
      await unknownFacesAPI.deleteUnknownFace(unknownId);
      setSuccess('Entry deleted successfully');
      setTimeout(() => setSuccess(null), 3000);
      fetchUnknownFaces();
    } catch (err) {
      setError('Failed to delete entry: ' + (err.response?.data?.message || err.message));
      setTimeout(() => setError(null), 5000);
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
                    <select
                      value={face.Status}
                      onChange={(e) => handleStatusChange(face.Unknown_ID, e.target.value)}
                      className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="IDENTIFIED">Identified</option>
                      <option value="IGNORED">Ignored</option>
                    </select>

                    <button
                      onDoubleClick={() => handleDelete(face.Unknown_ID)}
                      className="p-2 bg-red-500 text-white rounded hover:bg-red-600 transition"
                      title="Double-click to delete"
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
    </div>
  );
};

export default UnknownFaces;
