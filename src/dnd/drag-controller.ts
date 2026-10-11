import { reactive } from 'vue';
import type { DragSource, DropTarget } from '../domain/drop.ts';
import { findDropTarget, type Point } from './hit-test.ts';

export const DRAG_START_DISTANCE = 5;

export interface DragState {
  dragging: boolean;
  source: DragSource | null;
  pointer: Point;
  target: DropTarget | null;
}

export type DropHandler = (source: DragSource, target: DropTarget | null) => void;

const pointOf = (event: PointerEvent): Point => ({ x: event.clientX, y: event.clientY });

const targetAt = (point: Point, source?: DragSource): DropTarget | null =>
  findDropTarget(document.elementsFromPoint(point.x, point.y), point, source);

export const useDragController = (onDrop: DropHandler) => {
  const state = reactive<DragState>({ dragging: false, source: null, pointer: { x: 0, y: 0 }, target: null });
  let origin: Point = { x: 0, y: 0 };
  let latest: Point | null = null;
  let frame = 0;

  const detach = (): void => {
    window.removeEventListener('pointermove', handleMove);
    window.removeEventListener('pointerup', handleUp);
    window.removeEventListener('pointercancel', cancel);
    window.removeEventListener('keydown', handleKey);
  };

  const cancel = (): void => {
    cancelAnimationFrame(frame);
    frame = 0;
    latest = null;
    detach();
    state.dragging = false;
    state.source = null;
    state.target = null;
  };

  const refresh = (): void => {
    frame = 0;
    if (!latest) return;
    state.pointer = latest;
    state.target = targetAt(latest, state.source ?? undefined);
  };

  const handleMove = (event: PointerEvent): void => {
    const point = pointOf(event);
    if (!state.dragging) {
      if (Math.hypot(point.x - origin.x, point.y - origin.y) < DRAG_START_DISTANCE) return;
      state.dragging = true;
    }
    latest = point;
    if (frame === 0) frame = requestAnimationFrame(refresh);
  };

  const handleUp = (event: PointerEvent): void => {
    const source = state.source;
    const wasDragging = state.dragging;
    const target = wasDragging ? targetAt(pointOf(event), source ?? undefined) : null;
    cancel();
    if (wasDragging && source) onDrop(source, target);
  };

  const handleKey = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') cancel();
  };

  const start = (source: DragSource, event: PointerEvent): void => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    cancel();
    origin = pointOf(event);
    state.source = source;
    state.pointer = origin;
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', handleKey);
  };

  return { state, start, cancel };
};
