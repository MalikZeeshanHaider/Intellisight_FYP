/**
 * Attendance Analytics API Module
 * Covers: Sections, Courses, Enrollments, Slots, ClassAttendance
 */

import axios from 'axios';

// Cookie sent automatically via withCredentials — token never touches localStorage
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
  timeout: 30000,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ── Sections ──────────────────────────────────────────────────
export const sectionAPI = {
  getAll: () => api.get('/sections').then((r) => r.data),
  getById: (id) => api.get(`/sections/${id}`).then((r) => r.data),
  create: (data) => api.post('/sections', data).then((r) => r.data),
  update: (id, data) => api.put(`/sections/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/sections/${id}`).then((r) => r.data),
};

// ── Courses ───────────────────────────────────────────────────
export const courseAPI = {
  getAll: () => api.get('/courses').then((r) => r.data),
  getById: (id) => api.get(`/courses/${id}`).then((r) => r.data),
  create: (data) => api.post('/courses', data).then((r) => r.data),
  update: (id, data) => api.put(`/courses/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/courses/${id}`).then((r) => r.data),
};

// ── Enrollments ───────────────────────────────────────────────
export const enrollmentAPI = {
  getBySection: (sectionId) => api.get(`/enrollments/section/${sectionId}`).then((r) => r.data),
  getByStudent: (studentId) => api.get(`/enrollments/student/${studentId}`).then((r) => r.data),
  create: (data) => api.post('/enrollments', data).then((r) => r.data),
  bulkCreate: (data) => api.post('/enrollments/bulk', data).then((r) => r.data),
  delete: (id) => api.delete(`/enrollments/${id}`).then((r) => r.data),
};

// ── Slots (TimetableSlot) ─────────────────────────────────────
export const slotAPI = {
  getAll: (params) => api.get('/slots', { params }).then((r) => r.data),
  getById: (id) => api.get(`/slots/${id}`).then((r) => r.data),
  getBySection: (sectionId) => api.get(`/slots/section/${sectionId}`).then((r) => r.data),
  create: (data) => api.post('/slots', data).then((r) => r.data),
  bulkCreate: (slots) => api.post('/slots/bulk', { slots }).then((r) => r.data),
  checkOverlaps: (data) => api.post('/slots/check-overlaps', data).then((r) => r.data),
  update: (id, data) => api.put(`/slots/${id}`, data).then((r) => r.data),
  delete: (id) => api.delete(`/slots/${id}`).then((r) => r.data),
};

// ── Class Attendance ──────────────────────────────────────────
export const classAttendanceAPI = {
  /** Trigger aggregation for a single date */
  aggregate: (date, sectionId, slotId) =>
    api.post('/class-attendance/aggregate', { date, sectionId, slotId }).then((r) => r.data),

  /** Trigger aggregation for a date range */
  aggregateWeek: (startDate, endDate, sectionId) =>
    api.post('/class-attendance/aggregate-week', { startDate, endDate, sectionId }).then((r) => r.data),

  /** Flexible query */
  query: (params) => api.get('/class-attendance', { params }).then((r) => r.data),

  /** Per-slot rollcall on a specific date */
  getSlot: (slotId, date) =>
    api.get(`/class-attendance/slot/${slotId}`, { params: { date } }).then((r) => r.data),

  /** Student weekly grid with attendance dots */
  getStudentWeekly: (studentId, weekStart) =>
    api.get(`/class-attendance/student/${studentId}/weekly`, { params: { weekStart } }).then((r) => r.data),

  /** Section heatmap: present count per slot per day */
  getSectionWeekly: (sectionId, weekStart) =>
    api.get(`/class-attendance/section/${sectionId}/weekly`, { params: { weekStart } }).then((r) => r.data),

  /** Teacher weekly view */
  getTeacherWeekly: (teacherId, weekStart) =>
    api.get(`/class-attendance/teacher/${teacherId}/weekly`, { params: { weekStart } }).then((r) => r.data),
};
