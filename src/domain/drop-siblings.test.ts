import { describe, expect, it } from 'vitest';
import { applyIntent, resolveDrop } from './drop.ts';
import type { Board, Category } from './types.ts';

const category = (id: string, parentId: string | null = null): Category => ({
  id,
  title: id,
  parentId,
  color: null,
  cards: [],
});

const boardOf = (categories: Category[]): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 1,
  categories,
});

const threeSiblings = (): Board =>
  boardOf([category('a'), category('s1', 'a'), category('s2', 'a'), category('s3', 'a'), category('b')]);

const orderOf = (board: Board): string[] => board.categories.map((item) => item.id);
const parentOf = (board: Board, id: string): string | null | undefined =>
  board.categories.find((item) => item.id === id)?.parentId;

describe('sibling subcategory reorder', () => {
  it('moves the first sibling after the third and keeps the parent', () => {
    const board = threeSiblings();
    const next = applyIntent(
      board,
      resolveDrop({ kind: 'category', categoryId: 's1' }, { kind: 'category', categoryId: 's3', zone: 'after' }, board),
    );
    expect(parentOf(next, 's1')).toBe('a');
    expect(orderOf(next)).toEqual(['a', 's2', 's3', 's1', 'b']);
  });

  it('moves the third sibling before the second and keeps the parent', () => {
    const board = threeSiblings();
    const next = applyIntent(
      board,
      resolveDrop({ kind: 'category', categoryId: 's3' }, { kind: 'category', categoryId: 's2', zone: 'before' }, board),
    );
    expect(parentOf(next, 's3')).toBe('a');
    expect(orderOf(next)).toEqual(['a', 's1', 's3', 's2', 'b']);
  });

  it('places a top-level category beside the parent when dropped on a subcategory edge (G2)', () => {
    const board = threeSiblings();
    const next = applyIntent(
      board,
      resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 's2', zone: 'before' }, board),
    );
    expect(parentOf(next, 'b')).toBeNull();
    expect(orderOf(next)).toEqual(['b', 'a', 's1', 's2', 's3']);
  });

  it('leaves a self drop as the same board reference', () => {
    const board = threeSiblings();
    const intent = resolveDrop({ kind: 'category', categoryId: 's1' }, { kind: 'category', categoryId: 's1', zone: 'before' }, board);
    expect(applyIntent(board, intent)).toBe(board);
  });
});
