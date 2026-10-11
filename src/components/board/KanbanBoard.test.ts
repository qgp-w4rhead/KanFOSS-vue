import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Columns } from '../../composables/useColumns.ts';
import { useColumns } from '../../composables/useColumns.ts';
import type { Layout } from '../../composables/useLayout.ts';
import { useLayout } from '../../composables/useLayout.ts';
import { appStore } from '../../store/app-store.ts';
import {
  beginDrag,
  cleanup,
  createdIn,
  footers,
  mountBoard,
  type Root,
  resetBoard,
  sixBoard,
  stackTitles,
  targeted,
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

beforeEach(() => {
  useColumns().columns.value = '4';
  useLayout().layout.value = 'masonry';
  resetBoard(sixBoard());
});

afterEach(cleanup);

describe('masonry add-category footers', () => {
  it('renders one footer per stack even when there are fewer categories', () => {
    resetBoard(threeBoard());
    const root = mountBoard();
    expect(root.findAll('.stack')).toHaveLength(4);
    expect(footers(root)).toHaveLength(4);
    expect(root.findAll('.stack')[3].findAll('.lane')).toHaveLength(0);
  });

  it('keeps each footer as the last child of its own stack', () => {
    resetBoard(threeBoard());
    const root = mountBoard();
    root.findAll('.stack').forEach((stack, column) => {
      const children = Array.from(stack.element.children);
      const footer = children[children.length - 1];
      expect(footer.classList.contains('add-category')).toBe(true);
      expect(stack.element.getAttribute('data-column')).toBe(String(column));
      expect(footer.getAttribute('aria-label')).toBe(`Add category to column ${column + 1}`);
    });
  });

  it.each([0, 1, 2, 3])('clicking footer %i appends a top-level category only to that stack', async (column) => {
    const root = mountBoard();
    const before = appStore.board.value.categories.map((category) => category.id);
    const beforeStacks = stackTitles(root);
    await footers(root)[column].trigger('click');
    await flushPromises();
    const categories = appStore.board.value.categories;
    expect(categories.slice(0, -1).map((category) => category.id)).toEqual(before);
    expect(categories[categories.length - 1]).toMatchObject({ parentId: null, column });
    stackTitles(root).forEach((titles, index) => {
      const expected = index === column ? [...beforeStacks[index], 'Untitled category'] : beforeStacks[index];
      expect(titles).toEqual(expected);
    });
  });

  it('appends two new categories to the clicked stack and keeps the originals in place', async () => {
    const root = mountBoard();
    const before = appStore.board.value.categories.map((category) => category.id);
    const beforeStacks = stackTitles(root);
    await footers(root)[1].trigger('click');
    await footers(root)[1].trigger('click');
    await flushPromises();
    const after = appStore.board.value.categories;
    const added = after.filter((category) => !before.includes(category.id));
    expect(added).toHaveLength(2);
    expect(added.map((category) => category.column)).toEqual([1, 1]);
    expect(after.slice(0, before.length).map((category) => category.id)).toEqual(before);
    expect(stackTitles(root)[1]).toEqual([...beforeStacks[1], 'Untitled category', 'Untitled category']);
    expect(stackTitles(root).filter((_, index) => index !== 1)).toEqual(beforeStacks.filter((_, index) => index !== 1));
  });

  it('creates a category in the empty fourth stack', async () => {
    resetBoard(threeBoard());
    const root = mountBoard();
    await footers(root)[3].trigger('click');
    await flushPromises();
    expect(createdIn(3)).toHaveLength(1);
    expect(stackTitles(root)[3]).toEqual(['Untitled category']);
  });

  it('opens the title editor on the new category in the clicked stack', async () => {
    const root = mountBoard();
    await footers(root)[2].trigger('click');
    await flushPromises();
    const input = root.find('[data-column="2"] .title-input');
    expect(input.exists()).toBe(true);
    expect(input.element).toBe(document.activeElement);
  });

  it('keeps membership across Masonry, List, and back to Masonry', async () => {
    const root = mountBoard();
    await footers(root)[2].trigger('click');
    await flushPromises();
    useLayout().layout.value = 'list';
    await flushPromises();
    expect(root.findAll('.stack')).toHaveLength(0);
    expect(footers(root)).toHaveLength(1);
    useLayout().layout.value = 'masonry';
    await flushPromises();
    expect(stackTitles(root)[2]).toEqual(['Charlie', 'Untitled category']);
  });

  it('recomputes the Auto stack count from the observed width', async () => {
    const callbacks: ResizeObserverCallback[] = [];
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: ResizeObserverCallback) {
          callbacks.push(callback);
        }
        observe(): void {}
        unobserve(): void {}
        disconnect(): void {}
      },
    );
    useColumns().columns.value = 'auto';
    const root = mountBoard();
    expect(root.findAll('.stack')).toHaveLength(1);
    callbacks.forEach((callback) =>
      callback([{ contentRect: { width: 1000 } } as ResizeObserverEntry], {} as ResizeObserver),
    );
    await flushPromises();
    expect(root.findAll('.stack')).toHaveLength(3);
  });

  it('highlights only the hovered column footer during a drag', async () => {
    const root = mountBoard();
    beginDrag(root.find('.grip').element, footers(root)[1].element);
    await flushPromises();
    expect(targeted(root)).toEqual([false, true, false, false]);
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await flushPromises();
    expect(targeted(root)).toEqual([false, false, false, false]);
  });
});

