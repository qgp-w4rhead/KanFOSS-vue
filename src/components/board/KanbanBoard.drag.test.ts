import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Columns } from '../../composables/useColumns.ts';
import { useColumns } from '../../composables/useColumns.ts';
import type { Layout } from '../../composables/useLayout.ts';
import { useLayout } from '../../composables/useLayout.ts';
import type { Board, Card, Category } from '../../domain/types.ts';
import { appStore } from '../../store/app-store.ts';
import {
  heightOf,
  installHitStack,
  installRects,
  layoutBoard,
  leftOf,
  pointerDown,
  pointerMove,
  topOf,
} from './kanban-board.drag-harness.ts';
import {
  cleanup,
  footers,
  mountBoard,
  release,
  resetBoard,
  sixBoard,
  stubFrames,
  threeBoard,
} from './kanban-board.harness.ts';

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
  const layout = ref<Layout>('masonry');
  return { useLayout: () => ({ layout }) };
});

const card = (id: string): Card => ({ id, number: 1, title: `Card ${id}`, description: '' });

const cardsBoard = (): Board => {
  const lane = (id: string, title: string, cards: Card[] = []): Category => ({
    id,
    title,
    parentId: null,
    color: null,
    cards,
  });
  return {
    schemaVersion: 2,
    id: 'board',
    title: 'Board',
    nextCardNumber: 3,
    categories: [lane('a', 'Alpha', [card('k1'), card('k2')]), lane('b', 'Bravo'), lane('c', 'Charlie')],
  };
};

const panel = (title: string): Element => document.querySelector(`section[aria-label="${title}"]`) as Element;
const cardEl = (index: number): Element => document.querySelectorAll('article.card')[index];
const titles = (): string[] => appStore.board.value.categories.map((category) => category.title);
const orderIds = (): string[] => appStore.board.value.categories.map((category) => category.id);

const dragPanel = (source: Element, to: { x: number; y: number }): void => {
  stubFrames();
  const top = topOf(source);
  pointerDown(source, 50, top + 60);
  pointerMove(50, top + 75);
  pointerMove(to.x, to.y);
  release(to.x, to.y);
};

const dragCard = (handle: Element, from: { x: number; y: number }, to: { x: number; y: number }): void => {
  stubFrames();
  pointerDown(handle, from.x, from.y);
  pointerMove(from.x, from.y + 10);
  pointerMove(to.x, to.y);
  release(to.x, to.y);
};

const columnTitles = (column: number): string[] =>
  Array.from(document.querySelector(`[data-column="${column}"]`)?.children ?? [])
    .filter((child) => child.classList.contains('lane'))
    .map((child) => child.getAttribute('aria-label') ?? '');

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

describe('category panel drag on the board', () => {
  it('a new category created in List and renamed moves above an existing panel', async () => {
    resetBoard(threeBoard());
    const root = mountBoard();
    await footers(root)[0].trigger('click');
    await flushPromises();
    const input = root.find('.title-input');
    await input.setValue('Delta');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    layoutBoard(document.body);
    dragPanel(panel('Delta'), { x: 50, y: topOf(panel('Alpha')) + 5 });
    await flushPromises();
    expect(titles()).toEqual(['Delta', 'Alpha', 'Bravo', 'Charlie']);
    expect(appStore.board.value.categories.every((category) => category.parentId === null)).toBe(true);
  });

  it('a category dragged into the lower part of the last panel moves to the bottom', async () => {
    resetBoard(threeBoard());
    mountBoard();
    layoutBoard(document.body);
    dragPanel(panel('Alpha'), { x: 50, y: topOf(panel('Charlie')) + heightOf(panel('Charlie')) - 10 });
    await flushPromises();
    expect(titles()).toEqual(['Bravo', 'Charlie', 'Alpha']);
  });

  it('a parent dragged before another panel carries its subcategory with it', async () => {
    resetBoard(sixBoard());
    mountBoard();
    layoutBoard(document.body);
    dragPanel(panel('Alpha'), { x: 50, y: topOf(panel('Charlie')) + 5 });
    await flushPromises();
    expect(orderIds()).toEqual(['b', 'a', 's', 'c', 'd', 'e', 'f']);
    expect(appStore.board.value.categories.find((category) => category.id === 's')?.parentId).toBe('a');
  });

  it('a category dropped on its own panel centre is a no-op', async () => {
    resetBoard(sixBoard());
    mountBoard();
    layoutBoard(document.body);
    const before = appStore.board.value;
    dragPanel(panel('Alpha'), { x: 50, y: topOf(panel('Alpha')) + heightOf(panel('Alpha')) / 2 });
    await flushPromises();
    expect(appStore.board.value).toBe(before);
  });
});

