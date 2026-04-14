import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, BookOpen, User, MapPin, Save, AlertCircle } from 'lucide-react';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const DAY_LABELS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday' };

const TIME_OPTIONS = [
  '08:00','08:30','09:00','09:30','10:00','10:30','11:00','11:30',
  '12:00','12:30','13:00','13:30','14:00','14:30','15:00','15:30',
  '16:00','16:30','17:00','17:30','18:00',
];

function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const p = h >= 12 ? 'PM' : 'AM';
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${p}`;
}

export default function SlotFormModal({
  open,
  onClose,
  onSave,
  slot,          // null = create, object = edit
  sectionId,
  teachers = [],
  zones = [],
  saving = false,
  serverError = '',
}) {
  const isEdit = !!slot && !slot._isNew;

  const [form, setForm] = useState({
    SubjectName: '',
    DayOfWeek: 'MON',
    StartTime: '09:00',
    EndTime: '10:00',
    Teacher_ID: '',
    TeacherName: '',
    Zone_id: '',
    RoomName: '',
  });

  const [errors, setErrors] = useState({});
  const [useCustomTeacher, setUseCustomTeacher] = useState(false);

  useEffect(() => {
    if (slot && !slot._isNew) {
      setForm({
        SubjectName: slot.SubjectName || '',
        DayOfWeek: slot.DayOfWeek || 'MON',
        StartTime: slot.StartTime || '09:00',
        EndTime: slot.EndTime || '10:00',
        Teacher_ID: slot.Teacher_ID ? String(slot.Teacher_ID) : '',
        TeacherName: slot.TeacherName || '',
        Zone_id: slot.Zone_id ? String(slot.Zone_id) : '',
        RoomName: slot.RoomName || '',
      });
      setUseCustomTeacher(!slot.Teacher_ID && !!slot.TeacherName);
    } else {
      setForm({
        SubjectName: '',
        DayOfWeek: slot?.DayOfWeek || 'MON',
        StartTime: '09:00',
        EndTime: '10:00',
        Teacher_ID: '',
        TeacherName: '',
        Zone_id: '',
        RoomName: '',
      });
      setUseCustomTeacher(false);
    }
    setErrors({});
  }, [slot, open]);

  function set(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  }

  function validate() {
    const e = {};
    if (!form.SubjectName.trim()) e.SubjectName = 'Subject is required';
    if (!form.StartTime) e.StartTime = 'Start time is required';
    if (!form.EndTime) e.EndTime = 'End time is required';
    if (form.StartTime >= form.EndTime) e.EndTime = 'End must be after start';
    if (!useCustomTeacher && !form.Teacher_ID && !form.TeacherName.trim()) {
      // Teacher is optional but let's not block
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;

    const payload = {
      Section_ID: sectionId,
      SubjectName: form.SubjectName.trim(),
      DayOfWeek: form.DayOfWeek,
      StartTime: form.StartTime,
      EndTime: form.EndTime,
      Teacher_ID: !useCustomTeacher && form.Teacher_ID ? parseInt(form.Teacher_ID) : null,
      TeacherName: useCustomTeacher ? form.TeacherName.trim() : null,
      Zone_id: form.Zone_id ? parseInt(form.Zone_id) : null,
      RoomName: form.RoomName.trim() || null,
    };

    onSave(payload, isEdit ? slot.Slot_ID : null);
  }

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-700 bg-gradient-to-r from-indigo-500 to-violet-500">
            <div className="flex items-center gap-2 text-white">
              <BookOpen size={18} />
              <h2 className="text-lg font-bold">{isEdit ? 'Edit Class Slot' : 'Add New Class Slot'}</h2>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 text-white transition-colors">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
            {/* Subject */}
            <Field label="Subject Name" icon={BookOpen} error={errors.SubjectName}>
              <input
                type="text"
                value={form.SubjectName}
                onChange={e => set('SubjectName', e.target.value)}
                placeholder="e.g. Object Oriented Programming"
                className={inputCls(errors.SubjectName)}
              />
            </Field>

            {/* Day + Time row */}
            <div className="grid grid-cols-3 gap-3">
              <Field label="Day" icon={Clock}>
                <select value={form.DayOfWeek} onChange={e => set('DayOfWeek', e.target.value)} className={inputCls()}>
                  {DAYS.map(d => <option key={d} value={d}>{DAY_LABELS[d]}</option>)}
                </select>
              </Field>
              <Field label="Start Time" error={errors.StartTime}>
                <select value={form.StartTime} onChange={e => set('StartTime', e.target.value)} className={inputCls(errors.StartTime)}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmt12(t)}</option>)}
                </select>
              </Field>
              <Field label="End Time" error={errors.EndTime}>
                <select value={form.EndTime} onChange={e => set('EndTime', e.target.value)} className={inputCls(errors.EndTime)}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmt12(t)}</option>)}
                </select>
              </Field>
            </div>

            {/* Teacher */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                  <User size={11} /> Teacher
                </label>
                <button
                  type="button"
                  onClick={() => { setUseCustomTeacher(!useCustomTeacher); set('Teacher_ID', ''); set('TeacherName', ''); }}
                  className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  {useCustomTeacher ? 'Select from list' : 'Type name manually'}
                </button>
              </div>
              {useCustomTeacher ? (
                <input
                  type="text"
                  value={form.TeacherName}
                  onChange={e => set('TeacherName', e.target.value)}
                  placeholder="e.g. Dr. Ahmed Khan"
                  className={inputCls()}
                />
              ) : (
                <select value={form.Teacher_ID} onChange={e => set('Teacher_ID', e.target.value)} className={inputCls()}>
                  <option value="">— Select teacher (optional) —</option>
                  {teachers.map(t => (
                    <option key={t.Teacher_ID} value={t.Teacher_ID}>{t.Name}</option>
                  ))}
                </select>
              )}
            </div>

            {/* Zone / Room */}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Zone (Room)" icon={MapPin}>
                <select value={form.Zone_id} onChange={e => set('Zone_id', e.target.value)} className={inputCls()}>
                  <option value="">— Select zone (optional) —</option>
                  {zones.map(z => (
                    <option key={z.Zone_id} value={z.Zone_id}>{z.Zone_Name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Room Name">
                <input
                  type="text"
                  value={form.RoomName}
                  onChange={e => set('RoomName', e.target.value)}
                  placeholder="e.g. Room-301"
                  className={inputCls()}
                />
              </Field>
            </div>

            {/* Server error */}
            {serverError && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/40 rounded-xl text-sm text-rose-700 dark:text-rose-300">
                <AlertCircle size={14} /> {serverError}
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
              >
                <Save size={14} />
                {saving ? 'Saving…' : isEdit ? 'Update Slot' : 'Add Slot'}
              </button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// ── Utility sub-components ────────────────────────────────────
function Field({ label, icon: Icon, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
          {Icon && <Icon size={11} />} {label}
        </label>
      )}
      {children}
      {error && <span className="text-[10px] text-rose-500 font-medium">{error}</span>}
    </div>
  );
}

function inputCls(hasError) {
  return `w-full text-sm rounded-xl border ${
    hasError
      ? 'border-rose-300 dark:border-rose-600 focus:ring-rose-400'
      : 'border-slate-200 dark:border-slate-600 focus:ring-indigo-400'
  } bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:border-transparent outline-none transition-all`;
}
