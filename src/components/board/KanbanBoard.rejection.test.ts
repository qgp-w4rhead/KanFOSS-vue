import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Columns } from '../../composables/useColumns.ts';
import { useColumns } from '../../composables/useColumns.ts';
import type { Layout } from '../../composables/useLayout.ts';
import { useLayout } from '../../composables/useLayout.ts';
import { NEST_BLOCKED_REASON } from '../../domain/drop.ts';
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
import { cleanup, mountBoard, release, resetBoard, stubFrames } from './kanban-board.harness.ts';

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

const card = (id: string): Card => ({ id, number: 1, title: `Card ${id}`, description: '' });

const lane = (id: string, title: string, cards: Card[] = [], parentId: string | null = null): Category => ({
  id,
  title,
  parentId,
  color: null,
  cards,
});

const boardOf = (categories: Category[]): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 9,
  categories,
});

const treeBoard = (): Board => boardOf([lane('a', 'Alpha'), lane('s', 'Sub', [], 'a'), lane('b', 'Bravo')]);

const section = (title: string): Element => document.querySelector(`section[aria-label="${title}"]`) as Element;
const overlaysOwnedBy = (element: Element): number =>
  Array.from(element.children).filter((child) => child.classList.contains('drop-rejection')).length;
const rejectedRoots = (): string[] =>
  Array.from(document.querySelectorAll('section.lane.is-drop-rejected')).map((element) => element.getAttribute('aria-label') ?? '');
const topLevelTitles = (): string[] =>
  appStore.board.value.categories.filter((item) => item.parentId === null).map((item) => item.title);
const orderIds = (): string[] => appStore.board.value.categories.map((item) => item.id);
const parentIds = (): Record<string, string | null> =>
  Object.fromEntries(appStore.board.value.categories.map((item) => [item.id, item.parentId]));

const startPanel = async (title: string): Promise<void> => {
  stubFrames();
  const body = section(title).querySelector('.lane-body') as Element;
  const x = leftOf(body) + 50;
  const y = topOf(body) + 5;
  pointerDown(body, x, y);
  pointerMove(x, y + 15);
  await flushPromises();
};

const centreOf = (title: string): { x: number; y: number } => {
  const panel = section(title);
  return { x: leftOf(panel) + 50, y: (topOf(panel) + bottomOf(panel)) / 2 };
};

