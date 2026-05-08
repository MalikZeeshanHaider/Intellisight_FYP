import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Upload, Trash2, Edit3, Calendar, ImagePlus,
  Clock, BookOpen, MapPin, User, Users, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { slotAPI } from '../../api/attendance';
import { teacherAPI, zoneAPI } from '../../api/api';
import SectionManager from './SectionManager';
import SlotFormModal from './SlotFormModal';
import UploadTimetableModal from './UploadTimetableModal';

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI'];
const DAY_LABELS = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday' };
const DAY_SHORT  = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri' };

function fmt12(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  return `${((h % 12) || 12)}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

export default function TimetableManager({ sections, setSections, selectedSectionId, setSelectedSectionId }) {
  const [teachers, setTeachers] = useState([]);
  const [zones, setZones] = useState([]);
  const [grid, setGrid] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editSlot, setEditSlot] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState('');

  // Delete confirm
  const [deleteId, setDeleteId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // AI upload placeholder state
  const [showAiUpload, setShowAiUpload] = useState(false);

  // Load teachers + zones on mount
  useEffect(() => {
    teacherAPI.getAllTeachers()
      .then(res => setTeachers(res.data || []))
      .catch(() => {});
    zoneAPI.getAllZones()
      .then(res => setZones(res.data || []))
      .catch(() => {});
  }, []);

  // Load timetable when section changes
  useEffect(() => {
    if (selectedSectionId) {
      loadGrid(selectedSectionId);
    } else {
      setGrid(null);
    }
  }, [selectedSectionId]);

  async function loadGrid(secId) {
    setLoading(true);
    setError('');
    try {
      const res = await slotAPI.getBySection(secId);
      const data = res.data ?? res;
      setGrid(data.grid || data);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load timetable');
    } finally {
      setLoading(false);
    }
  }

  const parseMinutes = (t) => {
    if (!t) return 0;
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  };

  // Compute 60-min columns from all slots
  const timeColumns = useMemo(() => {
    if (!grid) return [];
    let minM = 24 * 60, maxM = 0;
    DAYS.forEach(day => {
      (grid[day] || []).forEach(s => {
        const st = parseMinutes(s.StartTime);
        const et = parseMinutes(s.EndTime);
        minM = Math.min(minM, st);
        maxM = Math.max(maxM, et);
      });
    });
    if (minM >= maxM) return [];
    
    // Round down minM to the nearest hour (e.g. 08:30 -> 08:00)
    minM = Math.floor(minM / 60) * 60;
    
    const cols = [];
    for (let m = minM; m < maxM; m += 60) cols.push(m);
    return cols;
  }, [grid]);

  // Total slot count
  const totalSlots = useMemo(() => {
    if (!grid) return 0;
    return DAYS.reduce((sum, day) => sum + (grid[day]?.length || 0), 0);
  }, [grid]);

  // Build cells for a day row (handles colspan merging for multi-hour slots)
  function buildDayCells(day) {
    const slots = grid[day] || [];
    const slotByStart = {};
    slots.forEach(s => {
      const m = parseMinutes(s.StartTime);
      slotByStart[m] = s;
    });
    const cells = [];
    const skip = new Set();
    for (const col of timeColumns) {
      if (skip.has(col)) continue;
      const slot = slotByStart[col];
      if (slot) {
        const startM = parseMinutes(slot.StartTime);
        const endM = parseMinutes(slot.EndTime);
      const span = Math.max(1, Math.ceil((endM - startM) / 60));
      for (let i = 1; i < span; i++) skip.add(startM + i * 60);
        cells.push({ type: 'slot', slot, span, minute: col });
      } else {
        cells.push({ type: 'free', span: 1, minute: col });
      }
    }
    return cells;
  }

  // ── CRUD handlers ──────────────────────────────────────────────
  function openAddModal(day) {
    setModalError('');
    setEditSlot({ DayOfWeek: day || 'MON', _isNew: true });
    setModalOpen(true);
  }

  function openEditModal(slot) {
    setEditSlot(slot);
    setModalError('');
    setModalOpen(true);
  }

  async function handleSaveSlot(payload, slotId) {
    setModalSaving(true);
    setModalError('');
    try {
      if (slotId) {
        await slotAPI.update(slotId, payload);
        setSuccess('Slot updated successfully');
      } else {
        await slotAPI.create(payload);
        setSuccess('Slot added successfully');
      }
      setModalOpen(false);
      setEditSlot(null);
      await loadGrid(selectedSectionId);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setModalError(err?.response?.data?.message || 'Failed to save slot');
    } finally {
      setModalSaving(false);
    }
  }

  async function handleDeleteSlot() {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await slotAPI.delete(deleteId);
      setDeleteId(null);
      setSuccess('Slot deleted');
      await loadGrid(selectedSectionId);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to delete slot');
    } finally {
      setDeleting(false);
    }
  }

  function handleSectionCreated(newSection) {
    setSections(prev => [...prev, newSection]);
    setSelectedSectionId(newSection.Section_ID);
  }

  // ── Time slot cell colors (empty vs occupied)
  function slotBg(slot) {
    if (!slot) return 'bg-slate-50 dark:bg-slate-800/40 border-dashed border-slate-200 dark:border-slate-700';
    return 'bg-sky-50 dark:bg-sky-900/20 border-sky-200 dark:border-sky-700/40';
  }

  return (
    <div className="space-y-5">
      {/* Section + Add button row */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
        <SectionManager
          sections={sections}
          selectedId={selectedSectionId}
          onSelect={setSelectedSectionId}
          onCreated={handleSectionCreated}
        />
      </div>

      {/* Actions row */}
      {selectedSectionId && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => openAddModal()}
            className="flex items-center gap-2 px-4 py-2.5 bg-sky-500 hover:bg-sky-600 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
          >
            <Plus size={16} /> Add Class Slot
          </button>
          <button
            onClick={() => setShowAiUpload(!showAiUpload)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-semibold rounded-xl transition-colors"
          >
            <ImagePlus size={16} /> Upload Timetable Image (AI)
          </button>
        </div>
      )}

      {/* AI Upload modal — full extraction + review flow */}
      <UploadTimetableModal
        isOpen={showAiUpload}
        onClose={() => setShowAiUpload(false)}
        onSuccess={async (newSectionId) => {
          // Switch to imported section, then refresh the grid
          if (newSectionId && newSectionId !== selectedSectionId) {
            setSelectedSectionId(Number(newSectionId));
          } else if (selectedSectionId) {
            await loadGrid(selectedSectionId);
          }
          setSuccess('Timetable imported successfully');
          setTimeout(() => setSuccess(''), 4000);
        }}
        defaultSectionId={selectedSectionId}
        sections={sections}
      />

      {/* Success message */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-2 px-4 py-3 bg-emerald-50 dark:bg-emerald-900/30 border border-emerald-200 dark:border-emerald-700/40 rounded-xl text-sm text-emerald-700 dark:text-emerald-300 font-medium"
          >
            <CheckCircle2 size={16} /> {success}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/40 rounded-xl text-sm text-rose-700 dark:text-rose-300 font-medium">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Timetable Grid */}
      {selectedSectionId && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Calendar size={14} /> Weekly Timetable
            </h2>
            {grid && (
              <span className="text-xs text-slate-400 dark:text-slate-500">
                {totalSlots} class{totalSlots !== 1 ? 'es' : ''} configured
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="h-16 bg-slate-100 dark:bg-slate-700/40 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : !grid || timeColumns.length === 0 ? (
            <div className="py-12 text-center">
              <div className="inline-flex p-4 bg-slate-100 dark:bg-slate-700/40 rounded-2xl mb-3">
                <Calendar size={28} className="text-slate-400" />
              </div>
              <p className="text-slate-500 dark:text-slate-400 font-semibold">No classes added yet</p>
              <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
                Click <strong>Add Class Slot</strong> or <strong>Upload Timetable Image</strong> to get started.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate" style={{ borderSpacing: '4px 4px' }}>
                <thead>
                  <tr>
                    <th className="w-28 text-left pb-2 sticky left-0 bg-white dark:bg-slate-800 z-10">
                      <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Day</span>
                    </th>
                    {timeColumns.map(min => (
                      <th key={min} className="min-w-[120px] text-center pb-2">
                        <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                          {fmt12(`${String(Math.floor(min/60)).padStart(2,'0')}:${String(min%60).padStart(2,'0')}`)}
                        </span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DAYS.map(day => {
                    const cells = buildDayCells(day);
                    return (
                      <tr key={day}>
                        <td className="pr-2 align-middle sticky left-0 bg-white dark:bg-slate-800 z-10">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-700 dark:text-slate-200 uppercase tracking-wider w-8">
                              {DAY_SHORT[day]}
                            </span>
                            <button
                              onClick={() => openAddModal(day)}
                              className="p-0.5 rounded hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-500 transition-colors"
                              title={`Add slot on ${DAY_LABELS[day]}`}
                            >
                              <Plus size={12} strokeWidth={3} />
                            </button>
                          </div>
                        </td>
                        {cells.map(cell => {
                          if (cell.type === 'slot') {
                            const { slot, span } = cell;
                            return (
                              <td key={cell.minute} colSpan={span} className="align-top">
                                <motion.div
                                  whileHover={{ scale: 1.01 }}
                                  className={`relative group rounded-xl border p-2.5 min-h-[76px] cursor-default ${slotBg(slot)} transition-shadow hover:shadow-md h-full`}
                                >
                                  <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                                    {slot.SubjectName}
                                  </p>
                                  <p className="text-[10px] text-sky-500 dark:text-sky-400 font-medium mt-0.5 flex items-center gap-0.5">
                                    <Clock size={8} /> {fmt12(slot.StartTime)} – {fmt12(slot.EndTime)}
                                  </p>
                                  {(slot.teacher?.Name || slot.TeacherName) && (
                                    <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate mt-0.5 flex items-center gap-0.5">
                                      <User size={8} /> {slot.teacher?.Name || slot.TeacherName}
                                    </p>
                                  )}
                                  {(slot.zone?.Zone_Name || slot.RoomName) && (
                                    <p className="text-[10px] text-slate-400 dark:text-slate-500 truncate mt-0.5 flex items-center gap-0.5">
                                      <MapPin size={8} /> {slot.zone?.Zone_Name || slot.RoomName}
                                    </p>
                                  )}
                                  <div className="absolute top-1 right-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => openEditModal(slot)}
                                      className="p-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-sky-100 dark:hover:bg-sky-900/40 text-sky-500 transition-colors"
                                      title="Edit slot"
                                    >
                                      <Edit3 size={11} />
                                    </button>
                                    <button
                                      onClick={() => setDeleteId(slot.Slot_ID)}
                                      className="p-1 rounded-lg bg-white/80 dark:bg-slate-800/80 hover:bg-rose-100 dark:hover:bg-rose-900/40 text-rose-500 transition-colors"
                                      title="Delete slot"
                                    >
                                      <Trash2 size={11} />
                                    </button>
                                  </div>
                                </motion.div>
                              </td>
                            );
                          }
                          return (
                            <td key={cell.minute} className="align-top">
                              <div className={`rounded-xl border min-h-[76px] flex items-center justify-center ${slotBg(null)}`}>
                                <span className="text-[10px] text-slate-300 dark:text-slate-600 italic">Free</span>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {!selectedSectionId && (
        <div className="py-16 text-center">
          <div className="inline-flex p-4 bg-sky-50 dark:bg-sky-900/20 rounded-2xl mb-3">
            <Users size={28} className="text-sky-400" />
          </div>
          <p className="text-slate-600 dark:text-slate-300 font-semibold">Select a section to manage its timetable</p>
          <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">
            Choose an existing section from the dropdown or create a new one.
          </p>
        </div>
      )}

      {/* Slot Form Modal */}
      <SlotFormModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditSlot(null); }}
        onSave={handleSaveSlot}
        slot={editSlot}
        sectionId={selectedSectionId}
        teachers={teachers}
        zones={zones}
        saving={modalSaving}
        serverError={modalError}
      />

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 p-6 max-w-sm w-full text-center"
            >
              <div className="inline-flex p-3 bg-rose-100 dark:bg-rose-900/30 rounded-2xl mb-3">
                <Trash2 size={24} className="text-rose-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-1">Delete Class Slot?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">This action cannot be undone. Any attendance records for this slot will also be removed.</p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={() => setDeleteId(null)}
                  className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteSlot}
                  disabled={deleting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
