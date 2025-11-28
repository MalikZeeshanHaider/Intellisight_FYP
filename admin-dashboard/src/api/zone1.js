/**
 * Zone 1 Live Tracking API
 * API endpoints for real-time face recognition and tracking
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/zones/1`,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const zone1API = {
  // Log recognized person entry
  logRecognizedPerson: async (personId, personType, confidence = 0.95) => {
    const response = await api.post('/recognize', {
      personId,
      personType,
      confidence
    });
    return response.data;
  },

  // Log unknown person
  logUnknownPerson: async (capturedImage, confidence = 0, notes = '') => {
    const response = await api.post('/unknown', {
      capturedImage,
      confidence,
      notes
    });
    return response.data;
  },

  // Get all persons currently in Zone 1
  getCurrentPersons: async () => {
    const response = await api.get('/current');
    return response.data;
  },

  // Get Zone 1 activity logs
  getZoneLogs: async (limit = 50, offset = 0) => {
    const response = await api.get('/logs', {
      params: { limit, offset }
    });
    return response.data;
  },

  // Get TimeTable logs (Entry/Exit tracking)
  getTimeTableLogs: async (limit = 50, offset = 0, personType = null, zoneId = null) => {
    const response = await api.get('/timetable-logs', {
      params: { limit, offset, personType, zoneId }
    });
    return response.data;
  },

  // Get face database for recognition
  getFaceDatabase: async () => {
    const response = await api.get('/face-database');
    return response.data;
  },

  // Mark person exit
  markExit: async (timetableId) => {
    const response = await api.put(`/exit/${timetableId}`);
    return response.data;
  },

  // Get unknown faces
  getUnknownFaces: async (limit = 20, status = null) => {
    const response = await api.get('/unknown-list', {
      params: { limit, status }
    });
    return response.data;
  }
};
