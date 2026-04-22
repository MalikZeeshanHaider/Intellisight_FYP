import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

function statusStyle(status) {
  if (!status && status !== 0) return 'bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/30';
  const s = String(status).toLowerCase();
  if (s === 'present') return 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700/40';
  if (s === 'late')    return 'bg-amber-50  dark:bg-amber-900/30  border-amber-200  dark:border-amber-700/40';
  if (s === 'absent')  return 'bg-rose-50   dark:bg-rose-900/30   border-rose-200   dark:border-rose-700/40';
  return 'bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/30';
}

function rateStyle(rate) {
  if (rate === null || rate === undefined) return 'bg-slate-100 dark:bg-slate-700/40 border-slate-200 dark:border-slate-600/30';
  if (rate >= 80) return 'bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-700/40';
  if (rate >= 60) return 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-700/40';
  return 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700/40';
}

function rateText(rate) {
  if (rate === null || rate === undefined) return 'text-slate-400';
  if (rate >= 80) return 'text-emerald-700 dark:text-emerald-300';
  if (rate >= 60) return 'text-amber-700 dark:text-amber-300';
  return 'text-rose-700 dark:text-rose-300';
}

function rateDot(rate) {
  if (rate === null || rate === undefined) return 'bg-slate-300';
  if (rate >= 80) return 'bg-emerald-400';
  if (rate >= 60) return 'bg-amber-400';
  return 'bg-rose-400';
}

function statusDot(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'present') return 'bg-emerald-400';
  if (s === 'late')    return 'bg-amber-400';
  if (s === 'absent')  return 'bg-rose-400';
  return 'bg-slate-300';
}

function statusText(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'present') return 'text-emerald-700 dark:text-emerald-300';
  if (s === 'late')    return 'text-amber-700 dark:text-amber-300';
  if (s === 'absent')  return 'text-rose-700 dark:text-rose-300';
  return 'text-slate-400';
}

function fmt(time) {
  if (!time) return '';
  
  // Clean arbitrary formats like "9:0" to "09:00:00"
  let [h, m] = time.split(':');
  h = h ? h.padStart(2, '0') : '00';
  m = m ? m.padStart(2, '0') : '00';
  
  const d = new Date(`1970-01-01T${h}:${m}:00`);
  if (isNaN(d.getTime())) return time; // fallback to raw string if still invalid

  return d.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

export default function TimetableCell({ slot, attendance, teacherAttendance, mode }) {
  const [hover, setHover] = useState(false);

  if (!slot) {
    return (
      <div className="h-full w-full min-h-[5.5rem] bg-transparent" />
    );
  }

  const bgCls = mode === 'student'
    ? statusStyle(attendance?.status)
    : rateStyle(attendance?.attendanceRate);

  return (
    <div
      className="relative h-full w-full"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div
        className={`h-full min-h-[5.5rem] w-full flex flex-col justify-start border-none px-3 py-2 cursor-default select-none ${bgCls} transition-colors`}
      >
        <p className="text-sm font-bold text-slate-800 dark:text-white leading-tight line-clamp-2 uppercase tracking-wide">
          {slot.SubjectName || slot.course?.Name || '—'}
        </p>
        <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400 truncate mt-1">
          {fmt(slot.StartTime)} – {fmt(slot.EndTime)}
        </p>
        {slot.teacher && (
          <p className="text-[11px] font-medium text-slate-500 dark:text-slate-500 truncate mt-0.5">
            {slot.teacher.Name}
          </p>
        )}

        {mode === 'section' && attendance && (
          <div className="flex flex-col gap-1 mt-1.5">
            <div className="flex items-center gap-1">
              <span className={`w-1.5 h-1.5 rounded-full inline-block ${rateDot(attendance.attendanceRate)}`} />
              <span className={`text-xs font-extrabold ${rateText(attendance.attendanceRate)}`}>
                {Math.round(attendance.attendanceRate ?? 0)}%
              </span>
              <span className="text-[10px] text-slate-400">
                ({attendance.attended ?? attendance.present}/{attendance.totalEnrolled})
              </span>
            </div>
            {teacherAttendance && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className={`w-2 h-2 rounded-full inline-block ${statusDot(teacherAttendance.status)}`} />
                <span className={`font-semibold capitalize ${statusText(teacherAttendance.status)}`}>
                  Teacher: {teacherAttendance.status?.toLowerCase()}
                </span>
              </div>
            )}
          </div>
        )}

        {mode === 'student' && attendance && (
          <div className="flex items-center gap-1 mt-auto pt-2">
            <span className={`w-1.5 h-1.5 rounded-full inline-block ${statusDot(attendance.status)}`} />
            <span className={`text-xs font-bold capitalize ${statusText(attendance.status)}`}>
              {attendance.status?.toLowerCase() || 'no data'}
            </span>
          </div>
        )}
      </div>

      <AnimatePresence>
        {hover && attendance && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 bottom-[calc(100%+6px)] left-1/2 -translate-x-1/2 w-52 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3"
          >
            <p className="text-xs font-bold text-slate-700 dark:text-white mb-1.5">
              {slot.SubjectName}
            </p>
            {mode === 'section' ? (
              <>
                <Row label="Present"  value={attendance.present} />
                <Row label="Absent"   value={attendance.absent} />
                <Row label="Late"     value={attendance.late} />
                <Row label="Enrolled" value={attendance.totalEnrolled} />
                <Row label="Rate"     value={`${Math.round(attendance.attendanceRate ?? 0)}%`} />
              </>
            ) : (
              <>
                <Row label="Status"   value={attendance.status} />
                {attendance.firstSeenAt && (
                  <Row label="First seen" value={new Date(attendance.firstSeenAt).toLocaleTimeString()} />
                )}
                {attendance.totalMinutes != null && (
                  <Row label="Duration" value={`${attendance.totalMinutes} min`} />
                )}
              </>
            )}
            <div className="absolute bottom-[-6px] left-1/2 -translate-x-1/2 w-3 h-3 bg-white dark:bg-slate-800 border-b border-r border-slate-200 dark:border-slate-700 rotate-45" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between text-[11px] py-0.5">
      <span className="text-slate-400 dark:text-slate-500">{label}</span>
      <span className="font-semibold text-slate-700 dark:text-slate-200">{value ?? '—'}</span>
    </div>
  );
}
