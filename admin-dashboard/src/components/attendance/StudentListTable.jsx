import React, { useState } from 'react';
import { Users, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import TimetableGrid from './TimetableGrid';
import AttendanceChart from './AttendanceChart';

export default function StudentListTable({ students, isDarkMode, grid, kpis, mode }) {
  const [showHeatmapModal, setShowHeatmapModal] = useState(false);

  if (!students || students.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size={24} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm font-medium" style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}>
          No students enrolled in this section
        </p>
      </div>
    );
  }

  const getStatusColor = (rate) => {
    if (rate >= 80) return { bg: '#d1fae5', text: '#065f46', border: '#a7f3d0', hex: '#10b981' };
    if (rate >= 60) return { bg: '#fef3c7', text: '#78350f', border: '#fcd34d', hex: '#f59e0b' };
    return { bg: '#fee2e2', text: '#7f1d1d', border: '#fca5a5', hex: '#ef4444' };
  };

  return (
    <>
      <div className="rounded-2xl shadow-sm border overflow-hidden"
        style={{
          borderColor: isDarkMode ? '#334155' : '#e2e8f0',
          background: isDarkMode ? '#1e293b' : '#ffffff',
        }}>
        
        {/* Header with Heatmap Button */}
        <div className="p-5 border-b flex items-center justify-between"
          style={{ borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
          <div className="flex items-center gap-2">
            <Users size={16} style={{ color: isDarkMode ? '#818cf8' : '#6366f1' }} />
            <div>
              <h3 className="text-sm font-bold uppercase tracking-widest"
                style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                Students in Section
              </h3>
              <p className="text-xs mt-0.5"
                style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}>
                {students.length} students • Attendance summary for the week
              </p>
            </div>
          </div>

          {/* Heatmap Popup Button */}
          <button
            onClick={() => setShowHeatmapModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              background: isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff',
              color: isDarkMode ? '#818cf8' : '#6366f1',
              border: isDarkMode ? '1px solid rgba(99, 102, 241, 0.3)' : '1px solid rgba(99, 102, 241, 0.2)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isDarkMode ? 'rgba(99, 102, 241, 0.3)' : '#dbeafe';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#eef2ff';
            }}
          >
            <BarChart3 size={14} />
            Heatmap
          </button>
        </div>

        {/* Student Records Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr style={{ borderBottom: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>ID</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Name</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Department</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Gender</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-center" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Present</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-center" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Absent</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-widest text-center" style={{ color: isDarkMode ? '#94a3b8' : '#64748b' }}>Status</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: isDarkMode ? '#334155' : '#e2e8f0' }}>
              {students.map((item, idx) => {
                const { student, summary } = item;
                const statusColor = getStatusColor(summary.attendanceRate);
                const initial = student.Name ? student.Name.charAt(0).toUpperCase() : '?';

                return (
                  <tr
                    key={student.Student_ID}
                    className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-4 text-sm font-semibold" style={{ color: isDarkMode ? '#818cf8' : '#6366f1' }}>
                      {student.Student_ID}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold border"
                          style={{
                            borderColor: isDarkMode ? '#3f3f46' : '#e5e7eb',
                            color: isDarkMode ? '#e2e8f0' : '#4f46e5',
                            background: isDarkMode ? '#1e293b' : '#e0e7ff'
                          }}>
                          {initial}
                        </div>
                        <span className="text-sm font-semibold" style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                          {student.Name}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm font-medium" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                      {student.Department || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                      {student.Gender || '—'}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-center" style={{ color: '#059669' }}>
                      {summary.present}
                    </td>
                    <td className="px-5 py-4 text-sm font-bold text-center" style={{ color: '#e11d48' }}>
                      {summary.absent}
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-center">
                      <span className="px-3 py-1 rounded-full text-xs font-bold" style={{
                        background: statusColor.bg,
                        color: statusColor.text,
                        border: `1px solid ${statusColor.border}`,
                      }}>
                        {summary.attendanceRate}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Heatmap Modal */}
      {showHeatmapModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.5)' }}
          onClick={() => setShowHeatmapModal(false)}
        >
          <div
            className="rounded-2xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-y-auto"
            style={{
              background: isDarkMode ? '#0f172a' : '#ffffff',
              border: isDarkMode ? '1px solid rgba(129, 140, 248, 0.3)' : 'none',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div
              className="sticky top-0 px-6 py-4 border-b flex items-center justify-between"
              style={{
                borderColor: isDarkMode ? '#334155' : '#e2e8f0',
                background: isDarkMode ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
              }}
            >
              <div className="flex items-center gap-2">
                <BarChart3 size={20} style={{ color: isDarkMode ? '#818cf8' : '#6366f1' }} />
                <h2 className="text-lg font-bold" style={{ color: isDarkMode ? '#e2e8f0' : '#1e293b' }}>
                  Attendance Heatmap & Analytics
                </h2>
              </div>
              <button
                onClick={() => setShowHeatmapModal(false)}
                className="text-2xl font-light transition hover:opacity-70"
                style={{ color: isDarkMode ? '#94a3b8' : '#6b7280' }}
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6">
              {/* Heatmap Grid */}
              {grid && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                    Weekly Timetable — Attendance Heatmap
                  </h3>
                  <TimetableGrid grid={grid} mode={mode} />
                </div>
              )}

              {/* Attendance Trend Chart */}
              {kpis?.chartData?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-sm font-bold uppercase tracking-widest" style={{ color: isDarkMode ? '#cbd5e1' : '#475569' }}>
                    Daily Attendance Trend
                  </h3>
                  <AttendanceChart data={kpis.chartData} mode={mode} />
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div style={{ borderTop: isDarkMode ? '1px solid #334155' : '1px solid #e2e8f0' }}>
              <button
                onClick={() => setShowHeatmapModal(false)}
                className="w-full px-6 py-3 font-semibold transition-colors"
                style={{
                  color: isDarkMode ? '#818cf8' : '#6366f1',
                  background: isDarkMode ? 'rgba(99, 102, 241, 0.1)' : '#eef2ff',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isDarkMode ? 'rgba(99, 102, 241, 0.2)' : '#dbeafe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isDarkMode ? 'rgba(99, 102, 241, 0.1)' : '#eef2ff';
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
