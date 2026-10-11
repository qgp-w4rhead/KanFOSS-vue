import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CARD_EDGE_MARGIN,
  EDGE_FRACTION,
  MAX_GAP_DISTANCE,
  categoryZoneAt,
  findDropTarget,
  sideAt,
  targetFromHit,
  zoneAt,
  type Rect,
} from './hit-test.ts';

const rect: Rect = { left: 100, top: 50, width: 200, height: 80 };
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

describe('zone helpers', () => {
  it('keeps the horizontal zoneAt for legacy callers', () => {
    expect(EDGE_FRACTION).toBe(0.25);
    expect(zoneAt(110, rect)).toBe('before');
    expect(zoneAt(200, rect)).toBe('center');
    expect(zoneAt(290, rect)).toBe('after');
  });

  it('classifies a category panel vertically: top 25% before, middle center, bottom 25% after', () => {
    const panel = { left: 0, top: 100, width: 300, height: 200 };
    expect(categoryZoneAt(110, panel)).toBe('before');
    expect(categoryZoneAt(200, panel)).toBe('center');
    expect(categoryZoneAt(290, panel)).toBe('after');
  });

  it('uses the vertical position, so the top half is before and the bottom half is after', () => {
    expect(sideAt(60, rect)).toBe('before');
    expect(sideAt(120, rect)).toBe('after');
  });
});

describe('targetFromHit', () => {
  it('builds a card target with its side from the pointer', () => {
    expect(targetFromHit('card:c1', { x: 150, y: 120 }, rect)).toEqual({ kind: 'card', cardId: 'c1', side: 'after' });
  });

  it('builds lane targets and vertical category targets, ignoring x for categories', () => {
    expect(targetFromHit('lane:a', { x: 150, y: 60 }, rect)).toEqual({ kind: 'lane', categoryId: 'a' });
    expect(targetFromHit('category:a', { x: 290, y: 60 }, rect)).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'before',
    });
  });

  it('builds the add-category target without an id', () => {
    expect(targetFromHit('add-category', { x: 0, y: 0 }, rect)).toEqual({ kind: 'add-category' });
  });

  it('returns null for an unknown kind or a missing id', () => {
    expect(targetFromHit('card:', { x: 0, y: 0 }, rect)).toBeNull();
    expect(targetFromHit('unknown:x', { x: 0, y: 0 }, rect)).toBeNull();
  });

  it('keeps ids that contain colons', () => {
    expect(targetFromHit('card:a:b', { x: 150, y: 120 }, rect)).toEqual({ kind: 'card', cardId: 'a:b', side: 'after' });
  });
});

describe('category sources', () => {
  const panel = (): HTMLElement => node('category:a', { left: 0, top: 0, width: 300, height: 300 });

  it('treats a card as transparent to its owning panel and resolves the panel zone', () => {
    const owner = panel();
    const body = node('lane:a', { left: 0, top: 30, width: 300, height: 240 }, owner);
    const card = node('card:c1', { left: 8, top: 60, width: 284, height: 40 }, body);
    expect(findDropTarget([card, body, owner], { x: 100, y: 150 }, { kind: 'category', categoryId: 'x' })).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'center',
    });
  });

  it('resolves a subcategory card to its own subcategory panel', () => {
    const owner = panel();
    const sub = node('category:s', { left: 10, top: 100, width: 280, height: 100 }, owner);
    const subCard = node('card:c2', { left: 18, top: 120, width: 264, height: 40 }, sub);
    expect(findDropTarget([subCard, sub, owner], { x: 100, y: 190 }, { kind: 'category', categoryId: 'x' })).toEqual({
      kind: 'category',
      categoryId: 's',
      zone: 'after',
    });
  });

  it('gives a card source its own card target instead of the panel', () => {
    const owner = panel();
    const body = node('lane:a', { left: 0, top: 30, width: 300, height: 240 }, owner);
    const card = node('card:c1', { left: 8, top: 60, width: 284, height: 40 }, body);
    expect(findDropTarget([card, body, owner], { x: 100, y: 65 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'card',
      cardId: 'c1',
      side: 'before',
    });
  });
});

