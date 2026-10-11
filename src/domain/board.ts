import { createId } from './ids.ts';
import { MAX_CATEGORIES, MAX_TITLE_LENGTH } from './limits.ts';
import type { Board, Category, CategoryId, ColorKey } from './types.ts';

export const DEFAULT_CATEGORY_TITLE = 'Untitled category';
export const DEFAULT_SUBCATEGORY_TITLE = 'Untitled subcategory';
export const END_OF_LIST = Number.MAX_SAFE_INTEGER;
export const COLOR_KEYS: readonly ColorKey[] = [
  'gray',
  'slate',
  'brown',
  'red',
  'orange',
  'yellow',
  'lime',
  'green',
  'teal',
  'cyan',
  'sky',
  'blue',
  'indigo',
  'purple',
  'magenta',
  'pink',
];
export const TITLE_REQUIRED_ERROR = 'Title is required';
export const TITLE_TOO_LONG_ERROR = `Title must be ${MAX_TITLE_LENGTH} characters or fewer`;
export const NEST_BLOCKED_ERROR = 'Move its subcategories out first';

export interface Deletion {
  board: Board;
  removedCards: number;
}

export const isColorKey = (value: unknown): value is ColorKey => COLOR_KEYS.some((key) => key === value);

export const titleError = (title: string): string | null => {
  const trimmed = title.trim();
  if (!trimmed) return TITLE_REQUIRED_ERROR;
  return trimmed.length > MAX_TITLE_LENGTH ? TITLE_TOO_LONG_ERROR : null;
};

export const cleanTitle = (title: string): string | null => (titleError(title) === null ? title.trim() : null);

export const createBoard = (id: string, title: string): Board => ({
  schemaVersion: 2,
  id,
  title,
  nextCardNumber: 1,
  categories: [],
});

export const findCategory = (board: Board, id: CategoryId): Category | undefined =>
  board.categories.find((category) => category.id === id);

export const childrenOf = (board: Board, parentId: CategoryId | null): Category[] =>
  board.categories.filter((category) => category.parentId === parentId);

export const topLevelOf = (board: Board): Category[] => childrenOf(board, null);

export const canAddCategory = (board: Board): boolean => board.categories.length < MAX_CATEGORIES;

export const insertAt = <T>(items: T[], index: number, item: T): T[] => {
  const at = Math.min(Math.max(index, 0), items.length);
  return [...items.slice(0, at), item, ...items.slice(at)];
};

const replaceCategories = (board: Board, categories: Category[]): Board => ({ ...board, categories });

const updateCategory = (board: Board, id: CategoryId, change: (category: Category) => Category): Board =>
  replaceCategories(board, board.categories.map((category) => (category.id === id ? change(category) : category)));

export const renameBoard = (board: Board, title: string): Board => {
  const clean = cleanTitle(title);
  return clean === null || clean === board.title ? board : { ...board, title: clean };
};

export const addCategory = (board: Board, title = DEFAULT_CATEGORY_TITLE, id: CategoryId = createId()): Board => {
  const clean = cleanTitle(title);
  if (clean === null || !canAddCategory(board)) return board;
  return replaceCategories(board, [...board.categories, { id, title: clean, parentId: null, color: null, cards: [] }]);
};

export const addSubcategory = (
  board: Board,
  parentId: CategoryId,
  title = DEFAULT_SUBCATEGORY_TITLE,
  id: CategoryId = createId(),
): Board => {
  const parent = findCategory(board, parentId);
  const clean = cleanTitle(title);
  if (!parent || parent.parentId !== null || clean === null || !canAddCategory(board)) return board;
  return replaceCategories(board, [...board.categories, { id, title: clean, parentId, color: null, cards: [] }]);
};

export const renameCategory = (board: Board, id: CategoryId, title: string): Board => {
  const current = findCategory(board, id);
  const clean = cleanTitle(title);
  if (!current || clean === null || current.title === clean) return board;
  return updateCategory(board, id, (category) => ({ ...category, title: clean }));
};

export const setCategoryColor = (board: Board, id: CategoryId, color: ColorKey | null): Board => {
  const current = findCategory(board, id);
  if (!current || (color !== null && !isColorKey(color)) || current.color === color) return board;
  return updateCategory(board, id, (category) => ({ ...category, color }));
};

const canNest = (board: Board, moving: Category, parentId: CategoryId): boolean => {
  const parent = findCategory(board, parentId);
  return (
    parent !== undefined &&
    parent.parentId === null &&
    parent.id !== moving.id &&
    childrenOf(board, moving.id).length === 0
  );
};

const sameOrder = (before: Category[], after: Category[]): boolean =>
  before.length === after.length &&
  before.every((category, index) => category.id === after[index].id && category.parentId === after[index].parentId);

export const placeCategory = (
  board: Board,
  id: CategoryId,
  parentId: CategoryId | null,
  index: number,
): Board | null => {
  const moving = findCategory(board, id);
  if (!moving || (parentId !== null && !canNest(board, moving, parentId))) return null;
  const moved: Category = { ...moving, parentId };
  const all = board.categories.map((category) => (category.id === id ? moved : category));
  const siblings = all.filter((category) => category.parentId === parentId && category.id !== id);
  const ordered = insertAt(siblings, index, moved);
  const tops = parentId === null ? ordered : all.filter((category) => category.parentId === null);
  const arranged = tops.flatMap((top) => [
    top,
    ...(top.id === parentId ? ordered : all.filter((category) => category.parentId === top.id)),
  ]);
  if (arranged.length !== board.categories.length) return null;
  return sameOrder(board.categories, arranged) ? board : replaceCategories(board, arranged);
};

export const promoteCategory = (board: Board, id: CategoryId): Board => {
  const current = findCategory(board, id);
  if (!current || current.parentId === null) return board;
  return placeCategory(board, id, null, END_OF_LIST) ?? board;
};

export const nestCategory = (board: Board, id: CategoryId, parentId: CategoryId): Board | null =>
  placeCategory(board, id, parentId, END_OF_LIST);

export const stepCategory = (board: Board, id: CategoryId, delta: number): Board => {
  const current = findCategory(board, id);
  if (!current) return board;
  const index = childrenOf(board, current.parentId).findIndex((category) => category.id === id);
  return placeCategory(board, id, current.parentId, index + delta) ?? board;
};

export const deleteCategory = (board: Board, id: CategoryId): Deletion => {
  const removedIds = new Set([id, ...childrenOf(board, id).map((category) => category.id)]);
  const removed = board.categories.filter((category) => removedIds.has(category.id));
  if (removed.length === 0) return { board, removedCards: 0 };
  const kept = board.categories.filter((category) => !removedIds.has(category.id));
  const removedCards = removed.reduce((total, category) => total + category.cards.length, 0);
  return { board: replaceCategories(board, kept), removedCards };
};
