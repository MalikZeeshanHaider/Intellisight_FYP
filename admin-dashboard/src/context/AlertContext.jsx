import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/api';

const AlertContext = createContext(null);

const POLL_MS   = 15000;
const STREAM_BASE = import.meta.env.VITE_STREAM_BASE_URL || 'http://localhost:5001';
const WS_URL    = STREAM_BASE.replace(/^http/, 'ws') + '/ws/events';
const MAX_ALERTS = 50;
const ACTIVE_TTL = 8000; // ms to stay "active/blue" after a known-person detection

export const AlertProvider = ({ children }) => {
  const [alerts, setAlerts]   = useState([]);
  const [unread, setUnread]   = useState(0);
  // status: 'idle' | 'active' (known person — blue) | 'alert' (unknown — red)
  const [status, setStatus]   = useState('idle');

  const seenIds     = useRef(new Set());
  const wsRef       = useRef(null);
  const pollTimer   = useRef(null);
  const activeTimer = useRef(null); // resets status back to idle after ACTIVE_TTL

  // ── Push new alerts, deduplicate ─────────────────────────────────────────
  const pushAlerts = useCallback((incoming) => {
    const fresh = incoming.filter((a) => !seenIds.current.has(a.id));
    if (!fresh.length) return;
    fresh.forEach((a) => seenIds.current.add(a.id));
    setAlerts((prev) => [...fresh, ...prev].slice(0, MAX_ALERTS));
    setUnread((n) => n + fresh.length);
    // any new alert → at minimum "alert" (red)
    setStatus('alert');
  }, []);

  // ── Trigger blue "active" state briefly (known person seen) ──────────────
  const triggerActive = useCallback(() => {
    setStatus((prev) => {
      // don't downgrade red → blue
      if (prev === 'alert') return prev;
      return 'active';
    });
    clearTimeout(activeTimer.current);
    activeTimer.current = setTimeout(() => {
      setStatus((prev) => (prev === 'active' ? 'idle' : prev));
    }, ACTIVE_TTL);
  }, []);

  // ── Poll backend for persisted unknown-face records ───────────────────────
  const poll = useCallback(async () => {
    try {
      const res = await api.get('/zones/recent-alerts');
      const incoming = res.data?.data?.alerts || [];
      if (incoming.length) pushAlerts(incoming);
    } catch { /* ignore */ }
  }, [pushAlerts]);

  useEffect(() => {
    poll();
    pollTimer.current = setInterval(poll, POLL_MS);
    return () => clearInterval(pollTimer.current);
  }, [poll]);

  // ── Python WebSocket — real-time events ──────────────────────────────────
  useEffect(() => {
    let reconnectTimer = null;

    const connect = () => {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => ws.send(JSON.stringify({ type: 'subscribe', camera_ids: [] }));

        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);

            if (msg.type === 'detection') {
              const dets = msg.detections || [];
              const hasUnknown   = dets.some((d) => d.person?.recognized === false);
              const hasRecognized = dets.some((d) => d.person?.recognized === true);

              if (hasUnknown) {
                const now = new Date().toISOString();
                const wsAlerts = dets
                  .filter((d) => d.person?.recognized === false)
                  .map((_, i) => ({
                    id:       `ws_${msg.camera_id}_${msg.timestamp}_${i}`,
                    type:     'UNKNOWN_FACE',
                    severity: 'warning',
                    message:  `Unknown face detected by Camera ${msg.camera_id}`,
                    zoneName: `Camera ${msg.camera_id}`,
                    timestamp: now,
                    status:   'PENDING',
                  }));
                pushAlerts(wsAlerts);
              } else if (hasRecognized) {
                triggerActive();
              }
            }

            if (msg.type === 'camera_status' &&
                (msg.status === 'offline' || msg.status === 'error')) {
              pushAlerts([{
                id:       `cam_${msg.camera_id}_${Date.now()}`,
                type:     'CAMERA_ISSUE',
                severity: 'error',
                message:  `Camera ${msg.camera_id} is ${msg.status}${msg.message ? ': ' + msg.message : ''}`,
                zoneName: `Camera ${msg.camera_id}`,
                timestamp: new Date().toISOString(),
                status:   msg.status,
              }]);
            }
          } catch { /* malformed JSON */ }
        };

        ws.onerror  = () => {};
        ws.onclose  = () => { reconnectTimer = setTimeout(connect, 10000); };
      } catch {
        reconnectTimer = setTimeout(connect, 10000);
      }
    };

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [pushAlerts, triggerActive]);

  const markAllRead = useCallback(() => {
    setUnread(0);
    setStatus('idle');
  }, []);

  const dismiss = useCallback((id) => {
    setAlerts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      if (!next.length) setStatus('idle');
      return next;
    });
    setUnread((n) => Math.max(0, n - 1));
  }, []);

  const clearAll = useCallback(() => {
    setAlerts([]);
    setUnread(0);
    setStatus('idle');
  }, []);

  return (
    <AlertContext.Provider value={{ alerts, unread, status, markAllRead, dismiss, clearAll }}>
      {children}
    </AlertContext.Provider>
  );
};

export const useAlerts = () => {
  const ctx = useContext(AlertContext);
  if (!ctx) throw new Error('useAlerts must be used within AlertProvider');
  return ctx;
};
