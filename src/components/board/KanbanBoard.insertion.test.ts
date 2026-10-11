import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Columns } from '../../composables/useColumns.ts';
import { useColumns } from '../../composables/useColumns.ts';
import type { Layout } from '../../composables/useLayout.ts';
import { useLayout } from '../../composables/useLayout.ts';
import type { Board, Card, Category } from '../../domain/types.ts';
import { appStore } from '../../store/app-store.ts';
import {
  bottomOf,
  installHitStack,
  installRects,
  layoutBoard,
  leftOf,
  pointerDown,
  pointerMove,
  topOf,
} from './kanban-board.drag-harness.ts';
import { cleanup, mountBoard, release, resetBoard, stubFrames, threeBoard } from './kanban-board.harness.ts';

vi.mock('../../store/app-store.ts', async () => {
  const { createBoardStore } = await import('../../store/board-store.ts');
  const empty = { schemaVersion: 2 as const, id: 'empty', title: 'Empty', nextCardNumber: 1, categories: [] };
  return { appStore: createBoardStore({ load: () => null, save: () => undefined }, () => empty) };
});

vi.mock('../../composables/useColumns.ts', async () => {
  const { ref } = await import('vue');
  const columns = ref<Columns>('4');
  return { useColumns: () => ({ columns }) };
});

vi.mock('../../composables/useLayout.ts', async () => {
  const { ref } = await import('vue');
  const layout = ref<Layout>('list');
  return { useLayout: () => ({ layout }) };
});

const card = (id: string): Card => ({ id, number: 1, title: `Card ${id}`, description: `Desc ${id}` });

const lane = (id: string, title: string, cards: Card[] = [], column?: number): Category => ({
  id,
  title,
  parentId: null,
  color: null,
  cards,
  ...(column === undefined ? {} : { column }),
});

const boardOf = (categories: Category[]): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 9,
  categories,
});

const abcBoard = (): Board =>
  boardOf([lane('a', 'Alpha', [card('A'), card('B'), card('C')]), lane('b', 'Bravo'), lane('c', 'Charlie')]);

const articleOf = (id: string): Element =>
  Array.from(document.querySelectorAll('article.card')).find(
    (element) => element.querySelector('h3')?.textContent?.trim() === `Card ${id}`,
  ) as Element;

const panel = (title: string): Element => document.querySelector(`section[aria-label="${title}"]`) as Element;
const cardIds = (categoryId: string): string[] =>
  appStore.board.value.categories.find((category) => category.id === categoryId)?.cards.map((item) => item.id) ?? [];
const titles = (): string[] => appStore.board.value.categories.map((category) => category.title);
const parentIds = (): (string | null)[] => appStore.board.value.categories.map((category) => category.parentId);
const slots = (): Record<string, number | undefined> =>
  Object.fromEntries(appStore.board.value.categories.map((category) => [category.id, category.column]));
const columnTitles = (column: number): string[] =>
  Array.from(document.querySelector(`[data-column="${column}"]`)?.children ?? [])
    .filter((child) => child.classList.contains('lane'))
    .map((child) => child.getAttribute('aria-label') ?? '');

const cardCount = (className: string): number =>
  Array.from(document.querySelectorAll('article.card')).filter((element) => element.classList.contains(className)).length;
const rootsWith = (className: string): (string | null)[] =>
  Array.from(document.querySelectorAll('section.lane'))
    .filter((element) => element.classList.contains(className))
    .map((element) => element.getAttribute('aria-label'));

const gapY = (above: string, below: string): number => (bottomOf(articleOf(above)) + topOf(articleOf(below))) / 2;

const hoverAt = async (x: number, y: number): Promise<void> => {
  pointerMove(x, y);
  await flushPromises();
};

const startCard = async (id: string): Promise<void> => {
  stubFrames();
  const element = articleOf(id);
  pointerDown(element, 100, topOf(element) + 10);
  pointerMove(100, topOf(element) + 20);
  await flushPromises();
};

const startPanel = async (title: string): Promise<void> => {
  stubFrames();
  const body = panel(title).querySelector('.lane-body') as Element;
  const x = leftOf(body) + 50;
  const y = topOf(body) + 5;
  pointerDown(body, x, y);
  pointerMove(x, y + 15);
  await flushPromises();
};

const mountCards = (): void => {
  mountBoard(true);
  layoutBoard(document.body);
};

