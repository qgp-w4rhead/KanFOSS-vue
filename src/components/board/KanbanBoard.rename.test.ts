import { flushPromises } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Columns } from '../../composables/useColumns.ts';
import { useColumns } from '../../composables/useColumns.ts';
import type { Layout } from '../../composables/useLayout.ts';
import { useLayout } from '../../composables/useLayout.ts';
import { MAX_CATEGORIES } from '../../domain/limits.ts';
import { appStore } from '../../store/app-store.ts';
import {
  beginDrag,
  capBoard,
  cardBoard,
  cardGrip,
  cleanup,
  footers,
  mountBoard,
  pressKey,
  release,
  resetBoard,
  sixBoard,
  targeted,
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

describe('rename requests', () => {
  it('does not reopen the editor after a named category is switched to List and back', async () => {
    const root = mountBoard();
    await footers(root)[2].trigger('click');
    await flushPromises();
    await root.find('[data-column="2"] .title-input').setValue('Renamed');
    await pressKey(root, '[data-column="2"] .title-input', 'Enter');
    await flushPromises();
    expect(appStore.board.value.categories.some((category) => category.title === 'Renamed')).toBe(true);
    useLayout().layout.value = 'list';
    await flushPromises();
    useLayout().layout.value = 'masonry';
    await flushPromises();
    expect(root.findAll('.title-input')).toHaveLength(0);
  });

  it('does not reopen an escaped editor after a layout switch, but a new add still focuses once', async () => {
    const root = mountBoard();
    await footers(root)[1].trigger('click');
    await flushPromises();
    await pressKey(root, '[data-column="1"] .title-input', 'Escape');
    await flushPromises();
    useLayout().layout.value = 'list';
    await flushPromises();
    useLayout().layout.value = 'masonry';
    await flushPromises();
    expect(root.findAll('.title-input')).toHaveLength(0);
    await footers(root)[0].trigger('click');
    await flushPromises();
    const fresh = root.findAll('.title-input');
    expect(fresh).toHaveLength(1);
    expect(fresh[0].element).toBe(document.activeElement);
  });
});

describe('creation at the category cap', () => {
  it('disables every creation footer at the cap', () => {
    resetBoard(capBoard());
    const root = mountBoard();
    expect(footers(root).map((footer) => (footer.element as HTMLButtonElement).disabled)).toEqual([
      true,
      true,
      true,
      true,
    ]);
  });

  it('a card drag below the cap highlights the hovered footer', async () => {
    resetBoard(cardBoard());
    const root = mountBoard(true);
    beginDrag(cardGrip(root), footers(root)[1].element);
    await flushPromises();
    expect(targeted(root)).toEqual([false, true, false, false]);
  });

  it('a card drag at the cap neither highlights a footer nor changes the board', async () => {
    resetBoard(capBoard());
    const root = mountBoard(true);
    const before = appStore.board.value;
    beginDrag(cardGrip(root), footers(root)[1].element);
    await flushPromises();
    expect(targeted(root)).toEqual([false, false, false, false]);
    release();
    await flushPromises();
    expect(appStore.board.value).toBe(before);
    expect(appStore.board.value.categories).toHaveLength(MAX_CATEGORIES);
  });

  it('an existing category can still be dropped on a footer at the cap', async () => {
    resetBoard(capBoard());
    const root = mountBoard();
    beginDrag(root.find('.grip').element, footers(root)[1].element);
    await flushPromises();
    expect(targeted(root)).toEqual([false, true, false, false]);
    release();
    await flushPromises();
    const categories = appStore.board.value.categories;
    expect(categories).toHaveLength(MAX_CATEGORIES);
    expect(categories.find((category) => category.id === 'c0')?.column).toBe(1);
  });
});
