import {
  NEST_BLOCKED_ERROR,
  addCategory,
  addSubcategory,
  childrenOf,
  deleteCategory,
  findCategory,
  nestCategory,
  placeCategory,
  promoteCategory,
  renameBoard,
  renameCategory,
  setCategoryColor,
  stepCategory,
} from '../domain/board.ts';
import { addCard, deleteCard, moveCard, moveCardToNewCategory, updateCard, type CardDraft } from '../domain/cards.ts';
import { addCategoryInColumn, stepCategoryInColumn } from '../domain/columns.ts';
import { applyIntent, resolveDrop, type DragSource, type DropTarget } from '../domain/drop.ts';
import type { Board, CardId, CategoryId, ColorKey, ColumnPlacement } from '../domain/types.ts';

export type CategoryAction =
  | { type: 'add-category'; placement?: ColumnPlacement }
  | { type: 'add-subcategory'; parentId: CategoryId }
  | { type: 'rename-category'; categoryId: CategoryId; title: string }
  | { type: 'set-color'; categoryId: CategoryId; color: ColorKey | null }
  | { type: 'delete-category'; categoryId: CategoryId }
  | { type: 'place-category'; categoryId: CategoryId; parentId: CategoryId | null; index: number }
  | { type: 'step-category'; categoryId: CategoryId; delta: number; columnCount?: number }
  | { type: 'promote-category'; categoryId: CategoryId }
  | { type: 'nest-category'; categoryId: CategoryId; parentId: CategoryId };

export type CardAction =
  | { type: 'add-card'; categoryId: CategoryId; draft: CardDraft }
  | { type: 'update-card'; cardId: CardId; draft: CardDraft }
  | { type: 'delete-card'; cardId: CardId }
  | { type: 'move-card'; cardId: CardId; categoryId: CategoryId; index: number }
  | { type: 'card-to-new-category'; cardId: CardId };

export type BoardLevelAction =
  | { type: 'rename-board'; title: string }
  | { type: 'replace-board'; board: Board }
  | { type: 'drop'; source: DragSource; target: DropTarget | null; columnCount?: number };

export type BoardAction = CategoryAction | CardAction | BoardLevelAction;

export interface Reduction {
  board: Board;
  message?: string;
}

const CARD_ACTION_TYPES: readonly string[] = [
  'add-card',
  'update-card',
  'delete-card',
  'move-card',
  'card-to-new-category',
];

const isCardAction = (action: BoardAction): action is CardAction => CARD_ACTION_TYPES.includes(action.type);

const deleteWithMessage = (board: Board, categoryId: CategoryId): Reduction => {
  const title = findCategory(board, categoryId)?.title;
  if (title === undefined) return { board };
  const deletion = deleteCategory(board, categoryId);
  const count = deletion.removedCards;
  const suffix = count > 0 ? ` with ${count} card${count === 1 ? '' : 's'}` : '';
  return { board: deletion.board, message: `Deleted "${title}"${suffix}. Undo restores it.` };
};

const nestWithMessage = (board: Board, categoryId: CategoryId, parentId: CategoryId): Reduction => {
  const next = nestCategory(board, categoryId, parentId);
  if (next) return { board: next };
  const blocked = childrenOf(board, categoryId).length > 0;
  return { board, message: blocked ? NEST_BLOCKED_ERROR : 'That category cannot go there' };
};

const reduceCategories = (board: Board, action: CategoryAction): Reduction => {
  switch (action.type) {
    case 'add-category':
      return { board: action.placement ? addCategoryInColumn(board, action.placement) : addCategory(board) };
    case 'add-subcategory':
      return { board: addSubcategory(board, action.parentId) };
    case 'rename-category':
      return { board: renameCategory(board, action.categoryId, action.title) };
    case 'set-color':
      return { board: setCategoryColor(board, action.categoryId, action.color) };
    case 'delete-category':
      return deleteWithMessage(board, action.categoryId);
    case 'place-category':
      return { board: placeCategory(board, action.categoryId, action.parentId, action.index) ?? board };
    case 'step-category':
      return {
        board:
          action.columnCount === undefined
            ? stepCategory(board, action.categoryId, action.delta)
            : stepCategoryInColumn(board, action.categoryId, action.delta, action.columnCount),
      };
    case 'promote-category':
      return { board: promoteCategory(board, action.categoryId) };
    case 'nest-category':
      return nestWithMessage(board, action.categoryId, action.parentId);
  }
};

const reduceCards = (board: Board, action: CardAction): Board => {
  switch (action.type) {
    case 'add-card':
      return addCard(board, action.categoryId, action.draft);
    case 'update-card':
      return updateCard(board, action.cardId, action.draft);
    case 'delete-card':
      return deleteCard(board, action.cardId);
    case 'move-card':
      return moveCard(board, action.cardId, action.categoryId, action.index);
    case 'card-to-new-category':
      return moveCardToNewCategory(board, action.cardId);
  }
};

const reduceDrop = (board: Board, action: Extract<BoardAction, { type: 'drop' }>): Reduction => {
  const intent = resolveDrop(action.source, action.target, board, action.columnCount);
  const message = intent.kind === 'none' || intent.kind === 'rejected' ? intent.reason : undefined;
  return { board: applyIntent(board, intent), message };
};

export const reduceBoard = (board: Board, action: BoardAction): Reduction => {
  if (action.type === 'drop') return reduceDrop(board, action);
  if (action.type === 'replace-board') return { board: action.board };
  if (action.type === 'rename-board') return { board: renameBoard(board, action.title) };
  return isCardAction(action) ? { board: reduceCards(board, action) } : reduceCategories(board, action);
};
