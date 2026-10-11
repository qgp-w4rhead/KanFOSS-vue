import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyIntent, resolveDrop, type DragSource } from '../domain/drop.ts';
import type { Board, Category } from '../domain/types.ts';
import { findDropTarget, type Point, type Rect } from './hit-test.ts';

const boxes = new WeakMap<Element, Rect>();
const domRect = (box: Rect): DOMRect =>
  ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height }) as unknown as DOMRect;

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return domRect(boxes.get(this) ?? { left: 0, top: 0, width: 0, height: 0 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const node = (attribute: string | null, box: Rect, parent?: Element): HTMLElement => {
  const element = document.createElement('div');
  if (attribute !== null) element.setAttribute('data-drop', attribute);
  boxes.set(element, box);
  parent?.appendChild(element);
  return element;
};

const cat = (id: string, parentId: string | null = null): Category => ({ id, title: id, parentId, color: null, cards: [] });

const board = (): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 1,
  categories: [cat('a'), cat('s1', 'a'), cat('s2', 'a'), cat('b'), cat('t1', 'b'), cat('t2', 'b')],
});

const tree = () => {
  const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 600 });
  const a = node('category:a', { left: 0, top: 16, width: 300, height: 200 }, lanes);
  node(null, { left: 0, top: 16, width: 300, height: 30 }, a);
  node('lane:a', { left: 0, top: 46, width: 300, height: 40 }, a);
  const s1 = node('category:s1', { left: 40, top: 80, width: 240, height: 30 }, a);
  const s2 = node('category:s2', { left: 40, top: 120, width: 240, height: 30 }, a);
  const b = node('category:b', { left: 0, top: 232, width: 300, height: 100 }, lanes);
  const t1 = node('category:t1', { left: 40, top: 250, width: 240, height: 20 }, b);
  const t2 = node('category:t2', { left: 40, top: 296, width: 240, height: 30 }, b);
  return { lanes, a, s1, s2, b, t1, t2 };
};

const parentsOf = (value: Board): Record<string, string | null> =>
  Object.fromEntries(value.categories.map((item) => [item.id, item.parentId]));

const orderOf = (value: Board): string[] => value.categories.map((item) => item.id);

const dropAt = (source: DragSource, elements: Element[], point: Point): Board => {
  const target = findDropTarget(elements, point, source);
  return applyIntent(board(), resolveDrop(source, target, board()));
};

describe('G2 exact model between parents', () => {
  it('a top-level source before a foreign subcategory lands before its parent', () => {
    const { s2, lanes } = tree();
    const next = dropAt({ kind: 'category', categoryId: 'b' }, [s2, lanes], { x: 100, y: 122 });
    expect(orderOf(next)).toEqual(['b', 't1', 't2', 'a', 's1', 's2']);
    expect(parentsOf(next)).toEqual({ a: null, s1: 'a', s2: 'a', b: null, t1: 'b', t2: 'b' });
  });

  it('a top-level source after a subcategory lands after its parent and keeps its own children', () => {
    const { s2, lanes } = tree();
    const next = dropAt({ kind: 'category', categoryId: 'b' }, [s2, lanes], { x: 100, y: 148 });
    expect(orderOf(next)).toEqual(['a', 's1', 's2', 'b', 't1', 't2']);
    expect(parentsOf(next)).toEqual({ a: null, s1: 'a', s2: 'a', b: null, t1: 'b', t2: 'b' });
  });

  it('a subcategory before a foreign subcategory is promoted beside the foreign parent, not into it', () => {
    const { t2, lanes } = tree();
    const next = dropAt({ kind: 'category', categoryId: 's2' }, [t2, lanes], { x: 100, y: 298 });
    expect(orderOf(next)).toEqual(['a', 's1', 's2', 'b', 't1', 't2']);
    expect(parentsOf(next)).toEqual({ a: null, s1: 'a', s2: null, b: null, t1: 'b', t2: 'b' });
  });

  it('a same-parent subcategory edge reorders inside its own group', () => {
    const { s1, lanes } = tree();
    const next = dropAt({ kind: 'category', categoryId: 's2' }, [s1, lanes], { x: 100, y: 85 });
    expect(orderOf(next)).toEqual(['a', 's2', 's1', 'b', 't1', 't2']);
    expect(parentsOf(next)).toEqual({ a: null, s1: 'a', s2: 'a', b: null, t1: 'b', t2: 'b' });
  });

  it('a centre target still nests the source, and is not normalized', () => {
    const { b, lanes } = tree();
    const next = dropAt({ kind: 'category', categoryId: 's1' }, [b, lanes], { x: 100, y: 282 });
    expect(orderOf(next)).toEqual(['a', 's2', 'b', 't1', 't2', 's1']);
    expect(parentsOf(next).s1).toBe('b');
  });
});
