import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

type DragHandlers = {
  onStart: () => void;
  /** Total vertical travel since the drag started, in px. */
  onMove: (dy: number) => void;
  /** Release velocity in px/ms (positive = downwards), matching PanResponder's `vy`. */
  onEnd: (vy: number) => void;
};

/**
 * Mouse / pen dragging for a sheet handle on web, where the responder system does not pick up mouse drags.
 * Finds the element by `nativeID`, follows the pointer on the window, and swallows the click that ends a
 * real drag so the handle's tap action doesn't also fire. Does nothing on native: PanResponder covers touch.
 */
export function useWebDrag(nodeId: string, handlers: DragHandlers, deps: unknown[]) {
  const latest = useRef(handlers);
  useEffect(() => {
    latest.current = handlers;
  });

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const node = document.getElementById(nodeId);
    if (!node) return;
    let startY = 0;
    let lastY = 0;
    let lastT = 0;
    let vy = 0;
    let active = false;
    let dragging = false;

    const move = (e: PointerEvent) => {
      if (!active) return;
      const dy = e.clientY - startY;
      if (!dragging && Math.abs(dy) > 6) {
        dragging = true;
        latest.current.onStart();
      }
      if (!dragging) return;
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      vy = 0.7 * ((e.clientY - lastY) / dt) + 0.3 * vy; // smoothed, so one jittery frame can't flip the decision
      lastY = e.clientY;
      lastT = now;
      latest.current.onMove(dy);
      e.preventDefault();
    };
    const up = () => {
      if (!active) return;
      active = false;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (!dragging) return;
      latest.current.onEnd(vy);
      // the click that follows a drag isn't a tap
      const swallow = (ev: MouseEvent) => {
        ev.stopPropagation();
        ev.preventDefault();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', swallow, { capture: true }), 0);
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'touch' || e.button !== 0) return; // touch goes through PanResponder
      active = true;
      dragging = false;
      startY = lastY = e.clientY;
      lastT = performance.now();
      vy = 0;
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    };
    node.addEventListener('pointerdown', down);
    return () => {
      node.removeEventListener('pointerdown', down);
      up();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
