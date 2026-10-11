import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Rect } from './hit-test.ts';
import { normalizeInsertionTarget } from './insertion-targets.ts';

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

const box = (top: number): Rect => ({ left: 0, top, width: 100, height: 20 });

describe('normalizeInsertionTarget for task cards', () => {
  const lane = () => {
    const body = node('lane:x', box(0));
    const a = node('card:A', box(0), body);
    const b = node('card:B', box(30), body);
    const c = node('card:C', box(60), body);
    return { a, b, c };
  };

  it('keeps a before edge on a non-first card as its own raw neighbour edge', () => {
    const { b } = lane();
    expect(normalizeInsertionTarget({ kind: 'card', cardId: 'B', side: 'before' }, b)).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'before',
    });
  });

  it('keeps a before edge on the first card and every after edge', () => {
    const { a, b } = lane();
    expect(normalizeInsertionTarget({ kind: 'card', cardId: 'A', side: 'before' }, a)).toEqual({
      kind: 'card',
      cardId: 'A',
      side: 'before',
    });
    expect(normalizeInsertionTarget({ kind: 'card', cardId: 'B', side: 'after' }, b)).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'after',
    });
  });

  it('keeps the before edge of a neighbour when the previous card is the source', () => {
    const { b } = lane();
    expect(normalizeInsertionTarget({ kind: 'card', cardId: 'B', side: 'before' }, b, { kind: 'card', cardId: 'A' })).toEqual({
      kind: 'card',
      cardId: 'B',
      side: 'before',
    });
  });

  it('returns null for the source card itself', () => {
    const { b } = lane();
    expect(normalizeInsertionTarget({ kind: 'card', cardId: 'B', side: 'after' }, b, { kind: 'card', cardId: 'B' })).toBeNull();
  });

  it('keeps colon ids intact', () => {
    const body = node('lane:x', box(0));
    node('card:x:1', box(0), body);
    const second = node('card:x:2', box(30), body);
    expect(normalizeInsertionTarget({ kind: 'card', cardId: 'x:2', side: 'before' }, second)).toEqual({
      kind: 'card',
      cardId: 'x:2',
      side: 'before',
    });
  });
});

