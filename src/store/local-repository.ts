import { parseBoardFile, serializeBoard } from '../domain/import-export.ts';
import { isRecord } from '../domain/import-parse.ts';
import type { Board } from '../domain/types.ts';
import type { BoardRepository } from './board-store.ts';

export const BOARD_STORAGE_KEY = 'kanfoss_board_v2';
const LEGACY_BOARDS_KEY = 'kanfoss_boards';
const LEGACY_CURRENT_KEY = 'kanfoss_current_board';

const isStoredBoard = (value: unknown): value is Board =>
  isRecord(value) && value.schemaVersion === 2 && Array.isArray(value.categories);

const readStored = (storage: Storage): Board | null => {
  const raw = storage.getItem(BOARD_STORAGE_KEY);
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return isStoredBoard(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const pickLegacyBoard = (boards: unknown[], currentId: string | null): unknown =>
  boards.find((board) => isRecord(board) && board.id === currentId) ?? boards[0];

const migrateLegacy = (storage: Storage): Board | null => {
  const raw = storage.getItem(LEGACY_BOARDS_KEY);
  if (raw === null) return null;
  try {
    const boards: unknown = JSON.parse(raw);
    if (!Array.isArray(boards) || boards.length === 0) return null;
    const legacy = pickLegacyBoard(boards, storage.getItem(LEGACY_CURRENT_KEY));
    return parseBoardFile(JSON.stringify(legacy)).board;
  } catch {
    return null;
  }
};

export const createLocalRepository = (storage: Storage): BoardRepository => {
  const save = (board: Board): void => storage.setItem(BOARD_STORAGE_KEY, serializeBoard(board));
  return {
    load: () => {
      const stored = readStored(storage);
      if (stored) return stored;
      const migrated = migrateLegacy(storage);
      if (migrated) save(migrated);
      return migrated;
    },
    save,
  };
};
