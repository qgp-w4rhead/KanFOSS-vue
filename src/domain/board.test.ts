import { describe, expect, it } from 'vitest';
import {
  NEST_BLOCKED_ERROR,
  addCategory,
  addSubcategory,
  childrenOf,
  deleteCategory,
  nestCategory,
  placeCategory,
  promoteCategory,
  renameBoard,
  renameCategory,
  setCategoryColor,
  stepCategory,
  titleError,
  TITLE_REQUIRED_ERROR,
  TITLE_TOO_LONG_ERROR,
} from './board.ts';
import { MAX_CATEGORIES, MAX_TITLE_LENGTH } from './limits.ts';
import type { Board, Card, Category, ColorKey } from './types.ts';

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
  nextCardNumber: 1,
  categories,
});

const orderOf = (board: Board): string[] => board.categories.map((item) => item.id);

describe('addCategory', () => {
  it('appends a top-level category', () => {
    const result = addCategory(boardOf([category('a')]), 'Plans', 'new');
    expect(result.categories[1]).toMatchObject({ id: 'new', title: 'Plans', parentId: null });
  });

  it('ignores a blank title and keeps the same reference', () => {
    const board = boardOf([]);
    expect(addCategory(board, '   ')).toBe(board);
  });

  it('ignores a title over the limit', () => {
    const board = boardOf([]);
    expect(addCategory(board, 'x'.repeat(MAX_TITLE_LENGTH + 1))).toBe(board);
  });

  it('ignores the request at the category limit', () => {
    const full = boardOf(Array.from({ length: MAX_CATEGORIES }, (_, index) => category(`c${index}`)));
    expect(addCategory(full, 'Extra')).toBe(full);
  });
});

describe('addSubcategory', () => {
  it('adds a child under a top-level parent', () => {
    const result = addSubcategory(boardOf([category('a')]), 'a', 'Child', 'sub');
    expect(childrenOf(result, 'a').map((item) => item.id)).toEqual(['sub']);
  });

  it('rejects a parent that is itself a subcategory', () => {
    const board = boardOf([category('a'), category('sub', 'a')]);
    expect(addSubcategory(board, 'sub', 'Deep', 'x')).toBe(board);
  });

  it('rejects an unknown parent', () => {
    const board = boardOf([category('a')]);
    expect(addSubcategory(board, 'missing', 'Child', 'x')).toBe(board);
  });
});

describe('renameCategory', () => {
  it('trims the new title', () => {
    expect(renameCategory(boardOf([category('a')]), 'a', '  New  ').categories[0].title).toBe('New');
  });

  it('keeps the same reference when the title is unchanged', () => {
    const board = boardOf([category('a')]);
    expect(renameCategory(board, 'a', 'a')).toBe(board);
  });

  it('rejects an empty title', () => {
    const board = boardOf([category('a')]);
    expect(renameCategory(board, 'a', '')).toBe(board);
  });

  it('rejects an unknown category', () => {
    const board = boardOf([category('a')]);
    expect(renameCategory(board, 'missing', 'Name')).toBe(board);
  });
});

describe('renameBoard', () => {
  it('renames the board and rejects a blank title', () => {
    const board = boardOf([]);
    expect(renameBoard(board, ' Launch ').title).toBe('Launch');
    expect(renameBoard(board, ' ')).toBe(board);
  });
});

describe('titleError', () => {
  it('reports a required title and a title over the limit', () => {
    expect(titleError('')).toBe(TITLE_REQUIRED_ERROR);
    expect(titleError('x'.repeat(MAX_TITLE_LENGTH + 1))).toBe(TITLE_TOO_LONG_ERROR);
  });
});

describe('setCategoryColor', () => {
  it('sets a valid color key', () => {
    const result = setCategoryColor(boardOf([category('a')]), 'a', 'cyan');
    expect(result.categories[0].color).toBe('cyan');
  });

  it('clears the color with null', () => {
    const colored = setCategoryColor(boardOf([category('a')]), 'a', 'red');
    expect(setCategoryColor(colored, 'a', null).categories[0].color).toBeNull();
  });

  it('rejects an unknown color key', () => {
    const board = boardOf([category('a')]);
    expect(setCategoryColor(board, 'a', 'chartreuse' as unknown as ColorKey)).toBe(board);
  });
});

