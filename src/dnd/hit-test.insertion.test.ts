import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { findDropTarget, type Rect } from './hit-test.ts';

const boxes = new WeakMap<Element, Rect>();
const domRect = (box: Rect): DOMRect =>
  ({ ...box, x: box.left, y: box.top, right: box.left + box.width, bottom: box.top + box.height }) as unknown as DOMRect;

beforeEach(() => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return domRect(boxes.get(this) ?? { left: 0, top: 0, width: 0, height: 0 });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

const node = (attribute: string | null, box: Rect, parent?: Element): HTMLElement => {
  const element = document.createElement('div');
  if (attribute !== null) element.setAttribute('data-drop', attribute);
  boxes.set(element, box);
  parent?.appendChild(element);
  return element;
};

const categorySource = (categoryId: string) => ({ kind: 'category' as const, categoryId });
const cardSource = (cardId: string) => ({ kind: 'card' as const, cardId });

describe('source self and descendant blocking', () => {
  const panelWithNeighbour = () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 600 });
    const panel = node('category:a', { left: 0, top: 16, width: 300, height: 200 }, lanes);
    node('category:b', { left: 0, top: 232, width: 300, height: 100 }, lanes);
    return { lanes, panel };
  };

  it.each([
    ['top', 20],
    ['centre', 116],
    ['bottom', 210],
  ])('returns null for the source category at its %s, even with a neighbour below', (_, y) => {
    const { lanes, panel } = panelWithNeighbour();
    expect(findDropTarget([panel, lanes], { x: 50, y }, categorySource('a'))).toBeNull();
  });

  it('returns null for the source own subcategory without falling back to the parent', () => {
    const { lanes, panel } = panelWithNeighbour();
    const sub = node('category:s', { left: 10, top: 100, width: 280, height: 30 }, panel);
    expect(findDropTarget([sub, panel, lanes], { x: 50, y: 115 }, categorySource('a'))).toBeNull();
  });

  it('returns null for a card inside the source category', () => {
    const { lanes, panel } = panelWithNeighbour();
    const body = node('lane:a', { left: 0, top: 30, width: 300, height: 170 }, panel);
    const card = node('card:k1', { left: 8, top: 40, width: 284, height: 40 }, body);
    expect(findDropTarget([card, body, panel, lanes], { x: 50, y: 60 }, categorySource('a'))).toBeNull();
  });

  it('returns null for the source card on its top and bottom halves', () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 600 });
    const body = node('lane:x', { left: 0, top: 0, width: 300, height: 200 }, lanes);
    const card = node('card:k1', { left: 8, top: 10, width: 284, height: 40 }, body);
    node('card:k2', { left: 8, top: 60, width: 284, height: 40 }, body);
    expect(findDropTarget([card, body, lanes], { x: 50, y: 15 }, cardSource('k1'))).toBeNull();
    expect(findDropTarget([card, body, lanes], { x: 50, y: 45 }, cardSource('k1'))).toBeNull();
  });

  it('does not confuse a card with the same string id as a category', () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 600 });
    const panel = node('category:k1', { left: 0, top: 0, width: 300, height: 200 }, lanes);
    expect(findDropTarget([panel, lanes], { x: 50, y: 5 }, cardSource('k1'))).toEqual({
      kind: 'category',
      categoryId: 'k1',
      zone: 'before',
    });
  });
});

describe('three cards in one lane: one owner per seam', () => {
  const lane = () => {
    const body = node('lane:x', { left: 0, top: 0, width: 300, height: 200 });
    const a = node('card:A', { left: 8, top: 10, width: 284, height: 40 }, body);
    const b = node('card:B', { left: 8, top: 60, width: 284, height: 40 }, body);
    const c = node('card:C', { left: 8, top: 110, width: 284, height: 40 }, body);
    return { body, a, b, c };
  };

  it('top of B is its own before edge and bottom of A is its own after edge', () => {
    const { body, a, b } = lane();
    expect(findDropTarget([b, body], { x: 50, y: 65 }, cardSource('C'))).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'before',
    });
    expect(findDropTarget([a, body], { x: 50, y: 45 }, cardSource('C'))).toEqual({
      kind: 'card',
      cardId: 'A',
      side: 'after',
    });
  });

  it('the physical gap between A and B resolves to the same owner A after', () => {
    const { body } = lane();
    expect(findDropTarget([body], { x: 50, y: 55 }, cardSource('C'))).toEqual({
      kind: 'card',
      cardId: 'A',
      side: 'after',
    });
  });

  it('the first card keeps its before slot', () => {
    const { body, a } = lane();
    expect(findDropTarget([a, body], { x: 50, y: 15 }, cardSource('C'))).toEqual({
      kind: 'card',
      cardId: 'A',
      side: 'before',
    });
  });

  it('the physical gap between B and C, with C as source, resolves to B after', () => {
    const { body } = lane();
    expect(findDropTarget([body], { x: 50, y: 105 }, cardSource('C'))).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'after',
    });
  });

  it('with A as source, the neighbour B before edge is valid and A own edges stay null', () => {
    const { body, a, b } = lane();
    expect(findDropTarget([b, body], { x: 50, y: 65 }, cardSource('A'))).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'before',
    });
    expect(findDropTarget([body], { x: 50, y: 55 }, cardSource('A'))).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'before',
    });
    expect(findDropTarget([a, body], { x: 50, y: 45 }, cardSource('A'))).toBeNull();
  });
});

