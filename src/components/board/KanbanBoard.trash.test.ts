import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Columns } from '../../composables/useColumns.ts';
import { useColumns } from '../../composables/useColumns.ts';
import type { Layout } from '../../composables/useLayout.ts';
import { useLayout } from '../../composables/useLayout.ts';
import type { Board, Card, Category } from '../../domain/types.ts';
import { appStore } from '../../store/app-store.ts';
import { DialogStub } from './dialog-stub.harness.ts';
import KanbanBoard from './KanbanBoard.vue';

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

const boardWithSubcategory = (): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 3,
  categories: [lane('a', 'Alpha', [card('c1')]), lane('s', 'Sub', [card('x1')], 'a'), lane('b', 'Bravo')],
});

const mounted: { unmount: () => void }[] = [];

beforeEach(() => {
  useColumns().columns.value = '4';
  useLayout().layout.value = 'list';
});

afterEach(() => {
  mounted.splice(0).forEach((root) => root.unmount());
});

describe('deleting a category from its trash icon', () => {
  it('confirming removes the category with its subcategories and cards, and undo restores the whole board', async () => {
    appStore.dispatch({ type: 'replace-board', board: boardWithSubcategory() });
    const original = appStore.board.value;
    const root = mount(KanbanBoard, {
      attachTo: document.body,
      global: { stubs: { UiDialog: DialogStub, ColorPicker: true, CardForm: true, CardItem: true } },
    });
    mounted.push(root);
    (document.querySelector('[aria-label="Delete category Alpha"]') as HTMLElement).click();
    await flushPromises();
    (document.querySelector('.dialog-stub .ui-row.is-danger') as HTMLElement).click();
    await flushPromises();
    expect(appStore.board.value.categories.map((item) => item.id)).toEqual(['b']);
    appStore.undo();
    await flushPromises();
    expect(appStore.board.value).toBe(original);
  });
});
