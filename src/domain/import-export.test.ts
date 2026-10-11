import { describe, expect, it } from 'vitest';
import { IMPORT_SIZE_ERROR, TOO_MANY_CATEGORIES_ERROR, parseBoardFile, serializeBoard, validateImportSize } from './import-export.ts';
import { IMPORT_FORMAT_ERROR, SHAPE_ERROR } from './import-parse.ts';
import { MAX_BOARD_BYTES, MAX_CATEGORIES } from './limits.ts';
import { legacyEdge, legacySample } from './__fixtures__/legacy-boards.ts';

const json = (value: unknown): string => JSON.stringify(value);

describe('parseBoardFile with a v1 board', () => {
  it('assigns fresh ids and keeps the card numbers, including 0', () => {
    const { board, warnings } = parseBoardFile(json(legacySample));
    expect(warnings).toEqual([]);
    expect(board.categories.map((category) => category.title)).toEqual(['To Do', 'In Progress', 'Done']);
    expect(board.categories.map((category) => category.id)).not.toContain('todo');
    expect(board.categories[0].cards.map((card) => card.number)).toEqual([0, 1]);
    expect(board.nextCardNumber).toBe(4);
  });

  it('maps subcategory parents to the new ids and converts dates', () => {
    const { board, warnings } = parseBoardFile(json(legacyEdge));
    const todo = board.categories.find((category) => category.title === 'Todo');
    const sub = board.categories.find((category) => category.title === 'Todo - 1');
    expect(sub?.parentId).toBe(todo?.id);
    expect(warnings).toEqual(['"Orphan" lost its parent and was moved to the top level.']);
    expect(todo?.cards[0].start).toEqual({ date: '2024-03-01', time: '09:00' });
  });

  it('moves an orphaned subcategory to the top level with a warning and keeps its card number', () => {
    const { board } = parseBoardFile(json(legacyEdge));
    const orphan = board.categories.find((category) => category.title === 'Orphan');
    expect(orphan?.parentId).toBeNull();
    expect(orphan?.cards[0].number).toBe(5);
    expect(board.nextCardNumber).toBe(6);
  });

  it('maps v1 colors to color keys and drops unknown ones', () => {
    const { board } = parseBoardFile(json(legacyEdge));
    expect(board.categories.find((category) => category.title === 'Todo')?.color).toBe('blue');
    expect(board.categories.find((category) => category.title === 'Todo - 1')?.color).toBeNull();
  });

  it('keeps the link for a card that has one', () => {
    const { board } = parseBoardFile(json(legacyEdge));
    expect(board.categories[0].cards[0].link).toBe('https://example.com');
  });
});

describe('parseBoardFile with a v2 board', () => {
  it('round-trips a serialized board', () => {
    const first = parseBoardFile(json(legacySample)).board;
    const second = parseBoardFile(serializeBoard(first)).board;
    expect(second.categories.map((category) => category.title)).toEqual(['To Do', 'In Progress', 'Done']);
    expect(second.categories.flatMap((category) => category.cards.map((card) => card.number))).toEqual([0, 1, 2, 3]);
  });
});

describe('parseBoardFile errors', () => {
  it('rejects text that is not JSON', () => {
    expect(() => parseBoardFile('not json')).toThrow(IMPORT_FORMAT_ERROR);
  });

  it('rejects JSON that is not an object', () => {
    expect(() => parseBoardFile('[]')).toThrow(IMPORT_FORMAT_ERROR);
  });

  it('rejects an object without a categories or columns list', () => {
    expect(() => parseBoardFile(json({ title: 'Nope' }))).toThrow(SHAPE_ERROR);
  });

  it('rejects a card with no title', () => {
    const bad = { schemaVersion: 2, title: 'Bad', categories: [{ id: 'x', title: 'X', cards: [{ number: 1 }] }] };
    expect(() => parseBoardFile(json(bad))).toThrow('Invalid card');
  });

  it('rejects a category with no title', () => {
    const bad = { schemaVersion: 2, title: 'Bad', categories: [{ id: 'x', title: '' }] };
    expect(() => parseBoardFile(json(bad))).toThrow('Category: Title is required');
  });

  it('rejects a board over the category limit', () => {
    const categories = Array.from({ length: MAX_CATEGORIES + 1 }, (_, index) => ({ id: `c${index}`, title: `C${index}` }));
    expect(() => parseBoardFile(json({ schemaVersion: 2, title: 'Big', categories }))).toThrow(TOO_MANY_CATEGORIES_ERROR);
  });
});

describe('column slots in import and export', () => {
  const slotted = {
    schemaVersion: 2,
    id: 'board',
    title: 'Slots',
    nextCardNumber: 3,
    categories: [
      {
        id: 'p',
        title: 'Parent',
        parentId: null,
        color: null,
        cards: [{ id: 'k', number: 0, title: 'Card', description: '' }],
        column: 0,
      },
      { id: 'q', title: 'Other', parentId: null, color: null, cards: [], column: 3 },
      { id: 's', title: 'Sub', parentId: 'p', color: null, cards: [] },
    ],
  };

  it('keeps slots, including slot 0, through export and import with fresh ids', () => {
    const first = parseBoardFile(json(slotted)).board;
    const second = parseBoardFile(serializeBoard(first)).board;
    const parent = second.categories.find((category) => category.title === 'Parent');
    expect(parent?.column).toBe(0);
    expect(parent?.id).not.toBe('p');
    expect(parent?.cards[0].number).toBe(0);
    expect(second.categories.find((category) => category.title === 'Other')?.column).toBe(3);
    expect(second.categories.find((category) => category.title === 'Sub')).toMatchObject({ parentId: parent?.id });
    expect(second.categories.find((category) => category.title === 'Sub')?.column).toBeUndefined();
  });

  it('accepts v1 boards and v2 boards without slots', () => {
    expect(parseBoardFile(json(legacySample)).board.categories.every((category) => category.column === undefined)).toBe(
      true,
    );
    const plain = { schemaVersion: 2, title: 'Plain', categories: [{ id: 'x', title: 'X', cards: [] }] };
    expect(parseBoardFile(json(plain)).board.categories[0].column).toBeUndefined();
  });

  it.each([-1, 1.5, '2', null, true])('ignores a malformed v2 slot (%s) without failing', (column) => {
    const bad = { schemaVersion: 2, title: 'Bad', categories: [{ id: 'x', title: 'X', cards: [], column }] };
    expect(parseBoardFile(json(bad)).board.categories[0].column).toBeUndefined();
  });

  it('ignores a slot on a v1 column', () => {
    const legacy = { title: 'Legacy', columns: [{ id: 'x', title: 'X', tasks: [], column: 1 }] };
    expect(parseBoardFile(json(legacy)).board.categories[0].column).toBeUndefined();
  });
});

describe('validateImportSize', () => {
  it('accepts a file exactly at the limit', () => {
    expect(validateImportSize(MAX_BOARD_BYTES)).toBeNull();
  });

  it('rejects a file over the limit', () => {
    expect(validateImportSize(MAX_BOARD_BYTES + 1)).toBe(IMPORT_SIZE_ERROR);
  });
});
