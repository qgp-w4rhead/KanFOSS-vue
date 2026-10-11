import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyIntent, resolveDrop } from '../domain/drop.ts';
import type { Board, Card, Category } from '../domain/types.ts';
import { findDropTarget, type Rect } from './hit-test.ts';
import { normalizeInsertionTarget } from './insertion-targets.ts';

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

const card = (id: string): Card => ({ id, number: 1, title: id, description: '' });
const category = (id: string, cards: Card[] = []): Category => ({ id, title: id, parentId: null, color: null, cards });

const board = (): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 2,
  categories: [category('a', [card('k')]), category('b')],
});

const cardsOf = (value: Board, id: string): string[] =>
  value.categories.find((item) => item.id === id)?.cards.map((item) => item.id) ?? [];

const tree = () => {
  const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 600 });
  const a = node('category:a', { left: 0, top: 0, width: 300, height: 100 }, lanes);
  const body = node('lane:a', { left: 0, top: 30, width: 300, height: 60 }, a);
  node('card:k', { left: 8, top: 40, width: 284, height: 40 }, body);
  const b = node('category:b', { left: 0, top: 116, width: 300, height: 100 }, lanes);
  const headerB = node(null, { left: 0, top: 116, width: 300, height: 30 }, b);
  return { lanes, b, headerB };
};

describe('a task card dropped on a category edge appends to that category', () => {
  it('top of B resolves to B before, and the card appends to B', () => {
    const { lanes, b, headerB } = tree();
    const source = { kind: 'card' as const, cardId: 'k' };
    const target = findDropTarget([headerB, b, lanes], { x: 50, y: 120 }, source);
    expect(target).toEqual({ kind: 'category', categoryId: 'b', zone: 'before' });
    expect(target && normalizeInsertionTarget(target, b, source)).toEqual(target);
    const next = applyIntent(board(), resolveDrop(source, target, board()));
    expect(cardsOf(next, 'b')).toEqual(['k']);
    expect(cardsOf(next, 'a')).toEqual([]);
  });

  it('bottom of B resolves to B after, and the card still appends to B', () => {
    const { lanes, b, headerB } = tree();
    const source = { kind: 'card' as const, cardId: 'k' };
    const target = findDropTarget([headerB, b, lanes], { x: 50, y: 210 }, source);
    expect(target).toEqual({ kind: 'category', categoryId: 'b', zone: 'after' });
    const next = applyIntent(board(), resolveDrop(source, target, board()));
    expect(cardsOf(next, 'b')).toEqual(['k']);
    expect(cardsOf(next, 'a')).toEqual([]);
  });
});