describe('first item before in each group, and colon-safe ids', () => {
  it('a first panel in each masonry stack keeps its before slot, independent of the previous stack', () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 400 });
    const stackOne = node('lanes', { left: 0, top: 0, width: 300, height: 400 }, lanes);
    node('category:p0', { left: 0, top: 0, width: 300, height: 100 }, stackOne);
    node('category:p1', { left: 0, top: 110, width: 300, height: 100 }, stackOne);
    const stackTwo = node('lanes', { left: 320, top: 0, width: 300, height: 400 }, lanes);
    const q0 = node('category:q0', { left: 320, top: 0, width: 300, height: 100 }, stackTwo);
    expect(findDropTarget([q0, stackTwo], { x: 350, y: 5 }, categorySource('z'))).toEqual({
      kind: 'category',
      categoryId: 'q0',
      zone: 'before',
    });
  });

  it('subcategories ignore the parent header and body when counting the first sub', () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 400 });
    const parent = node('category:pa', { left: 0, top: 0, width: 300, height: 200 }, lanes);
    node(null, { left: 0, top: 0, width: 300, height: 30 }, parent);
    node('lane:pa', { left: 0, top: 30, width: 300, height: 40 }, parent);
    const s1 = node('category:s1', { left: 40, top: 80, width: 240, height: 30 }, parent);
    node('category:s2', { left: 40, top: 130, width: 240, height: 30 }, parent);
    expect(findDropTarget([s1, parent, lanes], { x: 100, y: 85 }, categorySource('z'))).toEqual({
      kind: 'category',
      categoryId: 's1',
      zone: 'before',
    });
  });

  it('a second task card owns its own before edge and keeps colon ids intact', () => {
    const body = node('lane:x', { left: 0, top: 0, width: 300, height: 200 });
    node('form', { left: 0, top: 0, width: 300, height: 10 }, body);
    node('card:x:1', { left: 8, top: 10, width: 284, height: 40 }, body);
    const second = node('card:x:2', { left: 8, top: 60, width: 284, height: 40 }, body);
    expect(findDropTarget([second, body], { x: 50, y: 65 }, cardSource('z'))).toEqual({
      kind: 'card',
      cardId: 'x:2',
      side: 'before',
    });
  });
});

describe('G2 edges between parents', () => {
  const tree = () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 600 });
    const a = node('category:a', { left: 0, top: 16, width: 300, height: 200 }, lanes);
    node(null, { left: 0, top: 16, width: 300, height: 30 }, a);
    node('lane:a', { left: 0, top: 46, width: 300, height: 40 }, a);
    const s1 = node('category:s1', { left: 40, top: 90, width: 240, height: 30 }, a);
    const s2 = node('category:s2', { left: 40, top: 130, width: 240, height: 30 }, a);
    const b = node('category:b', { left: 0, top: 232, width: 300, height: 100 }, lanes);
    const t2 = node('category:t2', { left: 40, top: 296, width: 240, height: 30 }, b);
    return { lanes, a, s1, s2, b, t2 };
  };

  it('a top-level source before a subcategory promotes to the parent before, not after it', () => {
    const { lanes, s2 } = tree();
    expect(findDropTarget([s2, lanes], { x: 100, y: 135 }, categorySource('b'))).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'before',
    });
  });

  it('a top-level source after a subcategory promotes to the parent after', () => {
    const { lanes, s2 } = tree();
    expect(findDropTarget([s2, lanes], { x: 100, y: 155 }, categorySource('b'))).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'after',
    });
  });

  it('a subcategory before a foreign subcategory resolves beside the foreign parent', () => {
    const { lanes, t2 } = tree();
    expect(findDropTarget([t2, lanes], { x: 100, y: 298 }, categorySource('s2'))).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'after',
    });
  });

  it('a same-parent subcategory edge reorders inside its own group', () => {
    const { lanes, s1 } = tree();
    expect(findDropTarget([s1, lanes], { x: 100, y: 95 }, categorySource('s2'))).toEqual({
      kind: 'category',
      categoryId: 's1',
      zone: 'before',
    });
  });

  it('a centre target on a parent is unchanged for another source', () => {
    const { lanes, a } = tree();
    expect(findDropTarget([a, lanes], { x: 100, y: 116 }, categorySource('b'))).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'center',
    });
  });
});
