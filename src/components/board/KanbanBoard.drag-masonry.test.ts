import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Columns } from '../../composables/useColumns.ts';
import { useColumns } from '../../composables/useColumns.ts';
import type { Layout } from '../../composables/useLayout.ts';
import { useLayout } from '../../composables/useLayout.ts';
import type { Board } from '../../domain/types.ts';
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
import {
  cleanup,
  footers,
  mountBoard,
  release,
  resetBoard,
  sixBoard,
  stubFrames,
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

const panel = (title: string): Element => document.querySelector(`section[aria-label="${title}"]`) as Element;
const orderIds = (): string[] => appStore.board.value.categories.map((category) => category.id);
const columnTitles = (column: number): string[] =>
  Array.from(document.querySelector(`[data-column="${column}"]`)?.children ?? [])
    .filter((child) => child.classList.contains('lane'))
    .map((child) => child.getAttribute('aria-label') ?? '');
const slotMap = (): Record<string, number | undefined> =>
  Object.fromEntries(appStore.board.value.categories.map((category) => [category.id, category.column]));

const slotted = (board: Board, slots: Record<string, number>): Board => ({
  ...board,
  categories: board.categories.map((category) =>
    category.id in slots ? { ...category, column: slots[category.id] } : category,
  ),
});

const dragFromBody = (body: Element, to: { x: number; y: number }): void => {
  stubFrames();
  const x = leftOf(body) + 50;
  const y = topOf(body) + 5;
  pointerDown(body, x, y);
  pointerMove(x, y + 15);
  pointerMove(to.x, to.y);
  release(to.x, to.y);
};

const dragPanel = (source: Element, to: { x: number; y: number }): void => {
  stubFrames();
  const top = topOf(source);
  pointerDown(source, 50, top + 60);
  pointerMove(50, top + 75);
  pointerMove(to.x, to.y);
  release(to.x, to.y);
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

describe('Masonry new root drag', () => {
  it('a root created in column 0 moves above Alpha, then below Echo, staying in column 0', async () => {
    useLayout().layout.value = 'masonry';
    resetBoard(sixBoard());
    const root = mountBoard();
    await flushPromises();
    const otherColumns = [1, 2, 3].map(columnTitles);
    await footers(root)[0].trigger('click');
    await flushPromises();
    const input = root.find('[data-column="0"] .title-input');
    await input.setValue('New');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();

    layoutBoard(document.body);
    const alpha = panel('Alpha');
    dragFromBody(panel('New').querySelector('.lane-body') as Element, { x: leftOf(alpha) + 50, y: topOf(alpha) + 5 });
    await flushPromises();
    expect(columnTitles(0)).toEqual(['New', 'Alpha', 'Echo']);
    expect([1, 2, 3].map(columnTitles)).toEqual(otherColumns);
    expect(appStore.board.value.categories.find((category) => category.title === 'New')?.column).toBe(0);

    layoutBoard(document.body);
    const echo = panel('Echo');
    dragFromBody(panel('New').querySelector('.lane-body') as Element, {
      x: leftOf(echo) + 50,
      y: bottomOf(echo) - 5,
    });
    await flushPromises();
    expect(columnTitles(0)).toEqual(['Alpha', 'Echo', 'New']);
    expect([1, 2, 3].map(columnTitles)).toEqual(otherColumns);
    expect(appStore.board.value.categories.find((category) => category.title === 'New')?.column).toBe(0);
    expect(appStore.board.value.categories.filter((category) => category.id !== 's').every((category) => category.parentId === null)).toBe(true);
    expect(appStore.board.value.categories.find((category) => category.id === 's')?.parentId).toBe('a');
  });
});

describe('Column footer drop zone', () => {
  it('drops a category below a column footer into the bottom of that column', async () => {
    useLayout().layout.value = 'masonry';
    resetBoard(sixBoard());
    const root = mountBoard();
    await flushPromises();
    layoutBoard(document.body);
    const footer = document.querySelector('[data-column="1"] .add-category') as Element;
    const to = { x: leftOf(footer) + 50, y: bottomOf(footer) + 50 };
    const source = panel('Charlie');
    stubFrames();
    pointerDown(source, leftOf(source) + 50, topOf(source) + 60);
    pointerMove(leftOf(source) + 50, topOf(source) + 75);
    pointerMove(to.x, to.y);
    await flushPromises();
    expect(document.querySelector('[data-column="1"]')?.classList.contains('is-column-target')).toBe(true);
    release(to.x, to.y);
    await flushPromises();
    expect(columnTitles(1)).toEqual(['Bravo', 'Foxtrot', 'Charlie']);
    expect(columnTitles(2)).toEqual([]);
    expect(appStore.board.value.categories.find((category) => category.title === 'Charlie')?.column).toBe(1);
    expect(root.findAll('.stack.is-column-target')).toHaveLength(0);
  });
});

describe('List reorder of slotted categories', () => {
  it('moves order in List but keeps every saved slot unchanged', async () => {
    resetBoard(slotted(sixBoard(), { a: 2, b: 0, c: 1, d: 3, e: 0, f: 1 }));
    const root = mountBoard();
    await flushPromises();
    layoutBoard(document.body);
    const slotsBefore = slotMap();
    dragPanel(panel('Charlie'), { x: 50, y: topOf(panel('Alpha')) + 5 });
    await flushPromises();
    expect(orderIds()).toEqual(['c', 'a', 's', 'b', 'd', 'e', 'f']);
    expect(slotMap()).toEqual(slotsBefore);
    expect(root.findAll('.stack')).toHaveLength(0);
  });
});
