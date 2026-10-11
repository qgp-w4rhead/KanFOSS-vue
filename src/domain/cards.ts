import { canAddCategory, cleanTitle, findCategory, insertAt, titleError, DEFAULT_CATEGORY_TITLE } from './board.ts';
import { createId } from './ids.ts';
import { validateRange } from './dates.ts';
import { MAX_CARDS, MAX_DESCRIPTION_LENGTH, MAX_LINK_LENGTH } from './limits.ts';
import type { Board, Card, CardId, Category, CategoryId, DateTime } from './types.ts';

export interface CardDraft {
  title: string;
  description?: string;
  link?: string;
  start?: DateTime;
  due?: DateTime;
}

export interface CardFields {
  title: string;
  description: string;
  link?: string;
  start?: DateTime;
  due?: DateTime;
}

export interface CardLocation {
  category: Category;
  card: Card;
}

export const LINK_PROTOCOL_ERROR = 'Link must start with http:// or https://';
export const LINK_LENGTH_ERROR = `Link must be ${MAX_LINK_LENGTH} characters or fewer`;
export const DESCRIPTION_LENGTH_ERROR = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or fewer`;

const isWebLink = (link: string): boolean => {
  try {
    const url = new URL(link);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

export const validateCardDraft = (draft: CardDraft): string | null => {
  const link = (draft.link ?? '').trim();
  const checks = [
    titleError(draft.title),
    (draft.description ?? '').length > MAX_DESCRIPTION_LENGTH ? DESCRIPTION_LENGTH_ERROR : null,
    link.length > MAX_LINK_LENGTH ? LINK_LENGTH_ERROR : null,
    link && !isWebLink(link) ? LINK_PROTOCOL_ERROR : null,
  ];
  return checks.find((error) => error !== null) ?? validateRange(draft.start, draft.due);
};

export const toCardFields = (draft: CardDraft): CardFields | null => {
  const title = cleanTitle(draft.title);
  if (title === null || validateCardDraft(draft) !== null) return null;
  const link = (draft.link ?? '').trim();
  return {
    title,
    description: (draft.description ?? '').trim(),
    link: link || undefined,
    start: draft.start,
    due: draft.due,
  };
};

export const findCard = (board: Board, cardId: CardId): CardLocation | undefined => {
  for (const category of board.categories) {
    const card = category.cards.find((item) => item.id === cardId);
    if (card) return { category, card };
  }
  return undefined;
};

export const canAddCard = (board: Board): boolean =>
  board.categories.reduce((total, category) => total + category.cards.length, 0) < MAX_CARDS;

const withoutCard = (cards: Card[], cardId: CardId): Card[] => cards.filter((card) => card.id !== cardId);

export const addCard = (board: Board, categoryId: CategoryId, draft: CardDraft, id: CardId = createId()): Board => {
  const fields = toCardFields(draft);
  if (!fields || !findCategory(board, categoryId) || !canAddCard(board)) return board;
  const card: Card = { id, number: board.nextCardNumber, ...fields };
  const categories = board.categories.map((category) =>
    category.id === categoryId ? { ...category, cards: [...category.cards, card] } : category,
  );
  return { ...board, categories, nextCardNumber: board.nextCardNumber + 1 };
};

export const updateCard = (board: Board, cardId: CardId, draft: CardDraft): Board => {
  const found = findCard(board, cardId);
  const fields = toCardFields(draft);
  if (!found || !fields) return board;
  const card: Card = { ...found.card, ...fields };
  if (JSON.stringify(card) === JSON.stringify(found.card)) return board;
  const categories = board.categories.map((category) =>
    category.cards.some((item) => item.id === cardId)
      ? { ...category, cards: category.cards.map((item) => (item.id === cardId ? card : item)) }
      : category,
  );
  return { ...board, categories };
};

export const deleteCard = (board: Board, cardId: CardId): Board => {
  if (!findCard(board, cardId)) return board;
  const categories = board.categories.map((category) => ({ ...category, cards: withoutCard(category.cards, cardId) }));
  return { ...board, categories };
};

export const moveCard = (board: Board, cardId: CardId, categoryId: CategoryId, index: number): Board => {
  const found = findCard(board, cardId);
  if (!found || !findCategory(board, categoryId)) return board;
  const categories = board.categories.map((category) => {
    if (category.id === categoryId) {
      return { ...category, cards: insertAt(withoutCard(category.cards, cardId), index, found.card) };
    }
    return category.cards.some((item) => item.id === cardId)
      ? { ...category, cards: withoutCard(category.cards, cardId) }
      : category;
  });
  return JSON.stringify(categories) === JSON.stringify(board.categories) ? board : { ...board, categories };
};

export const moveCardToNewCategory = (board: Board, cardId: CardId, id: CategoryId = createId()): Board => {
  const found = findCard(board, cardId);
  if (!found || !canAddCategory(board)) return board;
  const categories = board.categories.map((category) => ({ ...category, cards: withoutCard(category.cards, cardId) }));
  const created: Category = { id, title: DEFAULT_CATEGORY_TITLE, parentId: null, color: null, cards: [found.card] };
  return { ...board, categories: [...categories, created] };
};
