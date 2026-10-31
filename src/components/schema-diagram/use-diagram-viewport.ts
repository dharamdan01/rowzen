"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";

export interface DiagramBounds { x: number; y: number; width: number; height: number }
interface Camera { width: number; height: number; zoom: number; x: number; y: number }
function fitted(bounds: DiagramBounds, width: number, height: number): Camera {
  const zoom = Math.min(width / Math.max(1, bounds.width), height / Math.max(1, bounds.height), 1);
  return { width, height, zoom, x: bounds.x + (bounds.width - width / zoom) / 2, y: bounds.y + (bounds.height - height / zoom) / 2 };
}

/** Hidden/zero-size observations never reset a retained camera. Only real width changes refit. */
export function useDiagramViewport(bounds: DiagramBounds, active: boolean) {
  const container = useRef<HTMLDivElement>(null), observedWidth = useRef(0);
  const drag = useRef<{ id: number; x: number; y: number; camera: Camera } | null>(null);
  const [camera, setCamera] = useState(() => fitted(bounds, 640, 420));
  useEffect(() => {
    if (!active || !container.current) return;
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width > 0 && width !== observedWidth.current) { observedWidth.current = width; setCamera(fitted(bounds, width, 420)); }
    });
    observer.observe(container.current);
    return () => { observer.disconnect(); drag.current = null; };
  }, [active, bounds]);
  function zoomBy(factor: number) {
    setCamera(previous => {
      const minimum = Math.min(0.05, fitted(bounds, previous.width, previous.height).zoom);
      const zoom = Math.max(minimum, Math.min(4, previous.zoom * factor));
      return { ...previous, zoom, x: previous.x + previous.width / previous.zoom / 2 - previous.width / zoom / 2,
        y: previous.y + previous.height / previous.zoom / 2 - previous.height / zoom / 2 };
    });
  }
  function move(x: number, y: number) { setCamera(previous => ({ ...previous, x: previous.x + x / previous.zoom, y: previous.y + y / previous.zoom })); }
  function fit(area = bounds) { setCamera(previous => fitted(area, previous.width, previous.height)); }
  function reset() { setCamera(previous => ({ ...previous, zoom: 1, x: bounds.x, y: bounds.y })); }
  function pointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !event.isPrimary || (event.target as Element).closest("g[id]")) return;
    event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, camera };
  }
  function pointerMove(event: PointerEvent<HTMLDivElement>) {
    const start = drag.current;
    if (start?.id === event.pointerId) setCamera({ ...start.camera, x: start.camera.x - (event.clientX - start.x) / start.camera.zoom,
      y: start.camera.y - (event.clientY - start.y) / start.camera.zoom });
  }
  function pointerUp(event: PointerEvent<HTMLDivElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    drag.current = null;
  }
  return { container, camera, zoomBy, move, fit, reset, pointerDown, pointerMove, pointerUp };
}
