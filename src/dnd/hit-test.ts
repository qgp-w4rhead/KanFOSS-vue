import type { DragSource, DropTarget, Side, Zone } from '../domain/drop.ts';
import { isColumnPlacement } from '../domain/columns.ts';
import type { ColumnPlacement } from '../domain/types.ts';
import {
  DROP_ATTRIBUTE,
  areSiblingSubcategories,
  attributeOf,
  idOf,
  isWithinCategory,
  normalizeInsertionTarget,
  type InsertionCandidate,
} from './insertion-targets.ts';

export { DROP_ATTRIBUTE } from './insertion-targets.ts';
export const EDGE_FRACTION = 0.25;
export const CARD_EDGE_MARGIN = 12;
export const MAX_GAP_DISTANCE = 24;

const DIGITS = /^\d+$/;

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

const zoneWithin = (offset: number): Zone => {
  if (offset < EDGE_FRACTION) return 'before';
  return offset > 1 - EDGE_FRACTION ? 'after' : 'center';
};

export const zoneAt = (x: number, rect: Rect): Zone => zoneWithin((x - rect.left) / rect.width);

export const categoryZoneAt = (y: number, rect: Rect): Zone => zoneWithin((y - rect.top) / rect.height);

export const sideAt = (y: number, rect: Rect): Side => (y - rect.top < rect.height / 2 ? 'before' : 'after');

const placementFrom = (parts: string[]): ColumnPlacement | null => {
  if (parts.length !== 2 || !parts.every((part) => DIGITS.test(part))) return null;
  const placement = { index: Number(parts[0]), count: Number(parts[1]) };
  return isColumnPlacement(placement) ? placement : null;
};

const addCategoryTarget = (parts: string[]): DropTarget | null => {
  if (parts.length === 0) return { kind: 'add-category' };
  const placement = placementFrom(parts);
  return placement ? { kind: 'add-category', placement } : null;
};

export const targetFromHit = (attribute: string, point: Point, rect: Rect): DropTarget | null => {
  const [kind, ...rest] = attribute.split(':');
  const id = rest.join(':');
  if (kind === 'add-category') return addCategoryTarget(rest);
  if (!id) return null;
  if (kind === 'card') return { kind: 'card', cardId: id, side: sideAt(point.y, rect) };
  if (kind === 'lane') return { kind: 'lane', categoryId: id };
  if (kind === 'category') return { kind: 'category', categoryId: id, zone: categoryZoneAt(point.y, rect) };
  return null;
};

const rectOf = (element: Element): Rect => element.getBoundingClientRect();

const distanceTo = (rect: Rect, point: Point): number => {
  const dx = Math.max(rect.left - point.x, 0, point.x - (rect.left + rect.width));
  const dy = Math.max(rect.top - point.y, 0, point.y - (rect.top + rect.height));
  return Math.hypot(dx, dy);
};

const nearestWithin = (candidates: Element[], point: Point): Element | null =>
  candidates.reduce<{ element: Element | null; distance: number }>(
    (best, candidate) => {
      const distance = distanceTo(rectOf(candidate), point);
      return distance <= MAX_GAP_DISTANCE && distance < best.distance ? { element: candidate, distance } : best;
    },
    { element: null, distance: Infinity },
  ).element;

const cardEdgeNear = (container: Element, point: Point, excludeId: string): InsertionCandidate | null => {
  let best: { candidate: InsertionCandidate; distance: number } | null = null;
  for (const card of container.querySelectorAll(`[${DROP_ATTRIBUTE}^="card:"]`)) {
    const cardId = idOf(card);
    const rect = rectOf(card);
    if (cardId === excludeId || point.x < rect.left || point.x > rect.left + rect.width) continue;
    const side = sideAt(point.y, rect);
    const distance = Math.abs(point.y - (side === 'before' ? rect.top : rect.top + rect.height));
    if (distance <= CARD_EDGE_MARGIN && (best === null || distance < best.distance)) {
      best = { candidate: { target: { kind: 'card', cardId, side }, element: card }, distance };
    }
  }
  return best?.candidate ?? null;
};

