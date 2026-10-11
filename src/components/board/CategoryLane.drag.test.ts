import { flushPromises, mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { Card, Category } from '../../domain/types.ts';
import CategoryLane from './CategoryLane.vue';

const card = (id: string): Card => ({ id, number: 1, title: `Card ${id}`, description: 'Body text' });

const laneOf = (id: string, cards: Card[] = [], parentId: string | null = null): Category => ({
  id,
  title: `Lane ${id}`,
  parentId,
  color: null,
  cards,
});

const mounted: { unmount: () => void }[] = [];

const mountLane = (category: Category, subcategories: Category[] = []) => {
  const root = mount(CategoryLane, {
    props: {
      category,
      subcategories,
      destinations: [],
      topLevel: [],
      dropTarget: null,
      dragSource: null,
      renameId: null,
    },
    attachTo: document.body,
    global: { stubs: { PickerDialog: true, LaneMenu: true, ColorPicker: true, CardForm: true } },
  });
  mounted.push(root);
  return root;
};

const press = (element: Element): void => {
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 10, clientY: 10 }));
};

type LaneRoot = ReturnType<typeof mountLane>;

const starts = (root: LaneRoot) => root.emitted('drag-start') ?? [];

afterEach(() => {
  mounted.splice(0).forEach((root) => root.unmount());
});

describe('category panel drag surface', () => {
  it('pointerdown on the panel itself starts a drag for that panel', () => {
    const root = mountLane(laneOf('a', [card('k1')]));
    press(root.element);
    expect(starts(root)).toHaveLength(1);
    expect(starts(root)[0][0]).toEqual({ kind: 'category', categoryId: 'a' });
  });

  it.each(['.lane-body', '.lane-head', '.count'])('pointerdown on %s starts the same category drag', (selector) => {
    const root = mountLane(laneOf('a', [card('k1')]));
    press(root.find(selector).element);
    expect(starts(root)).toHaveLength(1);
    expect(starts(root)[0][0]).toEqual({ kind: 'category', categoryId: 'a' });
  });

  it('the empty message of an empty category starts the category drag', () => {
    const root = mountLane(laneOf('a'));
    press(root.find('.empty').element);
    expect(starts(root)[0][0]).toEqual({ kind: 'category', categoryId: 'a' });
  });

  it.each(['.title-button', '.color-dot', '.add-card', '.add-card svg'])(
    'pointerdown on the control %s does not start a category drag',
    (selector) => {
      const root = mountLane(laneOf('a', [card('k1')]));
      press(root.find(selector).element);
      expect(starts(root)).toHaveLength(0);
    },
  );

  it('a card drag is not overwritten by its parent panel', () => {
    const root = mountLane(laneOf('a', [card('k1')]));
    press(root.find('.card .title').element);
    expect(starts(root)).toHaveLength(1);
    expect(starts(root)[0][0]).toEqual({ kind: 'card', cardId: 'k1' });
  });

  it('a subcategory drag is not overwritten by its parent panel', () => {
    const sub = laneOf('s', [], 'a');
    const root = mountLane(laneOf('a'), [sub]);
    press(root.find('.lane.is-sub').element);
    expect(starts(root)).toHaveLength(1);
    expect(starts(root)[0][0]).toEqual({ kind: 'category', categoryId: 's' });
  });

  it('a plain title click still opens the rename editor and starts no drag', async () => {
    const root = mountLane(laneOf('a'));
    await root.find('.title-button').trigger('click');
    expect(root.find('.title-input').exists()).toBe(true);
    expect(starts(root)).toHaveLength(0);
  });

  it('a padding drag commits an open rename draft before the drag starts', async () => {
    const root = mountLane(laneOf('a'));
    await root.find('.title-button').trigger('click');
    await root.find('.title-input').setValue('Renamed');
    press(root.find('.lane-body').element);
    await flushPromises();
    expect(root.emitted('action')?.[0][0]).toEqual({
      type: 'rename-category',
      categoryId: 'a',
      title: 'Renamed',
    });
    expect(starts(root)).toHaveLength(1);
  });

  it('pointerdown on the rename input does not start a drag and keeps the draft open', async () => {
    const root = mountLane(laneOf('a'));
    await root.find('.title-button').trigger('click');
    press(root.find('.title-input').element);
    expect(starts(root)).toHaveLength(0);
    expect(root.find('.title-input').exists()).toBe(true);
  });

  it('a right-button press starts no drag, is not prevented, and leaves an open draft alone', async () => {
    const root = mountLane(laneOf('a'));
    await root.find('.title-button').trigger('click');
    await root.find('.title-input').setValue('Keep');
    const rightPress = new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 2 });
    root.find('.lane-body').element.dispatchEvent(rightPress);
    expect(rightPress.defaultPrevented).toBe(false);
    expect(starts(root)).toHaveLength(0);
    expect(root.emitted('action')).toBeUndefined();
    expect(root.find('.title-input').exists()).toBe(true);
  });

  it('card action icons and a dialog inside a card do not start the panel drag', () => {
    const root = mountLane(laneOf('a', [card('k1')]));
    press(root.find('.actions svg').element);
    const dialog = document.createElement('dialog');
    root.find('.card').element.appendChild(dialog);
    press(dialog);
    expect(starts(root)).toHaveLength(0);
  });
});
