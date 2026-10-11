import { describe, expect, it } from 'vitest';
import { deleteCategory } from './board.ts';
import {
  addCategoryInColumn,
  columnOf,
  isColumnIndex,
  isColumnPlacement,
  moveCardToNewCategoryInColumn,
  pinColumns,
  placeCategoryInColumn,
  stepCategoryInColumn,
} from './columns.ts';
import { MAX_CATEGORIES, MAX_TITLE_LENGTH } from './limits.ts';
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

const sixWithChild = (): Board =>
  boardOf([
    category('a'),
    category('s', 'a'),
    category('b'),
    category('c'),
    category('d'),
    category('e'),
    category('f'),
  ]);

const stacksOf = (board: Board, count: number): string[][] => {
  const tops = board.categories.filter((item) => item.parentId === null);
  return Array.from({ length: count }, (_, s) =>
    tops.filter((item, i) => columnOf(item, i, count) === s).map((item) => item.id),
  );
};

const slotOf = (board: Board, id: string): number | undefined =>
  board.categories.find((item) => item.id === id)?.column;

const at = (count: number, index: number): ColumnPlacement => ({ index, count });

describe('column index and placement guards', () => {
  it('accepts only safe non-negative integers as indexes', () => {
    expect(isColumnIndex(0)).toBe(true);
    expect(isColumnIndex(Number.MAX_SAFE_INTEGER)).toBe(true);
    expect(isColumnIndex(-1)).toBe(false);
    expect(isColumnIndex(1.5)).toBe(false);
    expect(isColumnIndex(NaN)).toBe(false);
    expect(isColumnIndex(Infinity)).toBe(false);
    expect(isColumnIndex('1')).toBe(false);
    expect(isColumnIndex(Number.MAX_SAFE_INTEGER + 1)).toBe(false);
  });

  it('requires a placement index below its count', () => {
    expect(isColumnPlacement(at(4, 0))).toBe(true);
    expect(isColumnPlacement(at(4, 3))).toBe(true);
    expect(isColumnPlacement(at(4, 4))).toBe(false);
    expect(isColumnPlacement(at(0, 0))).toBe(false);
    expect(isColumnPlacement({ index: 1 })).toBe(false);
    expect(isColumnPlacement(null)).toBe(false);
  });

  it('folds a saved slot by the visible count and falls back when it is invalid', () => {
    expect(columnOf({ ...category('x'), column: 5 }, 0, 4)).toBe(1);
    expect(columnOf(category('x'), 6, 4)).toBe(2);
    expect(columnOf({ ...category('x'), column: -1 }, 3, 4)).toBe(3);
    expect(columnOf(category('x'), 3, 0)).toBe(0);
  });
});

describe('pinColumns', () => {
  it('materializes row-major slots from top-level indexes and never counts subcategories', () => {
    const pinned = pinColumns(sixWithChild(), 4);
    expect(stacksOf(pinned, 4)).toEqual([['a', 'e'], ['b', 'f'], ['c'], ['d']]);
    expect(slotOf(pinned, 's')).toBeUndefined();
  });

  it('keeps the initial four-column appearance for the fixture', () => {
    expect(stacksOf(sixWithChild(), 4)).toEqual([['a', 'e'], ['b', 'f'], ['c'], ['d']]);
  });

  it('does not mutate its input and keeps existing slots', () => {
    const input = sixWithChild();
    input.categories[2] = { ...input.categories[2], column: 0 };
    const snapshot = JSON.stringify(input);
    const pinned = pinColumns(input, 4);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(slotOf(pinned, 'b')).toBe(0);
  });

  it('keeps a valid raw slot even when it is above the current count', () => {
    const board = boardOf([{ ...category('a'), column: 3 }, category('b')]);
    expect(slotOf(pinColumns(board, 2), 'a')).toBe(3);
  });

  it('returns the same board when nothing is missing or the count is invalid', () => {
    const once = pinColumns(sixWithChild(), 4);
    expect(pinColumns(once, 4)).toBe(once);
    expect(pinColumns(once, 0)).toBe(once);
    expect(pinColumns(once, 1.5)).toBe(once);
    expect(pinColumns(once, NaN)).toBe(once);
  });
});

