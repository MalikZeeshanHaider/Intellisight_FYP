import React, { useEffect, useState } from 'react';
import { Filter, CalendarDays, Users, BookOpen, UserCheck, RefreshCw, Download } from 'lucide-react';

function getMondayOf(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  const day = d.getDay(); // 0=Sun
  const diff = (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function toDateInputValue(dateStr) {
  return dateStr || new Date().toISOString().slice(0, 10);
}

export default function FilterPanel({
  sections = [],
  students = [],
  mode,
  onModeChange,
  onLoad,
  onExport,
  loading,
}) {
  const [sectionId, setSectionId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [weekDate, setWeekDate] = useState(getMondayOf());

  // Auto-select first section and trigger initial load
  useEffect(() => {
    if (sections.length && !sectionId) {
      const firstId = String(sections[0].Section_ID);
      setSectionId(firstId);
      // Auto-load on initial arrival
      setTimeout(() => {
        onLoad({ sectionId: firstId, studentId: '', weekStart: getMondayOf(weekDate) });
      }, 100);
    }
  }, [sections]);

  const weekStart = getMondayOf(weekDate);

  function handleLoad() {
    onLoad({ sectionId, studentId: mode === 'student' ? studentId : '', weekStart });
  }

  function handleSectionChange(e) {
    const newSectionId = e.target.value;
    setSectionId(newSectionId);
    onLoad({ sectionId: newSectionId, studentId: mode === 'student' ? studentId : '', weekStart });
  }

  function handleWeekChange(e) {
    const newDate = e.target.value;
    setWeekDate(newDate);
    onLoad({ sectionId, studentId: mode === 'student' ? studentId : '', weekStart: getMondayOf(newDate) });
  }

  return (
    <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-sm p-5">
      {/* Header row */}
      <div className="flex items-center gap-2 mb-4">
        <Filter size={15} className="text-indigo-500" />
        <h3 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase tracking-widest">
          Filters
        </h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* View mode */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            View
          </label>
          <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
            {[
              { v: 'section', label: 'Section', Icon: BookOpen },
              { v: 'student', label: 'Student', Icon: UserCheck },
            ].map(({ v, label, Icon }) => (
              <button
                key={v}
                onClick={() => {
                  onModeChange(v);
                  if (v === 'section') {
                    onLoad({ sectionId, studentId: '', weekStart });
                  } else if (v === 'student' && studentId) {
                    onLoad({ sectionId, studentId, weekStart });
                  }
                }}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors ${
                  mode === v
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <Icon size={12} strokeWidth={2.5} />
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Section picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <Users size={11} />Section
            </span>
          </label>
          <select
            value={sectionId}
            onChange={handleSectionChange}
            className="text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400 outline-none"
          >
            <option value="">All sections</option>
            {sections.map(s => (
              <option key={s.Section_ID} value={s.Section_ID}>
                {s.Name} {s.Semester ? `— Sem ${s.Semester}` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Student picker (only in student mode) */}
        {mode === 'student' && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <UserCheck size={11} />Student
              </span>
            </label>
            <select
              value={studentId}
              onChange={e => setStudentId(e.target.value)}
              className="text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
            >
              <option value="">Select student…</option>
              {students.map(s => (
                <option key={s.Student_ID} value={s.Student_ID}>
                  {s.Name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Week picker */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            <span className="flex items-center gap-1">
              <CalendarDays size={11} />Week of
            </span>
          </label>
          <input
            type="date"
            value={toDateInputValue(weekDate)}
            onChange={handleWeekChange}
            className="text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-indigo-400 outline-none"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-2 mt-4">
        <button
          onClick={handleLoad}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          {loading ? 'Loading…' : 'Load Report'}
        </button>

        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-2 px-4 py-2 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors"
          >
            <Download size={14} />
            Export CSV
          </button>
        )}

        {weekStart && (
          <span className="text-xs text-slate-400 dark:text-slate-500 ml-auto">
            Week starting <strong>{new Date(weekStart + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
