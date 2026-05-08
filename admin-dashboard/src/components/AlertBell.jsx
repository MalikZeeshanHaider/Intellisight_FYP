/**
 * AlertBell — fixed bottom-right floating alert button.
 *
 * States:
 *   idle   → dark button, grey bell
 *   active → blue/cyan glow  (known person just seen by camera)
 *   alert  → red pulse       (unknown face detected)
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiBell, FiX, FiAlertTriangle, FiAlertCircle, FiTrash2, FiExternalLink, FiShield,
} from 'react-icons/fi';
import { useAlerts } from '../context/AlertContext';
import { useNavigate } from 'react-router-dom';

const timeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return new Date(iso).toLocaleDateString();
};

// Colour tokens per status
const TOKEN = {
  idle: {
    fab:     'rgba(20, 26, 54, 0.95)',
    fabBorder: 'rgba(255,255,255,0.12)',
    icon:    '#64748b',
    ring:    null,
    label:   null,
  },
  active: {
    fab:     'rgba(6,56,96,0.95)',
    fabBorder: 'rgba(6,182,212,0.7)',
    icon:    '#06b6d4',
    ring:    'rgba(6,182,212,0.35)',
    label:   'LIVE',
  },
  alert: {
    fab:     'rgba(60,10,10,0.97)',
    fabBorder: 'rgba(239,68,68,0.8)',
    icon:    '#ef4444',
    ring:    'rgba(239,68,68,0.4)',
    label:   'ALERT',
  },
};

export default function AlertBell() {
  const { alerts, unread, status, markAllRead, dismiss, clearAll } = useAlerts();
  const [open, setOpen]   = useState(false);
  const ref               = useRef(null);
  const navigate          = useNavigate();

  const tk = TOKEN[status] || TOKEN.idle;

  // Close on outside click
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = () => {
    setOpen((v) => !v);
    if (!open) markAllRead();
  };

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-[9000] flex flex-col items-end gap-0">

      {/* ── Alert Panel (opens upward) ──────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit  ={{ opacity: 0, y: 16, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="mb-3 w-80 rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background:    'rgba(10, 14, 39, 0.97)',
              border:        '1px solid rgba(255,255,255,0.1)',
              backdropFilter:'blur(24px)',
              boxShadow:     '0 8px 48px rgba(0,0,0,0.6)',
            }}
          >
            {/* Panel header */}
            <div
              className="flex items-center justify-between px-4 py-3"
              style={{ borderBottom: '1px solid rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <FiShield size={14} style={{ color: status === 'alert' ? '#ef4444' : '#06b6d4' }} />
                <span className="text-sm font-bold" style={{ color: '#f1f5f9' }}>
                  Security Alerts
                  {alerts.length > 0 && (
                    <span className="ml-1.5 text-xs font-normal" style={{ color: '#94a3b8' }}>
                      ({alerts.length})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                {alerts.length > 0 && (
                  <button
                    onClick={clearAll}
                    className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all hover:bg-white/5"
                    style={{ color: '#64748b' }}
                  >
                    <FiTrash2 size={10} /> Clear
                  </button>
                )}
                <button
                  onClick={() => { setOpen(false); navigate('/unknown-faces'); }}
                  className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg transition-all"
                  style={{ color: '#06b6d4', background: 'rgba(6,182,212,0.08)' }}
                >
                  <FiExternalLink size={10} /> View all
                </button>
                <button
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-center w-6 h-6 rounded-lg transition-all hover:bg-white/10"
                  style={{ color: '#64748b' }}
                >
                  <FiX size={13} />
                </button>
              </div>
            </div>

            {/* Alert list */}
            <div className="overflow-y-auto" style={{ maxHeight: 320 }}>
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    <FiBell size={18} style={{ color: '#334155' }} />
                  </div>
                  <p className="text-xs" style={{ color: '#475569' }}>No alerts right now</p>
                </div>
              ) : (
                alerts.map((alert) => {
                  const isError = alert.severity === 'error';
                  return (
                    <div
                      key={alert.id}
                      className="group flex items-start gap-3 px-4 py-3 transition-all cursor-default"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      {/* Status dot */}
                      <div
                        className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center"
                        style={{
                          background: isError ? 'rgba(239,68,68,0.15)' : 'rgba(239,68,68,0.12)',
                          border:     isError ? '1px solid rgba(239,68,68,0.4)' : '1px solid rgba(251,191,36,0.3)',
                        }}
                      >
                        {isError
                          ? <FiAlertCircle  size={13} style={{ color: '#ef4444' }} />
                          : <FiAlertTriangle size={13} style={{ color: '#f59e0b' }} />}
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium leading-snug" style={{ color: '#e2e8f0' }}>
                          {alert.message}
                        </p>
                        <p className="text-[11px] mt-0.5" style={{ color: '#475569' }}>
                          {timeAgo(alert.timestamp)}
                        </p>
                      </div>

                      {/* Dismiss */}
                      <button
                        onClick={() => dismiss(alert.id)}
                        className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-white/5"
                        style={{ color: '#475569' }}
                      >
                        <FiX size={12} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Panel footer — status bar */}
            <div
              className="px-4 py-2 flex items-center gap-2"
              style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  background: status === 'alert' ? '#ef4444' : status === 'active' ? '#06b6d4' : '#334155',
                  boxShadow:  status !== 'idle' ? `0 0 6px ${status === 'alert' ? '#ef4444' : '#06b6d4'}` : 'none',
                }}
              />
              <span className="text-[11px]" style={{ color: '#475569' }}>
                {status === 'alert'  ? 'Unknown activity detected'
                  : status === 'active' ? 'Camera feed active'
                  : 'Monitoring active'}
              </span>
              <span className="ml-auto text-[10px]" style={{ color: '#1e293b' }}>
                Polls every 15s
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── FAB Button ────────────────────────────────────────────────── */}
      <div className="relative">
        {/* Outer pulse ring — only when active or alert */}
        {status !== 'idle' && (
          <span
            className="absolute inset-0 rounded-2xl animate-ping"
            style={{
              background: tk.ring,
              opacity: 0.5,
              animationDuration: status === 'alert' ? '1s' : '2s',
            }}
          />
        )}

        <motion.button
          whileHover={{ scale: 1.07 }}
          whileTap={{ scale: 0.94 }}
          onClick={toggle}
          className="relative flex items-center gap-2.5 px-4 h-12 rounded-2xl font-semibold text-sm shadow-2xl transition-all"
          style={{
            background:    tk.fab,
            border:        `1px solid ${tk.fabBorder}`,
            color:         tk.icon,
            boxShadow:     status !== 'idle'
              ? `0 0 24px ${tk.ring}, 0 8px 32px rgba(0,0,0,0.5)`
              : '0 8px 32px rgba(0,0,0,0.5)',
            minWidth: 48,
          }}
          title="Security Alerts"
        >
          {/* Bell icon — shake when new alert arrives */}
          <motion.div
            animate={status === 'alert' ? { rotate: [0, -15, 15, -10, 10, 0] } : {}}
            transition={{ repeat: status === 'alert' ? Infinity : 0, repeatDelay: 3, duration: 0.5 }}
          >
            <FiBell size={20} />
          </motion.div>

          {/* Label (LIVE / ALERT) */}
          <AnimatePresence mode="wait">
            {tk.label && (
              <motion.span
                key={tk.label}
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: 'auto' }}
                exit={{ opacity: 0, width: 0 }}
                className="text-xs font-bold tracking-widest overflow-hidden whitespace-nowrap"
                style={{ color: tk.icon }}
              >
                {tk.label}
              </motion.span>
            )}
          </AnimatePresence>

          {/* Unread badge */}
          {unread > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 flex items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: '#ef4444', padding: '0 4px', boxShadow: '0 2px 8px rgba(239,68,68,0.6)' }}
            >
              {unread > 99 ? '99+' : unread}
            </motion.span>
          )}
        </motion.button>
      </div>
    </div>
  );
}
