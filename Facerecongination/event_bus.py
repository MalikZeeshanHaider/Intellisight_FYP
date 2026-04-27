"""
IntelliSight — in-process detection event bus.

The AI worker threads call `publish(event)` from many threads; WebSocket
handler threads call `subscribe(camera_ids)` to get a per-client queue that
receives only the events they asked for. This cleanly decouples the AI
pipeline from the WebSocket layer.

Design:
  • One bounded `queue.Queue` per subscriber (maxsize=32). A slow browser
    can at most accumulate 32 stale events before the oldest is evicted —
    publishers never block.
  • Subscriptions are mutable: a client can subscribe/unsubscribe at any
    time without reopening the WebSocket.
  • Camera-id filtering is done inside `publish()` so we don't fan out to
    subscribers that didn't ask for this camera.
"""

import queue
import threading
from typing import Iterable, Optional, Set


_MAX_QUEUE = 32   # per-subscriber buffer — drops oldest on overflow


class Subscriber:
    """One WebSocket client. Owns its own queue and its filter set."""

    __slots__ = ("queue", "cameras", "_lock")

    def __init__(self) -> None:
        self.queue: "queue.Queue[dict]" = queue.Queue(maxsize=_MAX_QUEUE)
        self.cameras: Set[int] = set()           # empty = receive nothing
        self._lock = threading.Lock()

    def set_cameras(self, camera_ids: Iterable[int]) -> None:
        with self._lock:
            self.cameras = {int(c) for c in camera_ids}

    def add_cameras(self, camera_ids: Iterable[int]) -> None:
        with self._lock:
            self.cameras.update(int(c) for c in camera_ids)

    def remove_cameras(self, camera_ids: Iterable[int]) -> None:
        with self._lock:
            self.cameras.difference_update(int(c) for c in camera_ids)

    def wants(self, camera_id: int) -> bool:
        with self._lock:
            return camera_id in self.cameras


class EventBus:
    """Thread-safe fan-out. One instance per Python process."""

    def __init__(self) -> None:
        self._subs: Set[Subscriber] = set()
        self._lock = threading.Lock()

    def subscribe(self) -> Subscriber:
        sub = Subscriber()
        with self._lock:
            self._subs.add(sub)
        return sub

    def unsubscribe(self, sub: Subscriber) -> None:
        with self._lock:
            self._subs.discard(sub)

    def publish(self, event: dict) -> None:
        """Fan out an event to every subscriber interested in its camera.

        Event shape is the JSON contract sent to browsers (see docs).
        Non-blocking: if a subscriber queue is full, the oldest event is
        evicted so the publisher never waits on a slow consumer.
        """
        camera_id = event.get('camera_id')
        if camera_id is None:
            return

        with self._lock:
            targets = [s for s in self._subs if s.wants(camera_id)]

        for sub in targets:
            try:
                sub.queue.put_nowait(event)
            except queue.Full:
                # Drop-oldest: evict one then try again. If that still fails
                # (extremely unlikely with single consumer) we just skip.
                try:
                    sub.queue.get_nowait()
                except queue.Empty:
                    pass
                try:
                    sub.queue.put_nowait(event)
                except queue.Full:
                    pass

    def publish_status(self, camera_id: int, status: str,
                       message: Optional[str] = None) -> None:
        """Convenience for camera lifecycle events."""
        self.publish({
            'type': 'camera_status',
            'camera_id': camera_id,
            'status': status,
            'message': message,
        })

    def subscriber_count(self) -> int:
        with self._lock:
            return len(self._subs)


# Single process-wide instance — import this from service code.
bus = EventBus()
