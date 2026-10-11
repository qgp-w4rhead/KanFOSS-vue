import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyIntent, resolveDrop } from '../domain/drop.ts';
import type { Board, Card, Category } from '../domain/types.ts';
import { findDropTarget, type Rect } from './hit-test.ts';

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
const category = (id: string, cards: Card[] = [], parentId: string | null = null): Category => ({
  id,
  title: id,
  parentId,
  color: null,
  cards,
});

const cardBoard = (): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 4,
  categories: [category('x', [card('A'), card('B'), card('C')])],
});

const cardsOf = (value: Board): string[] => value.categories[0].cards.map((item) => item.id);

const cardTree = () => {
  const body = node('lane:x', { left: 0, top: 0, width: 300, height: 200 });
  const a = node('card:A', { left: 8, top: 10, width: 284, height: 40 }, body);
  const b = node('card:B', { left: 8, top: 60, width: 284, height: 40 }, body);
  return { body, a, b };
};

describe('adjacent task neighbours keep their own raw edges', () => {
  it('source A on the top half of B gives B before, and source B on the bottom of A gives A after', () => {
    const { body, a, b } = cardTree();
    expect(findDropTarget([b, body], { x: 50, y: 65 }, { kind: 'card', cardId: 'A' })).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'before',
    });
    expect(findDropTarget([a, body], { x: 50, y: 45 }, { kind: 'card', cardId: 'B' })).toEqual({
      kind: 'card',
      cardId: 'A',
      side: 'after',
    });
  });

  it('source A on the bottom of B gives B after, and source B on the top of A gives A before', () => {
    const { body, a, b } = cardTree();
    expect(findDropTarget([b, body], { x: 50, y: 95 }, { kind: 'card', cardId: 'A' })).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'after',
    });
    expect(findDropTarget([a, body], { x: 50, y: 15 }, { kind: 'card', cardId: 'B' })).toEqual({
      kind: 'card',
      cardId: 'A',
      side: 'before',
    });
  });

  it('the source own top and bottom halves stay null', () => {
    const { body, a } = cardTree();
    expect(findDropTarget([a, body], { x: 50, y: 15 }, { kind: 'card', cardId: 'A' })).toBeNull();
    expect(findDropTarget([a, body], { x: 50, y: 45 }, { kind: 'card', cardId: 'A' })).toBeNull();
  });

  it('the halves swap A and B through resolveDrop and applyIntent, and a no-op edge keeps the board', () => {
    const board = cardBoard();
    const swapped = applyIntent(board, resolveDrop({ kind: 'card', cardId: 'A' }, { kind: 'card', cardId: 'B', side: 'after' }, board));
    expect(cardsOf(swapped)).toEqual(['B', 'A', 'C']);
    const reversed = applyIntent(board, resolveDrop({ kind: 'card', cardId: 'B' }, { kind: 'card', cardId: 'A', side: 'before' }, board));
    expect(cardsOf(reversed)).toEqual(['B', 'A', 'C']);
    expect(applyIntent(board, resolveDrop({ kind: 'card', cardId: 'A' }, { kind: 'card', cardId: 'B', side: 'before' }, board))).toBe(board);
  });
});

describe('sibling subcategory panels use halves, not a centre', () => {
  const tree = () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 600 });
    const a = node('category:a', { left: 0, top: 16, width: 300, height: 200 }, lanes);
    node(null, { left: 0, top: 16, width: 300, height: 30 }, a);
    node('lane:a', { left: 0, top: 46, width: 300, height: 30 }, a);
    const s1 = node('category:s1', { left: 40, top: 80, width: 240, height: 30 }, a);
    const s2 = node('category:s2', { left: 40, top: 120, width: 240, height: 30 }, a);
    const b = node('category:b', { left: 0, top: 232, width: 300, height: 100 }, lanes);
    return { lanes, s1, s2, b };
  };

  it('the top half of a sibling is before and the bottom half is after', () => {
    const { lanes, s1, s2 } = tree();
    expect(findDropTarget([s1, lanes], { x: 100, y: 85 }, { kind: 'category', categoryId: 's2' })).toEqual({
      kind: 'category',
      categoryId: 's1',
      zone: 'before',
    });
    expect(findDropTarget([s2, lanes], { x: 100, y: 145 }, { kind: 'category', categoryId: 's1' })).toEqual({
      kind: 'category',
      categoryId: 's2',
      zone: 'after',
    });
  });

  it('the former centre of a sibling resolves to after, never to a nest', () => {
    const { lanes, s2 } = tree();
    expect(findDropTarget([s2, lanes], { x: 100, y: 135 }, { kind: 'category', categoryId: 's1' })).toEqual({
      kind: 'category',
      categoryId: 's2',
      zone: 'after',
    });
  });

  it('a subcategory on its own top half stays null', () => {
    const { lanes, s1 } = tree();
    expect(findDropTarget([s1, lanes], { x: 100, y: 85 }, { kind: 'category', categoryId: 's1' })).toBeNull();
  });

  it('a top-level source over a foreign subcategory still gets the parent before edge, and centre nesting is unchanged', () => {
    const { lanes, s2, s1 } = tree();
    expect(findDropTarget([s2, lanes], { x: 100, y: 122 }, { kind: 'category', categoryId: 'b' })).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'before',
    });
    expect(findDropTarget([s1, lanes], { x: 100, y: 85 }, { kind: 'category', categoryId: 'b' })).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'before',
    });
  });

  it('the sibling halves reorder inside the parent through the domain resolver', () => {
    const board: Board = {
      schemaVersion: 2,
      id: 'board',
      title: 'Board',
      nextCardNumber: 1,
      categories: [category('a'), category('s1', [], 'a'), category('s2', [], 'a'), category('b')],
    };
    const before = applyIntent(board, resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'category', categoryId: 's1', zone: 'before' }, board));
    expect(before.categories.map((item) => item.id)).toEqual(['a', 's2', 's1', 'b']);
    expect(before.categories.find((item) => item.id === 's2')?.parentId).toBe('a');
    const after = applyIntent(board, resolveDrop({ kind: 'category', categoryId: 's1' }, { kind: 'category', categoryId: 's2', zone: 'after' }, board));
    expect(after.categories.map((item) => item.id)).toEqual(['a', 's2', 's1', 'b']);
    expect(after.categories.find((item) => item.id === 's1')?.parentId).toBe('a');
  });
});
