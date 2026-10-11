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

const card = (id: string, link?: string): Card => ({
  id,
  number: 1,
  title: `Card ${id}`,
  description: `Desc ${id}`,
  link,
});

const lane = (id: string, title: string, cards: Card[] = []): Category => ({
  id,
  title,
  parentId: null,
  color: null,
  cards,
});

const boardWith = (alphaCards: Card[]): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 9,
  categories: [
    lane('a', 'Alpha', alphaCards),
    lane('b', 'Bravo', [card('kb1'), card('kb2')]),
    lane('c', 'Charlie'),
  ],
});

const cards3 = (): Board => boardWith([card('k1'), card('k2'), card('k3')]);

const cardEl = (index: number): Element => document.querySelectorAll('article.card')[index];
const cardIds = (categoryId: string): string[] =>
  appStore.board.value.categories.find((category) => category.id === categoryId)?.cards.map((item) => item.id) ?? [];
const orderIds = (): string[] => appStore.board.value.categories.map((category) => category.id);

const mountCards = () => {
  const root = mountBoard(true);
  layoutBoard(document.body);
  return root;
};

const dragCard = (handle: Element, from: { x: number; y: number }, to: { x: number; y: number }): void => {
  stubFrames();
  pointerDown(handle, from.x, from.y);
  pointerMove(from.x, from.y + 10);
  pointerMove(to.x, to.y);
  release(to.x, to.y);
};

const expectTopLevelUntouched = (): void => {
  expect(orderIds()).toEqual(['a', 'b', 'c']);
  expect(appStore.board.value.categories.every((category) => category.parentId === null)).toBe(true);
  expect(appStore.board.value.categories.every((category) => category.column === undefined)).toBe(true);
};

beforeEach(() => {
  useColumns().columns.value = '4';
  useLayout().layout.value = 'list';
  resetBoard(cards3());
  installRects();
  installHitStack();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('nested task card mutations', () => {
  it('dragging a card body into the gap between two cards reorders the lane', async () => {
    mountCards();
    const k1 = cardEl(0);
    const gap = (bottomOf(cardEl(1)) + topOf(cardEl(2))) / 2;
    dragCard(k1, { x: 100, y: topOf(k1) + 10 }, { x: 100, y: gap });
    await flushPromises();
    expect(cardIds('a')).toEqual(['k2', 'k1', 'k3']);
    expectTopLevelUntouched();
  });

  it('dragging a card by its description into the top half of the card above reorders it', async () => {
    mountCards();
    const k1 = cardEl(0);
    dragCard(k1, { x: 100, y: topOf(k1) + 10 }, { x: 100, y: (bottomOf(cardEl(1)) + topOf(cardEl(2))) / 2 });
    await flushPromises();
    layoutBoard(document.body);
    expect(cardIds('a')).toEqual(['k2', 'k1', 'k3']);
    const k3Description = cardEl(2).querySelector('.description') as Element;
    const k2 = cardEl(0);
    dragCard(k3Description, { x: 100, y: topOf(cardEl(2)) + 30 }, { x: 100, y: topOf(k2) + 5 });
    await flushPromises();
    expect(cardIds('a')).toEqual(['k3', 'k2', 'k1']);
    expectTopLevelUntouched();
  });

  it('a cross-lane drag removes the card from its source and inserts it exactly between two targets', async () => {
    mountCards();
    const k1 = cardEl(0);
    const gap = (bottomOf(cardEl(3)) + topOf(cardEl(4))) / 2;
    dragCard(k1, { x: 100, y: topOf(k1) + 10 }, { x: 100, y: gap });
    await flushPromises();
    expect(cardIds('a')).toEqual(['k2', 'k3']);
    expect(cardIds('b')).toEqual(['kb1', 'k1', 'kb2']);
    expect(orderIds()).toEqual(['a', 'b', 'c']);
  });

  it('the final release position decides placement even after hovering another target', () => {
    mountCards();
    const before = appStore.board.value;
    const k3 = cardEl(2);
    stubFrames();
    pointerDown(k3, 100, topOf(k3) + 10);
    pointerMove(100, topOf(k3) + 20);
    pointerMove(100, topOf(cardEl(0)) + 5);
    release(100, bottomOf(cardEl(1)) - 5);
    expect(cardIds('a')).toEqual(['k1', 'k2', 'k3']);
    expect(appStore.board.value).toBe(before);
  });
});

describe('controls on a card never start a drag', () => {
  const expectNoDrag = (target: Element, before: Board): void => {
    stubFrames();
    pointerDown(target, 100, 70);
    pointerMove(100, 80);
    pointerMove(100, 130);
    release(100, 130);
    expect(appStore.board.value).toBe(before);
  };

  it('a card link does not start a drag', () => {
    resetBoard(boardWith([card('k1', 'https://example.com'), card('k2'), card('k3')]));
    mountBoard(true);
    layoutBoard(document.body);
    const before = appStore.board.value;
    expectNoDrag(cardEl(0).querySelector('a.link') as Element, before);
  });

  it.each(['input', 'textarea', 'form', 'label'])('a real edit form %s does not start a drag', async (selector) => {
    mountBoard(true, true);
    layoutBoard(document.body);
    (cardEl(0).querySelector('button[aria-label^="Edit card"]') as HTMLElement).click();
    await flushPromises();
    layoutBoard(document.body);
    const before = appStore.board.value;
    expectNoDrag(cardEl(0).querySelector(selector) as Element, before);
  });

  it('a card action icon does not start a drag', () => {
    mountCards();
    const before = appStore.board.value;
    expectNoDrag(cardEl(0).querySelector('button[aria-label^="Move card"] svg') as Element, before);
  });

  it('a dialog surface inside a card does not start a drag', () => {
    mountCards();
    const dialog = document.createElement('dialog');
    cardEl(0).appendChild(dialog);
    const before = appStore.board.value;
    expectNoDrag(dialog, before);
  });

  it('a right-button press does not start a drag or prevent the default action', () => {
    mountCards();
    const before = appStore.board.value;
    const press = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 2, clientX: 100, clientY: 70 });
    cardEl(0).querySelector('h3')?.dispatchEvent(press);
    expect(press.defaultPrevented).toBe(false);
    stubFrames();
    pointerMove(100, 80);
    pointerMove(100, 130);
    release(100, 130);
    expect(appStore.board.value).toBe(before);
  });
});
