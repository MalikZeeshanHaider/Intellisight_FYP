import React, { useState, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Upload, Sparkles, Image as ImageIcon, Check, AlertCircle,
  Loader2, MapPin, BookOpen, User, Clock,
} from 'lucide-react';
import { slotAPI } from '../../api/attendance';

const DAY_LABEL = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

/**
 * Three-stage flow:
 *   1. UPLOAD   — drop zone, preview, "Analyze with AI" button
 *   2. REVIEW   — editable table of extracted slots, dropdowns for unmatched names
 *   3. DONE     — success summary
 */
export default function UploadTimetableModal({ isOpen, onClose, onSuccess, defaultSectionId, sections }) {
  const [stage, setStage] = useState('UPLOAD'); // UPLOAD | REVIEW | DONE
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  // Extraction result + admin edits
  const [extracted, setExtracted] = useState(null);   // backend response
  const [sectionId, setSectionId] = useState(null);   // chosen section
  const [slots, setSlots] = useState([]);             // editable copy
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const fileInputRef = useRef(null);

  // ── Reset on close ──
  const reset = useCallback(() => {
    setStage('UPLOAD');
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtracted(null);
    setSectionId(null);
    setSlots([]);
    setError('');
    setImportResult(null);
    setReplaceExisting(false);
  }, [previewUrl]);

  const handleClose = () => { reset(); onClose(); };

  const handleFileSelect = (f) => {
    if (!f) return;
    if (!f.type.startsWith('image/')) {
      setError('Please select an image file (JPG, PNG, etc.)');
      return;
    }
    if (f.size > 8 * 1024 * 1024) {
      setError('Image too large — max 8 MB');
      return;
    }
    setError('');
    setFile(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  const handleDrop = (e) => {
    e.preventDefault();
    handleFileSelect(e.dataTransfer.files?.[0]);
  };

  // ── Stage 1 → 2: Run AI ──
  const analyze = async () => {
    if (!file) return;
    setAnalyzing(true);
    setError('');
    try {
      const res = await slotAPI.extractFromImage(file);
      const data = res.data ?? res;
      setExtracted(data);
      // Pre-fill chosen section: prefer prop default, else AI suggestion
      setSectionId(defaultSectionId || data.extractedSection?.suggestedSectionId || null);
      // Hydrate editable slots with suggestions
      setSlots(
        data.slots.map((s) => ({
          ...s,
          teacherId: s.suggestedTeacherId,
          courseId: s.suggestedCourseId,
          zoneId: null,
          include: true, // admin can untick to skip
        }))
      );
      setStage('REVIEW');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'AI extraction failed');
    } finally {
      setAnalyzing(false);
    }
  };

  // ── Stage 2 helpers ──
  const updateSlot = (idx, patch) => {
    setSlots((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const removeSlot = (idx) => setSlots((prev) => prev.filter((_, i) => i !== idx));

  const validSelectedCount = useMemo(() => slots.filter((s) => s.include).length, [slots]);

  // ── Stage 2 → 3: Persist ──
  const importNow = async () => {
    if (!sectionId) { setError('Please pick a section first'); return; }
    const toImport = slots
      .filter((s) => s.include)
      .map((s) => ({
        day: s.day,
        startTime: s.startTime,
        endTime: s.endTime,
        course: s.course,
        teacher: s.teacher,
        room: s.room,
        isLab: s.isLab,
        teacherId: s.teacherId || null,
        courseId: s.courseId || null,
        zoneId: s.zoneId || null,
      }));
    if (toImport.length === 0) { setError('No slots selected to import'); return; }
    setImporting(true);
    setError('');
    try {
      const res = await slotAPI.importExtracted({
        sectionId: Number(sectionId),
        slots: toImport,
        replaceExisting,
      });
      setImportResult(res.data ?? res);
      setStage('DONE');
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)' }}>
      <motion.div
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-200 dark:border-slate-700"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <Sparkles size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800 dark:text-white">Import Timetable from Image</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {stage === 'UPLOAD' && 'Step 1 of 3 — Upload an image of the timetable'}
                {stage === 'REVIEW' && 'Step 2 of 3 — Review & confirm extracted classes'}
                {stage === 'DONE'   && 'Step 3 of 3 — Import complete'}
              </p>
            </div>
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 p-3 rounded-lg bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-700/50 text-rose-700 dark:text-rose-300 text-sm">
              <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* ─── STAGE 1: UPLOAD ─── */}
          {stage === 'UPLOAD' && (
            <div className="space-y-4">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-violet-300 dark:border-violet-700 rounded-2xl p-10 text-center cursor-pointer hover:bg-violet-50 dark:hover:bg-violet-900/20 transition"
              >
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0])} />
                {previewUrl ? (
                  <div>
                    <img src={previewUrl} alt="preview"
                      className="mx-auto max-h-80 rounded-lg shadow-md object-contain" />
                    <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 font-medium">{file?.name}</p>
                    <p className="text-xs text-slate-400">{((file?.size || 0) / 1024).toFixed(0)} KB — click to change</p>
                  </div>
                ) : (
                  <div>
                    <div className="inline-flex p-4 bg-violet-100 dark:bg-violet-900/40 rounded-2xl mb-3">
                      <Upload size={32} className="text-violet-500" />
                    </div>
                    <p className="text-base font-semibold text-slate-700 dark:text-slate-200">
                      Drop a timetable image here, or click to browse
                    </p>
                    <p className="text-xs text-slate-400 mt-1">JPG, PNG — up to 8 MB</p>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2">
                <button onClick={handleClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                  Cancel
                </button>
                <button
                  onClick={analyze}
                  disabled={!file || analyzing}
                  className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 rounded-xl shadow disabled:opacity-50 disabled:cursor-not-allowed">
                  {analyzing
                    ? <><Loader2 size={16} className="animate-spin" /> Analyzing…</>
                    : <><Sparkles size={16} /> Analyze with AI</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* ─── STAGE 2: REVIEW ─── */}
          {stage === 'REVIEW' && extracted && (
            <div className="space-y-4">
              {/* Detected header */}
              <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700/50">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 uppercase tracking-wider">Detected from image</p>
                    <p className="text-base font-bold text-slate-700 dark:text-slate-100">
                      {extracted.extractedSection?.rawTitle || '(no title detected)'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {extracted.counts.validSlots} of {extracted.counts.rawSlots} slots parsed successfully
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 min-w-[260px]">
                    <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Save into section *</label>
                    <select
                      value={sectionId || ''}
                      onChange={(e) => setSectionId(e.target.value || null)}
                      className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-violet-500"
                    >
                      <option value="">— Select section —</option>
                      {(sections?.length ? sections : extracted.catalog?.sections || []).map((s) => (
                        <option key={s.Section_ID} value={s.Section_ID}>{s.Name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Replace existing checkbox */}
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
                <input type="checkbox" checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="w-4 h-4 rounded accent-rose-600" />
                Replace ALL existing slots in this section before importing (destructive)
              </label>

              {/* Slot table */}
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/60 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="px-3 py-2 text-left w-8"></th>
                      <th className="px-3 py-2 text-left">Day & Time</th>
                      <th className="px-3 py-2 text-left">Course</th>
                      <th className="px-3 py-2 text-left">Teacher</th>
                      <th className="px-3 py-2 text-left">Room</th>
                      <th className="px-3 py-2 text-right w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {slots.map((s, idx) => {
                      const teacherUnmatched = s.teacher && !s.teacherId;
                      const courseUnmatched = s.course && !s.courseId;
                      return (
                        <tr key={idx} className={s.include ? '' : 'opacity-40'}>
                          <td className="px-3 py-2 align-top">
                            <input type="checkbox" checked={s.include}
                              onChange={(e) => updateSlot(idx, { include: e.target.checked })}
                              className="w-4 h-4 rounded accent-violet-600 mt-1" />
                          </td>
                          <td className="px-3 py-2 align-top">
                            <div className="font-semibold text-slate-700 dark:text-slate-200">{DAY_LABEL[s.day] || s.day}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                              <Clock size={11} />
                              <input value={s.startTime}
                                onChange={(e) => updateSlot(idx, { startTime: e.target.value })}
                                className="w-14 bg-transparent border-b border-slate-300 dark:border-slate-600 text-xs focus:outline-none focus:border-violet-500" />
                              –
                              <input value={s.endTime}
                                onChange={(e) => updateSlot(idx, { endTime: e.target.value })}
                                className="w-14 bg-transparent border-b border-slate-300 dark:border-slate-600 text-xs focus:outline-none focus:border-violet-500" />
                            </div>
                            {s.isLab && <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">LAB</span>}
                          </td>
                          <td className="px-3 py-2 align-top min-w-[200px]">
                            <input value={s.course}
                              onChange={(e) => updateSlot(idx, { course: e.target.value })}
                              className="w-full bg-transparent border-b border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500" />
                            <select
                              value={s.courseId || ''}
                              onChange={(e) => updateSlot(idx, { courseId: e.target.value ? Number(e.target.value) : null })}
                              className="mt-1 w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            >
                              <option value="">{courseUnmatched ? '⚠ Pick existing course (or save as text)' : 'Use as plain text'}</option>
                              {(extracted.catalog?.courses || []).map((c) => (
                                <option key={c.Course_ID} value={c.Course_ID}>{c.Code ? `${c.Code} — ` : ''}{c.Name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 align-top min-w-[200px]">
                            <input value={s.teacher || ''}
                              onChange={(e) => updateSlot(idx, { teacher: e.target.value })}
                              placeholder="(no teacher)"
                              className="w-full bg-transparent border-b border-slate-300 dark:border-slate-600 text-sm font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500" />
                            <select
                              value={s.teacherId || ''}
                              onChange={(e) => updateSlot(idx, { teacherId: e.target.value ? Number(e.target.value) : null })}
                              className="mt-1 w-full px-2 py-1 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                            >
                              <option value="">{teacherUnmatched ? '⚠ Pick existing teacher (or save as text)' : 'Use as plain text'}</option>
                              {(extracted.catalog?.teachers || []).map((t) => (
                                <option key={t.Teacher_ID} value={t.Teacher_ID}>{t.Name}</option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 align-top min-w-[120px]">
                            <input value={s.room || ''}
                              onChange={(e) => updateSlot(idx, { room: e.target.value })}
                              placeholder="—"
                              className="w-full bg-transparent border-b border-slate-300 dark:border-slate-600 text-sm text-slate-700 dark:text-slate-200 focus:outline-none focus:border-violet-500" />
                          </td>
                          <td className="px-3 py-2 align-top text-right">
                            <button onClick={() => removeSlot(idx)}
                              className="text-slate-400 hover:text-rose-500 text-xs" title="Remove this row">
                              <X size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {slots.length === 0 && (
                      <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-400 text-sm">All rows removed</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Rows with ⚠ couldn't be matched to existing teachers/courses — pick an existing one from the dropdown,
                or leave it on "plain text" to save the name as-is (you can link it later).
              </p>

              {/* Footer actions */}
              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => { setStage('UPLOAD'); setExtracted(null); setSlots([]); }}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                  ← Back to upload
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={handleClose}
                    className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                    Cancel
                  </button>
                  <button
                    onClick={importNow}
                    disabled={importing || !sectionId || validSelectedCount === 0}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow disabled:opacity-50 disabled:cursor-not-allowed">
                    {importing
                      ? <><Loader2 size={16} className="animate-spin" /> Saving…</>
                      : <><Check size={16} /> Save {validSelectedCount} slot{validSelectedCount !== 1 ? 's' : ''}</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ─── STAGE 3: DONE ─── */}
          {stage === 'DONE' && importResult && (
            <div className="text-center py-8">
              <div className="inline-flex p-4 bg-emerald-100 dark:bg-emerald-900/40 rounded-full mb-4">
                <Check size={36} className="text-emerald-600 dark:text-emerald-400" />
              </div>
              <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">Import complete</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
                Created <strong className="text-emerald-600 dark:text-emerald-400">{importResult.totals.created}</strong>
                {' '}slot(s){importResult.totals.skipped > 0
                  ? <>, skipped <strong className="text-amber-600 dark:text-amber-400">{importResult.totals.skipped}</strong></>
                  : null}.
              </p>

              {importResult.skipped?.length > 0 && (
                <div className="max-w-md mx-auto text-left mb-4">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 uppercase mb-2">Skipped</p>
                  <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-400 max-h-32 overflow-y-auto">
                    {importResult.skipped.map((s, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="text-amber-500">•</span>
                        <span>{s.slot?.day} {s.slot?.startTime} — <em>{s.reason}</em></span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                onClick={() => { onSuccess?.(sectionId); handleClose(); }}
                className="px-6 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl">
                Done
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
