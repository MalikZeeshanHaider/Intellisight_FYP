/**
 * Axios API Configuration
 * Handles all HTTP requests to the IntelliSight backend
 */

import axios from 'axios';

// Create axios instance with default configuration
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000, // 30 seconds for image upload operations
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - Add JWT token to all requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - Handle errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Unauthorized - clear token and redirect to login
      localStorage.removeItem('token');
      localStorage.removeItem('user');
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
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },
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

export default api;
