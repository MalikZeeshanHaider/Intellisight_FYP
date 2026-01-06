/**
 * Unknown Faces API Integration
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

// Create axios instance
const api = axios.create({
  baseURL: `${API_BASE_URL}/zones/1`,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const unknownFacesAPI = {
  /**
   * Get unknown faces log
   */
  getUnknownFaces: async (limit = 20, status = null) => {
    try {
      const params = { limit };
      if (status) {
        params.status = status;
      }

      const response = await api.get('/unknown-list', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching unknown faces:', error);
      throw error;
    }
  },

  /**
   * Update unknown face status
   */
  updateStatus: async (unknownId, status, notes = null) => {
    try {
      const response = await api.put(`/unknown/${unknownId}`, {
        status,
        notes
      });
      return response.data;
    } catch (error) {
      console.error('Error updating unknown face status:', error);
      throw error;
    }
  },

  /**
   * Delete unknown face entry
   */
  deleteUnknownFace: async (unknownId) => {
    try {
      const response = await api.delete(`/unknown/${unknownId}`);
      return response.data;
    } catch (error) {
      console.error('Error deleting unknown face:', error);
      throw error;
    }
  },
};
