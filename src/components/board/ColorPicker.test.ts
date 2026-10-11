import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import { COLOR_KEYS } from '../../domain/board.ts';
import type { Category, ColorKey } from '../../domain/types.ts';
import ColorPicker from './ColorPicker.vue';
import { DialogStub } from './dialog-stub.harness.ts';

const category = (color: ColorKey | null): Category => ({
  id: 'a',
  title: 'Alpha',
  parentId: null,
  color,
  cards: [],
});

const mountPicker = (color: ColorKey | null) =>
  mount(ColorPicker, {
    props: { open: true, category: category(color) },
    global: { stubs: { UiDialog: DialogStub } },
  });

const label = (key: ColorKey): string => key.charAt(0).toUpperCase() + key.slice(1);

describe('colour picker swatches', () => {
  it('renders sixteen colour swatches with their labels and marks only the current colour pressed', () => {
    const root = mountPicker('red');
    const swatches = root.findAll('button.ui-swatch[data-color]');
    expect(swatches.map((swatch) => swatch.attributes('aria-label'))).toEqual(COLOR_KEYS.map(label));
    expect(swatches.map((swatch) => swatch.attributes('data-color'))).toEqual([...COLOR_KEYS]);
    expect(
      swatches.filter((swatch) => swatch.attributes('aria-pressed') === 'true').map((swatch) => swatch.attributes('aria-label')),
    ).toEqual(['Red']);
  });

  it('picking a swatch emits the original colour key and then closes', async () => {
    const root = mountPicker(null);
    await root.find('button[aria-label="Blue"]').trigger('click');
    expect(root.emitted('action')).toEqual([[{ type: 'set-color', categoryId: 'a', color: 'blue' }]]);
    expect(root.emitted('close')).toHaveLength(1);
  });

  it('the no-colour row keeps its ordinary text action and sends null', async () => {
    const root = mountPicker('blue');
    const row = root.findAll('button.ui-row').find((button) => button.text() === 'No color');
    await row?.trigger('click');
    expect(root.emitted('action')).toEqual([[{ type: 'set-color', categoryId: 'a', color: null }]]);
    expect(root.findAll('button.ui-swatch[data-color]')).toHaveLength(COLOR_KEYS.length);
  });
});