const hoverAt = async (point: { x: number; y: number }): Promise<void> => {
  pointerMove(point.x, point.y);
  await flushPromises();
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

describe('a subcategory centre nests into its parent in List', () => {
  it('a root over a subcategory centre shows the parent panel as the nest target and release nests into it', async () => {
    resetBoard(treeBoard());
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Bravo');
    const point = centreOf('Sub');
    await hoverAt(point);
    expect(rejectedRoots()).toEqual([]);
    expect(overlaysOwnedBy(section('Sub'))).toBe(0);
    expect(section('Alpha').classList.contains('drop-center')).toBe(true);
    expect(['drop-before', 'drop-after', 'drop-center'].some((name) => section('Sub').classList.contains(name))).toBe(false);
    release(point.x, point.y);
    await flushPromises();
    expect(orderIds()).toEqual(['a', 's', 'b']);
    expect(parentIds()).toEqual({ a: null, s: 'a', b: 'a' });
    expect(topLevelTitles()).toEqual(['Alpha']);
  });

  it('moving to a subcategory edge swaps the parent-centre outline for the legal edge', async () => {
    resetBoard(treeBoard());
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Bravo');
    await hoverAt(centreOf('Sub'));
    expect(section('Alpha').classList.contains('drop-center')).toBe(true);
    await hoverAt({ x: leftOf(section('Sub')) + 50, y: topOf(section('Sub')) + 5 });
    expect(section('Alpha').classList.contains('drop-center')).toBe(false);
    expect(section('Alpha').classList.contains('drop-before')).toBe(true);
  });

  it('Escape clears the centre indicator', async () => {
    resetBoard(treeBoard());
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Bravo');
    await hoverAt(centreOf('Sub'));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(section('Alpha').classList.contains('drop-center')).toBe(false);
  });

  it('pointercancel clears the centre indicator', async () => {
    resetBoard(treeBoard());
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Bravo');
    await hoverAt(centreOf('Sub'));
    window.dispatchEvent(new Event('pointercancel'));
    await flushPromises();
    expect(section('Alpha').classList.contains('drop-center')).toBe(false);
  });

  it('a parent with subcategories over a foreign subcategory centre shows the X on that sub parent', async () => {
    resetBoard(
      boardOf([
        lane('a', 'Alpha'),
        lane('s', 'Sub', [], 'a'),
        lane('b', 'Bravo'),
        lane('t', 'Sub-B', [], 'b'),
        lane('c', 'Charlie'),
      ]),
    );
    mountBoard();
    layoutBoard(document.body);
    const before = appStore.board.value;
    await startPanel('Alpha');
    const point = centreOf('Sub-B');
    await hoverAt(point);
    expect(rejectedRoots()).toEqual(['Bravo']);
    release(point.x, point.y);
    await flushPromises();
    expect(appStore.board.value).toBe(before);
    expect(appStore.message.value).toBe(NEST_BLOCKED_REASON);
  });

  it('a parent with subcategories shows the existing nest reason on a top-level centre', async () => {
    resetBoard(treeBoard());
    mountBoard();
    layoutBoard(document.body);
    const before = appStore.board.value;
    await startPanel('Alpha');
    const point = centreOf('Bravo');
    await hoverAt(point);
    expect(rejectedRoots()).toEqual(['Bravo']);
    expect(overlaysOwnedBy(section('Alpha'))).toBe(0);
    release(point.x, point.y);
    await flushPromises();
    expect(appStore.board.value).toBe(before);
    expect(appStore.message.value).toBe(NEST_BLOCKED_REASON);
  });

  it('a task card dropped on a subcategory centre appends normally with no X', async () => {
    resetBoard(boardOf([lane('a', 'Alpha'), lane('s', 'Sub', [], 'a'), lane('b', 'Bravo', [card('k')])]));
    mountBoard(true);
    layoutBoard(document.body);
    const article = document.querySelector('article.card') as Element;
    stubFrames();
    pointerDown(article, leftOf(article) + 50, topOf(article) + 10);
    pointerMove(leftOf(article) + 50, topOf(article) + 20);
    await flushPromises();
    const point = centreOf('Sub');
    await hoverAt(point);
    expect(document.querySelectorAll('.drop-rejection')).toHaveLength(0);
    release(point.x, point.y);
    await flushPromises();
    expect(appStore.board.value.categories.find((item) => item.id === 's')?.cards.map((item) => item.id)).toEqual(['k']);
  });

  it('a same-parent subcategory neighbour edge reorders normally with no X', async () => {
    resetBoard(boardOf([lane('a', 'Alpha'), lane('s1', 'One', [], 'a'), lane('s2', 'Two', [], 'a'), lane('b', 'Bravo')]));
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Two');
    await hoverAt({ x: leftOf(section('One')) + 50, y: topOf(section('One')) + 5 });
    expect(document.querySelectorAll('.drop-rejection')).toHaveLength(0);
    release(leftOf(section('One')) + 50, topOf(section('One')) + 5);
    await flushPromises();
    expect(orderIds()).toEqual(['a', 's2', 's1', 'b']);
    expect(topLevelTitles()).toEqual(['Alpha', 'Bravo']);
  });

  it('a parent dragged over its own subcategory centre shows no X', async () => {
    resetBoard(treeBoard());
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Alpha');
    await hoverAt(centreOf('Sub'));
    expect(document.querySelectorAll('.drop-rejection')).toHaveLength(0);
  });
});

describe('a subcategory centre nests into its parent in Masonry', () => {
  it('the same promotion applies inside a stack and the release nests under the parent', async () => {
    useLayout().layout.value = 'masonry';
    resetBoard(treeBoard());
    mountBoard();
    layoutBoard(document.body);
    await startPanel('Bravo');
    const point = centreOf('Sub');
    await hoverAt(point);
    expect(rejectedRoots()).toEqual([]);
    expect(section('Alpha').classList.contains('drop-center')).toBe(true);
    release(point.x, point.y);
    await flushPromises();
    expect(orderIds()).toEqual(['a', 's', 'b']);
    expect(parentIds()).toEqual({ a: null, s: 'a', b: 'a' });
  });
});
