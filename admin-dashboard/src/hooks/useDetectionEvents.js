/**
 * useDetectionEvents — single shared WebSocket to the Python /ws/events endpoint.
 *
 * One connection per browser tab. Components declare which camera IDs they
 * care about; the hook refs-counts subscriptions so the same camera can be
 * used by multiple <DetectionOverlay> instances without duplicate subscribe
 * messages. Detection events are exposed as a "latest event per camera" map,
 * re-rendered only when a new event arrives for a subscribed camera.
 *
 * Usage:
 *   const events = useDetectionEvents([camera.Camara_Id]);
 *   const ev = events[camera.Camara_Id];   // { timestamp, frame_size, detections }
 *
 * Reconnects with capped backoff if the WS drops.
 */

import { useEffect, useRef, useSyncExternalStore } from 'react';
import { streamAPI } from '../api/api';

// ── Singleton store (one per page) ───────────────────────────────────────────
const store = (() => {
  let ws = null;
  let state = {};                     // { [cameraId]: event }
  const listeners = new Set();
  const refCounts = new Map();        // cameraId → number of mounted hooks
  let reconnectAttempt = 0;
  let reconnectTimer = null;
  let closed = false;

  const emit = () => listeners.forEach((l) => l());

  const sendSet = () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: 'set',
        camera_ids: Array.from(refCounts.keys()),
      }));
    }
  };

  const connect = () => {
    if (closed) return;
    const url = streamAPI.getEventsWsUrl();
    ws = new WebSocket(url);

    ws.onopen = () => {
      reconnectAttempt = 0;
      sendSet();                      // restore subscriptions after reconnect
    };
    ws.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); } catch { return; }
      if (msg.type === 'detection') {
        state = { ...state, [msg.camera_id]: msg };
        emit();
      }
      // hello / camera_status are ignored here — extend if needed.
    };
    ws.onerror = () => { /* onclose will fire */ };
    ws.onclose = () => {
      ws = null;
      if (closed) return;
      const delay = Math.min(500 * 2 ** reconnectAttempt, 10_000);
      reconnectAttempt += 1;
      reconnectTimer = setTimeout(connect, delay);
    };
  };

  const ensureConnected = () => {
    if (!ws && !reconnectTimer) connect();
  };

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() { return state; },

    addCameras(ids) {
      ids.forEach((id) => {
        refCounts.set(id, (refCounts.get(id) || 0) + 1);
      });
      ensureConnected();
      sendSet();
    },
    removeCameras(ids) {
      ids.forEach((id) => {
        const n = (refCounts.get(id) || 0) - 1;
        if (n <= 0) refCounts.delete(id);
        else refCounts.set(id, n);
      });
      sendSet();
    },
  };
})();

export function useDetectionEvents(cameraIds) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot);

  // Ref-counted subscription — stable across re-renders of the same IDs.
  const lastIdsRef = useRef([]);
  useEffect(() => {
    const ids = cameraIds.filter((id) => id !== undefined && id !== null);
    store.addCameras(ids);
    lastIdsRef.current = ids;
    return () => store.removeCameras(lastIdsRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraIds.join('|')]);

  return snapshot;
}
