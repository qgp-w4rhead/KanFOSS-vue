import { computed, ref, shallowRef } from 'vue';
import type { Board } from '../domain/types.ts';
import { reduceBoard, type BoardAction } from './actions.ts';

export interface BoardRepository {
  load: () => Board | null;
  save: (board: Board) => void;
}

export const HISTORY_LIMIT = 50;
export const UNDO_MESSAGE = 'Undone';

export const createBoardStore = (repository: BoardRepository, fallback: () => Board) => {
  const board = shallowRef<Board>(repository.load() ?? fallback());
  const history = shallowRef<Board[]>([]);
  const message = ref('');
  const canUndo = computed(() => history.value.length > 0);

  const replace = (next: Board): void => {
    board.value = next;
    repository.save(next);
  };

  const dispatch = (action: BoardAction): void => {
    const result = reduceBoard(board.value, action);
    message.value = result.message ?? '';
    if (result.board === board.value) return;
    history.value = [...history.value, board.value].slice(-HISTORY_LIMIT);
    replace(result.board);
  };

  const undo = (): void => {
    const stack = history.value;
    if (stack.length === 0) return;
    history.value = stack.slice(0, -1);
    replace(stack[stack.length - 1]);
    message.value = UNDO_MESSAGE;
  };

  const notify = (text: string): void => {
    message.value = text;
  };

  return { board, message, canUndo, dispatch, undo, notify };
};
