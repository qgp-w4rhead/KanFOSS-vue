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

const card = (id: string): Card => ({ id, number: 1, title: `Card ${id}`, description: `Desc ${id}` });

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

const twoCardBoard = (): Board =>
  boardOf([lane('a', 'Alpha', [card('A'), card('B')]), lane('b', 'Bravo')]);

const subBoard = (): Board =>
  boardOf([lane('a', 'Alpha'), lane('s1', 'One', [], 'a'), lane('s2', 'Two', [], 'a'), lane('b', 'Bravo')]);

const articleOf = (id: string): Element =>
  Array.from(document.querySelectorAll('article.card')).find(
    (element) => element.querySelector('h3')?.textContent?.trim() === `Card ${id}`,
  ) as Element;

const section = (title: string): Element => document.querySelector(`section[aria-label="${title}"]`) as Element;
const cardIds = (categoryId: string): string[] =>
  appStore.board.value.categories.find((category) => category.id === categoryId)?.cards.map((item) => item.id) ?? [];
const orderIds = (): string[] => appStore.board.value.categories.map((category) => category.id);
const parentIds = (): Record<string, string | null> =>
  Object.fromEntries(appStore.board.value.categories.map((category) => [category.id, category.parentId]));

const activeCardOwners = (): string[] =>
  Array.from(document.querySelectorAll('article.card'))
    .filter((element) => element.classList.contains('drop-before') || element.classList.contains('drop-after'))
    .map((element) => element.querySelector('h3')?.textContent?.trim() ?? '');

const activeSubOwners = (className: string): string[] =>
  Array.from(document.querySelectorAll('section.lane.is-sub'))
    .filter((element) => element.classList.contains(className))
    .map((element) => element.getAttribute('aria-label') ?? '');

const activeLaneOwners = (className: string): string[] =>
  Array.from(document.querySelectorAll('section.lane:not(.is-sub)'))
    .filter((element) => element.classList.contains(className))
    .map((element) => element.getAttribute('aria-label') ?? '');

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

