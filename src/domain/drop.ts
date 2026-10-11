import { childrenOf, findCategory, placeCategory, topLevelOf } from './board.ts';
import { findCard, moveCard, moveCardToNewCategory } from './cards.ts';
import {
  columnOf,
  isColumnPlacement,
  moveCardToNewCategoryInColumn,
  placeCategoryInColumn,
} from './columns.ts';
import type { Board, Category, CardId, CategoryId, ColumnPlacement } from './types.ts';

export type Side = 'before' | 'after';
export type Zone = Side | 'center';

export type DragSource = { kind: 'card'; cardId: CardId } | { kind: 'category'; categoryId: CategoryId };

export type DropTarget =
  | { kind: 'card'; cardId: CardId; side: Side }
  | { kind: 'lane'; categoryId: CategoryId; zone?: Zone }
  | { kind: 'category'; categoryId: CategoryId; zone: Zone }
  | { kind: 'add-category'; placement?: ColumnPlacement };

export type DropIntent =
  | { kind: 'none'; reason: string }
  | { kind: 'rejected'; reason: string }
  | { kind: 'moveCard'; cardId: CardId; categoryId: CategoryId; index: number }
  | {
      kind: 'placeCategory';
      categoryId: CategoryId;
      parentId: CategoryId | null;
      index: number;
      placement?: ColumnPlacement;
    }
  | { kind: 'newCategoryWithCard'; cardId: CardId; placement?: ColumnPlacement };

export const NO_TARGET_REASON = 'Dropped outside every target';
export const DROP_ON_ITSELF_REASON = 'Dropped on itself';
export const CATEGORY_ON_CARD_REASON = 'Categories cannot be dropped on cards';
export const UNKNOWN_ITEM_REASON = 'That item no longer exists';
export const NEST_BLOCKED_REASON = 'Move its subcategories out first';
export const ALREADY_INSIDE_REASON = 'Already inside that category';
export const SAME_SLOT_REASON = 'Already in that position';

const none = (reason: string): DropIntent => ({ kind: 'none', reason });

const place = (
  categoryId: CategoryId,
  parentId: CategoryId | null,
  index: number,
  placement?: ColumnPlacement,
): DropIntent =>
  placement
    ? { kind: 'placeCategory', categoryId, parentId, index, placement }
    : { kind: 'placeCategory', categoryId, parentId, index };

const newCategory = (cardId: CardId, placement?: ColumnPlacement): DropIntent =>
  placement ? { kind: 'newCategoryWithCard', cardId, placement } : { kind: 'newCategoryWithCard', cardId };

const insertionIndex = (siblings: Category[], anchorId: CategoryId, after: boolean, movingId: CategoryId): number =>
  siblings.filter((category) => category.id !== movingId).findIndex((category) => category.id === anchorId) +
  (after ? 1 : 0);

const sameSlot = (siblings: Category[], sourceId: CategoryId, anchorId: CategoryId, after: boolean): boolean => {
  const at = siblings.findIndex((category) => category.id === anchorId);
  const from = siblings.findIndex((category) => category.id === sourceId);
  return at >= 0 && from >= 0 && (after ? from === at + 1 : from === at - 1);
};

const placementBeside = (anchorId: CategoryId, board: Board, columnCount?: number): ColumnPlacement | undefined => {
  if (columnCount === undefined) return undefined;
  const tops = topLevelOf(board);
  const at = tops.findIndex((category) => category.id === anchorId);
  if (at < 0) return undefined;
  const placement = { index: columnOf(tops[at], at, columnCount), count: columnCount };
  return isColumnPlacement(placement) ? placement : undefined;
};

const resolveOntoCard = (cardId: CardId, targetId: CardId, side: Side, board: Board): DropIntent => {
  if (cardId === targetId) return none(DROP_ON_ITSELF_REASON);
  const destination = findCard(board, targetId);
  if (!destination) return none(UNKNOWN_ITEM_REASON);
  const others = destination.category.cards.filter((card) => card.id !== cardId);
  const index = others.findIndex((card) => card.id === targetId) + (side === 'after' ? 1 : 0);
  return { kind: 'moveCard', cardId, categoryId: destination.category.id, index };
};

const resolveAppend = (cardId: CardId, categoryId: CategoryId, board: Board): DropIntent => {
  const category = findCategory(board, categoryId);
  if (!category) return none(UNKNOWN_ITEM_REASON);
  const index = category.cards.filter((card) => card.id !== cardId).length;
  return { kind: 'moveCard', cardId, categoryId, index };
};