describe('panel gaps for a category source', () => {
  const lanesWithPanels = (): { lanes: HTMLElement } => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 400 });
    node('category:a', { left: 0, top: 16, width: 300, height: 100 }, lanes);
    node('category:b', { left: 0, top: 132, width: 300, height: 100 }, lanes);
    return { lanes };
  };

  it('snaps a gap between panels to the nearest panel edge', () => {
    const { lanes } = lanesWithPanels();
    expect(findDropTarget([lanes], { x: 50, y: 120 }, { kind: 'category', categoryId: 'x' })).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'after',
    });
  });

  it('ignores the dragged category when choosing a gap, so a gap beside itself resolves to nothing', () => {
    const { lanes } = lanesWithPanels();
    expect(findDropTarget([lanes], { x: 50, y: 120 }, { kind: 'category', categoryId: 'a' })).toBeNull();
  });

  it('excludes a dragged panel descendant from gap candidates even when it is closer', () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 400 });
    node('category:z', { left: 0, top: 0, width: 300, height: 100 }, lanes);
    const dragged = node('category:a', { left: 0, top: 116, width: 300, height: 100 }, lanes);
    node('category:s', { left: 10, top: 120, width: 280, height: 26 }, dragged);
    expect(findDropTarget([lanes], { x: 50, y: 112 }, { kind: 'category', categoryId: 'a' })).toEqual({
      kind: 'category',
      categoryId: 'z',
      zone: 'after',
    });
  });

  it('accepts a gap exactly at the snap distance, then falls back to the column footer', () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 400 });
    node('category:a', { left: 0, top: 16, width: 300, height: 100 }, lanes);
    expect(MAX_GAP_DISTANCE).toBe(24);
    expect(findDropTarget([lanes], { x: 50, y: 140 }, { kind: 'category', categoryId: 'x' })).toEqual({
      kind: 'category',
      categoryId: 'a',
      zone: 'after',
    });
    expect(findDropTarget([lanes], { x: 50, y: 150 }, { kind: 'category', categoryId: 'x' })).toEqual({
      kind: 'add-category',
    });
  });
});

describe('column footer fallback', () => {
  const lanesWithColumns = () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 640, height: 800 });
    const stack0 = node('lanes', { left: 0, top: 0, width: 300, height: 800 }, lanes);
    stack0.setAttribute('data-column', '0');
    const stack1 = node('lanes', { left: 316, top: 0, width: 300, height: 800 }, lanes);
    stack1.setAttribute('data-column', '1');
    node('category:a', { left: 0, top: 16, width: 300, height: 100 }, stack0);
    node('category:b', { left: 316, top: 16, width: 300, height: 100 }, stack1);
    return { lanes, stack0, stack1 };
  };

  it('a category dropped in the empty space below a column lands at its bottom', () => {
    const { lanes, stack1 } = lanesWithColumns();
    expect(findDropTarget([stack1, lanes], { x: 400, y: 400 }, { kind: 'category', categoryId: 'x' })).toEqual({
      kind: 'add-category',
      placement: { index: 1, count: 2 },
    });
  });

  it('the same column placement resolves for a card source', () => {
    const { lanes, stack0 } = lanesWithColumns();
    expect(findDropTarget([stack0, lanes], { x: 100, y: 400 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'add-category',
      placement: { index: 0, count: 2 },
    });
  });

  it('a point in a column gutter picks the nearest column', () => {
    const { lanes } = lanesWithColumns();
    expect(findDropTarget([lanes], { x: 310, y: 700 }, { kind: 'category', categoryId: 'x' })).toEqual({
      kind: 'add-category',
      placement: { index: 1, count: 2 },
    });
  });
});

