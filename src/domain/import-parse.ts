import { isColorKey } from './board.ts';
import type { CardDraft } from './cards.ts';
import { toDateTime } from './dates.ts';
import { isColumnIndex } from './columns.ts';
import type { ColorKey } from './types.ts';

export const IMPORT_FORMAT_ERROR = 'Only JSON files are supported';
export const SHAPE_ERROR = 'Invalid board format: categories are missing';
const V1_COLOR_PATTERN = /^bg-([a-z]+)-100$/;

export interface SourceCard extends CardDraft {
  number: number | null;
}

export interface SourceCategory {
  key: string;
  title: string;
  parentKey: string | null;
  color: ColorKey | null;
  cards: SourceCard[];
  column?: number;
}

export interface SourceBoard {
  title: string;
  nextCardNumber: number | null;
  categories: SourceCategory[];
}

export type JsonRecord = Record<string, unknown>;

export const isRecord = (value: unknown): value is JsonRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const recordOf = (value: unknown): JsonRecord => (isRecord(value) ? value : {});
const listOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);
const textOf = (value: unknown): string => (typeof value === 'string' ? value : '');
const keyOf = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const countOf = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null;

const colorFromV1 = (value: unknown): ColorKey | null => {
  const name = textOf(recordOf(value).bg).match(V1_COLOR_PATTERN)?.[1];
  return isColorKey(name) ? name : null;
};

const dateTimeFromV2 = (value: unknown): CardDraft['start'] => {
  const raw = recordOf(value);
  return toDateTime(textOf(raw.date), textOf(raw.time));
};

const readV2Card = (value: unknown): SourceCard => {
  const raw = recordOf(value);
  return {
    number: countOf(raw.number),
    title: textOf(raw.title),
    description: textOf(raw.description),
    link: textOf(raw.link) || undefined,
    start: dateTimeFromV2(raw.start),
    due: dateTimeFromV2(raw.due),
  };
};

const readV2Category = (value: unknown, index: number): SourceCategory => {
  const raw = recordOf(value);
  const column = isColumnIndex(raw.column) ? { column: raw.column } : {};
  return {
    key: keyOf(raw.id) ?? `#${index}`,
    title: textOf(raw.title),
    parentKey: keyOf(raw.parentId),
    color: isColorKey(raw.color) ? raw.color : null,
    cards: listOf(raw.cards).map(readV2Card),
    ...column,
  };
};

const readV1Card = (value: unknown): SourceCard => {
  const raw = recordOf(value);
  return {
    number: countOf(raw.taskId),
    title: textOf(raw.title),
    description: textOf(raw.description),
    link: textOf(raw.contentLink) || undefined,
    start: toDateTime(textOf(raw.startDate), textOf(raw.startTime)),
    due: toDateTime(textOf(raw.dueDate), textOf(raw.dueTime)),
  };
};

const readV1Category = (value: unknown, index: number): SourceCategory => {
  const raw = recordOf(value);
  return {
    key: keyOf(raw.id) ?? `#${index}`,
    title: textOf(raw.title),
    parentKey: keyOf(raw.parentId),
    color: colorFromV1(raw.color),
    cards: listOf(raw.tasks).map(readV1Card),
  };
};

const parseJson = (source: string): unknown => {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(IMPORT_FORMAT_ERROR);
  }
};

const parseRecord = (source: string): JsonRecord => {
  const parsed = parseJson(source);
  if (!isRecord(parsed)) throw new Error(IMPORT_FORMAT_ERROR);
  return parsed;
};

export const parseSource = (source: string): SourceBoard => {
  const data = parseRecord(source);
  const isV2 = data.schemaVersion === 2;
  const list = isV2 ? data.categories : data.columns;
  if (!Array.isArray(list)) throw new Error(SHAPE_ERROR);
  const categories = list.map((entry, index) =>
    isV2 ? readV2Category(entry, index) : readV1Category(entry, index),
  );
  return {
    title: textOf(data.title),
    nextCardNumber: isV2 ? countOf(data.nextCardNumber) : null,
    categories,
  };
};
