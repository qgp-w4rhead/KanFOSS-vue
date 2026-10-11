import { vi } from 'vitest';
import type { Rect } from '../../dnd/hit-test.ts';
import { flushFrame } from './kanban-board.harness.ts';

const PANEL_WIDTH = 300;
const MIN_PANEL_HEIGHT = 120;
const HEADER_HEIGHT = 30;
const CARD_TOP = 34;
const CARD_HEIGHT = 40;
const CARD_STRIDE = 48;
const BODY_MIN_HEIGHT = 60;
const BODY_BOTTOM_PAD = 4;
const SECTION_GAP = 8;
const SUB_INSET = 12;
const TOP_GAP = 16;
const COLUMN_STRIDE = 316;
const FOOTER_HEIGHT = 40;
const EMPTY: Rect = { left: 0, top: 0, width: 0, height: 0 };

const boxes = new WeakMap<Element, Rect>();

const toDomRect = (rect: Rect): DOMRect =>
  ({ ...rect, x: rect.left, y: rect.top, right: rect.left + rect.width, bottom: rect.top + rect.height }) as unknown as DOMRect;

export const installRects = (): void => {
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return toDomRect(boxes.get(this) ?? EMPTY);
  });
};

const place = (element: Element | undefined, rect: Rect): void => {
  if (element) boxes.set(element, rect);
};

const childrenNamed = (parent: Element, className: string): Element[] =>
  Array.from(parent.children).filter((child) => child.classList.contains(className));

const cardsHeight = (count: number): number => (count === 0 ? 0 : (count - 1) * CARD_STRIDE + CARD_HEIGHT);

const layoutPanel = (panel: Element, left: number, top: number, width: number): number => {
  const body = childrenNamed(panel, 'lane-body')[0];
  const cards = childrenNamed(body, 'card');
  const bodyHeight = Math.max(BODY_MIN_HEIGHT, CARD_TOP + cardsHeight(cards.length) + BODY_BOTTOM_PAD - HEADER_HEIGHT);
  place(childrenNamed(panel, 'lane-head')[0], { left, top, width, height: HEADER_HEIGHT });
  place(body, { left, top: top + HEADER_HEIGHT, width, height: bodyHeight });
  cards.forEach((card, index) =>
    place(card, {
      left: left + 8,
      top: top + HEADER_HEIGHT + 4 + index * CARD_STRIDE,
      width: width - 16,
      height: CARD_HEIGHT,
    }),
  );
  let cursor = top + HEADER_HEIGHT + bodyHeight;
  childrenNamed(panel, 'lane').forEach((sub) => {
    cursor += SECTION_GAP + layoutPanel(sub, left + SUB_INSET, cursor + SECTION_GAP, width - SUB_INSET);
  });
  const height = Math.max(MIN_PANEL_HEIGHT, cursor + SECTION_GAP - top);
  place(panel, { left, top, width, height });
  return height;
};

export const layoutBoard = (root: Element): void => {
  const lanes = root.querySelector('.lanes') as Element;
  const stacks = Array.from(root.querySelectorAll('.stack'));
  const columns = stacks.length > 0 ? stacks : [lanes];
  place(lanes, { left: 0, top: 0, width: COLUMN_STRIDE * columns.length, height: 2000 });
  columns.forEach((column, index) => {
    const left = index * COLUMN_STRIDE;
    place(column, { left, top: 0, width: PANEL_WIDTH, height: 2000 });
    let top = TOP_GAP;
    childrenNamed(column, 'lane').forEach((panel) => {
      top += layoutPanel(panel, left, top, PANEL_WIDTH) + TOP_GAP;
    });
    column.querySelectorAll('.add-category').forEach((footer) =>
      place(footer, { left, top, width: PANEL_WIDTH, height: FOOTER_HEIGHT }),
    );
  });
};

const contains = (rect: Rect, x: number, y: number): boolean =>
  rect.width > 0 && rect.height > 0 && x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height;

export const installHitStack = (): void => {
  Object.defineProperty(document, 'elementsFromPoint', {
    configurable: true,
    value: (x: number, y: number): Element[] =>
      Array.from(document.body.querySelectorAll('*'))
        .filter((element) => {
          const rect = boxes.get(element);
          return rect !== undefined && contains(rect, x, y);
        })
        .reverse(),
  });
};

export const pointerDown = (element: Element, x: number, y: number, button = 0): void => {
  element.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button, clientX: x, clientY: y }));
};

export const pointerMove = (x: number, y: number): void => {
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y }));
  flushFrame();
};

export const topOf = (element: Element): number => element.getBoundingClientRect().top;
export const leftOf = (element: Element): number => element.getBoundingClientRect().left;
export const heightOf = (element: Element): number => element.getBoundingClientRect().height;
export const bottomOf = (element: Element): number => topOf(element) + heightOf(element);