const startSub = async (title: string): Promise<void> => {
  stubFrames();
  const body = section(title).querySelector('.lane-body') as Element;
  const x = leftOf(body) + 50;
  const y = topOf(body) + 5;
  pointerDown(body, x, y);
  pointerMove(x, y + 15);
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

describe('adjacent task cards swap by the half that is hovered', () => {
  it('bottom half of B moves A after B, then bottom half of A moves B after A, then top half of A puts B first', async () => {
    resetBoard(twoCardBoard());
    mountBoard(true);
    layoutBoard(document.body);

    await startCard('A');
    await hoverAt(100, bottomOf(articleOf('B')) - 5);
    expect(activeCardOwners()).toEqual(['Card B']);
    release(100, bottomOf(articleOf('B')) - 5);
    await flushPromises();
    expect(cardIds('a')).toEqual(['B', 'A']);
    layoutBoard(document.body);

    await startCard('B');
    await hoverAt(100, bottomOf(articleOf('A')) - 5);
    expect(activeCardOwners()).toEqual(['Card A']);
    release(100, bottomOf(articleOf('A')) - 5);
    await flushPromises();
    expect(cardIds('a')).toEqual(['A', 'B']);
    layoutBoard(document.body);

    await startCard('B');
    await hoverAt(100, topOf(articleOf('A')) + 5);
    expect(activeCardOwners()).toEqual(['Card A']);
    release(100, topOf(articleOf('A')) + 5);
    await flushPromises();
    expect(cardIds('a')).toEqual(['B', 'A']);
  });
});

describe('a subcategory cannot redrop inside its own parent', () => {
  it('the parent centre shows no target and the release leaves the board unchanged', async () => {
    resetBoard(subBoard());
    mountBoard();
    layoutBoard(document.body);
    const alpha = section('Alpha');
    await startSub('One');
    await hoverAt(leftOf(alpha) + 4, topOf(alpha) + (bottomOf(alpha) - topOf(alpha)) / 2);
    expect(['drop-before', 'drop-after', 'drop-center'].some((name) => alpha.classList.contains(name))).toBe(false);
    expect(alpha.classList.contains('is-drop-rejected')).toBe(false);
    release(leftOf(alpha) + 4, topOf(alpha) + (bottomOf(alpha) - topOf(alpha)) / 2);
    await flushPromises();
    expect(orderIds()).toEqual(['a', 's1', 's2', 'b']);
    expect(parentIds()).toEqual({ a: null, s1: 'a', s2: 'a', b: null });
  });
});

describe('sibling subcategory panels use top and bottom halves', () => {
  it('top half of a sibling gives a single before owner and reorders inside the parent only', async () => {
    resetBoard(subBoard());
    mountBoard();
    layoutBoard(document.body);
    await startSub('Two');
    await hoverAt(100, topOf(section('One')) + 5);
    expect(activeSubOwners('drop-before')).toEqual(['One']);
    expect(activeSubOwners('drop-after')).toEqual([]);
    release(100, topOf(section('One')) + 5);
    await flushPromises();
    expect(orderIds()).toEqual(['a', 's2', 's1', 'b']);
    expect(parentIds()).toEqual({ a: null, s2: 'a', s1: 'a', b: null });
  });

  it('bottom half of a sibling gives a single after owner and keeps the parent order', async () => {
    resetBoard(subBoard());
    mountBoard();
    layoutBoard(document.body);
    await startSub('One');
    await hoverAt(100, bottomOf(section('Two')) - 5);
    expect(activeSubOwners('drop-after')).toEqual(['Two']);
    expect(activeSubOwners('drop-before')).toEqual([]);
    release(100, bottomOf(section('Two')) - 5);
    await flushPromises();
    expect(orderIds()).toEqual(['a', 's2', 's1', 'b']);
    expect(parentIds()).toEqual({ a: null, s2: 'a', s1: 'a', b: null });
  });
});

describe('a category cannot rearrange into its own slot', () => {
  it('the seam directly above a dragged lane shows no indicator and the release is a no-op', async () => {
    resetBoard(subBoard());
    mountBoard();
    layoutBoard(document.body);
    const alpha = section('Alpha');
    await startSub('Bravo');
    await hoverAt(50, bottomOf(alpha) + 8);
    expect(activeLaneOwners('drop-before')).toEqual([]);
    expect(activeLaneOwners('drop-after')).toEqual([]);
    expect(activeLaneOwners('drop-center')).toEqual([]);
    release(50, bottomOf(alpha) + 8);
    await flushPromises();
    expect(orderIds()).toEqual(['a', 's1', 's2', 'b']);
    expect(parentIds()).toEqual({ a: null, s1: 'a', s2: 'a', b: null });
  });

  it('a subcategory sees no indicator on the seam right after its previous sibling', async () => {
    resetBoard(subBoard());
    mountBoard();
    layoutBoard(document.body);
    await startSub('Two');
    await hoverAt(100, bottomOf(section('One')) - 5);
    expect(activeSubOwners('drop-after')).toEqual([]);
    expect(activeSubOwners('drop-before')).toEqual([]);
    release(100, bottomOf(section('One')) - 5);
    await flushPromises();
    expect(orderIds()).toEqual(['a', 's1', 's2', 'b']);
    expect(parentIds()).toEqual({ a: null, s1: 'a', s2: 'a', b: null });
  });
});

describe('a card drop on lane space shows one seam instead of outlining the body', () => {
  it('hovering the body outside the cards lights only the last card and appends on release', async () => {
    resetBoard(twoCardBoard());
    mountBoard(true);
    layoutBoard(document.body);
    const body = section('Alpha').querySelector('.lane-body') as Element;
    const x = leftOf(body) + body.getBoundingClientRect().width - 4;
    await startCard('A');
    await hoverAt(x, topOf(body) + 30);
    expect(activeCardOwners()).toEqual(['Card B']);
    expect(body.classList.contains('is-target')).toBe(false);
    release(x, topOf(body) + 30);
    await flushPromises();
    expect(cardIds('a')).toEqual(['B', 'A']);
  });

  it('an empty lane keeps the body outline since no card can carry the seam', async () => {
    resetBoard(twoCardBoard());
    mountBoard(true);
    layoutBoard(document.body);
    const body = section('Bravo').querySelector('.lane-body') as Element;
    const x = leftOf(body) + 50;
    await startCard('A');
    await hoverAt(x, topOf(body) + 10);
    expect(body.classList.contains('is-target')).toBe(true);
    expect(activeCardOwners()).toEqual([]);
    release(x, topOf(body) + 10);
    await flushPromises();
    expect(cardIds('a')).toEqual(['B']);
    expect(cardIds('b')).toEqual(['A']);
  });
});