describe('card gaps for a card source', () => {
  const twoCards = (): { body: HTMLElement; first: HTMLElement; second: HTMLElement } => {
    const body = node('lane:a', { left: 0, top: 0, width: 300, height: 200 });
    const first = node('card:c1', { left: 8, top: 10, width: 284, height: 40 }, body);
    const second = node('card:c2', { left: 8, top: 70, width: 284, height: 40 }, body);
    return { body, first, second };
  };

  it('snaps just below a card to its after edge', () => {
    const { body } = twoCards();
    expect(findDropTarget([body], { x: 100, y: 53 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'card',
      cardId: 'c1',
      side: 'after',
    });
  });

  it('keeps the lane target when the pointer is outside the card horizontal span', () => {
    const { body } = twoCards();
    expect(findDropTarget([body], { x: 2, y: 53 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'lane',
      categoryId: 'a',
    });
  });

  it('does not snap beyond the vertical margin', () => {
    const body = node('lane:a', { left: 0, top: 0, width: 300, height: 200 });
    node('card:c1', { left: 8, top: 10, width: 284, height: 40 }, body);
    expect(findDropTarget([body], { x: 100, y: 50 + CARD_EDGE_MARGIN + 1 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'lane',
      categoryId: 'a',
    });
  });

  it('chooses the nearest eligible edge of two neighbouring cards', () => {
    const { body } = twoCards();
    expect(findDropTarget([body], { x: 100, y: 44 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'card',
      cardId: 'c1',
      side: 'after',
    });
    expect(findDropTarget([body], { x: 100, y: 68 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'card',
      cardId: 'c2',
      side: 'before',
    });
  });

  it('never snaps a dragged card to its own edge', () => {
    const { body } = twoCards();
    expect(findDropTarget([body], { x: 100, y: 53 }, { kind: 'card', cardId: 'c1' })).toEqual({
      kind: 'lane',
      categoryId: 'a',
    });
  });

  it('uses the nearest card for a lanes gap', () => {
    const lanes = node('lanes', { left: 0, top: 0, width: 400, height: 400 });
    const body = node('lane:a', { left: 0, top: 0, width: 300, height: 200 }, lanes);
    node('card:c1', { left: 8, top: 10, width: 284, height: 40 }, body);
    expect(findDropTarget([lanes], { x: 100, y: 53 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'card',
      cardId: 'c1',
      side: 'after',
    });
  });
});

describe('baseline target resolution', () => {
  it('returns null with no elements, or with elements that carry no drop attribute', () => {
    expect(findDropTarget([], { x: 0, y: 0 }, { kind: 'card', cardId: 'k' })).toBeNull();
    expect(findDropTarget([node(null, rect)], { x: 110, y: 60 }, { kind: 'card', cardId: 'k' })).toBeNull();
    expect(findDropTarget([node(null, rect)], { x: 110, y: 60 }, { kind: 'category', categoryId: 'x' })).toBeNull();
  });

  it('a malformed first hit does not hide a later valid target', () => {
    const malformed = node('card:', rect);
    const lane = node('lane:a', rect);
    expect(findDropTarget([malformed, lane], { x: 150, y: 60 }, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'lane',
      categoryId: 'a',
    });
  });
});

describe('placed add-category targets', () => {
  it('builds a placed target from the column index and count', () => {
    expect(targetFromHit('add-category:2:4', { x: 0, y: 0 }, rect)).toStrictEqual({
      kind: 'add-category',
      placement: { index: 2, count: 4 },
    });
  });

  it('keeps the bare add-category target without a placement key', () => {
    expect(targetFromHit('add-category', { x: 0, y: 0 }, rect)).toStrictEqual({ kind: 'add-category' });
  });

  it.each([
    'add-category:',
    'add-category:1',
    'add-category:1:4:9',
    'add-category::4',
    'add-category:a:4',
    'add-category:-1:4',
    'add-category:1.5:4',
    'add-category:4:4',
    'add-category:1:0',
    'add-category:1:4x',
  ])('returns null for a malformed add target (%s)', (attribute) => {
    expect(targetFromHit(attribute, { x: 0, y: 0 }, rect)).toBeNull();
  });

  it('returns the placed footer target from findDropTarget', () => {
    const footer = node('add-category:1:4', { left: 0, top: 0, width: 10, height: 10 });
    expect(findDropTarget([footer], { x: 5, y: 5 }, { kind: 'card', cardId: 'k' })).toStrictEqual({
      kind: 'add-category',
      placement: { index: 1, count: 4 },
    });
  });
});
