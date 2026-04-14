import React, { useEffect, useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, TrendingUp, CalendarCheck, Clock,
  AlertTriangle, BookOpen, UserCheck, BarChart3, RefreshCcw,
  Calendar, LayoutGrid,
} from 'lucide-react';

import { sectionAPI, enrollmentAPI, classAttendanceAPI } from '../api/attendance';
import TimetableManager from '../components/attendance/TimetableManager';
import FilterPanel from '../components/attendance/FilterPanel';
import KpiCard from '../components/attendance/KpiCard';
import TimetableGrid from '../components/attendance/TimetableGrid';
import AttendanceChart from '../components/attendance/AttendanceChart';
import LoadingSkeleton from '../components/attendance/LoadingSkeleton';
import StudentListTable from '../components/attendance/StudentListTable';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// ─── Helpers ───────────────────────────────────────────────────────────────
function deriveSectionKpis(data) {
  if (!data?.grid) return null;
  const { grid, enrolledCount } = data;
  const dayRates = [];
  let totalPresent = 0, totalEnrolled = 0;

  DAYS.forEach(day => {
    const cells = grid[day]?.cells || [];
    if (!cells.length) return;
    const dayRate = cells.reduce((s, c) => s + (c.attendance?.attendanceRate ?? 0), 0) / cells.length;
    dayRates.push({ day, rate: Math.round(dayRate) });
    cells.forEach(c => {
      if (c.attendance) {
        totalPresent += c.attendance.present ?? 0;
        totalEnrolled += c.attendance.totalEnrolled ?? 0;
      }
    });
  });

  const overallRate = totalEnrolled > 0 ? Math.round((totalPresent / totalEnrolled) * 100) : 0;
  const bestDay = dayRates.length ? dayRates.reduce((a, b) => (b.rate > a.rate ? b : a)) : null;
  const worstDay = dayRates.length ? dayRates.reduce((a, b) => (b.rate < a.rate ? b : a)) : null;

  return {
    enrolledCount: enrolledCount ?? 0,
    overallRate,
    bestDay: bestDay ? `${bestDay.day} — ${bestDay.rate}%` : '—',
    worstDay: worstDay ? `${worstDay.day} — ${worstDay.rate}%` : '—',
    chartData: dayRates,
  };
}

function deriveStudentKpis(data) {
  if (!data?.summary) return null;
  const { summary, grid } = data;
  const chartData = [];

  DAYS.forEach(day => {
    const slots = grid?.[day]?.slots || [];
    const total = slots.length;
    if (!total) return;
    const present = slots.filter(s => s.attendance?.status === 'PRESENT').length;
    const late = slots.filter(s => s.attendance?.status === 'LATE').length;
    chartData.push({
      day,
      present: Math.round((present / total) * 100),
      late: Math.round((late / total) * 100),
      rate: Math.round(((present + late) / total) * 100),
    });
  });

  return {
    totalSlots: summary.totalSlots,
    present: summary.present,
    late: summary.late,
    absent: summary.absent,
    attendanceRate: Math.round(summary.attendanceRate ?? 0),
    chartData,
  };
}

function exportToCsv(data, mode) {
  if (!data?.grid) return;
  const rows = [['Day', 'Date', 'Subject', 'Start', 'End',
    mode === 'section' ? 'Present' : 'Status',
    mode === 'section' ? 'Absent' : 'First Seen',
    mode === 'section' ? 'Late' : 'Duration (min)',
    mode === 'section' ? 'Rate %' : '',
  ]];
  DAYS.forEach(day => {
    const dayData = data.grid[day];
    const cells = dayData?.cells || dayData?.slots || [];
    cells.forEach(cell => {
      const s = cell.slot;
      const a = cell.attendance;
      if (mode === 'section') {
        rows.push([day, dayData?.date || '', s.SubjectName, s.StartTime, s.EndTime,
          a?.present ?? '', a?.absent ?? '', a?.late ?? '', a?.attendanceRate ?? '']);
      } else {
        rows.push([day, dayData?.date || '', s.SubjectName, s.StartTime, s.EndTime,
          a?.status ?? '', a?.firstSeenAt ?? '', a?.totalMinutes ?? '']);
      }
    });
  });
  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `attendance_${mode}_${Date.now()}.csv`;
  link.click();
}