const resolveCardDrop = (cardId: CardId, target: DropTarget, board: Board): DropIntent => {
  if (!findCard(board, cardId)) return none(UNKNOWN_ITEM_REASON);
  if (target.kind === 'add-category') return newCategory(cardId, target.placement);
  if (target.kind === 'card') return resolveOntoCard(cardId, target.cardId, target.side, board);
  if (target.kind === 'lane' || target.kind === 'category') return resolveAppend(cardId, target.categoryId, board);
  return none(NO_TARGET_REASON);
};

const placeBeside = (
  source: Category,
  anchorId: CategoryId,
  after: boolean,
  board: Board,
  columnCount?: number,
): DropIntent => {
  const tops = topLevelOf(board);
  if (sameSlot(tops, source.id, anchorId, after)) return none(SAME_SLOT_REASON);
  return place(
    source.id,
    null,
    insertionIndex(tops, anchorId, after, source.id),
    placementBeside(anchorId, board, columnCount),
  );
};

const besideParent = (
  source: Category,
  anchor: Category,
  parentId: CategoryId,
  after: boolean,
  board: Board,
  columnCount?: number,
): DropIntent => {
  if (parentId === source.id) return none(DROP_ON_ITSELF_REASON);
  const siblings = childrenOf(board, parentId);
  if (source.parentId === parentId) {
    if (sameSlot(siblings, source.id, anchor.id, after)) return none(SAME_SLOT_REASON);
    return place(source.id, parentId, insertionIndex(siblings, anchor.id, after, source.id));
  }
  return placeBeside(source, parentId, after, board, columnCount);
};

const nestInto = (source: Category, anchor: Category, board: Board): DropIntent => {
  if (childrenOf(board, source.id).length > 0) return { kind: 'rejected', reason: NEST_BLOCKED_REASON };
  const index = childrenOf(board, anchor.id).filter((category) => category.id !== source.id).length;
  return place(source.id, anchor.id, index);
};

const resolveOntoCategory = (
  source: Category,
  anchorId: CategoryId,
  zone: Zone,
  board: Board,
  columnCount?: number,
): DropIntent => {
  const anchor = findCategory(board, anchorId);
  if (!anchor) return none(UNKNOWN_ITEM_REASON);
  if (anchor.id === source.id) return none(DROP_ON_ITSELF_REASON);
  if (anchor.parentId !== null) {
    if (zone === 'center') {
      if (anchor.parentId === source.id) return none(DROP_ON_ITSELF_REASON);
      if (source.parentId === anchor.parentId) return none(ALREADY_INSIDE_REASON);
      const parent = findCategory(board, anchor.parentId);
      return parent ? nestInto(source, parent, board) : none(UNKNOWN_ITEM_REASON);
    }
    return besideParent(source, anchor, anchor.parentId, zone === 'after', board, columnCount);
  }
  if (zone !== 'center') return placeBeside(source, anchor.id, zone === 'after', board, columnCount);
  if (source.parentId === anchor.id) return none(ALREADY_INSIDE_REASON);
  return nestInto(source, anchor, board);
};

const resolveCategoryDrop = (
  categoryId: CategoryId,
  target: DropTarget,
  board: Board,
  columnCount?: number,
): DropIntent => {
  const source = findCategory(board, categoryId);
  if (!source) return none(UNKNOWN_ITEM_REASON);
  if (target.kind === 'add-category') {
    const others = topLevelOf(board).filter((category) => category.id !== source.id).length;
    return place(source.id, null, others, target.placement);
  }
  if (target.kind === 'category') return resolveOntoCategory(source, target.categoryId, target.zone, board, columnCount);
  if (target.kind === 'lane') return resolveOntoCategory(source, target.categoryId, target.zone ?? 'center', board, columnCount);
  return none(CATEGORY_ON_CARD_REASON);
};

export const resolveDrop = (
  source: DragSource,
  target: DropTarget | null,
  board: Board,
  columnCount?: number,
): DropIntent => {
  if (!target) return none(NO_TARGET_REASON);
  if (target.kind === 'add-category' && target.placement !== undefined && !isColumnPlacement(target.placement)) {
    return none(NO_TARGET_REASON);
  }
  return source.kind === 'card'
    ? resolveCardDrop(source.cardId, target, board)
    : resolveCategoryDrop(source.categoryId, target, board, columnCount);
};

export const applyIntent = (board: Board, intent: DropIntent): Board => {
  switch (intent.kind) {
    case 'moveCard':
      return moveCard(board, intent.cardId, intent.categoryId, intent.index);
    case 'placeCategory':
      return intent.placement
        ? placeCategoryInColumn(board, intent.categoryId, intent.placement, intent.index)
        : (placeCategory(board, intent.categoryId, intent.parentId, intent.index) ?? board);
    case 'newCategoryWithCard':
      return intent.placement
        ? moveCardToNewCategoryInColumn(board, intent.cardId, intent.placement)
        : moveCardToNewCategory(board, intent.cardId);
    case 'none':
    case 'rejected':
      return board;
  }
};
