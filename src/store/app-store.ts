import { createSampleBoard } from '../domain/sample-board.ts';
import { createBoardStore } from './board-store.ts';
import { createLocalRepository } from './local-repository.ts';

export const appStore = createBoardStore(createLocalRepository(window.localStorage), () => createSampleBoard());
