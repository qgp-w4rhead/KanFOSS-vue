import { describe, expect, it } from 'vitest';
import { createSampleBoard } from './sample-board.ts';

describe('createSampleBoard', () => {
  it('starts the card numbers after the highest existing number', () => {
    const board = createSampleBoard();
    const numbers = board.categories.flatMap((category) => category.cards.map((card) => card.number));
    expect(numbers).toEqual([0, 1, 2, 3]);
    expect(board.nextCardNumber).toBe(Math.max(...numbers) + 1);
  });

  it('gives every category and card a unique id', () => {
    const board = createSampleBoard();
    const ids = [...board.categories, ...board.categories.flatMap((category) => category.cards)].map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
