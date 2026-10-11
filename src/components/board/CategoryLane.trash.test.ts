import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { Category } from '../../domain/types.ts';
import CategoryLane from './CategoryLane.vue';
import { DialogStub } from './dialog-stub.harness.ts';

const laneOf = (id: string, title: string, parentId: string | null = null): Category => ({
  id,
  title,
  parentId,
  color: null,
  cards: [],
});

const mounted: { unmount: () => void }[] = [];

const mountLane = (category: Category) => {
  const root = mount(CategoryLane, {
    props: {
      category,
      subcategories: [],
      destinations: [],
      topLevel: [],
      dropTarget: null,
      dragSource: null,
      renameId: null,
    },
    attachTo: document.body,
    global: { stubs: { UiDialog: DialogStub, ColorPicker: true, CardForm: true, CardItem: true } },
  });
  mounted.push(root);
  return root;
};

const press = (element: Element): void => {
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
};

afterEach(() => {
  mounted.splice(0).forEach((root) => root.unmount());
});

describe('category trash icon in the panel header', () => {
  it('is rendered on a top-level header and on a subcategory header', () => {
    expect(mountLane(laneOf('a', 'Alpha')).find('.lane-head .delete-button').exists()).toBe(true);
    expect(mountLane(laneOf('s', 'Sub', 'a')).find('.lane-head .delete-button').exists()).toBe(true);
  });

  it('pressing the icon or its SVG starts no category drag', () => {
    const root = mountLane(laneOf('a', 'Alpha'));
    press(root.find('.delete-button svg').element);
    press(root.find('.delete-button').element);
    expect(root.emitted('drag-start') ?? []).toHaveLength(0);
  });
});
