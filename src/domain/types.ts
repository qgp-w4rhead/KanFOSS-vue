export type CategoryId = string;
export type CardId = string;
export type ColorKey =
  | 'gray'
  | 'slate'
  | 'brown'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'lime'
  | 'green'
  | 'teal'
  | 'cyan'
  | 'sky'
  | 'blue'
  | 'indigo'
  | 'purple'
  | 'magenta'
  | 'pink';

export interface DateTime {
  date: string;
  time?: string;
}

export interface Card {
  id: CardId;
  number: number;
  title: string;
  description: string;
  link?: string;
  start?: DateTime;
  due?: DateTime;
}

export interface Category {
  id: CategoryId;
  title: string;
  parentId: CategoryId | null;
  color: ColorKey | null;
  cards: Card[];
  column?: number;
}

export interface ColumnPlacement {
  index: number;
  count: number;
}

export interface Board {
  schemaVersion: 2;
  id: string;
  title: string;
  nextCardNumber: number;
  categories: Category[];
}