describe('cross-column and List placement', () => {
  it('dragging a panel above a panel in another column places it in that column', async () => {
    useLayout().layout.value = 'masonry';
    resetBoard(sixBoard());
    mountBoard();
    await flushPromises();
    layoutBoard(document.body);
    const target = panel('Charlie');
    dragPanel(panel('Alpha'), { x: leftOf(target) + 50, y: topOf(target) + 5 });
    await flushPromises();
    expect(appStore.board.value.categories.find((category) => category.id === 'a')?.column).toBe(2);
    expect(columnTitles(2)).toEqual(['Alpha', 'Charlie']);
    useLayout().layout.value = 'list';
    await flushPromises();
    expect(document.querySelectorAll('.stack')).toHaveLength(0);
    expect(appStore.board.value.categories.find((category) => category.id === 'a')?.column).toBe(2);
  });
});

describe('real nested cards', () => {
  const mountCards = () => {
    resetBoard(cardsBoard());
    const root = mountBoard(true);
    layoutBoard(document.body);
    return root;
  };

  it('dragging a card from its title reorders it after another card in the same lane', () => {
    mountCards();
    const before = appStore.board.value;
    const handle = cardEl(0).querySelector('h3') as Element;
    dragCard(handle, { x: 100, y: 70 }, { x: 100, y: 130 });
    expect(appStore.board.value).not.toBe(before);
    const lane = appStore.board.value.categories.find((category) => category.id === 'a');
    expect(lane?.cards.map((item) => item.id)).toEqual(['k2', 'k1']);
    expect(orderIds()).toEqual(['a', 'b', 'c']);
  });

  it('a card dropped in the gap between cards does not snap to its own edge', () => {
    mountCards();
    const before = appStore.board.value;
    dragCard(cardEl(1).querySelector('h3') as Element, { x: 100, y: 110 }, { x: 100, y: 94 });
    expect(appStore.board.value).toBe(before);
  });

  it('controls on a card do not start a drag', () => {
    mountCards();
    const before = appStore.board.value;
    const edit = cardEl(0).querySelector('button[aria-label^="Edit card"]') as Element;
    stubFrames();
    pointerDown(edit, 100, 70);
    pointerMove(100, 150);
    release(100, 150);
    expect(appStore.board.value).toBe(before);
  });

  it('Escape cancels a card drag without changing the board', () => {
    mountCards();
    const before = appStore.board.value;
    stubFrames();
    pointerDown(cardEl(0).querySelector('h3') as Element, 100, 70);
    pointerMove(100, 80);
    pointerMove(100, 130);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    release(100, 130);
    expect(appStore.board.value).toBe(before);
  });

  it('a movement under five pixels does nothing', () => {
    mountCards();
    const before = appStore.board.value;
    stubFrames();
    pointerDown(cardEl(0).querySelector('h3') as Element, 100, 70);
    pointerMove(100, 73);
    release(100, 130);
    expect(appStore.board.value).toBe(before);
  });

  it('pointercancel ends a card drag without changing the board', () => {
    mountCards();
    const before = appStore.board.value;
    stubFrames();
    pointerDown(cardEl(0).querySelector('h3') as Element, 100, 70);
    pointerMove(100, 80);
    pointerMove(100, 130);
    window.dispatchEvent(new Event('pointercancel'));
    release(100, 130);
    expect(appStore.board.value).toBe(before);
  });
});
