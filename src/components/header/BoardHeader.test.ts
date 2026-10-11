import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { Columns } from '../../composables/useColumns.ts';
import { useColumns } from '../../composables/useColumns.ts';
import type { Layout } from '../../composables/useLayout.ts';
import { useLayout } from '../../composables/useLayout.ts';
import type { Board, Category } from '../../domain/types.ts';
import { appStore } from '../../store/app-store.ts';
import KanbanBoard from '../board/KanbanBoard.vue';
import BoardHeader from './BoardHeader.vue';

vi.mock('../../store/app-store.ts', async () => {
  const { createBoardStore } = await import('../../store/board-store.ts');
  const empty = { schemaVersion: 2 as const, id: 'empty', title: 'Empty', nextCardNumber: 1, categories: [] };
  return { appStore: createBoardStore({ load: () => null, save: () => undefined }, () => empty) };
});

vi.mock('../../composables/useColumns.ts', async () => {
  const { ref } = await import('vue');
  const columns = ref<Columns>('auto');
  return { COLUMN_OPTIONS: ['auto', '1', '2', '3', '4', '5', '6'], useColumns: () => ({ columns }) };
});

vi.mock('../../composables/useLayout.ts', async () => {
  const { ref } = await import('vue');
  const layout = ref<Layout>('masonry');
  return {
    LAYOUT_OPTIONS: ['masonry', 'list'],
    isLayout: (value: string | null) => value === 'masonry' || value === 'list',
    useLayout: () => ({ layout }),
  };
});

vi.mock('../../composables/useTheme.ts', async () => {
  const { ref } = await import('vue');
  const theme = ref<'light' | 'dark'>('light');
  return {
    useTheme: () => ({
      theme,
      toggleTheme: () => {
        theme.value = theme.value === 'light' ? 'dark' : 'light';
      },
    }),
  };
});

const lane = (id: string): Category => ({ id, title: `Lane ${id}`, parentId: null, color: null, cards: [] });

const sixBoard = (): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 1,
  categories: ['a', 'b', 'c', 'd', 'e', 'f'].map((id) => lane(id)),
});

const mounted: { unmount: () => void }[] = [];

const mountHeader = () => {
  const root = mount(BoardHeader, { attachTo: document.body, global: { stubs: { PickerDialog: true } } });
  mounted.push(root);
  return root;
};

const mountBoth = () => {
  const Both = defineComponent({ render: () => [h(BoardHeader), h(KanbanBoard)] });
  const root = mount(Both, {
    attachTo: document.body,
    global: {
      stubs: { PickerDialog: true, CategoryLane: true, LaneMenu: true, ColorPicker: true, CardForm: true, CardItem: true },
    },
  });
  mounted.push(root);
  return root;
};

type HeaderRoot = ReturnType<typeof mountHeader>;

const controlButtons = (root: HeaderRoot) => root.findAll('.columns-control button');
const pressedOf = (root: HeaderRoot): string[] =>
  controlButtons(root)
    .filter((button) => button.attributes('aria-pressed') === 'true')
    .map((button) => button.text());
const byLabel = (label: string): HTMLElement => document.querySelector<HTMLElement>(`[aria-label="${label}"]`) as HTMLElement;

beforeEach(() => {
  useColumns().columns.value = 'auto';
  useLayout().layout.value = 'masonry';
  appStore.dispatch({ type: 'replace-board', board: sixBoard() });
});

afterEach(() => {
  mounted.splice(0).forEach((root) => root.unmount());
  vi.unstubAllGlobals();
});

