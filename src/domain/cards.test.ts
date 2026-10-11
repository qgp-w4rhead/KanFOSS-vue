import { describe, expect, it } from 'vitest';
import {
  DESCRIPTION_LENGTH_ERROR,
  LINK_PROTOCOL_ERROR,
  addCard,
  deleteCard,
  moveCard,
  moveCardToNewCategory,
  toCardFields,
  updateCard,
  validateCardDraft,
} from './cards.ts';
import { RANGE_ORDER_ERROR } from './dates.ts';
import { MAX_DESCRIPTION_LENGTH } from './limits.ts';
import { TITLE_REQUIRED_ERROR } from './board.ts';
import type { Board, Card, Category } from './types.ts';

const card = (id: string, number = 0): Card => ({ id, number, title: `Card ${id}`, description: '' });

const category = (id: string, cards: Card[] = []): Category => ({
  id,
  title: id,
  parentId: null,
  color: null,
  cards,
});

const boardOf = (categories: Category[], nextCardNumber = 1): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber,
  categories,
});

const cardIds = (board: Board, categoryId: string): string[] =>
  board.categories.find((item) => item.id === categoryId)?.cards.map((item) => item.id) ?? [];

describe('validateCardDraft', () => {
  it('requires a title', () => {
    expect(validateCardDraft({ title: '  ' })).toBe(TITLE_REQUIRED_ERROR);
  });

  it('rejects a description over the limit', () => {
    const description = 'x'.repeat(MAX_DESCRIPTION_LENGTH + 1);
    expect(validateCardDraft({ title: 'Ok', description })).toBe(DESCRIPTION_LENGTH_ERROR);
  });

  it('rejects a link that is not http or https', () => {
    expect(validateCardDraft({ title: 'Ok', link: 'javascript:alert(1)' })).toBe(LINK_PROTOCOL_ERROR);
  });

  it('accepts an https link', () => {
    expect(validateCardDraft({ title: 'Ok', link: 'https://example.com' })).toBeNull();
  });

  it('rejects reversed times on the same day (C11)', () => {
    const draft = {
      title: 'Ok',
      start: { date: '2024-01-01', time: '10:00' },
      due: { date: '2024-01-01', time: '09:00' },
    };
    expect(validateCardDraft(draft)).toBe(RANGE_ORDER_ERROR);
  });
});

describe('toCardFields', () => {
  it('trims the title, description, and link', () => {
    expect(toCardFields({ title: ' Task ', description: ' Notes ', link: ' https://a.test ' })).toEqual({
      title: 'Task',
      description: 'Notes',
      link: 'https://a.test',
      start: undefined,
      due: undefined,
    });
  });

  it('returns null for an invalid draft', () => {
    expect(toCardFields({ title: '' })).toBeNull();
  });
});

describe('addCard', () => {
  it('assigns the next card number and increments it', () => {
    const board = addCard(boardOf([category('a')]), 'a', { title: 'First' }, 'c1');
    const next = addCard(board, 'a', { title: 'Second' }, 'c2');
    expect(next.categories[0].cards.map((item) => item.number)).toEqual([1, 2]);
    expect(next.nextCardNumber).toBe(3);
  });

  it('never reuses a number after a delete', () => {
    const board = addCard(boardOf([category('a')]), 'a', { title: 'First' }, 'c1');
    const trimmed = deleteCard(board, 'c1');
    expect(addCard(trimmed, 'a', { title: 'Second' }, 'c2').categories[0].cards[0].number).toBe(2);
  });

  it('keeps the board unchanged for an invalid draft or unknown category', () => {
    const board = boardOf([category('a')]);
    expect(addCard(board, 'a', { title: '' }, 'c1')).toBe(board);
    expect(addCard(board, 'missing', { title: 'Ok' }, 'c1')).toBe(board);
  });
});

describe('updateCard', () => {
  it('changes fields and keeps the card number', () => {
    const board = boardOf([category('a', [card('c1', 7)])]);
    const next = updateCard(board, 'c1', { title: 'Renamed' });
    expect(next.categories[0].cards[0]).toMatchObject({ title: 'Renamed', number: 7 });
  });

  it('keeps the same reference when nothing changes', () => {
    const board = boardOf([category('a', [{ ...card('c1'), title: 'Same' }])]);
    expect(updateCard(board, 'c1', { title: 'Same' })).toBe(board);
  });

  it('rejects an invalid draft and an unknown card', () => {
    const board = boardOf([category('a', [card('c1')])]);
    expect(updateCard(board, 'c1', { title: '' })).toBe(board);
    expect(updateCard(board, 'missing', { title: 'Ok' })).toBe(board);
  });
});

describe('deleteCard', () => {
  it('removes the card from its lane', () => {
    const board = boardOf([category('a', [card('c1'), card('c2')])]);
    expect(cardIds(deleteCard(board, 'c1'), 'a')).toEqual(['c2']);
  });

  it('ignores an unknown card', () => {
    const board = boardOf([category('a')]);
    expect(deleteCard(board, 'missing')).toBe(board);
  });
});

describe('moveCard', () => {
  const twoLanes = boardOf([category('a', [card('c1'), card('c2')]), category('b', [card('c3')])]);

  it('moves a card to another lane at an index', () => {
    expect(cardIds(moveCard(twoLanes, 'c1', 'b', 0), 'b')).toEqual(['c1', 'c3']);
    expect(cardIds(moveCard(twoLanes, 'c1', 'b', 0), 'a')).toEqual(['c2']);
  });

  it('clamps the index to the end of the lane', () => {
    expect(cardIds(moveCard(twoLanes, 'c1', 'b', 99), 'b')).toEqual(['c3', 'c1']);
  });

  it('reorders within a lane', () => {
    expect(cardIds(moveCard(twoLanes, 'c2', 'a', 0), 'a')).toEqual(['c2', 'c1']);
  });

  it('keeps the same reference when the card stays put', () => {
    expect(moveCard(twoLanes, 'c1', 'a', 0)).toBe(twoLanes);
  });

  it('ignores an unknown card or lane', () => {
    expect(moveCard(twoLanes, 'missing', 'a', 0)).toBe(twoLanes);
    expect(moveCard(twoLanes, 'c1', 'missing', 0)).toBe(twoLanes);
  });
});

describe('moveCardToNewCategory', () => {
  it('creates a top-level category holding only that card', () => {
    const board = boardOf([category('a', [card('c1'), card('c2')])]);
    const next = moveCardToNewCategory(board, 'c1', 'fresh');
    expect(next.categories.map((item) => [item.id, item.cards.map((c) => c.id)])).toEqual([
      ['a', ['c2']],
      ['fresh', ['c1']],
    ]);
  });

  it('ignores an unknown card', () => {
    const board = boardOf([category('a')]);
    expect(moveCardToNewCategory(board, 'missing', 'fresh')).toBe(board);
  });
});
