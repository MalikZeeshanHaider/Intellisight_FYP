/**
 * Axios API Configuration
 * Handles all HTTP requests to the IntelliSight backend
 */

import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000, // 30 seconds for image upload operations
  withCredentials: true, // Send httpOnly cookie on every request — token never touches JS
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor - Handle 401 globally.
// Only redirect when the user is on a protected page — never when already on /login,
// /register, or /forgot-password, and never for the session-check (getMe) call.
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/reset-password'];
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const isPublicPage = PUBLIC_PATHS.some((p) => window.location.pathname.startsWith(p));
    if (error.response?.status === 401 && !isPublicPage) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ============== AUTH APIs ==============

export const authAPI = {
  login: async (email, password) => {
    const response = await api.post('/auth/login', { email, password });
    return response.data;
  },

  register: async (userData) => {
    const response = await api.post('/auth/register', userData);
    return response.data;
  },

  logout: async () => {
    // Ask the backend to clear the httpOnly cookie
    await api.post('/auth/logout').catch(() => {});
  },

  getMe: async () => {
    const response = await api.get('/auth/me');
    return response.data;
  },
};

// ============== ROLES & PERMISSIONS APIs ==============

// ============== ACCESS REQUEST APIs ==============

export const accessRequestAPI = {
  /** Non-SuperAdmin: submit permission requests */
  submit: (permissionKeys, message) =>
    api.post('/access-requests', { permissionKeys, message }).then((r) => r.data),

  /** Non-SuperAdmin: get own requests */
  getMyRequests: () =>
    api.get('/access-requests/my').then((r) => r.data),

  /** SuperAdmin: get all requests, optionally filtered by status */
  getAll: (status) =>
    api.get('/access-requests', { params: status ? { status } : {} }).then((r) => r.data),

  /** SuperAdmin: count of pending requests (for badge) */
  getPendingCount: () =>
    api.get('/access-requests/pending-count').then((r) => r.data),

  /** SuperAdmin: approve or reject a request */
  review: (id, action, reviewNote) =>
    api.put(`/access-requests/${id}/review`, { action, reviewNote }).then((r) => r.data),
};

export const rolesAPI = {
  listPermissions: () => api.get('/roles/permissions').then((r) => r.data),
  listRoles:       () => api.get('/roles').then((r) => r.data),
  createRole:      (data) => api.post('/roles', data).then((r) => r.data),
  updateRole:      (id, data) => api.put(`/roles/${id}`, data).then((r) => r.data),
  deleteRole:      (id) => api.delete(`/roles/${id}`).then((r) => r.data),
  setPermissions:  (id, permissionKeys) => api.put(`/roles/${id}/permissions`, { permissionKeys }).then((r) => r.data),
  assignRole:      (adminId, roleId) => api.put('/roles/assign', { adminId, roleId }).then((r) => r.data),
  getRoleAdmins:   (id) => api.get(`/roles/${id}/admins`).then((r) => r.data),
};

// ============== ZONE APIs ==============

export const zoneAPI = {
  // Get all zones
  getAllZones: async () => {
    const response = await api.get('/zones');
    return response.data;
  },

  // Get zone by ID
  getZoneById: async (zoneId) => {
    const response = await api.get(`/zones/${zoneId}`);
    return response.data;
  },

  // Get persons in a specific zone
  getPersonsInZone: async (zoneId) => {
    const response = await api.get(`/zones/${zoneId}/current`);
    return response.data;
  },

  // Get unknown face count for a specific zone (Zone 2+)
  getZoneUnknownCount: async (zoneId) => {
    const response = await api.get(`/zones/${zoneId}/unknown-count`);
    return response.data;
  },

  // Create new zone
  createZone: async (zoneData) => {
    const response = await api.post('/zones', zoneData);
    return response.data;
  },

  // Update zone
  updateZone: async (zoneId, zoneData) => {
    const response = await api.put(`/zones/${zoneId}`, zoneData);
    return response.data;
  },

  // Delete zone
  deleteZone: async (zoneId) => {
    const response = await api.delete(`/zones/${zoneId}`);
    return response.data;
  },
};

