import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Users, Check } from 'lucide-react';
import { sectionAPI } from '../../api/attendance';

export default function SectionManager({ sections, selectedId, onSelect, onCreated }) {
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ Name: '', Department: '', Semester: '', Shift: 'Morning' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.Name.trim()) { setError('Section name is required'); return; }
    setSaving(true);
    setError('');
    try {
      const res = await sectionAPI.create(form);
      const created = res.data ?? res;
      onCreated(created);
      setCreating(false);
      setForm({ Name: '', Department: '', Semester: '', Shift: 'Morning' });
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to create section');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Section selector */}
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1 mb-1">
            <Users size={11} /> Section
          </label>
          <select
            value={selectedId || ''}
            onChange={e => onSelect(e.target.value ? parseInt(e.target.value) : null)}
            className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2.5 focus:ring-2 focus:ring-sky-400 focus:border-transparent outline-none"
          >
            <option value="">— Select a section —</option>
            {sections.map(s => (
              <option key={s.Section_ID} value={s.Section_ID}>
                {s.Name}{s.Semester ? ` — Sem ${s.Semester}` : ''}{s.Shift ? ` (${s.Shift})` : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="pt-5">
          <button
            onClick={() => setCreating(!creating)}
            className={`p-2.5 rounded-xl border transition-colors ${
              creating
                ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-200 dark:border-rose-700 text-rose-500'
                : 'bg-sky-50 dark:bg-sky-900/30 border-sky-200 dark:border-sky-700 text-sky-600 dark:text-sky-400 hover:bg-sky-100 dark:hover:bg-sky-900/50'
            }`}
            title={creating ? 'Cancel' : 'Create new section'}
          >
            {creating ? <X size={16} /> : <Plus size={16} />}
          </button>
        </div>
      </div>

      {/* Inline create form */}
      <AnimatePresence>
        {creating && (
          <motion.form
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            onSubmit={handleCreate}
            className="overflow-hidden"
          >
            <div className="bg-sky-50/50 dark:bg-sky-900/20 border border-sky-100 dark:border-sky-800/40 rounded-xl p-4 space-y-3">
              <p className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-widest">
                New Section
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <input
                    type="text"
                    value={form.Name}
                    onChange={e => { setForm(f => ({ ...f, Name: e.target.value })); setError(''); }}
                    placeholder="e.g. BSIT-VIII-A"
                    className="w-full text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
                  />
                </div>
                <input
                  type="text"
                  value={form.Department}
                  onChange={e => setForm(f => ({ ...f, Department: e.target.value }))}
                  placeholder="Department"
                  className="text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
                />
                <input
                  type="text"
                  value={form.Semester}
                  onChange={e => setForm(f => ({ ...f, Semester: e.target.value }))}
                  placeholder="Semester (e.g. 8th)"
                  className="text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
                />
                <select
                  value={form.Shift}
                  onChange={e => setForm(f => ({ ...f, Shift: e.target.value }))}
                  className="text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 px-3 py-2 focus:ring-2 focus:ring-sky-400 outline-none"
                >
                  <option value="Morning">Shift-I (Morning)</option>
                  <option value="Evening">Shift-II (Evening)</option>
                </select>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center justify-center gap-2 bg-sky-500 hover:bg-sky-600 disabled:opacity-60 text-white text-sm font-semibold rounded-xl py-2 transition-colors"
                >
                  <Check size={14} /> {saving ? 'Creating…' : 'Create'}
                </button>
              </div>
              {error && (
                <p className="text-xs text-rose-500 font-medium">{error}</p>
              )}
            </div>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