describe('column count control', () => {
  it('shows Auto and 1 to 6 as native buttons with accessible names', () => {
    const root = mountHeader();
    const buttons = controlButtons(root);
    expect(buttons.map((button) => button.text())).toEqual(['Auto', '1', '2', '3', '4', '5', '6']);
    expect(buttons.map((button) => button.attributes('aria-label'))).toEqual([
      'Auto columns',
      '1 column',
      '2 columns',
      '3 columns',
      '4 columns',
      '5 columns',
      '6 columns',
    ]);
    expect(buttons.every((button) => button.attributes('type') === 'button')).toBe(true);
    expect(root.find('.columns-control').attributes('aria-label')).toBe('Masonry column count');
  });

  it('marks exactly the current preference as pressed', () => {
    useColumns().columns.value = '3';
    const root = mountHeader();
    expect(pressedOf(root)).toEqual(['3']);
  });

  it('click 3, then 6, then Auto updates the shared preference', async () => {
    const root = mountHeader();
    await root.find('[aria-label="3 columns"]').trigger('click');
    expect(useColumns().columns.value).toBe('3');
    expect(pressedOf(root)).toEqual(['3']);
    await root.find('[aria-label="6 columns"]').trigger('click');
    expect(useColumns().columns.value).toBe('6');
    expect(pressedOf(root)).toEqual(['6']);
    await root.find('[aria-label="Auto columns"]').trigger('click');
    expect(useColumns().columns.value).toBe('auto');
    expect(pressedOf(root)).toEqual(['Auto']);
  });

  it('hides the group in List, shows 1 column, keeps the saved preference, and restores the selection', async () => {
    useColumns().columns.value = '3';
    const root = mountHeader();
    useLayout().layout.value = 'list';
    await flushPromises();
    expect(root.find('.columns-control').exists()).toBe(false);
    expect(root.find('.columns-note').text()).toBe('1 column');
    expect(useColumns().columns.value).toBe('3');
    useLayout().layout.value = 'masonry';
    await flushPromises();
    expect(pressedOf(root)).toEqual(['3']);
  });

  it('puts layout, columns, and theme behind a settings button', () => {
    const root = mountHeader();
    const settings = root.find('[aria-label="Settings"]');
    expect(settings.exists()).toBe(true);
    expect(settings.attributes('aria-haspopup')).toBe('dialog');
    const layoutButtons = root.findAll('[aria-label="Board layout"] button');
    expect(layoutButtons.map((button) => button.text())).toEqual(['Masonry', 'List']);
    expect(layoutButtons.map((button) => button.attributes('aria-pressed'))).toEqual(['true', 'false']);
    const themeButtons = root.findAll('[aria-label="Theme"] button');
    expect(themeButtons.map((button) => button.text())).toEqual(['Light', 'Dark']);
  });

  it('layout buttons update the shared layout preference', async () => {
    const root = mountHeader();
    await root.findAll('[aria-label="Board layout"] button')[1].trigger('click');
    expect(useLayout().layout.value).toBe('list');
    await root.findAll('[aria-label="Board layout"] button')[0].trigger('click');
    expect(useLayout().layout.value).toBe('masonry');
  });
});

describe('header and board together', () => {
  it('a count button sets the rendered grid and footer count without touching board data', async () => {
    mountBoth();
    const before = appStore.board.value;
    byLabel('3 columns').click();
    await flushPromises();
    const lanes = document.querySelector<HTMLElement>('.lanes') as HTMLElement;
    expect(lanes.style.gridTemplateColumns).toBe('repeat(3, minmax(0, 1fr))');
    expect(document.querySelectorAll('.stack')).toHaveLength(3);
    expect(document.querySelectorAll('.add-category')).toHaveLength(3);
    expect(appStore.board.value).toBe(before);
  });

  it('Auto follows the observed width with a stubbed ResizeObserver and leaves board data alone', async () => {
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
    mountBoth();
    const before = appStore.board.value;
    byLabel('3 columns').click();
    await flushPromises();
    byLabel('Auto columns').click();
    await flushPromises();
    callbacks.forEach((callback) =>
      callback([{ contentRect: { width: 1000 } } as ResizeObserverEntry], {} as ResizeObserver),
    );
    await flushPromises();
    expect(document.querySelectorAll('.stack')).toHaveLength(3);
    expect(appStore.board.value).toBe(before);
  });
});