// ─── Tabs ──────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'timetable', label: 'Timetable', icon: Calendar, desc: 'Manage classes & schedule' },
  { id: 'analytics', label: 'Analytics',  icon: BarChart3, desc: 'View attendance data' },
];

// ─── Component ─────────────────────────────────────────────────────────────
export default function AttendanceAnalytics() {
  const [activeTab, setActiveTab] = useState('timetable');
  const [sections, setSections] = useState([]);
  const [selectedSectionId, setSelectedSectionId] = useState(null);

  // Analytics state
  const [mode, setMode] = useState('section');
  const [students, setStudents] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [aggLoading, setAggLoading] = useState(false);
  const [aggMsg, setAggMsg] = useState('');
  const [lastFilter, setLastFilter] = useState(null);

  // Load sections on mount
  useEffect(() => {
    sectionAPI.getAll()
      .then(res => {
        const list = Array.isArray(res) ? res : res.data ?? [];
        setSections(list);
      })
      .catch(() => setSections([]));
  }, []);

  // ── Analytics handlers ──────────────────────────────────────
  async function loadStudents(sectionId) {
    if (!sectionId) { setStudents([]); return; }
    try {
      const res = await enrollmentAPI.getBySection(sectionId);
      let list = [];
      if (Array.isArray(res)) list = res;
      else if (Array.isArray(res?.data)) list = res.data;
      else if (Array.isArray(res?.data?.enrollments)) list = res.data.enrollments;
      else if (Array.isArray(res?.enrollments)) list = res.enrollments;
      
      setStudents(list.map(e => e.student ?? e).filter(Boolean));
    } catch { setStudents([]); }
  }

  async function handleLoad({ sectionId, studentId, weekStart }) {
    setError('');
    setData(null);
    setLoading(true);
    setLastFilter({ sectionId, studentId, weekStart });
    try {
      let result;
      if (mode === 'student') {
        if (!studentId) {
          setError('Please select a student.');
          setLoading(false);
          return;
        }
        result = await classAttendanceAPI.getStudentWeekly(studentId, weekStart);
      } else if (sectionId) {
        result = await classAttendanceAPI.getSectionWeekly(sectionId, weekStart);
        await loadStudents(sectionId);
      } else {
        setError('Please select a section.');
        setLoading(false);
        return;
      }
      setData(result?.data || result);
    } catch (e) {
      setError(e?.response?.data?.message || 'Failed to load attendance data.');
    } finally {
      setLoading(false);
    }
  }

  async function handleAggregate() {
    if (!lastFilter?.sectionId) {
      setAggMsg('Select a section and load report first.');
      return;
    }
    setAggLoading(true);
    setAggMsg('');
    try {
      const endDate = new Date(lastFilter.weekStart);
      endDate.setDate(endDate.getDate() + 4);
      await classAttendanceAPI.aggregateWeek(
        lastFilter.weekStart,
        endDate.toISOString().slice(0, 10),
        lastFilter.sectionId,
      );
      setAggMsg('Aggregation complete. Reloading…');
      await handleLoad(lastFilter);
      setAggMsg('Done!');
    } catch (e) {
      setAggMsg(e?.response?.data?.message || 'Aggregation failed.');
    } finally {
      setAggLoading(false);
    }
  }

  const kpis = useMemo(() => {
    if (!data) return null;
    return mode === 'section' ? deriveSectionKpis(data) : deriveStudentKpis(data);
  }, [data, mode]);

  const sectionKpiCards = kpis && mode === 'section' ? [
    { icon: Users,         label: 'Enrolled Students',  value: kpis.enrolledCount, color: 'indigo', sub: 'in this section' },
    { icon: TrendingUp,    label: 'Avg Attendance Rate', value: `${kpis.overallRate}%`, color: 'emerald', sub: 'across the week' },
    { icon: CalendarCheck, label: 'Best Day',           value: kpis.bestDay,  color: 'sky', sub: 'highest attendance' },
    { icon: AlertTriangle, label: 'Lowest Day',         value: kpis.worstDay, color: 'rose', sub: 'needs attention' },
  ] : [];

  const studentKpiCards = kpis && mode === 'student' ? [
    { icon: BookOpen,      label: 'Total Classes',      value: kpis.totalSlots,      color: 'indigo' },
    { icon: UserCheck,     label: 'Present',            value: `${kpis.present} (${kpis.attendanceRate}%)`, color: 'emerald' },
    { icon: Clock,         label: 'Late',               value: kpis.late,            color: 'amber' },
    { icon: AlertTriangle, label: 'Absent',             value: kpis.absent,          color: 'rose' },
  ] : [];

  const kpiCards = mode === 'section' ? sectionKpiCards : studentKpiCards;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-4 sm:p-6">
      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="mb-5">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/40">
            <LayoutGrid size={22} />
          </div>
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 dark:text-white tracking-tight">
              Attendance
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Manage timetable, track class attendance from camera detections
            </p>
          </div>
        </div>
      </div>

      {/* ── Tab Bar ─────────────────────────────────────────── */}
      <div className="flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-1 mb-6 w-fit">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                active
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab: Timetable Management ───────────────────────── */}
      {activeTab === 'timetable' && (
        <TimetableManager
          sections={sections}
          setSections={setSections}
          selectedSectionId={selectedSectionId}
          setSelectedSectionId={setSelectedSectionId}
        />
      )}

      {/* ── Tab: Attendance Analytics ───────────────────────── */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          {/* Filter panel */}
          <FilterPanel
            sections={sections}
            students={students}
            mode={mode}
            onModeChange={setMode}
            onLoad={handleLoad}
            onExport={data ? () => exportToCsv(data, mode) : null}
            loading={loading}
          />

          {/* Aggregation trigger */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleAggregate}
              disabled={aggLoading || !lastFilter}
              className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors shadow-sm disabled:opacity-50"
            >
              <RefreshCcw size={14} className={aggLoading ? 'animate-spin' : ''} />
              {aggLoading ? 'Aggregating…' : 'Re-aggregate from Camera Logs'}
            </button>
            {aggMsg && (
              <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">{aggMsg}</span>
            )}
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className="px-4 py-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/40 rounded-xl text-sm text-rose-700 dark:text-rose-300 font-medium"
            >
              {error}
            </motion.div>
          )}

          {/* Body */}
          {loading ? (
            <LoadingSkeleton />
          ) : data ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* KPI cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <KpiCard {...card} />
                  </motion.div>
                ))}
              </div>

              {/* Timetable grid with attendance dots (only for student mode now, section uses modal) */}
              {mode === 'student' && data.grid && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                  <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-4">
                    Weekly Timetable — Attendance Heatmap
                  </h2>
                  <TimetableGrid grid={data.grid} mode={mode} />
                </div>
              )}

              {/* Student List (Section Mode Only) */}
              {mode === 'section' && data.students && (
                <StudentListTable 
                  students={data.students} 
                  isDarkMode={document.documentElement.classList.contains('dark')}
                  grid={data.grid}
                  kpis={kpis}
                  mode={mode}
                />
              )}

              {/* Chart (only for student mode now, section uses modal) */}
              {mode === 'student' && kpis?.chartData?.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
                  <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest mb-4">
                    Daily Attendance Trend
                  </h2>
                  <AttendanceChart data={kpis.chartData} mode={mode} />
                </div>
              )}
            </motion.div>
          ) : (
            <div className="mt-12 flex flex-col items-center text-center">
              <div className="p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl mb-4">
                <BarChart3 size={32} className="text-indigo-400" />
              </div>
              <p className="text-slate-600 dark:text-slate-300 font-semibold">No data loaded yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Select a section and click <strong>Load Report</strong> to view attendance analytics.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
