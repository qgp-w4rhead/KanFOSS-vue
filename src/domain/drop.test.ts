import { describe, expect, it } from 'vitest';
import { applyIntent, resolveDrop, SAME_SLOT_REASON, type DropIntent } from './drop.ts';
import type { Board, Card, Category } from './types.ts';

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

const fixture = (): Board =>
  boardOf([
    category('a', null, [card('c1'), card('c2')]),
    category('b', null, [card('c3')]),
    category('s1', 'a', [card('c4')]),
    category('s2', 'a'),
  ]);

const orderOf = (board: Board): string[] => board.categories.map((item) => item.id);
const cardsOf = (board: Board, id: string): string[] =>
  board.categories.find((item) => item.id === id)?.cards.map((item) => item.id) ?? [];

describe('card drops (D1 to D5)', () => {
  it('D1 reorders a card before another card in the same lane', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c2' }, { kind: 'card', cardId: 'c1', side: 'before' }, board);
    expect(cardsOf(applyIntent(board, intent), 'a')).toEqual(['c2', 'c1']);
  });

  it('D1 places a card after another card in the same lane', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c1' }, { kind: 'card', cardId: 'c2', side: 'after' }, board);
    expect(cardsOf(applyIntent(board, intent), 'a')).toEqual(['c2', 'c1']);
  });

  it('D2 moves a card before a card in another lane', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c1' }, { kind: 'card', cardId: 'c3', side: 'before' }, board);
    const next = applyIntent(board, intent);
    expect(cardsOf(next, 'b')).toEqual(['c1', 'c3']);
    expect(cardsOf(next, 'a')).toEqual(['c2']);
  });

  it('D3 appends a card to an empty lane', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c1' }, { kind: 'lane', categoryId: 's2' }, board);
    expect(cardsOf(applyIntent(board, intent), 's2')).toEqual(['c1']);
  });

  it('D4 creates a new category holding the dropped card', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c4' }, { kind: 'add-category' }, board);
    const next = applyIntent(board, intent);
    expect(next.categories[next.categories.length - 1]).toMatchObject({ parentId: null, cards: [card('c4')] });
  });

  it('D5 appends a card to a category center', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c1' }, { kind: 'category', categoryId: 'b', zone: 'center' }, board);
    expect(cardsOf(applyIntent(board, intent), 'b')).toEqual(['c3', 'c1']);
  });

  it('a card dropped on itself does nothing', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c1' }, { kind: 'card', cardId: 'c1', side: 'after' }, board);
    expect(applyIntent(board, intent)).toBe(board);
  });
});

