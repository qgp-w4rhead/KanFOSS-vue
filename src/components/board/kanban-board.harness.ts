import { mount } from '@vue/test-utils';
import { vi } from 'vitest';
import { MAX_CATEGORIES } from '../../domain/limits.ts';
import type { Board, Card, Category } from '../../domain/types.ts';
import { appStore } from '../../store/app-store.ts';
import KanbanBoard from './KanbanBoard.vue';

const TITLES: Record<string, string> = {
  a: 'Alpha',
  b: 'Bravo',
  c: 'Charlie',
  d: 'Delta',
  e: 'Echo',
  f: 'Foxtrot',
  s: 'Alpha sub',
};

const lane = (id: string, parentId: string | null = null, cards: Card[] = []): Category => ({
  id,
  title: TITLES[id],
  parentId,
  color: null,
  cards,
});

const card = (id: string): Card => ({ id, number: 1, title: id, description: '' });

const boardOf = (categories: Category[]): Board => ({
  schemaVersion: 2,
  id: 'board',
  title: 'Board',
  nextCardNumber: 2,
  categories,
});

export const sixBoard = (): Board =>
  boardOf([lane('a'), lane('s', 'a'), lane('b'), lane('c'), lane('d'), lane('e'), lane('f')]);
export const threeBoard = (): Board => boardOf([lane('a'), lane('b'), lane('c')]);
export const cardBoard = (): Board => boardOf([lane('a', null, [card('k1')]), lane('b'), lane('c')]);
export const capBoard = (): Board =>
  boardOf(
    Array.from({ length: MAX_CATEGORIES }, (_, i) => ({
      ...lane(`c${i}`),
      title: `Item ${i}`,
      cards: i === 0 ? [card('k1')] : [],
    })),
  );

export const resetBoard = (board: Board): void => {
  appStore.dispatch({ type: 'replace-board', board });
};

const mounted: { unmount: () => void }[] = [];
const originalElementsFromPoint = Object.getOwnPropertyDescriptor(document, 'elementsFromPoint');

export const mountBoard = (realCards = false, realForms = false) => {
  const root = mount(KanbanBoard, {
    attachTo: document.body,
    global: {
      stubs: {
        LaneMenu: true,
        ColorPicker: true,
        ...(realForms ? {} : { CardForm: true }),
        ...(realCards ? {} : { CardItem: true }),
      },
    },
  });
  mounted.push(root);
  return root;
};

export type Root = ReturnType<typeof mountBoard>;

export const footers = (root: Root) => root.findAll('.add-category');
export const targeted = (root: Root): boolean[] => footers(root).map((footer) => footer.classes('is-target'));

export const stackTitles = (root: Root): string[][] =>
  root.findAll('.stack').map((stack) =>
    Array.from(stack.element.children)
      .filter((child) => child.classList.contains('lane'))
      .map((child) => child.getAttribute('aria-label') ?? ''),
  );

export const createdIn = (column: number): Category[] =>
  appStore.board.value.categories.filter((category) => category.column === column);

export const cardGrip = (root: Root): Element => root.find('.card').element;

let queuedFrame: FrameRequestCallback | null = null;

export const flushFrame = (): void => {
  const callback = queuedFrame;
  queuedFrame = null;
  callback?.(0);
};

export const stubFrames = (): void => {
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queuedFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    queuedFrame = null;
  });
};

export const beginDrag = (grip: Element, hovered: Element): void => {
  stubFrames();
  Object.defineProperty(document, 'elementsFromPoint', { configurable: true, value: () => [hovered] });
  grip.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0 }));
  window.dispatchEvent(new MouseEvent('pointermove', { clientX: 50, clientY: 50 }));
  flushFrame();
};

export const release = (x = 50, y = 50): void => {
  window.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: y }));
};

export const pressKey = (root: Root, selector: string, key: string): Promise<void> =>
  root.find(selector).trigger('keydown', { key });

export const cleanup = (): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
  mounted.splice(0).forEach((root) => root.unmount());
  vi.unstubAllGlobals();
  if (originalElementsFromPoint) {
    Object.defineProperty(document, 'elementsFromPoint', originalElementsFromPoint);
  } else {
    Reflect.deleteProperty(document, 'elementsFromPoint');
  }
};
