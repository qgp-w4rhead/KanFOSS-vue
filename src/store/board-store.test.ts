import { describe, expect, it } from 'vitest';
import { createBoardStore, UNDO_MESSAGE, type BoardRepository } from './board-store.ts';
import { createSampleBoard } from '../domain/sample-board.ts';
import { MAX_CATEGORIES } from '../domain/limits.ts';
import type { Board } from '../domain/types.ts';

const memoryRepository = (initial: Board | null = null) => {
  let saved: Board | null = initial;
  const writes: Board[] = [];
  const repository: BoardRepository = {
    load: () => saved,
    save: (board) => {
      saved = board;
      writes.push(board);
    },
  };
  return { repository, writes };
};

const titles = (board: Board): string[] => board.categories.map((category) => category.title);

describe('createBoardStore', () => {
  it('uses the saved board when one exists', () => {
    const saved = createSampleBoard();
    const store = createBoardStore(memoryRepository(saved).repository, () => createSampleBoard());
    expect(store.board.value).toBe(saved);
  });

  it('uses the fallback when nothing is saved', () => {
    const store = createBoardStore(memoryRepository().repository, () => createSampleBoard());
    expect(titles(store.board.value)).toEqual(['To Do', 'In Progress', 'Done']);
  });

  it('persists each committed change and makes it undoable', () => {
    const { repository, writes } = memoryRepository();
    const store = createBoardStore(repository, () => createSampleBoard());
    store.dispatch({ type: 'add-category' });
    expect(writes).toHaveLength(1);
    expect(titles(store.board.value)).toHaveLength(4);
    expect(store.canUndo.value).toBe(true);
  });

  it('undo restores the previous board and reports it', () => {
    const { repository } = memoryRepository();
    const store = createBoardStore(repository, () => createSampleBoard());
    const before = store.board.value;
    store.dispatch({ type: 'add-category' });
    store.undo();
    expect(store.board.value).toBe(before);
    expect(store.message.value).toBe(UNDO_MESSAGE);
    expect(store.canUndo.value).toBe(false);
  });

  it('a no-op action does not add undo history', () => {
    const store = createBoardStore(memoryRepository().repository, () => createSampleBoard());
    store.dispatch({ type: 'rename-category', categoryId: 'missing', title: 'Name' });
    expect(store.canUndo.value).toBe(false);
  });

  it('a rejected drop reports the reason and leaves the board alone', () => {
    const store = createBoardStore(memoryRepository().repository, () => createSampleBoard());
    const [todo, , done] = store.board.value.categories;
    store.dispatch({ type: 'add-subcategory', parentId: todo.id });
    const before = store.board.value;
    store.dispatch({
      type: 'drop',
      source: { kind: 'category', categoryId: todo.id },
      target: { kind: 'category', categoryId: done.id, zone: 'center' },
    });
    expect(store.message.value).toBe('Move its subcategories out first');
    expect(store.board.value).toBe(before);
  });

  it('importing a board replaces it as an undoable change', () => {
    const store = createBoardStore(memoryRepository().repository, () => createSampleBoard());
    const original = store.board.value;
    const replacement = { ...createSampleBoard(), title: 'Imported' };
    store.dispatch({ type: 'replace-board', board: replacement });
    expect(store.board.value.title).toBe('Imported');
    store.undo();
    expect(store.board.value).toBe(original);
  });
});

describe('placed category changes', () => {
  it('saves a targeted creation once and keeps its slot after reload', () => {
    const { repository, writes } = memoryRepository();
    const store = createBoardStore(repository, () => createSampleBoard());
    store.dispatch({ type: 'add-category', placement: { index: 0, count: 4 } });
    expect(writes).toHaveLength(1);
    expect(store.board.value.categories.slice(-1)).toMatchObject([{ column: 0 }]);
    const reloaded = createBoardStore(repository, () => createSampleBoard());
    expect(reloaded.board.value.categories.slice(-1)).toMatchObject([{ column: 0 }]);
  });

  it('one undo restores the exact previous board after a targeted creation', () => {
    const store = createBoardStore(memoryRepository().repository, () => createSampleBoard());
    const before = store.board.value;
    store.dispatch({ type: 'add-category', placement: { index: 2, count: 4 } });
    store.undo();
    expect(store.board.value).toBe(before);
    expect(store.canUndo.value).toBe(false);
  });

  it('an invalid targeted creation saves and records nothing', () => {
    const { repository, writes } = memoryRepository();
    const store = createBoardStore(repository, () => createSampleBoard());
    store.dispatch({ type: 'add-category', placement: { index: 4, count: 4 } });
    expect(writes).toHaveLength(0);
    expect(store.canUndo.value).toBe(false);
  });

  it('places a targeted creation next to interleaved subcategories', () => {
    const store = createBoardStore(memoryRepository().repository, () => createSampleBoard());
    const [todo] = store.board.value.categories;
    store.dispatch({ type: 'add-subcategory', parentId: todo.id });
    store.dispatch({ type: 'add-category', placement: { index: 1, count: 2 } });
    expect(store.board.value.categories.slice(-1)).toMatchObject([{ parentId: null, column: 1 }]);
    expect(store.board.value.categories.filter((category) => category.parentId === todo.id)).toHaveLength(1);
  });

  it('refuses a targeted creation at the category cap without saving', () => {
    const full: Board = {
      ...createSampleBoard(),
      categories: Array.from({ length: MAX_CATEGORIES }, (_, index) => ({
        id: `c${index}`,
        title: `C${index}`,
        parentId: null,
        color: null,
        cards: [],
      })),
    };
    const { repository, writes } = memoryRepository(full);
    const store = createBoardStore(repository, () => createSampleBoard());
    store.dispatch({ type: 'add-category', placement: { index: 0, count: 4 } });
    expect(writes).toHaveLength(0);
    expect(store.board.value).toBe(full);
  });

  it('saves a placed step and a placed drop once each', () => {
    const { repository, writes } = memoryRepository();
    const store = createBoardStore(repository, () => createSampleBoard());
    const [, inProgress, done] = store.board.value.categories;
    store.dispatch({ type: 'step-category', categoryId: done.id, delta: -1, columnCount: 2 });
    expect(titles(store.board.value)[0]).toBe('Done');
    store.dispatch({
      type: 'drop',
      source: { kind: 'category', categoryId: done.id },
      target: { kind: 'category', categoryId: inProgress.id, zone: 'before' },
      columnCount: 2,
    });
    expect(writes).toHaveLength(2);
    expect(store.board.value.categories[1]).toMatchObject({ id: done.id, column: 1 });
  });
});