// ============== TIMETABLE APIs ==============

export const timetableAPI = {
  // Get all active persons in the building
  getActivePersons: async () => {
    const response = await api.get('/timetable/active');
    return response.data;
  },

  // Get recent activity
  getRecentActivity: async (limit = 10) => {
    const response = await api.get(`/timetable/recent?limit=${limit}`);
    return response.data;
  },

  // Get zone tracking history
  getZoneHistory: async (zoneId, startDate, endDate) => {
    const response = await api.get(`/timetable/zone/${zoneId}/history`, {
      params: { startDate, endDate },
    });
    return response.data;
  },
};

// ============== STUDENT APIs ==============

export const studentAPI = {
  // Get all students
  getAllStudents: async () => {
    const response = await api.get('/students');
    return response.data;
  },

  // Get student by ID
  getStudentById: async (studentId) => {
    const response = await api.get(`/students/${studentId}`);
    return response.data;
  },

  // Create student
  createStudent: async (studentData) => {
    const response = await api.post('/students', studentData);
    return response.data;
  },

  // Update student
  updateStudent: async (studentId, studentData) => {
    const response = await api.put(`/students/${studentId}`, studentData);
    return response.data;
  },

  // Delete student
  deleteStudent: async (studentId) => {
    const response = await api.delete(`/students/${studentId}`);
    return response.data;
  },

  // Attendance summary
  getAttendanceSummary: async (studentId, month) => {
    const response = await api.get(`/students/${studentId}/attendance-summary`, {
      params: month ? { month } : {},
    });
    return response.data;
  },
};

// ============== TEACHER APIs ==============

export const teacherAPI = {
  // Get all teachers
  getAllTeachers: async () => {
    const response = await api.get('/teachers');
    return response.data;
  },

  // Get teacher by ID
  getTeacherById: async (teacherId) => {
    const response = await api.get(`/teachers/${teacherId}`);
    return response.data;
  },

  // Create teacher
  createTeacher: async (teacherData) => {
    const response = await api.post('/teachers', teacherData);
    return response.data;
  },

  // Update teacher
  updateTeacher: async (teacherId, teacherData) => {
    const response = await api.put(`/teachers/${teacherId}`, teacherData);
    return response.data;
  },

  // Delete teacher
  deleteTeacher: async (teacherId) => {
    const response = await api.delete(`/teachers/${teacherId}`);
    return response.data;
  },

  // Attendance summary
  getAttendanceSummary: async (teacherId, month) => {
    const response = await api.get(`/teachers/${teacherId}/attendance-summary`, {
      params: month ? { month } : {},
    });
    return response.data;
  },
};

// ============== CAMERA APIs ==============

export const cameraAPI = {
  // Get all cameras
  getAllCameras: async () => {
    const response = await api.get('/cameras');
    return response.data;
  },

  // Get camera by ID
  getCameraById: async (cameraId) => {
    const response = await api.get(`/cameras/${cameraId}`);
    return response.data;
  },

  // Create camera
  createCamera: async (cameraData) => {
    const response = await api.post('/cameras', cameraData);
    return response.data;
  },

  // Update camera
  updateCamera: async (cameraId, cameraData) => {
    const response = await api.put(`/cameras/${cameraId}`, cameraData);
    return response.data;
  },

  // Delete camera
  deleteCamera: async (cameraId) => {
    const response = await api.delete(`/cameras/${cameraId}`);
    return response.data;
  },
};

// ============== STATISTICS APIs ==============

