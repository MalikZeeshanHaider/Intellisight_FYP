/**
 * DetectionOverlay — absolutely-positioned canvas that draws AI bboxes on top
 * of a WebRTC <video>. Subscribes to the detection event stream for one camera
 * and redraws on requestAnimationFrame.
 *
 * Overlay strategy:
 *   • Each draw uses the MOST RECENT event received for this camera.
 *   • If the event is older than DECAY_MS (500ms), the canvas is cleared —
 *     no stale boxes left on screen after the person walks out of frame.
 *   • Alpha fades linearly over the last FADE_MS (200ms) of the decay window
 *     so boxes disappear smoothly rather than pop.
 *
 * Coordinate scaling:
 *   The event carries frame_size = {w, h} describing the resolution the AI
 *   processed. We scale bbox coords to the rendered video element size so the
 *   overlay lines up regardless of the <video> CSS size.
 *
 * Props:
 *   cameraId      — number, the camera whose events to draw
 *   videoRef      — ref of the <video> element this overlay sits on top of
 *   events        — map returned by useDetectionEvents (so parent controls subs)
 */

import { useEffect, useRef } from 'react';

const DECAY_MS = 500;     // events older than this → nothing drawn
const FADE_MS  = 200;     // linear alpha fade over the last FADE_MS of decay

export default function DetectionOverlay({ cameraId, videoRef, events }) {
  const canvasRef = useRef(null);
  const rafRef    = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    const video  = videoRef.current;
    if (!canvas || !video) return;

    const ctx = canvas.getContext('2d');

    const resize = () => {
      // Use the video's rendered size as the canvas pixel size so
      // drawing coordinates = CSS pixels on the overlay.
      const rect = video.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const dpr = window.devicePixelRatio || 1;
      canvas.width  = Math.round(rect.width  * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width  = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const ro = new ResizeObserver(resize);
    ro.observe(video);
    resize();

    const draw = () => {
      rafRef.current = requestAnimationFrame(draw);

      const w = parseFloat(canvas.style.width)  || canvas.width;
      const h = parseFloat(canvas.style.height) || canvas.height;
      ctx.clearRect(0, 0, w, h);

      const ev = events[cameraId];
      if (!ev) return;

      const age = Date.now() - ev.timestamp;
      if (age > DECAY_MS) return;      // too stale — nothing to draw

      const alpha = age <= DECAY_MS - FADE_MS
        ? 1.0
        : Math.max(0, (DECAY_MS - age) / FADE_MS);

      const src = ev.frame_size || { w: 1280, h: 720 };
      const sx  = w / src.w;
      const sy  = h / src.h;

      ctx.globalAlpha = alpha;
      ctx.lineWidth   = 2;
      ctx.font        = '600 13px system-ui, sans-serif';
      ctx.textBaseline = 'bottom';

      for (const d of ev.detections || []) {
        const bx = d.bbox.x * sx;
        const by = d.bbox.y * sy;
        const bw = d.bbox.w * sx;
        const bh = d.bbox.h * sy;

        const recognized = !!d.person?.recognized;
        const color = recognized ? '#22c55e' : '#ef4444';

        ctx.strokeStyle = color;
        ctx.strokeRect(bx, by, bw, bh);

        const label = recognized
          ? `${d.person.name} ${Math.round((d.confidence || 0) * 100)}%`
          : 'Unknown';

        // Label background
        const pad    = 4;
        const textW  = ctx.measureText(label).width;
        const labelH = 18;
        ctx.fillStyle = color;
        ctx.fillRect(bx, Math.max(0, by - labelH), textW + pad * 2, labelH);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(label, bx + pad, Math.max(labelH, by) - 4);
      }
      ctx.globalAlpha = 1;
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, [cameraId, videoRef, events]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
    />
  );
}
