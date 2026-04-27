/**
 * MjpegFeed — snapshot-polling live video component.
 *
 * Polls /snapshot/<id>?t=<timestamp> every ~125 ms (~8 fps).  Each request is
 * independent so React lifecycle events (remount, re-render) cannot break the
 * feed — unlike a long-lived multipart/x-mixed-replace MJPEG connection.
 *
 * The ref is forwarded to the underlying <img> element so that a
 * DetectionOverlay canvas can be positioned and sized against it via
 * ResizeObserver — exactly the same way it works with a <video> element.
 */

import { forwardRef, useEffect, useRef, useState } from 'react';
import { streamAPI } from '../api/api';

const MjpegFeed = forwardRef(function MjpegFeed(
  { cameraId, fps = 8, className = '' },
  ref,
) {
  const [src, setSrc] = useState('');
  const intervalRef = useRef(null);

  useEffect(() => {
    if (!cameraId) return;

    const base = streamAPI.getSnapshotUrl(cameraId);
    const tick = () => setSrc(`${base}?t=${Date.now()}`);

    tick();
    intervalRef.current = setInterval(tick, Math.round(1000 / fps));

    return () => {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    };
  }, [cameraId, fps]);

  if (!src) return null;

  return (
    <img
      ref={ref}
      src={src}
      alt=""
      className={className}
      draggable={false}
      onError={() => {}}
    />
  );
});

export default MjpegFeed;
