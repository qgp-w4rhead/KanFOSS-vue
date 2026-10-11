import { mount } from '@vue/test-utils';
import { describe, expect, it } from 'vitest';
import type { Category } from '../../domain/types.ts';
import LaneMenu from './LaneMenu.vue';
import { DialogStub } from './dialog-stub.harness.ts';

const category = (title: string, parentId: string | null = null): Category => ({
  id: 'a',
  title,
  parentId,
  color: null,
  cards: [],
});

const mountMenu = (value: Category, cardCount = 0) =>
  mount(LaneMenu, {
    props: { category: value, cardCount, nestTargets: [] },
    global: { stubs: { UiDialog: DialogStub } },
  });

describe('category trash icon in LaneMenu', () => {
  it('renders a labelled button on top-level and subcategory headers', () => {
    const top = mountMenu(category('Alpha'));
    const trash = top.find('button.delete-button');
    expect(trash.attributes('aria-label')).toBe('Delete category Alpha');
    expect(trash.attributes('title')).toBe('Delete category Alpha — Shift+click skips confirmation');
    expect(trash.attributes('type')).toBe('button');
    expect(mountMenu(category('Sub', 'x')).find('button.delete-button').exists()).toBe(true);
  });

  it('clicking the icon opens the confirmation only and emits nothing', async () => {
    const root = mountMenu(category('Alpha'), 2);
    await root.find('button.delete-button').trigger('click');
    expect(root.emitted('action')).toBeUndefined();
    expect(root.find('.dialog-stub').attributes('data-title')).toBe('Delete Alpha');
    expect(root.find('.confirm-text').text()).toContain('Delete "Alpha"');
    expect(root.findAll('.ui-row').map((row) => row.text())).toEqual(['Delete', 'Cancel']);
  });

  it('shift-click emits the delete immediately without opening the dialog', async () => {
    const root = mountMenu(category('Alpha'), 2);
    await root.find('button.delete-button').trigger('click', { shiftKey: true });
    expect(root.emitted('action')).toEqual([[{ type: 'delete-category', categoryId: 'a' }]]);
    expect(root.find('.dialog-stub').exists()).toBe(false);
  });

  it('cancel closes without any action', async () => {
    const root = mountMenu(category('Alpha'));
    await root.find('button.delete-button').trigger('click');
    const cancel = root.findAll('button').find((button) => button.text() === 'Cancel');
    await cancel?.trigger('click');
    expect(root.emitted('action')).toBeUndefined();
    expect(root.find('.dialog-stub').exists()).toBe(false);
  });

  it('confirm emits exactly one delete for the category id and closes', async () => {
    const root = mountMenu(category('Alpha'));
    await root.find('button.delete-button').trigger('click');
    await root.find('.ui-row.is-danger').trigger('click');
    expect(root.emitted('action')).toEqual([[{ type: 'delete-category', categoryId: 'a' }]]);
    expect(root.find('.dialog-stub').exists()).toBe(false);
  });

  it.each([
    [0, false],
    [1, true],
    [3, true],
  ])('the warning counts %i child cards and reads the card count (%s)', async (count, mentionsCards) => {
    const root = mountMenu(category('Alpha'), count);
    await root.find('button.delete-button').trigger('click');
    const text = root.find('.confirm-text').text();
    expect(text.includes(`and its ${count} ${count === 1 ? 'card' : 'cards'}`)).toBe(mentionsCards);
  });

  it('a top-level warning says subcategories are deleted too, a subcategory warning does not', async () => {
    const top = mountMenu(category('Alpha'));
    await top.find('button.delete-button').trigger('click');
    expect(top.find('.confirm-text').text()).toContain('Its subcategories are deleted too.');
    const sub = mountMenu(category('Sub', 'x'));
    await sub.find('button.delete-button').trigger('click');
    expect(sub.find('.confirm-text').text()).not.toContain('subcategories');
  });

  it('reopening with the arrow after cancel shows the movement controls again', async () => {
    const root = mountMenu(category('Alpha'));
    await root.find('button.delete-button').trigger('click');
    const cancel = root.findAll('button').find((button) => button.text() === 'Cancel');
    await cancel?.trigger('click');
    await root.find('button.menu-button').trigger('click');
    expect(root.find('.dialog-stub').text()).toContain('Move up');
    expect(root.find('.confirm-text').exists()).toBe(false);
  });
});
