import {
  addCategory,
  DEFAULT_CATEGORY_TITLE,
  END_OF_LIST,
  findCategory,
  placeCategory,
  stepCategory,
  topLevelOf,
} from './board.ts';
import { moveCardToNewCategory } from './cards.ts';
import { createId } from './ids.ts';
import type { Board, Category, CategoryId, CardId, ColumnPlacement } from './types.ts';

export const isColumnIndex = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

export const isColumnCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 1;

export const isColumnPlacement = (value: unknown): value is ColumnPlacement => {
  if (typeof value !== 'object' || value === null) return false;
  const { index, count } = value as Partial<Record<keyof ColumnPlacement, unknown>>;
  return isColumnCount(count) && isColumnIndex(index) && index < count;
};

export const columnOf = (category: Category, fallbackIndex: number, count: number): number => {
  if (!isColumnCount(count)) return 0;
  const slot = isColumnIndex(category.column) ? category.column : fallbackIndex;
  return (isColumnIndex(slot) ? slot : 0) % count;
};

export const pinColumns = (board: Board, count: number): Board => {
  if (!isColumnCount(count)) return board;
  const pinned = new Map<CategoryId, Category>();
  topLevelOf(board).forEach((category, index) => {
    if (!isColumnIndex(category.column)) pinned.set(category.id, { ...category, column: index % count });
  });
  if (pinned.size === 0) return board;
  return { ...board, categories: board.categories.map((category) => pinned.get(category.id) ?? category) };
};

const withColumn = (board: Board, categoryId: CategoryId, column: number): Board => ({
  ...board,
  categories: board.categories.map((category) => (category.id === categoryId ? { ...category, column } : category)),
});

const layoutOf = (board: Board, count: number): string =>
  JSON.stringify(
    pinColumns(board, count).categories.map((category) => [
      category.id,
      category.parentId,
      isColumnIndex(category.column) ? category.column % count : null,
    ]),
  );

export const addCategoryInColumn = (
  board: Board,
  placement: ColumnPlacement,
  title = DEFAULT_CATEGORY_TITLE,
  id: CategoryId = createId(),
): Board => {
  if (!isColumnPlacement(placement)) return board;
  const pinned = pinColumns(board, placement.count);
  const next = addCategory(pinned, title, id);
  return next === pinned ? board : withColumn(next, id, placement.index);
};

export const placeCategoryInColumn = (
  board: Board,
  categoryId: CategoryId,
  placement: ColumnPlacement,
  index = END_OF_LIST,
): Board => {
  if (!isColumnPlacement(placement) || !findCategory(board, categoryId)) return board;
  const pinned = pinColumns(board, placement.count);
  const moved = placeCategory(pinned, categoryId, null, index);
  if (moved === null) return board;
  const next = withColumn(moved, categoryId, placement.index);
  return layoutOf(next, placement.count) === layoutOf(board, placement.count) ? board : next;
};

export const moveCardToNewCategoryInColumn = (
  board: Board,
  cardId: CardId,
  placement: ColumnPlacement,
  id: CategoryId = createId(),
): Board => {
  if (!isColumnPlacement(placement)) return board;
  const pinned = pinColumns(board, placement.count);
  const next = moveCardToNewCategory(pinned, cardId, id);
  return next === pinned ? board : withColumn(next, id, placement.index);
};

const stepTopLevelInColumn = (board: Board, categoryId: CategoryId, delta: number, count: number): Board => {
  const pinned = pinColumns(board, count);
  const tops = topLevelOf(pinned);
  const current = tops.find((category) => category.id === categoryId);
  if (!current || delta === 0) return board;
  const column = columnOf(current, 0, count);
  const sameColumn = tops.filter((category) => columnOf(category, 0, count) === column);
  const position = sameColumn.indexOf(current) + delta;
  if (position < 0 || position >= sameColumn.length) return board;
  const others = tops.filter((category) => category.id !== categoryId);
  const anchorAt = others.findIndex((category) => category.id === sameColumn[position].id);
  const moved = placeCategory(pinned, categoryId, null, delta < 0 ? anchorAt : anchorAt + 1);
  if (moved === null) return board;
  return layoutOf(moved, count) === layoutOf(board, count) ? board : moved;
};

export const stepCategoryInColumn = (board: Board, categoryId: CategoryId, delta: number, count: number): Board => {
  if (!Number.isSafeInteger(delta) || !isColumnCount(count)) return board;
  const current = findCategory(board, categoryId);
  if (!current) return board;
  return current.parentId === null
    ? stepTopLevelInColumn(board, categoryId, delta, count)
    : stepCategory(board, categoryId, delta);
};
