import { cleanTitle, titleError } from './board.ts';
import { toCardFields, validateCardDraft } from './cards.ts';
import { isColumnIndex } from './columns.ts';
import { createId } from './ids.ts';
import { parseSource, type SourceBoard, type SourceCard, type SourceCategory } from './import-parse.ts';
import { MAX_BOARD_BYTES, MAX_CARDS, MAX_CATEGORIES } from './limits.ts';
import type { Board, Card, Category } from './types.ts';

export const IMPORT_SIZE_ERROR = 'File size must be less than 1MB';
export const DEFAULT_IMPORT_TITLE = 'Imported board';
export const TOO_MANY_CATEGORIES_ERROR = `A board can have at most ${MAX_CATEGORIES} categories`;
export const TOO_MANY_CARDS_ERROR = `A board can have at most ${MAX_CARDS} cards`;

export interface ImportResult {
  board: Board;
  warnings: string[];
}

interface Numbering {
  assign: (given: number | null) => number;
  next: () => number;
}

export const validateImportSize = (size: number): string | null => (size > MAX_BOARD_BYTES ? IMPORT_SIZE_ERROR : null);

export const serializeBoard = (board: Board): string => JSON.stringify(board, null, 2);

const createNumbering = (nextCardNumber: number | null): Numbering => {
  let highest = (nextCardNumber ?? 0) - 1;
  return {
    assign: (given) => {
      highest = given === null ? highest + 1 : Math.max(highest, given);
      return given ?? highest;
    },
    next: () => highest + 1,
  };
};

const buildCard = (card: SourceCard, numbering: Numbering): Card => {
  const fields = toCardFields(card);
  if (!fields) throw new Error(`Invalid card "${card.title}": ${validateCardDraft(card) ?? 'Invalid card'}`);
  return { id: createId(), number: numbering.assign(card.number), ...fields };
};

const parentIdOf = (
  category: SourceCategory,
  firstByKey: Map<string, SourceCategory>,
  idByKey: Map<string, string>,
  warnings: string[],
): string | null => {
  if (category.parentKey === null) return null;
  const parent = firstByKey.get(category.parentKey);
  if (parent && parent.parentKey === null) return idByKey.get(category.parentKey) ?? null;
  warnings.push(`"${category.title}" lost its parent and was moved to the top level.`);
  return null;
};

const requireTitle = (title: string, label: string): string => {
  const clean = cleanTitle(title);
  if (clean === null) throw new Error(`${label}: ${titleError(title) ?? 'Invalid title'}`);
  return clean;
};

const groupUnderParents = (categories: Category[]): Category[] => {
  const tops = categories.filter((category) => category.parentId === null);
  return tops.flatMap((top) => [top, ...categories.filter((category) => category.parentId === top.id)]);
};

const checkLimits = (categories: Category[]): void => {
  if (categories.length > MAX_CATEGORIES) throw new Error(TOO_MANY_CATEGORIES_ERROR);
  const cardTotal = categories.reduce((total, category) => total + category.cards.length, 0);
  if (cardTotal > MAX_CARDS) throw new Error(TOO_MANY_CARDS_ERROR);
};

const indexByKey = (categories: SourceCategory[]): {
  firstByKey: Map<string, SourceCategory>;
  idByKey: Map<string, string>;
} => {
  const firstByKey = new Map<string, SourceCategory>();
  const idByKey = new Map<string, string>();
  categories.forEach((category) => {
    if (firstByKey.has(category.key)) return;
    firstByKey.set(category.key, category);
    idByKey.set(category.key, createId());
  });
  return { firstByKey, idByKey };
};

export const buildBoard = (source: SourceBoard): ImportResult => {
  const warnings: string[] = [];
  const { firstByKey, idByKey } = indexByKey(source.categories);
  const numbering = createNumbering(source.nextCardNumber);
  const categories = source.categories.map((category): Category => ({
    id: idByKey.get(category.key) ?? createId(),
    title: requireTitle(category.title, 'Category'),
    parentId: parentIdOf(category, firstByKey, idByKey, warnings),
    color: category.color,
    cards: category.cards.map((card) => buildCard(card, numbering)),
    ...(isColumnIndex(category.column) ? { column: category.column } : {}),
  }));
  checkLimits(categories);
  const board: Board = {
    schemaVersion: 2,
    id: createId(),
    title: cleanTitle(source.title) ?? DEFAULT_IMPORT_TITLE,
    nextCardNumber: numbering.next(),
    categories: groupUnderParents(categories),
  };
  return { board, warnings };
};

export const parseBoardFile = (text: string): ImportResult => buildBoard(parseSource(text));