describe('addCategoryInColumn', () => {
  it('adds one top-level category to each of the four slots', () => {
    for (let index = 0; index < 4; index += 1) {
      const next = addCategoryInColumn(sixWithChild(), at(4, index), 'X', 'x');
      expect(stacksOf(next, 4)[index].slice(-1)).toEqual(['x']);
      expect(next.categories.slice(-1)).toMatchObject([{ id: 'x', parentId: null }]);
    }
  });

  it('appends x and y to slot 2 without moving any existing category', () => {
    const first = addCategoryInColumn(sixWithChild(), at(4, 2), 'X', 'x');
    const second = addCategoryInColumn(first, at(4, 2), 'Y', 'y');
    expect(stacksOf(second, 4)).toEqual([['a', 'e'], ['b', 'f'], ['c', 'x', 'y'], ['d']]);
    expect(second.categories.filter((item) => item.id === 'x' || item.id === 'y').every((item) => item.parentId === null)).toBe(true);
  });

  it('places a category in slot 3 of an empty board', () => {
    const next = addCategoryInColumn(boardOf([]), at(4, 3), 'X', 'x');
    expect(stacksOf(next, 4)).toEqual([[], [], [], ['x']]);
  });

  it('keeps unrelated slots when a category is added and then deleted', () => {
    const pinned = pinColumns(sixWithChild(), 4);
    const added = addCategoryInColumn(pinned, at(4, 1), 'X', 'x');
    expect(stacksOf(deleteCategory(added, 'x').board, 4)).toEqual(stacksOf(pinned, 4));
  });

  it('restores the earlier four-column placement after folding to two columns', () => {
    const pinned = pinColumns(sixWithChild(), 4);
    expect(stacksOf(pinned, 2)).toEqual([['a', 'c', 'e'], ['b', 'd', 'f']]);
    const changed = addCategoryInColumn(pinned, at(2, 0), 'X', 'x');
    expect(slotOf(changed, 'c')).toBe(2);
    const restored = stacksOf(changed, 4).map((stack) => stack.filter((id) => id !== 'x'));
    expect(restored).toEqual([['a', 'e'], ['b', 'f'], ['c'], ['d']]);
  });

  it.each([
    ['negative index', { index: -1, count: 4 }],
    ['fractional index', { index: 1.5, count: 4 }],
    ['index equal to count', { index: 4, count: 4 }],
    ['NaN index', { index: NaN, count: 4 }],
    ['infinite index', { index: Infinity, count: 4 }],
    ['unsafe index', { index: Number.MAX_SAFE_INTEGER + 1, count: 4 }],
    ['zero count', { index: 0, count: 0 }],
    ['unsafe count', { index: 0, count: Number.MAX_SAFE_INTEGER + 2 }],
  ])('returns the original board for an invalid placement (%s)', (_, placement) => {
    const board = sixWithChild();
    expect(addCategoryInColumn(board, placement as ColumnPlacement, 'X', 'x')).toBe(board);
  });

  it('returns the original board for a blank, overlong, or capped request', () => {
    const board = sixWithChild();
    expect(addCategoryInColumn(board, at(4, 0), '   ')).toBe(board);
    expect(addCategoryInColumn(board, at(4, 0), 'x'.repeat(MAX_TITLE_LENGTH + 1))).toBe(board);
    const full = boardOf(Array.from({ length: MAX_CATEGORIES }, (_, i) => category(`c${i}`)));
    expect(addCategoryInColumn(full, at(4, 0), 'X', 'x')).toBe(full);
  });
});

