/**
 * GrantAccessModal
 * Lets a non-SuperAdmin request access to permissions they don't yet have.
 * Shows only permissions the user is missing, grouped by category.
 */
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiX, FiShield, FiSend, FiCheck, FiClock, FiXCircle,
} from 'react-icons/fi';
import { rolesAPI, accessRequestAPI } from '../api/api';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

const CAT_COLORS = {
  General:             'rgba(99,102,241,.7)',
  Monitoring:          'rgba(6,182,212,.7)',
  'People Management': 'rgba(34,197,94,.7)',
  Infrastructure:      'rgba(251,146,60,.7)',
  System:              'rgba(168,85,247,.7)',
};

const STATUS_ICON = {
  pending:  { icon: FiClock,   color: '#f59e0b', label: 'Pending' },
  approved: { icon: FiCheck,   color: '#22c55e', label: 'Approved' },
  rejected: { icon: FiXCircle, color: '#ef4444', label: 'Rejected' },
};

export default function GrantAccessModal({ open, onClose }) {
  const { user, hasPermission } = useAuth();
  const { isDarkMode }           = useTheme();

  const [allPerms,    setAllPerms]    = useState([]);
  const [myRequests,  setMyRequests]  = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [submitting,  setSubmitting]  = useState(false);
  const [checked,     setChecked]     = useState(new Set());
  const [message,     setMessage]     = useState('');
  const [flash,       setFlash]       = useState(null); // { type: 'ok'|'err', text }

  const D = isDarkMode;

  // Load available permissions + my existing requests
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      rolesAPI.listPermissions(),
      accessRequestAPI.getMyRequests(),
    ]).then(([permsRes, myRes]) => {
      setAllPerms(permsRes.data ?? []);
      setMyRequests(myRes.data ?? []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  // Permissions the user does NOT already have
  const missingPerms = useMemo(
    () => allPerms.filter((p) => !hasPermission(p.Key)),
    [allPerms, hasPermission],
  );

  // Permissions grouped by category
  const byCategory = useMemo(() => {
    const map = {};
    for (const p of missingPerms) (map[p.Category] ??= []).push(p);
    return map;
  }, [missingPerms]);

  // Map of key → latest request status
  const requestStatusMap = useMemo(() => {
    const map = {};
    for (const r of myRequests) {
      if (!map[r.Permission_Key] || new Date(r.RequestedAt) > new Date(map[r.Permission_Key].RequestedAt)) {
        map[r.Permission_Key] = r;
      }
    }
    return map;
  }, [myRequests]);

  const showFlash = (type, text) => {
    setFlash({ type, text });
    setTimeout(() => setFlash(null), 4000);
  };

  const toggle = (key) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!checked.size) return;
    try {
      setSubmitting(true);
      await accessRequestAPI.submit([...checked], message);
      // Refresh my requests
      const res = await accessRequestAPI.getMyRequests();
      setMyRequests(res.data ?? []);
      setChecked(new Set());
      setMessage('');
      showFlash('ok', 'Request submitted! The admin will review it shortly.');
    } catch (err) {
      showFlash('err', err.response?.data?.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  // ── Styles ────────────────────────────────────────────────────────────────
  const overlay = 'fixed inset-0 z-[9999] flex items-center justify-center p-4';
  const panel   = 'w-full max-w-xl max-h-[90vh] flex flex-col rounded-2xl overflow-hidden';
  const bg      = D ? 'rgba(10,14,39,.98)' : 'rgba(248,250,252,.98)';
  const border  = D ? '1px solid rgba(6,182,212,.25)' : '1px solid rgba(59,130,246,.25)';
  const textMain = D ? '#e2e8f0' : '#0f172a';
  const textMuted= D ? '#94a3b8' : '#64748b';
  const divider  = D ? '1px solid rgba(255,255,255,.07)' : '1px solid rgba(15,23,42,.1)';
  const inputBg  = D ? 'rgba(255,255,255,.06)' : 'rgba(241,245,249,.9)';

  return (
    <AnimatePresence>
      {open && (
        <div
          className={overlay}
          style={{ background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: .94, y: 16 }}
            animate={{ opacity: 1, scale: 1,   y: 0  }}
            exit  ={{ opacity: 0, scale: .94, y: 16 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className={panel}
            style={{ background: bg, border, boxShadow: '0 24px 80px rgba(0,0,0,.55)', backdropFilter: 'blur(24px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* ── Header ─────────────────────────────────────────────── */}
            <div className="flex items-center justify-between px-6 py-4 flex-shrink-0" style={{ borderBottom: divider }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: D ? 'rgba(6,182,212,.12)' : 'rgba(59,130,246,.12)',
                    border: D ? '1px solid rgba(6,182,212,.3)' : '1px solid rgba(59,130,246,.3)' }}>
                  <FiShield size={18} style={{ color: D ? '#67e8f9' : '#3b82f6' }} />
                </div>
                <div>
                  <h2 className="font-bold text-base" style={{ color: textMain }}>Request Access</h2>
                  <p className="text-xs" style={{ color: textMuted }}>Select permissions to request from admin</p>
                </div>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl transition-colors"
                style={{ color: textMuted }}
                onMouseEnter={(e) => e.currentTarget.style.background = D ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <FiX size={18} />
              </button>
            </div>

            {/* ── Flash ──────────────────────────────────────────────── */}
            <AnimatePresence>
              {flash && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-6 py-3 text-sm flex items-center gap-2"
                  style={{
                    background: flash.type === 'ok' ? 'rgba(34,197,94,.1)' : 'rgba(239,68,68,.1)',
                    borderBottom: divider,
                    color: flash.type === 'ok' ? (D ? '#86efac' : '#15803d') : (D ? '#fca5a5' : '#dc2626'),
                  }}>
                  {flash.type === 'ok' ? <FiCheck size={15} /> : <FiX size={15} />}
                  {flash.text}
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Body ───────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div style={{ width: 32, height: 32, borderRadius: '50%',
                    border: '3px solid rgba(6,182,212,.2)', borderTopColor: '#06b6d4',
                    animation: 'spin .8s linear infinite' }} />
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </div>
              ) : missingPerms.length === 0 ? (
                <div className="text-center py-12">
                  <FiShield size={40} className="mx-auto mb-3" style={{ color: textMuted, opacity: .4 }} />
                  <p className="text-sm font-medium" style={{ color: textMain }}>You have full access</p>
                  <p className="text-xs mt-1" style={{ color: textMuted }}>No additional permissions available to request</p>
                </div>
              ) : (
                <>
                  {/* Permission groups */}
                  {Object.entries(byCategory).map(([cat, perms]) => (
                    <div key={cat}>
                      <p className="text-xs font-bold uppercase tracking-widest mb-2"
                        style={{ color: CAT_COLORS[cat] ?? textMuted }}>
                        {cat}
                      </p>
                      <div className="space-y-2">
                        {perms.map((perm) => {
                          const isChecked = checked.has(perm.Key);
                          const reqStatus = requestStatusMap[perm.Key];
                          const StatusIcon = reqStatus ? STATUS_ICON[reqStatus.Status] : null;
                          return (
                            <label
                              key={perm.Key}
                              className="flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-all duration-150"
                              style={{
                                background: isChecked
                                  ? (D ? 'rgba(6,182,212,.1)' : 'rgba(59,130,246,.08)')
                                  : (D ? 'rgba(255,255,255,.03)' : 'rgba(0,0,0,.03)'),
                                border: isChecked
                                  ? (D ? '1px solid rgba(6,182,212,.3)' : '1px solid rgba(59,130,246,.3)')
                                  : (D ? '1px solid rgba(255,255,255,.06)' : '1px solid rgba(0,0,0,.07)'),
                              }}
                            >
                              {/* Custom checkbox */}
                              <div className="mt-0.5 w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center transition-all"
                                style={{
                                  background: isChecked
                                    ? (D ? '#06b6d4' : '#3b82f6')
                                    : (D ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)'),
                                  border: `2px solid ${isChecked ? (D ? '#06b6d4' : '#3b82f6') : (D ? 'rgba(255,255,255,.2)' : 'rgba(0,0,0,.2)')}`,
                                }}>
                                {isChecked && <FiCheck size={11} style={{ color: '#fff', strokeWidth: 3 }} />}
                              </div>
                              <input type="checkbox" className="sr-only" checked={isChecked} onChange={() => toggle(perm.Key)} />
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold" style={{ color: textMain }}>{perm.Name}</p>
                                {perm.Description && (
                                  <p className="text-xs mt-0.5" style={{ color: textMuted }}>{perm.Description}</p>
                                )}
                              </div>
                              {/* Prior request status badge */}
                              {StatusIcon && (
                                <div className="flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-lg"
                                  style={{ background: `${StatusIcon.color}18`, border: `1px solid ${StatusIcon.color}44` }}>
                                  <StatusIcon.icon size={11} style={{ color: StatusIcon.color }} />
                                  <span className="text-[10px] font-semibold" style={{ color: StatusIcon.color }}>
                                    {StatusIcon.label}
                                  </span>
                                </div>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}

                  {/* Optional message */}
                  <div>
                    <label className="block text-xs font-semibold mb-2" style={{ color: textMuted }}>
                      Message to Admin (optional)
                    </label>
                    <textarea
                      rows={3}
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Briefly explain why you need this access…"
                      className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                      style={{ background: inputBg,
                        border: D ? '1px solid rgba(255,255,255,.1)' : '1px solid rgba(0,0,0,.12)',
                        color: textMain, outline: 'none' }}
                    />
                  </div>
                </>
              )}
            </div>

            {/* ── Footer ─────────────────────────────────────────────── */}
            {missingPerms.length > 0 && !loading && (
              <div className="px-6 py-4 flex items-center gap-3 flex-shrink-0" style={{ borderTop: divider }}>
                <button onClick={onClose}
                  className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
                  style={{ background: D ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.05)',
                    border: D ? '1px solid rgba(255,255,255,.1)' : '1px solid rgba(0,0,0,.1)',
                    color: textMuted }}>
                  Cancel
                </button>
                <motion.button
                  whileHover={{ scale: 1.02 }} whileTap={{ scale: .98 }}
                  onClick={handleSubmit}
                  disabled={!checked.size || submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-40"
                  style={{ background: D ? 'rgba(6,182,212,.15)' : 'rgba(59,130,246,.15)',
                    border: D ? '1px solid rgba(6,182,212,.4)' : '1px solid rgba(59,130,246,.4)',
                    color: D ? '#67e8f9' : '#2563eb' }}>
                  <FiSend size={14} />
                  {submitting ? 'Sending…' : `Send Request${checked.size > 1 ? ` (${checked.size})` : ''}`}
                </motion.button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
