import { describe, expect, it } from 'vitest';
import { ALREADY_INSIDE_REASON, NEST_BLOCKED_REASON, applyIntent, resolveDrop } from './drop.ts';
import type { Board, Category } from './types.ts';

const category = (id: string, parentId: string | null = null): Category => ({
  id,
  title: id,
  parentId,
  color: null,
  cards: [],
});

const boardOf = (): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 1,
  categories: [category('a'), category('s1', 'a'), category('s2', 'a'), category('b'), category('t1', 'b')],
});

const orderOf = (value: Board): string[] => value.categories.map((item) => item.id);

describe('centre drops onto a subcategory nest into its parent', () => {
  it('a foreign top-level centre on a subcategory becomes a subcategory of its parent', () => {
    const board: Board = { ...boardOf(), categories: [category('a'), category('s1', 'a'), category('b')] };
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 's1', zone: 'center' }, board);
    expect(intent).toMatchObject({ kind: 'placeCategory', categoryId: 'b', parentId: 'a', index: 1 });
    const next = applyIntent(board, intent);
    expect(orderOf(next)).toEqual(['a', 's1', 'b']);
    expect(next.categories.find((item) => item.id === 'b')?.parentId).toBe('a');
  });

  it('a foreign subcategory centre on another parent subcategory moves under that parent', () => {
    const board = boardOf();
    const intent = resolveDrop({ kind: 'category', categoryId: 't1' }, { kind: 'category', categoryId: 's2', zone: 'center' }, board);
    expect(intent).toMatchObject({ kind: 'placeCategory', categoryId: 't1', parentId: 'a', index: 2 });
    const next = applyIntent(board, intent);
    expect(orderOf(next)).toEqual(['a', 's1', 's2', 't1', 'b']);
    expect(next.categories.find((item) => item.id === 't1')?.parentId).toBe('a');
  });

  it('a parent dropped on its own child centre stays a silent no-target', () => {
    const board = boardOf();
    const intent = resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'category', categoryId: 's1', zone: 'center' }, board);
    expect(intent).toEqual({ kind: 'none', reason: 'Dropped on itself' });
    expect(applyIntent(board, intent)).toBe(board);
  });

  it('a same-parent subcategory centre is a silent no-target, not a reorder', () => {
    const board = boardOf();
    const intent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'category', categoryId: 's1', zone: 'center' }, board);
    expect(intent).toEqual({ kind: 'none', reason: ALREADY_INSIDE_REASON });
    expect(applyIntent(board, intent)).toBe(board);
  });

  it('a category with children onto a foreign subcategory centre is still rejected on the parent', () => {
    const board = boardOf();
    const intent = resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'category', categoryId: 't1', zone: 'center' }, board);
    expect(intent).toEqual({ kind: 'rejected', reason: NEST_BLOCKED_REASON });
    expect(applyIntent(board, intent)).toBe(board);
  });

  it('a top-level category with children onto another top-level centre keeps the existing nest reason', () => {
    const board = boardOf();
    const intent = resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'category', categoryId: 'b', zone: 'center' }, board);
    expect(intent).toEqual({ kind: 'rejected', reason: NEST_BLOCKED_REASON });
  });
});

describe('edge drops around a subcategory stay allowed', () => {
  it('a top-level before edge on a subcategory moves beside its parent', () => {
    const board = boardOf();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 's1', zone: 'before' }, board);
    expect(intent.kind).toBe('placeCategory');
    const next = applyIntent(board, intent);
    expect(orderOf(next)).toEqual(['b', 't1', 'a', 's1', 's2']);
    expect(next.categories.find((item) => item.id === 'b')?.parentId).toBeNull();
  });

  it('a subcategory before edge within its own parent is a placement', () => {
    const board = boardOf();
    const intent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'category', categoryId: 's1', zone: 'before' }, board);
    expect(intent).toMatchObject({ kind: 'placeCategory', parentId: 'a' });
  });
});
