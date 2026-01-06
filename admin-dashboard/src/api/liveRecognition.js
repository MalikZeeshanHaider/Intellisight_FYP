import api from './api';

/**
 * Start automatic live recognition for a zone
 */
export const startLiveRecognition = async (zoneId) => {
  const response = await api.post(`/live-recognition/start/${zoneId}`);
  return response.data;
};

/**
 * Stop live recognition for a zone
 */
export const stopLiveRecognition = async (zoneId) => {
  const response = await api.post(`/live-recognition/stop/${zoneId}`);
  return response.data;
};

/**
 * Get status of all active recognition processes
 */
export const getRecognitionStatus = async () => {
  const response = await api.get('/live-recognition/status');
  return response.data;
};

/**
 * Get all detection logs (students, teachers, unknown)
 */
export const getDetectionLogs = async (params = {}) => {
  const response = await api.get('/live-recognition/logs', { params });
  return response.data;
};

/**
 * Get currently active presence in zones
 */
export const getLiveActivePresence = async (zoneId = null) => {
  const params = zoneId ? { zoneId } : {};
  const response = await api.get('/live-recognition/active', { params });
  return response.data;
};

export default {
  startLiveRecognition,
  stopLiveRecognition,
  getRecognitionStatus,
  getDetectionLogs,
  getLiveActivePresence
};
