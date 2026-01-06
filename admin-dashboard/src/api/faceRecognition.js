import api from './api';

/**
 * Enroll face embeddings for a single person
 */
export const enrollPerson = async (personType, personId) => {
  const response = await api.post('/face-recognition/enroll', {
    personType,
    personId
  });
  return response.data;
};

/**
 * Enroll all students and teachers
 */
export const enrollAll = async () => {
  const response = await api.post('/face-recognition/enroll-all');
  return response.data;
};

/**
 * Get active presence for all zones
 */
export const getAllActivePresence = async () => {
  const response = await api.get('/face-recognition/active-presence');
  return response.data;
};

/**
 * Get active presence for a specific zone
 */
export const getActivePresenceByZone = async (zoneId) => {
  const response = await api.get(`/face-recognition/active-presence/${zoneId}`);
  return response.data;
};

/**
 * Get attendance logs with filters
 */
export const getAttendanceLogs = async (filters = {}) => {
  const params = new URLSearchParams();
  
  if (filters.zoneId) params.append('zoneId', filters.zoneId);
  if (filters.personType) params.append('personType', filters.personType);
  if (filters.personId) params.append('personId', filters.personId);
  if (filters.startDate) params.append('startDate', filters.startDate);
  if (filters.endDate) params.append('endDate', filters.endDate);
  if (filters.limit) params.append('limit', filters.limit);
  if (filters.offset) params.append('offset', filters.offset);

  const response = await api.get(`/face-recognition/attendance-log?${params.toString()}`);
  return response.data;
};

/**
 * Start face recognition for a zone
 */
export const startRecognition = async (zoneId) => {
  const response = await api.post(`/face-recognition/start/${zoneId}`);
  return response.data;
};
