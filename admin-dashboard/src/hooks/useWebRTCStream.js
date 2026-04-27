/**
 * useWebRTCStream — plays a MediaMTX WebRTC (WHEP) stream into a <video>.
 *
 * WHEP = WebRTC-HTTP Egress Protocol. The handshake is:
 *   1. Create an RTCPeerConnection (recvonly — browser only receives).
 *   2. Call createOffer() → get an SDP offer.
 *   3. POST the offer to <whepUrl> as "application/sdp".
 *   4. Server responds 201 with an SDP answer (+ a Location header for DELETE).
 *   5. setRemoteDescription(answer) → tracks arrive on pc.ontrack → attach to <video>.
 *
 * MediaMTX's WHEP endpoint for a camera path is:
 *   http://<host>:8889/cam<id>/whep
 *
 * Lifecycle:
 *   - returns { videoRef, state, error }
 *     state: "idle" | "connecting" | "playing" | "error" | "stopped"
 *   - Cleans up the PC and the WHEP session (DELETE Location) on unmount.
 */

import { useEffect, useRef, useState } from 'react';

export function useWebRTCStream(whepUrl, enabled = true) {
  const videoRef    = useRef(null);
  const pcRef       = useRef(null);
  const locationRef = useRef(null);

  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!enabled || !whepUrl) {
      setState('idle');
      return;
    }

    let cancelled = false;
    setError(null);
    setState('connecting');

    const pc = new RTCPeerConnection({
      iceServers: [],          // MediaMTX can work with no STUN on LAN
      bundlePolicy: 'max-bundle',
    });
    pcRef.current = pc;

    // Incoming video/audio tracks → attach to <video>.
    pc.ontrack = (ev) => {
      if (videoRef.current && ev.streams && ev.streams[0]) {
        videoRef.current.srcObject = ev.streams[0];
      }
    };

    pc.onconnectionstatechange = () => {
      if (cancelled) return;
      const s = pc.connectionState;
      if (s === 'connected')    setState('playing');
      else if (s === 'failed')  { setState('error'); setError('WebRTC failed'); }
      else if (s === 'closed' || s === 'disconnected') setState('stopped');
    };

    // Browser only receives — tell the SDP we want recv-only transceivers.
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.addTransceiver('audio', { direction: 'recvonly' });

    (async () => {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Wait for ICE gathering to complete so the SDP contains candidates
        // (MediaMTX's WHEP expects a complete offer, no trickle ICE).
        await new Promise((resolve) => {
          if (pc.iceGatheringState === 'complete') return resolve();
          const check = () => {
            if (pc.iceGatheringState === 'complete') {
              pc.removeEventListener('icegatheringstatechange', check);
              resolve();
            }
          };
          pc.addEventListener('icegatheringstatechange', check);
          // Hard cap so we don't hang forever if a candidate stalls
          setTimeout(resolve, 2000);
        });

        if (cancelled) return;

        const res = await fetch(whepUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/sdp' },
          body: pc.localDescription.sdp,
        });
        if (!res.ok) {
          throw new Error(`WHEP handshake failed: ${res.status}`);
        }
        locationRef.current = res.headers.get('Location');
        const answer = await res.text();
        if (cancelled) return;

        await pc.setRemoteDescription({ type: 'answer', sdp: answer });
      } catch (e) {
        if (!cancelled) {
          setError(e.message || String(e));
          setState('error');
        }
      }
    })();

    return () => {
      cancelled = true;
      try {
        // Best-effort: tell MediaMTX to tear down the WHEP session.
        if (locationRef.current) {
          fetch(locationRef.current, { method: 'DELETE' }).catch(() => {});
          locationRef.current = null;
        }
      } catch { /* noop */ }
      try { pc.close(); } catch { /* noop */ }
      pcRef.current = null;
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [whepUrl, enabled]);

  return { videoRef, state, error };
}
