/**
 * AlertToast — auto-dismissing bottom-right slide-in toast for new alerts.
 * Appears just above the AlertBell FAB (bottom-20 offset).
 */
import React, { useState, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { FiAlertTriangle, FiX } from 'react-icons/fi';
import { useAlerts } from '../context/AlertContext';

export default function AlertToast() {
  const { alerts } = useAlerts();
  const [visible, setVisible] = useState(null);
  const shownIds = useRef(new Set());
  const timer    = useRef(null);

  useEffect(() => {
    const latest = alerts[0];
    if (!latest || shownIds.current.has(latest.id)) return;
    shownIds.current.add(latest.id);

    clearTimeout(timer.current);
    setVisible(latest);
    timer.current = setTimeout(() => setVisible(null), 5000);

    return () => clearTimeout(timer.current);
  }, [alerts]);

  return (
    <div className="fixed bottom-24 right-6 z-[8999] pointer-events-none">
      <AnimatePresence>
        {visible && (
          <motion.div
            key={visible.id}
            initial={{ opacity: 0, x: 60, scale: 0.95 }}
            animate={{ opacity: 1, x: 0,  scale: 1    }}
            exit  ={{ opacity: 0, x: 60, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
            className="pointer-events-auto flex items-start gap-3 pl-4 pr-3 py-3 rounded-2xl max-w-[280px]"
            style={{
              background:    'rgba(10, 14, 39, 0.97)',
              border:        '1px solid rgba(239,68,68,0.5)',
              backdropFilter:'blur(20px)',
              boxShadow:     '0 0 24px rgba(239,68,68,0.25), 0 8px 32px rgba(0,0,0,0.5)',
            }}
          >
            {/* Icon */}
            <div className="flex-shrink-0 mt-0.5 w-7 h-7 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
              <FiAlertTriangle size={13} style={{ color: '#ef4444' }} />
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold mb-0.5 uppercase tracking-wider" style={{ color: '#ef4444' }}>
                Security Alert
              </p>
              <p className="text-xs leading-snug" style={{ color: '#cbd5e1' }}>
                {visible.message}
              </p>
            </div>

            {/* Close */}
            <button
              onClick={() => { clearTimeout(timer.current); setVisible(null); }}
              className="flex-shrink-0 mt-0.5 p-1 rounded-lg transition-all hover:bg-white/5"
              style={{ color: '#475569' }}
            >
              <FiX size={13} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