beforeEach(() => {
  useColumns().columns.value = '4';
  useLayout().layout.value = 'list';
  installRects();
  installHitStack();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('task card insertion seams', () => {
  const expectOwner = (id: string, className: string): void => {
    const opposite = className === 'drop-after' ? 'drop-before' : 'drop-after';
    expect(cardCount(className)).toBe(1);
    expect(cardCount(opposite)).toBe(0);
    expect(articleOf(id).classList.contains(className)).toBe(true);
  };

  it('a source card shows one owner per seam and release inserts between neighbours', async () => {
    resetBoard(abcBoard());
    mountCards();
    await startCard('C');
    await hoverAt(100, bottomOf(articleOf('A')) - 5);
    expectOwner('A', 'drop-after');
    await hoverAt(100, topOf(articleOf('B')) + 5);
    expectOwner('B', 'drop-before');
    await hoverAt(100, gapY('A', 'B'));
    expectOwner('A', 'drop-after');
    release(100, gapY('A', 'B'));
    await flushPromises();
    expect(cardIds('a')).toEqual(['A', 'C', 'B']);
  });

  it('a card over its neighbour before edge shows that single edge and releasing in place keeps the board', async () => {
    resetBoard(abcBoard());
    mountCards();
    const before = appStore.board.value;
    await startCard('A');
    await hoverAt(100, topOf(articleOf('B')) + 5);
    expectOwner('B', 'drop-before');
    release(100, topOf(articleOf('B')) + 5);
    await flushPromises();
    expect(appStore.board.value).toBe(before);
  });

  it('a card over its own top and bottom shows no indicator and leaves the board untouched', async () => {
    resetBoard(abcBoard());
    mountCards();
    const before = appStore.board.value;
    await startCard('A');
    await hoverAt(100, topOf(articleOf('A')) + 5);
    expect(cardCount('drop-after') + cardCount('drop-before')).toBe(0);
    await hoverAt(100, bottomOf(articleOf('A')) - 5);
    expect(cardCount('drop-after') + cardCount('drop-before')).toBe(0);
    release(100, bottomOf(articleOf('A')) - 5);
    await flushPromises();
    expect(appStore.board.value).toBe(before);
  });
});

describe('root category insertion seams in List', () => {
  it('a source root shows one after owner on both sides of a root seam and release places it after Alpha', async () => {
    resetBoard(threeBoard());
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Charlie');
    await hoverAt(leftOf(panel('Alpha')) + 50, bottomOf(panel('Alpha')) - 5);
    expect(rootsWith('drop-after')).toEqual(['Alpha']);
    expect(rootsWith('drop-before')).toEqual([]);
    const bravoX = leftOf(panel('Bravo')) + 50;
    const bravoY = topOf(panel('Bravo')) + 5;
    await hoverAt(bravoX, bravoY);
    expect(rootsWith('drop-after')).toEqual(['Alpha']);
    expect(rootsWith('drop-before')).toEqual([]);
    release(bravoX, bravoY);
    await flushPromises();
    expect(titles()).toEqual(['Alpha', 'Charlie', 'Bravo']);
    expect(parentIds()).toEqual([null, null, null]);
  });

  it('a source root over its own top, centre and bottom shows no indicator and leaves the board untouched', async () => {
    resetBoard(threeBoard());
    mountBoard();
    layoutBoard(document.body);
    const before = appStore.board.value;
    await startPanel('Charlie');
    const x = leftOf(panel('Charlie')) + 50;
    const top = topOf(panel('Charlie'));
    const bottom = bottomOf(panel('Charlie'));
    for (const y of [top + 5, (top + bottom) / 2, bottom - 5]) {
      await hoverAt(x, y);
      expect(rootsWith('drop-before')).toEqual([]);
      expect(rootsWith('drop-after')).toEqual([]);
      expect(rootsWith('drop-center')).toEqual([]);
    }
    release(x, bottom - 5);
    await flushPromises();
    expect(appStore.board.value).toBe(before);
  });

  it('the first root keeps its own before slot when hovered from a different root', async () => {
    resetBoard(threeBoard());
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Charlie');
    await hoverAt(leftOf(panel('Alpha')) + 50, topOf(panel('Alpha')) + 5);
    expect(rootsWith('drop-before')).toEqual(['Alpha']);
    expect(rootsWith('drop-after')).toEqual([]);
  });
});

describe('cross-column seam mapping in Masonry', () => {
  it('a before edge on a non-first panel maps to the predecessor slot inside its own stack', async () => {
    useLayout().layout.value = 'masonry';
    resetBoard(
      boardOf([lane('a', 'Alpha', [], 0), lane('b', 'Bravo', [], 0), lane('c', 'Charlie', [], 1), lane('d', 'Delta', [], 2)]),
    );
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Delta');
    const x = leftOf(panel('Bravo')) + 50;
    const y = topOf(panel('Bravo')) + 5;
    await hoverAt(x, y);
    expect(rootsWith('drop-after')).toEqual(['Alpha']);
    expect(rootsWith('drop-before')).toEqual([]);
    release(x, y);
    await flushPromises();
    expect(slots()).toEqual({ a: 0, b: 0, c: 1, d: 0 });
    expect(columnTitles(0)).toEqual(['Alpha', 'Delta', 'Bravo']);
    expect(columnTitles(1)).toEqual(['Charlie']);
    expect(columnTitles(2)).toEqual([]);
    expect(columnTitles(3)).toEqual([]);
  });
});
