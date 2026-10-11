import { describe, expect, it } from 'vitest';
import { applyIntent, NO_TARGET_REASON, resolveDrop } from './drop.ts';
import type { Board, Card, Category, ColumnPlacement } from './types.ts';

const card = (id: string): Card => ({ id, number: 0, title: id, description: '' });

const category = (id: string, parentId: string | null = null, cards: Card[] = []): Category => ({
  id,
  title: id,
  parentId,
  color: null,
  cards,
});

const boardOf = (categories: Category[]): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 10,
  categories,
});

const fixture = (slots: Record<string, number> = {}): Board =>
  boardOf(
    [
      category('a', null, [card('c1'), card('c2')]),
      category('b', null, [card('c3')]),
      category('s1', 'a', [card('c4')]),
      category('s2', 'a'),
    ].map((item) => (item.id in slots ? { ...item, column: slots[item.id] } : item)),
  );

const at = (count: number, index: number): ColumnPlacement => ({ index, count });
const orderOf = (board: Board): string[] => board.categories.map((item) => item.id);
const columnOfId = (board: Board, id: string): number | undefined =>
  board.categories.find((item) => item.id === id)?.column;

describe('placed add-category targets', () => {
  it('moves a dropped card into a new category in the chosen column', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c4' }, { kind: 'add-category', placement: at(4, 3) }, board);
    expect(intent).toEqual({ kind: 'newCategoryWithCard', cardId: 'c4', placement: at(4, 3) });
    const next = applyIntent(board, intent);
    expect(next.categories.slice(-1)).toMatchObject([{ parentId: null, column: 3, cards: [card('c4')] }]);
    expect(next.categories.find((item) => item.id === 's1')?.cards).toEqual([]);
  });

  it('moves a dropped category to the bottom of the chosen column', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'add-category', placement: at(4, 2) }, board);
    const next = applyIntent(board, intent);
    expect(orderOf(next)).toEqual(['a', 's1', 'b', 's2']);
    expect(next.categories.find((item) => item.id === 's2')).toMatchObject({ parentId: null, column: 2 });
  });

  it('carries the children of a dropped top-level category', () => {
    const board = fixture();
    const next = applyIntent(
      board,
      resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'add-category', placement: at(4, 1) }, board),
    );
    expect(orderOf(next)).toEqual(['b', 'a', 's1', 's2']);
    expect(columnOfId(next, 'a')).toBe(1);
  });

  it.each([
    ['index equal to count', at(4, 4)],
    ['negative index', { index: -1, count: 4 }],
    ['zero count', { index: 0, count: 0 }],
  ])('resolves an invalid placement (%s) to no target', (_, placement) => {
    const board = fixture();
    const target = { kind: 'add-category' as const, placement: placement as ColumnPlacement };
    const cardIntent = resolveDrop({ kind: 'card', cardId: 'c4' }, target, board);
    const categoryIntent = resolveDrop({ kind: 'category', categoryId: 'b' }, target, board);
    expect(cardIntent).toEqual({ kind: 'none', reason: NO_TARGET_REASON });
    expect(categoryIntent).toEqual({ kind: 'none', reason: NO_TARGET_REASON });
    expect(applyIntent(board, cardIntent)).toBe(board);
  });

  it('keeps the legacy add-category intents without placement keys', () => {
    const board = fixture();
    const cardIntent = resolveDrop({ kind: 'card', cardId: 'c4' }, { kind: 'add-category' }, board);
    const categoryIntent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'add-category' }, board);
    expect(cardIntent).toEqual({ kind: 'newCategoryWithCard', cardId: 'c4' });
    expect('placement' in cardIntent).toBe(false);
    expect('placement' in categoryIntent).toBe(false);
  });
});

describe('category before and after drops with a column context', () => {
  it('places a category beside a top-level anchor in the anchor column', () => {
    const board = fixture({ a: 0, b: 1 });
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 'a', zone: 'before' }, board, 4);
    expect(intent).toEqual({ kind: 'placeCategory', categoryId: 'b', parentId: null, index: 0, placement: at(4, 0) });
    const next = applyIntent(board, intent);
    expect(orderOf(next)).toEqual(['b', 'a', 's1', 's2']);
    expect(columnOfId(next, 'b')).toBe(0);
  });

  it('uses the parent column when a subcategory anchor is a top-level move', () => {
    const board = fixture({ a: 2, b: 0 });
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 's1', zone: 'after' }, board, 4);
    expect(intent).toMatchObject({ kind: 'placeCategory', parentId: null, placement: at(4, 2) });
    expect(orderOf(applyIntent(board, intent))).toEqual(['a', 's1', 's2', 'b']);
  });

  it('moves a subcategory to the top level in the column of the dropped-on category', () => {
    const board = fixture({ b: 3 });
    const intent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'category', categoryId: 'b', zone: 'before' }, board, 4);
    expect(intent).toMatchObject({ kind: 'placeCategory', parentId: null, placement: at(4, 3) });
    expect(applyIntent(board, intent).categories.find((item) => item.id === 's2')?.parentId).toBeNull();
  });

  it('keeps same-parent child reordering without a placement', () => {
    const intent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'category', categoryId: 's1', zone: 'before' }, fixture(), 4);
    expect(intent).toEqual({ kind: 'placeCategory', categoryId: 's2', parentId: 'a', index: 0 });
  });

  it('keeps center nesting and its rejection without a placement', () => {
    const board = fixture();
    expect(resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 'a', zone: 'center' }, board, 4)).toEqual({
      kind: 'placeCategory',
      categoryId: 'b',
      parentId: 'a',
      index: 2,
    });
    expect(resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'category', categoryId: 'b', zone: 'center' }, board, 4)).toEqual({
      kind: 'rejected',
      reason: 'Move its subcategories out first',
    });
  });

  it('omits the placement when no valid column count is supplied', () => {
    const board = fixture();
    const target = { kind: 'category' as const, categoryId: 'a', zone: 'before' as const };
    expect(resolveDrop({ kind: 'category', categoryId: 'b' }, target, board)).toEqual({
      kind: 'placeCategory',
      categoryId: 'b',
      parentId: null,
      index: 0,
    });
    expect('placement' in resolveDrop({ kind: 'category', categoryId: 'b' }, target, board, 0)).toBe(false);
  });
});
