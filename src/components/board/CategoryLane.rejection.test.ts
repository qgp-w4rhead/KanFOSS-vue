import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import type { DragSource, DropTarget } from '../../domain/drop.ts';
import type { Category } from '../../domain/types.ts';
import CategoryLane from './CategoryLane.vue';
import { DialogStub } from './dialog-stub.harness.ts';
import type { DropRejection } from './view-types.ts';

const laneOf = (id: string, title: string, parentId: string | null = null): Category => ({
  id,
  title,
  parentId,
  color: null,
  cards: [],
});

const REASON = 'Move its subcategories out first';
const categoryTarget = (categoryId: string, zone: 'before' | 'after' | 'center' = 'center'): DropTarget => ({
  kind: 'category',
  categoryId,
  zone,
});
const categorySource = (categoryId: string): DragSource => ({ kind: 'category', categoryId });
const rejection = (categoryId: string): DropRejection => ({ categoryId, reason: REASON });

const mounted: { unmount: () => void }[] = [];

const mountLane = (
  category: Category,
  props: { dropTarget?: DropTarget | null; dragSource?: DragSource | null; dropRejection?: DropRejection | null; subcategories?: Category[] } = {},
) => {
  const root = mount(CategoryLane, {
    props: {
      category,
      subcategories: props.subcategories ?? [],
      destinations: [],
      topLevel: [],
      dropTarget: props.dropTarget ?? null,
      dragSource: props.dragSource ?? null,
      renameId: null,
      dropRejection: props.dropRejection ?? null,
    },
    global: { stubs: { UiDialog: DialogStub, ColorPicker: true, CardForm: true, CardItem: true } },
  });
  mounted.push(root);
  return root;
};

const ownOverlays = (element: Element): number =>
  Array.from(element.children).filter((child) => child.classList.contains('drop-rejection')).length;

const validPanelClasses = (classes: string[]): boolean =>
  ['drop-before', 'drop-after', 'drop-center'].some((name) => classes.includes(name));

afterEach(() => {
  mounted.splice(0).forEach((root) => root.unmount());
});

describe('rejected panel overlay guards', () => {
  it('a matching payload, actual category target and category source show the labelled X and no valid panel class', () => {
    const root = mountLane(laneOf('a', 'Alpha'), {
      dropTarget: categoryTarget('a'),
      dragSource: categorySource('b'),
      dropRejection: rejection('a'),
    });
    const overlay = root.find('.drop-rejection');
    expect(overlay.exists()).toBe(true);
    expect(overlay.attributes('role')).toBe('img');
    expect(overlay.attributes('aria-label')).toBe(`Cannot drop here: ${REASON}`);
    expect(overlay.find('svg path').attributes('d')).toBe('M0 0 L100 100 M100 0 L0 100');
    expect(overlay.find('svg path').attributes('vector-effect')).toBe('non-scaling-stroke');
    expect(overlay.find('.drop-rejection-label').text()).toBe(REASON);
    expect(root.classes()).toContain('is-drop-rejected');
    expect(validPanelClasses(root.classes())).toBe(false);
  });

  it('a mismatched payload category id shows no overlay', () => {
    const root = mountLane(laneOf('a', 'Alpha'), {
      dropTarget: categoryTarget('a'),
      dragSource: categorySource('b'),
      dropRejection: rejection('x'),
    });
    expect(root.find('.drop-rejection').exists()).toBe(false);
    expect(root.classes()).not.toContain('is-drop-rejected');
  });

  it('a mismatched actual target shows no overlay', () => {
    const root = mountLane(laneOf('a', 'Alpha'), {
      dropTarget: categoryTarget('x'),
      dragSource: categorySource('b'),
      dropRejection: rejection('a'),
    });
    expect(root.find('.drop-rejection').exists()).toBe(false);
  });

  it('a null target shows no overlay', () => {
    const root = mountLane(laneOf('a', 'Alpha'), {
      dropTarget: null,
      dragSource: categorySource('b'),
      dropRejection: rejection('a'),
    });
    expect(root.find('.drop-rejection').exists()).toBe(false);
  });

  it('a card source shows no overlay', () => {
    const root = mountLane(laneOf('a', 'Alpha'), {
      dropTarget: categoryTarget('a'),
      dragSource: { kind: 'card', cardId: 'k' },
      dropRejection: rejection('a'),
    });
    expect(root.find('.drop-rejection').exists()).toBe(false);
  });

  it('the panel dragged onto itself shows no overlay', () => {
    const root = mountLane(laneOf('a', 'Alpha'), {
      dropTarget: categoryTarget('a'),
      dragSource: categorySource('a'),
      dropRejection: rejection('a'),
    });
    expect(root.find('.drop-rejection').exists()).toBe(false);
  });

  it('restoring the target brings the overlay back, and clearing the payload removes it', async () => {
    const root = mountLane(laneOf('a', 'Alpha'), {
      dropTarget: categoryTarget('a'),
      dragSource: categorySource('b'),
      dropRejection: rejection('a'),
    });
    await root.setProps({ dropTarget: null });
    expect(root.find('.drop-rejection').exists()).toBe(false);
    await root.setProps({ dropTarget: categoryTarget('a') });
    expect(root.find('.drop-rejection').exists()).toBe(true);
    await root.setProps({ dropRejection: null });
    expect(root.find('.drop-rejection').exists()).toBe(false);
    expect(root.classes()).not.toContain('is-drop-rejected');
  });

  it('through recursive forwarding the overlay sits on the child lane, not on the parent', () => {
    const sub = laneOf('s', 'Sub', 'a');
    const root = mountLane(laneOf('a', 'Alpha'), {
      subcategories: [sub],
      dropTarget: categoryTarget('s'),
      dragSource: categorySource('b'),
      dropRejection: rejection('s'),
    });
    expect(ownOverlays(root.element)).toBe(0);
    expect(root.classes()).not.toContain('is-drop-rejected');
    const child = root.find('.lane.is-sub').element;
    expect(ownOverlays(child)).toBe(1);
    expect(child.classList.contains('is-drop-rejected')).toBe(true);
  });
});
