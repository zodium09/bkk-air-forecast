"use client";

import { useCallback, useEffect, useRef, useState, type PointerEvent, type ReactNode } from "react";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export default function FahSaiTwinScene({ children, hud, camera, autoRotate, onManualMove }: {
  children: ReactNode;
  hud: ReactNode;
  camera: string;
  autoRotate: boolean;
  onManualMove: () => void;
}) {
  const [view, setView] = useState({ tilt: 0, turn: 0, vertical: 0 });
  const [touchDrag, setTouchDrag] = useState(false);
  const [dragging, setDragging] = useState(false);
  const drag = useRef<null | { id: number; x: number; y: number; tilt: number; turn: number; element: HTMLDivElement }>(null);

  const endDrag = useCallback(() => {
    const active = drag.current;
    drag.current = null;
    if (active?.element.hasPointerCapture(active.id)) active.element.releasePointerCapture(active.id);
    setDragging(false);
  }, []);

  useEffect(() => {
    window.addEventListener("blur", endDrag);
    return () => window.removeEventListener("blur", endDrag);
  }, [endDrag]);

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    if (drag.current || event.button !== 0 || !event.isPrimary) return;
    if (event.pointerType === "touch" && !touchDrag) return;
    if ((event.target as HTMLElement).closest("button, [role=button], input, a")) return;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, tilt: view.tilt, turn: view.turn, element: event.currentTarget };
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    onManualMove();
  };

  const moveDrag = (event: PointerEvent<HTMLDivElement>) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    setView(current => ({ ...current,
      tilt: clamp(active.tilt - (event.clientY - active.y) * 0.3, -35, 35),
      turn: clamp(active.turn + (event.clientX - active.x) * 0.3, -180, 180),
    }));
  };

  const reset = () => {
    endDrag();
    onManualMove();
    setView({ tilt: 0, turn: 0, vertical: 0 });
  };

  return <div className="fs-3d-interactive">
    <div className="fs-3d-viewport">
    {hud}
    <div
      className="fs-3d-camera-surface"
      data-touch-drag={touchDrag}
      data-dragging={dragging}
      role="group"
      aria-label="ลากเพื่อหมุนและก้มเงยกล้อง 3 มิติ หรือใช้แถบเลื่อนด้านล่างเพื่อปรับด้วยแป้นพิมพ์"
      onPointerDown={startDrag}
      onPointerMove={moveDrag}
      onPointerUp={event => { if (drag.current?.id === event.pointerId) endDrag(); }}
      onPointerCancel={event => { if (drag.current?.id === event.pointerId) endDrag(); }}
      onLostPointerCapture={event => { if (drag.current?.id === event.pointerId) endDrag(); }}
    >
      <div className="fs-3d-camera-rig" style={{ transform: `translateY(${view.vertical}px) rotateX(${view.tilt}deg) rotateZ(${view.turn}deg)` }}>
        <div className={`fs-3d-scene cam-${camera} ${autoRotate ? "is-autorotate" : ""}`}>{children}</div>
      </div>
    </div>
    </div>
    <div className="fs-3d-camera-tools" role="group" aria-label="ควบคุมตำแหน่งและมุมกล้อง 3 มิติ">
      <span>ลากภาพเพื่อหมุน / ก้ม–เงย</span>
      <label>ก้ม–เงย <input type="range" min={-35} max={35} value={view.tilt} onChange={event => { onManualMove(); setView(current => ({ ...current, tilt: Number(event.target.value) })); }}/></label>
      <label>หมุนซ้าย–ขวา <input type="range" min={-180} max={180} value={view.turn} onChange={event => { onManualMove(); setView(current => ({ ...current, turn: Number(event.target.value) })); }}/></label>
      <label>เลื่อนขึ้น–ลง <input type="range" min={-120} max={120} value={view.vertical} onChange={event => { onManualMove(); setView(current => ({ ...current, vertical: Number(event.target.value) })); }}/></label>
      <button type="button" aria-pressed={touchDrag} onClick={() => { endDrag(); setTouchDrag(value => !value); }}>{touchDrag ? "ปิดลากบนจอสัมผัส" : "เปิดลากบนจอสัมผัส"}</button>
      <button type="button" onClick={reset}>คืนมุมกล้อง</button>
    </div>
  </div>;
}
