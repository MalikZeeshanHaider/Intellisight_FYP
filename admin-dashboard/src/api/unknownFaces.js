/**
 * Unknown Faces API — pulls from ALL zones (Zone 1 face-api.js path AND
 * Zone 2+ Python service path). Earlier this client was hardcoded to
 * /zones/1/* so unknowns saved by the Python service for other zones
 * never appeared on the page.
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Per-row mutation endpoints still live under /zones/1 since they reuse the
// existing zone1 controller logic; the row's Zone_id is still in the response
// payload.
const zone1Api = axios.create({
  baseURL: `${API_BASE_URL}/zones/1`,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export const unknownFacesAPI = {
  /** All unknown faces across every zone. */
  getUnknownFaces: async (limit = 100, status = null, zoneId = null) => {
    const params = { limit };
    if (status) params.status = status;
    if (zoneId) params.zone_id = zoneId;
    const response = await api.get('/zones/unknown-faces', { params });
    return response.data;
  },

  /** Aggregate counts (total / pending / identified / ignored) across all zones. */
  getUnknownStats: async () => {
    const response = await api.get('/zones/unknown-stats');
    return response.data;
  },

  updateStatus: async (unknownId, status, notes = null) => {
    const response = await zone1Api.put(`/unknown/${unknownId}`, { status, notes });
    return response.data;
  },

  deleteUnknownFace: async (unknownId) => {
    const response = await zone1Api.delete(`/unknown/${unknownId}`);
    return response.data;
  },
};