export const statsAPI = {
  // Get dashboard statistics
  getDashboardStats: async () => {
    try {
      const [zones, students, teachers, activePersons] = await Promise.all([
        zoneAPI.getAllZones(),
        studentAPI.getAllStudents(),
        teacherAPI.getAllTeachers(),
        timetableAPI.getActivePersons(),
      ]);

      return {
        totalZones: zones.data?.length || 0,
        totalStudents: students.data?.length || 0,
        totalTeachers: teachers.data?.length || 0,
        activePersons: activePersons.data?.count || 0,
        zones: zones.data || [],
        activePersonsList: activePersons.data?.activePersons || [],
      };
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      throw error;
    }
  },

  // Get daily detection statistics
  getDailyDetectionStats: async (year, month) => {
    try {
      const params = {};
      if (year) params.year = year;
      if (month) params.month = month;

      const response = await api.get('/timetable/daily-stats', { params });
      return response.data;
    } catch (error) {
      console.error('Error fetching daily detection stats:', error);
      throw error;
    }
  },
};

// ============== DAILY RESET APIs ==============

export const dailyResetAPI = {
  // Get daily statistics
  getStatistics: async () => {
    const response = await api.get('/daily-reset/statistics');
    return response.data;
  },

  // Trigger manual reset (admin only)
  manualReset: async () => {
    const response = await api.post('/daily-reset/manual');
    return response.data;
  },

  // Clear active presence only
  clearActivePresence: async () => {
    const response = await api.post('/daily-reset/clear-active');
    return response.data;
  },
};

// ============== CAMERA STREAMING APIs ==============================
// Video is delivered by MediaMTX directly (WebRTC/WHEP on port 8889).
// Detection metadata is delivered by the Python AI service (port 5001)
// over a single /ws/events WebSocket. Python is NOT in the video path.

const STREAM_BASE_URL = import.meta.env.VITE_STREAM_BASE_URL || 'http://localhost:5001';
const WEBRTC_BASE_URL = import.meta.env.VITE_WEBRTC_BASE_URL || 'http://localhost:8889';

const streamFetch = async (path, options = {}) => {
  const res = await fetch(`${STREAM_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Stream API error ${res.status}: ${text}`);
  }
  return res.json();
};

export const streamAPI = {
  /** WebRTC (WHEP) URL for a camera — attach to useWebRTCStream hook. */
  getWebRTCUrl: (cameraId) => `${WEBRTC_BASE_URL}/cam${cameraId}/whep`,

  /** MJPEG fallback URL — works without MediaMTX, served directly by Python. */
  getMjpegUrl: (cameraId) => `${STREAM_BASE_URL}/stream/${cameraId}`,

  /** Single JPEG snapshot URL — append ?t=Date.now() to force a fresh fetch. */
  getSnapshotUrl: (cameraId) => `${STREAM_BASE_URL}/snapshot/${cameraId}`,

  /** Single WebSocket URL for detection metadata (all cameras multiplexed). */
  getEventsWsUrl: () => {
    const wsBase = STREAM_BASE_URL.replace(/^http/, 'ws');
    return `${wsBase}/ws/events`;
  },

  /** Health check for the Python AI service */
  health: () => streamFetch('/health'),

  /** Start a camera — registers it with MediaMTX and begins AI processing */
  startCamera: (cameraId, cameraUrl, cameraType, zoneId) =>
    streamFetch('/cameras/start', {
      method: 'POST',
      body: JSON.stringify({ camera_id: cameraId, camera_url: cameraUrl, camera_type: cameraType, zone_id: zoneId }),
    }),

  /** Stop a camera */
  stopCamera: (cameraId) =>
    streamFetch(`/cameras/stop/${cameraId}`, { method: 'POST' }),

  /** Get list of all active camera streams */
  listCameras: () => streamFetch('/cameras/list'),

  /** Get status of all active camera streams */
  getCameraStatuses: () => streamFetch('/cameras/status'),

  /** Reload face embeddings in the AI service */
  reloadEmbeddings: () =>
    streamFetch('/embeddings/reload', { method: 'POST' }),

  /** Start all cameras for a zone */
  startZoneCameras: (zoneId) =>
    streamFetch(`/zones/${zoneId}/start_all`, { method: 'POST' }),
};

export default api;