describe('normalizeInsertionTarget for categories', () => {
  it('leaves lane and add targets unchanged', () => {
    const lanes = node('lanes', box(0));
    const laneEl = node('lane:a', box(0), lanes);
    expect(normalizeInsertionTarget({ kind: 'lane', categoryId: 'a' }, laneEl)).toEqual({ kind: 'lane', categoryId: 'a' });
    expect(normalizeInsertionTarget({ kind: 'add-category' }, laneEl)).toEqual({ kind: 'add-category' });
  });

  it('keeps a category edge unchanged for a card source, since it is a card append destination', () => {
    const lanes = node('lanes', box(0));
    node('category:p', box(0), lanes);
    const q = node('category:q', box(30), lanes);
    expect(normalizeInsertionTarget({ kind: 'category', categoryId: 'q', zone: 'before' }, q, { kind: 'card', cardId: 'k' })).toEqual({
      kind: 'category',
      categoryId: 'q',
      zone: 'before',
    });
  });

  it('resolves a non-first top-level before edge to after the previous panel', () => {
    const lanes = node('lanes', box(0));
    node('category:p', box(0), lanes);
    const q = node('category:q', box(30), lanes);
    expect(normalizeInsertionTarget({ kind: 'category', categoryId: 'q', zone: 'before' }, q)).toEqual({
      kind: 'category',
      categoryId: 'p',
      zone: 'after',
    });
  });

  it('returns null for a before edge whose previous panel is the source', () => {
    const lanes = node('lanes', box(0));
    node('category:p', box(0), lanes);
    const q = node('category:q', box(30), lanes);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 'q', zone: 'before' }, q, { kind: 'category', categoryId: 'p' }),
    ).toBeNull();
  });

  it('returns null for an after edge on the panel directly before the source', () => {
    const lanes = node('lanes', box(0));
    const p = node('category:p', box(0), lanes);
    node('category:q', box(30), lanes);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 'p', zone: 'after' }, p, { kind: 'category', categoryId: 'q' }),
    ).toBeNull();
  });

  it('blocks subcategory sibling edges that resolve to the source own slot', () => {
    const lanes = node('lanes', box(0));
    const parent = node('category:a', box(0), lanes);
    const s1 = node('category:s1', box(10), parent);
    node('category:s2', box(30), parent);
    const s3 = node('category:s3', box(50), parent);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 's1', zone: 'after' }, s1, { kind: 'category', categoryId: 's2' }),
    ).toBeNull();
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 's3', zone: 'before' }, s3, { kind: 'category', categoryId: 's2' }),
    ).toBeNull();
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 's1', zone: 'before' }, s1, { kind: 'category', categoryId: 's2' }),
    ).toEqual({ kind: 'category', categoryId: 's1', zone: 'before' });
  });

  it('keeps the centre zone unchanged for a non-self source', () => {
    const lanes = node('lanes', box(0));
    node('category:p', box(0), lanes);
    const q = node('category:q', box(30), lanes);
    expect(normalizeInsertionTarget({ kind: 'category', categoryId: 'q', zone: 'center' }, q, { kind: 'category', categoryId: 'p' })).toEqual({
      kind: 'category',
      categoryId: 'q',
      zone: 'center',
    });
  });

  it('blocks a centre target on the source own parent panel', () => {
    const lanes = node('lanes', box(0));
    const parent = node('category:a', box(0), lanes);
    node('category:s1', box(10), parent);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 'a', zone: 'center' }, parent, { kind: 'category', categoryId: 's1' }),
    ).toBeNull();
  });

  it('keeps an edge target on the source own parent so it can be promoted out', () => {
    const lanes = node('lanes', box(0));
    const parent = node('category:a', box(0), lanes);
    node('category:s1', box(10), parent);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 'a', zone: 'after' }, parent, { kind: 'category', categoryId: 's1' }),
    ).toEqual({ kind: 'category', categoryId: 'a', zone: 'after' });
  });

  it('promotes a centre target on a foreign subcategory to its parent panel', () => {
    const lanes = node('lanes', box(0));
    const a = node('category:a', box(0), lanes);
    const s2 = node('category:s2', box(10), a);
    const b = node('category:b', box(40), lanes);
    node('category:t1', box(50), b);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 's2', zone: 'center' }, s2, { kind: 'category', categoryId: 't1' }),
    ).toEqual({ kind: 'category', categoryId: 'a', zone: 'center' });
  });

  it('leaves a centre target on a top-level panel alone', () => {
    const lanes = node('lanes', box(0));
    const a = node('category:a', box(0), lanes);
    node('category:s2', box(10), a);
    const b = node('category:b', box(40), lanes);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 'b', zone: 'center' }, b, { kind: 'category', categoryId: 'a' }),
    ).toEqual({ kind: 'category', categoryId: 'b', zone: 'center' });
  });

  it('a centre target on the source itself is blocked', () => {
    const lanes = node('lanes', box(0));
    const q = node('category:q', box(30), lanes);
    expect(normalizeInsertionTarget({ kind: 'category', categoryId: 'q', zone: 'center' }, q, { kind: 'category', categoryId: 'q' })).toBeNull();
  });

  it('resolves the source panel only inside the same board', () => {
    const boardOne = node('lanes', box(0));
    const parent = node('category:a', box(0), boardOne);
    node('category:s1', box(0), parent);
    const s2 = node('category:s2', box(30), parent);
    const boardTwo = node('lanes', box(0));
    node('category:b', box(0), boardTwo);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 's2', zone: 'before' }, s2, { kind: 'category', categoryId: 'b' }),
    ).toEqual({ kind: 'category', categoryId: 's1', zone: 'after' });
  });

  it('keeps the ordinary subcategory normalization when the source has no DOM panel', () => {
    const boardOne = node('lanes', box(0));
    const parent = node('category:a', box(0), boardOne);
    node('category:s1', box(0), parent);
    const s2 = node('category:s2', box(30), parent);
    expect(
      normalizeInsertionTarget({ kind: 'category', categoryId: 's2', zone: 'before' }, s2, { kind: 'category', categoryId: 'ghost' }),
    ).toEqual({ kind: 'category', categoryId: 's1', zone: 'after' });
  });
});