describe('placeCategoryInColumn', () => {
  it('moves a category to a new column even when the global order is unchanged', () => {
    const board = sixWithChild();
    const next = placeCategoryInColumn(board, 'b', at(4, 3), 1);
    expect(next).not.toBe(board);
    expect(stacksOf(next, 4)).toEqual([['a', 'e'], ['f'], ['c'], ['b', 'd']]);
  });

  it('returns the original board when nothing would change', () => {
    const board = sixWithChild();
    expect(placeCategoryInColumn(board, 'b', at(4, 1), 1)).toBe(board);
  });

  it('moves a top-level category with its children', () => {
    const next = placeCategoryInColumn(sixWithChild(), 'a', at(4, 2));
    expect(next.categories.map((item) => item.id)).toEqual(['b', 'c', 'd', 'e', 'f', 'a', 's']);
    expect(slotOf(next, 'a')).toBe(2);
  });

  it('returns the original board for an unknown category or invalid placement', () => {
    const board = sixWithChild();
    expect(placeCategoryInColumn(board, 'missing', at(4, 1))).toBe(board);
    expect(placeCategoryInColumn(board, 'b', at(4, 4))).toBe(board);
  });
});

describe('moveCardToNewCategoryInColumn', () => {
  it('moves a card into a new category in the chosen column', () => {
    const board = boardOf([category('a', null, [card('c1')]), category('b')]);
    const next = moveCardToNewCategoryInColumn(board, 'c1', at(4, 3), 'n');
    expect(stacksOf(next, 4)).toEqual([['a'], ['b'], [], ['n']]);
    expect(next.categories.find((item) => item.id === 'n')?.cards.map((item) => item.id)).toEqual(['c1']);
    expect(next.categories.find((item) => item.id === 'a')?.cards).toEqual([]);
  });

  it('returns the original board for an unknown card or invalid placement', () => {
    const board = boardOf([category('a', null, [card('c1')])]);
    expect(moveCardToNewCategoryInColumn(board, 'missing', at(4, 0))).toBe(board);
    expect(moveCardToNewCategoryInColumn(board, 'c1', at(0, 0))).toBe(board);
  });

  it('returns the original board at the category cap without a pin-only change', () => {
    const board = boardOf(Array.from({ length: MAX_CATEGORIES }, (_, i) => category(`c${i}`, null, i === 0 ? [card('c1')] : [])));
    expect(moveCardToNewCategoryInColumn(board, 'c1', at(4, 0), 'n')).toBe(board);
    expect(board.categories[0].column).toBeUndefined();
  });
});

describe('stepCategoryInColumn', () => {
  it('moves a top-level category to its visible neighbour, not the global one', () => {
    const pinned = pinColumns(sixWithChild(), 4);
    const next = stepCategoryInColumn(pinned, 'f', -1, 4);
    expect(stacksOf(next, 4)).toEqual([['a', 'e'], ['f', 'b'], ['c'], ['d']]);
  });

  it('moves a category down past its visible neighbour and keeps its children', () => {
    const next = stepCategoryInColumn(sixWithChild(), 'a', 1, 4);
    expect(stacksOf(next, 4)).toEqual([['e', 'a'], ['b', 'f'], ['c'], ['d']]);
    expect(next.categories.map((item) => item.id)).toEqual(['b', 'c', 'd', 'e', 'a', 's', 'f']);
  });

  it('returns the original board at the visible boundaries', () => {
    const board = sixWithChild();
    expect(stepCategoryInColumn(board, 'a', -1, 4)).toBe(board);
    expect(stepCategoryInColumn(board, 'e', 1, 4)).toBe(board);
  });

  it('rejects invalid deltas and counts with the original board', () => {
    const board = sixWithChild();
    expect(stepCategoryInColumn(board, 'b', 1.5, 4)).toBe(board);
    expect(stepCategoryInColumn(board, 'b', NaN, 4)).toBe(board);
    expect(stepCategoryInColumn(board, 'b', 0, 4)).toBe(board);
    expect(stepCategoryInColumn(board, 'b', 1, 0)).toBe(board);
    expect(stepCategoryInColumn(board, 'missing', 1, 4)).toBe(board);
  });
});