describe('list mode', () => {
  const listLanes = (root: Root): HTMLElement => root.find('.lanes').element as HTMLElement;

  it.each(['auto', '1', '4', '6'] as const)('keeps one full-width track with saved preference %s', (preference) => {
    useColumns().columns.value = preference;
    useLayout().layout.value = 'list';
    const root = mountBoard();
    const lanes = listLanes(root);
    expect(lanes.style.gridTemplateColumns).toBe('minmax(0, 1fr)');
    expect(lanes.style.columnCount).toBe('');
    expect(lanes.style.columnWidth).toBe('');
    expect(root.findAll('.stack')).toHaveLength(0);
    const top = Array.from(lanes.children).filter((child) => child.classList.contains('lane'));
    expect(top.map((child) => child.getAttribute('aria-label'))).toEqual([
      'Alpha',
      'Bravo',
      'Charlie',
      'Delta',
      'Echo',
      'Foxtrot',
    ]);
    expect(lanes.querySelector('[aria-label="Alpha"] [aria-label="Alpha sub"]')).not.toBeNull();
    const addButtons = Array.from(lanes.children).filter((child) => child.classList.contains('add-category'));
    expect(addButtons).toHaveLength(1);
    expect(lanes.lastElementChild).toBe(addButtons[0]);
  });

  it('keeps one track when the saved preference changes while in List', async () => {
    useLayout().layout.value = 'list';
    const root = mountBoard();
    useColumns().columns.value = '2';
    await flushPromises();
    expect(listLanes(root).style.gridTemplateColumns).toBe('minmax(0, 1fr)');
    expect(root.findAll('.stack')).toHaveLength(0);
  });

  it('restores the locked Masonry count and membership after a List round trip', async () => {
    const root = mountBoard();
    await footers(root)[2].trigger('click');
    await flushPromises();
    const beforeStacks = stackTitles(root);
    useLayout().layout.value = 'list';
    await flushPromises();
    useLayout().layout.value = 'masonry';
    await flushPromises();
    expect(useColumns().columns.value).toBe('4');
    expect(listLanes(root).style.gridTemplateColumns).toBe('repeat(4, minmax(0, 1fr))');
    expect(footers(root)).toHaveLength(4);
    expect(stackTitles(root)).toEqual(beforeStacks);
  });
});