describe('category drops (D6 to D11)', () => {
  it('D6 reorders a top-level category before another', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 'a', zone: 'before' }, board);
    expect(orderOf(applyIntent(board, intent))).toEqual(['b', 'a', 's1', 's2']);
  });

  it('D6 never nests when dropped on an edge (C1)', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 'a', zone: 'after' }, board);
    const next = applyIntent(board, intent);
    expect(next.categories.find((item) => item.id === 'b')?.parentId).toBeNull();
  });

  it('D7 nests a childless category into a top-level center', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 'a', zone: 'center' }, board);
    const next = applyIntent(board, intent);
    expect(next.categories.find((item) => item.id === 'b')?.parentId).toBe('a');
  });

  it('D8 promotes a subcategory beside a top-level category edge', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 's1' }, { kind: 'category', categoryId: 'b', zone: 'after' }, board);
    const next = applyIntent(board, intent);
    expect(next.categories.find((item) => item.id === 's1')?.parentId).toBeNull();
    expect(orderOf(next)).toEqual(['a', 's2', 'b', 's1']);
  });

  it('D9 reorders sibling subcategories within a parent', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'category', categoryId: 's1', zone: 'before' }, board);
    expect(orderOf(applyIntent(board, intent))).toEqual(['a', 's2', 's1', 'b']);
  });

  it('D10 re-parents a subcategory into another top-level center', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 's1' }, { kind: 'category', categoryId: 'b', zone: 'center' }, board);
    const next = applyIntent(board, intent);
    expect(next.categories.find((item) => item.id === 's1')?.parentId).toBe('b');
  });

  it('D11 rejects nesting a category that has subcategories, with a reason', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'category', categoryId: 'b', zone: 'center' }, board);
    expect(intent).toEqual({ kind: 'rejected', reason: 'Move its subcategories out first' });
    expect(applyIntent(board, intent)).toBe(board);
  });

  it('a category dropped on itself does nothing', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 'b', zone: 'center' }, board);
    expect(intent.kind).toBe('none');
  });

  it('a category dropped on its own bottom seam does nothing', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 'a', zone: 'after' }, board);
    expect(intent).toEqual({ kind: 'none', reason: SAME_SLOT_REASON });
    expect(applyIntent(board, intent)).toBe(board);
  });

  it('a category dropped on its own top seam does nothing', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'category', categoryId: 'b', zone: 'before' }, board);
    expect(intent).toEqual({ kind: 'none', reason: SAME_SLOT_REASON });
    expect(applyIntent(board, intent)).toBe(board);
  });

  it('a subcategory dropped on the seam beside its own slot does nothing', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'category', categoryId: 's1', zone: 'after' }, board);
    expect(intent).toEqual({ kind: 'none', reason: SAME_SLOT_REASON });
    expect(applyIntent(board, intent)).toBe(board);
  });

  it('G1 moves a dropped category to a new top-level position on the add zone', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 's2' }, { kind: 'add-category' }, board);
    const next = applyIntent(board, intent);
    expect(next.categories.find((item) => item.id === 's2')?.parentId).toBeNull();
    expect(orderOf(next).slice(-1)).toEqual(['s2']);
  });

  it('G2 places a top-level category before the parent of a dropped-on subcategory edge', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'category', categoryId: 's1', zone: 'before' }, board);
    const next = applyIntent(board, intent);
    expect(next.categories.find((item) => item.id === 'b')?.parentId).toBeNull();
    expect(orderOf(next)).toEqual(['b', 'a', 's1', 's2']);
  });

  it('G2 does not nest a category under its own subcategory', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'category', categoryId: 's1', zone: 'center' }, board);
    expect(intent).toEqual({ kind: 'none', reason: 'Dropped on itself' });
  });

  it('G3 rejects a category dropped on a card, with a reason', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'card', cardId: 'c1', side: 'before' }, board);
    expect(intent.kind).toBe('none');
    expect(applyIntent(board, intent)).toBe(board);
  });
});

describe('no-op and error paths (D12)', () => {
  it('a drop outside every target changes nothing', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'card', cardId: 'c1' }, null, board);
    expect(intent).toEqual({ kind: 'none', reason: 'Dropped outside every target' });
    expect(applyIntent(board, intent)).toBe(board);
  });

  it('an unknown source resolves to none', () => {
    const intent: DropIntent = resolveDrop({ kind: 'card', cardId: 'missing' }, { kind: 'lane', categoryId: 'a' }, fixture());
    expect(intent.kind).toBe('none');
  });

  it('an unknown target card or category resolves to none', () => {
    const board = fixture();
    expect(resolveDrop({ kind: 'card', cardId: 'c1' }, { kind: 'card', cardId: 'missing', side: 'before' }, board).kind).toBe('none');
    expect(resolveDrop({ kind: 'card', cardId: 'c1' }, { kind: 'lane', categoryId: 'missing' }, board).kind).toBe('none');
    expect(resolveDrop({ kind: 'category', categoryId: 'missing' }, { kind: 'add-category' }, board).kind).toBe('none');
  });

  it('a category dropped in a lane body nests under it', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'lane', categoryId: 'a' }, board);
    expect(intent).toEqual({ kind: 'placeCategory', categoryId: 'b', parentId: 'a', index: 2 });
    expect(applyIntent(board, intent).categories.find((item) => item.id === 'b')?.parentId).toBe('a');
  });

  it('a category dropped on a lane edge moves beside it', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'b' }, { kind: 'lane', categoryId: 'a', zone: 'before' }, board);
    const next = applyIntent(board, intent);
    expect(next.categories.find((item) => item.id === 'b')?.parentId).toBeNull();
    expect(orderOf(next)).toEqual(['b', 'a', 's1', 's2']);
  });

  it('a category dropped on a lane edge after moves beside it', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'lane', categoryId: 'b', zone: 'after' }, board);
    expect(orderOf(applyIntent(board, intent))).toEqual(['b', 'a', 's1', 's2']);
  });

  it('a category dropped on its own lane does nothing', () => {
    const board = fixture();
    const intent = resolveDrop({ kind: 'category', categoryId: 'a' }, { kind: 'lane', categoryId: 'a' }, board);
    expect(intent).toEqual({ kind: 'none', reason: 'Dropped on itself' });
  });
});