const laneGapNear = (container: Element, point: Point): InsertionCandidate | null => {
  const lane = nearestWithin(Array.from(container.querySelectorAll(`[${DROP_ATTRIBUTE}^="lane:"]`)), point);
  return lane ? { target: { kind: 'lane', categoryId: idOf(lane) }, element: lane } : null;
};

const categoryGapNear = (container: Element, point: Point, sourceId: string): InsertionCandidate | null => {
  const panels = Array.from(container.querySelectorAll(`[${DROP_ATTRIBUTE}^="category:"]`)).filter(
    (panel) => !isWithinCategory(panel, sourceId),
  );
  const panel = nearestWithin(panels, point);
  if (!panel) return null;
  const rect = rectOf(panel);
  const zone: Zone = point.y < rect.top + rect.height / 2 ? 'before' : 'after';
  return { target: { kind: 'category', categoryId: idOf(panel), zone }, element: panel };
};

const horizontalGap = (rect: Rect, x: number): number => Math.max(rect.left - x, 0, x - (rect.left + rect.width));

const columnFooterCandidate = (container: Element, point: Point): InsertionCandidate | null => {
  const stacks = Array.from(container.querySelectorAll('[data-column]'));
  if (stacks.length === 0) return { target: { kind: 'add-category' }, element: container };
  const stack = stacks.reduce<Element>(
    (best, candidate) => (horizontalGap(rectOf(candidate), point.x) < horizontalGap(rectOf(best), point.x) ? candidate : best),
    stacks[0],
  );
  const placement = { index: Number(stack.getAttribute('data-column')), count: stacks.length };
  return isColumnPlacement(placement) ? { target: { kind: 'add-category', placement }, element: stack } : null;
};

const outermostLanes = (element: Element): Element => {
  let root = element;
  for (let node: Element | null = element.parentElement; node; node = node.parentElement) {
    if (attributeOf(node) === 'lanes') root = node;
  }
  return root;
};

const categoryCandidateAt = (element: Element, point: Point, source: DragSource | undefined): InsertionCandidate | null => {
  const attribute = attributeOf(element);
  if (attribute.startsWith('add-category')) {
    const target = targetFromHit(attribute, point, rectOf(element));
    return target ? { target, element } : null;
  }
  const owner = element.closest(`[${DROP_ATTRIBUTE}^="category:"]`);
  if (!owner) return null;
  const rect = rectOf(owner);
  const zone = areSiblingSubcategories(owner, source) ? sideAt(point.y, rect) : categoryZoneAt(point.y, rect);
  return { target: { kind: 'category', categoryId: idOf(owner), zone }, element: owner };
};

const cardCandidateAt = (element: Element, point: Point, source: DragSource | undefined): InsertionCandidate | null => {
  const attribute = attributeOf(element);
  if (!attribute || attribute === 'lanes') return null;
  const target = targetFromHit(attribute, point, rectOf(element));
  if (!target) return null;
  if (target.kind !== 'lane') return { target, element };
  const excludeId = source?.kind === 'card' ? source.cardId : '';
  return cardEdgeNear(element, point, excludeId) ?? { target, element };
};

const hitCandidate = (element: Element, point: Point, source: DragSource | undefined): InsertionCandidate | null => {
  if (source?.kind === 'category') return attributeOf(element) === 'lanes' ? null : categoryCandidateAt(element, point, source);
  return cardCandidateAt(element, point, source);
};

const gapCandidate = (elements: Element[], point: Point, source: DragSource | undefined): InsertionCandidate | null => {
  const hit = elements.find((element) => attributeOf(element) === 'lanes');
  if (!hit) return null;
  const container = outermostLanes(hit);
  if (source?.kind === 'category') {
    return categoryGapNear(container, point, source.categoryId) ?? columnFooterCandidate(container, point);
  }
  if (source?.kind === 'card') {
    return cardEdgeNear(container, point, source.cardId) ?? laneGapNear(container, point) ?? columnFooterCandidate(container, point);
  }
  return null;
};

export const findDropTarget = (elements: Element[], point: Point, source?: DragSource): DropTarget | null => {
  for (const element of elements) {
    const candidate = hitCandidate(element, point, source);
    if (candidate) return normalizeInsertionTarget(candidate.target, candidate.element, source);
  }
  const gap = gapCandidate(elements, point, source);
  return gap ? normalizeInsertionTarget(gap.target, gap.element, source) : null;
};