describe('placeCategory', () => {
  it('reorders top-level categories', () => {
    const board = boardOf([category('a'), category('b'), category('c')]);
    expect(orderOf(placeCategory(board, 'a', null, 2) ?? board)).toEqual(['b', 'c', 'a']);
  });

  it('clamps the index to the end of the list', () => {
    const board = boardOf([category('a'), category('b')]);
    expect(orderOf(placeCategory(board, 'a', null, 99) ?? board)).toEqual(['b', 'a']);
  });

  it('nests a childless category under a top-level category', () => {
    const board = boardOf([category('a'), category('b')]);
    const result = placeCategory(board, 'b', 'a', 0);
    expect(result?.categories.map((item) => [item.id, item.parentId])).toEqual([
      ['a', null],
      ['b', 'a'],
    ]);
  });

  it('keeps a subcategory after its parent when nesting', () => {
    const board = boardOf([category('a'), category('b'), category('c', 'b')]);
    expect(orderOf(placeCategory(board, 'c', 'a', 0) ?? board)).toEqual(['a', 'c', 'b']);
  });

  it('rejects nesting a category that has subcategories', () => {
    const board = boardOf([category('a'), category('a1', 'a'), category('b')]);
    expect(placeCategory(board, 'a', 'b', 0)).toBeNull();
  });

  it('rejects nesting under a subcategory', () => {
    const board = boardOf([category('a'), category('a1', 'a'), category('b')]);
    expect(placeCategory(board, 'b', 'a1', 0)).toBeNull();
  });

  it('rejects nesting a category under itself', () => {
    expect(placeCategory(boardOf([category('a')]), 'a', 'a', 0)).toBeNull();
  });

  it('returns null for an unknown category or parent', () => {
    const board = boardOf([category('a')]);
    expect(placeCategory(board, 'missing', null, 0)).toBeNull();
    expect(placeCategory(board, 'a', 'missing', 0)).toBeNull();
  });

  it('returns the same reference when the order does not change', () => {
    const board = boardOf([category('a'), category('b')]);
    expect(placeCategory(board, 'a', null, 0)).toBe(board);
  });
});

describe('promoteCategory and nestCategory', () => {
  it('promotes a subcategory to the top level at the end', () => {
    const board = boardOf([category('a'), category('a1', 'a'), category('b')]);
    const result = promoteCategory(board, 'a1');
    expect(result.categories.map((item) => [item.id, item.parentId])).toEqual([
      ['a', null],
      ['b', null],
      ['a1', null],
    ]);
  });

  it('leaves a top-level category alone when promoting', () => {
    const board = boardOf([category('a')]);
    expect(promoteCategory(board, 'a')).toBe(board);
  });

  it('reports the blocked nest with a null result', () => {
    const board = boardOf([category('a'), category('a1', 'a')]);
    expect(nestCategory(board, 'a', 'a1')).toBeNull();
    expect(NEST_BLOCKED_ERROR).toBe('Move its subcategories out first');
  });
});

describe('stepCategory', () => {
  it('moves a subcategory within its siblings', () => {
    const board = boardOf([category('a'), category('s1', 'a'), category('s2', 'a')]);
    expect(orderOf(stepCategory(board, 's1', 1))).toEqual(['a', 's2', 's1']);
  });

  it('does nothing past the first or last sibling', () => {
    const board = boardOf([category('a'), category('s1', 'a')]);
    expect(stepCategory(board, 's1', -1)).toBe(board);
  });
});

describe('deleteCategory', () => {
  it('deletes subcategories and reports the cards removed', () => {
    const board = boardOf([
      category('a', null, [card('c1')]),
      category('a1', 'a', [card('c2'), card('c3')]),
      category('b'),
    ]);
    const result = deleteCategory(board, 'a');
    expect(orderOf(result.board)).toEqual(['b']);
    expect(result.removedCards).toBe(3);
  });

  it('does nothing for an unknown category', () => {
    const board = boardOf([category('a')]);
    expect(deleteCategory(board, 'missing')).toEqual({ board, removedCards: 0 });
  });
});
