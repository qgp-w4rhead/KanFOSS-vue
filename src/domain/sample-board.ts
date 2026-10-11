import { createId } from './ids.ts';
import type { Board, Card } from './types.ts';

export const SAMPLE_BOARD_TITLE = 'My First Board';

export const createSampleBoard = (newId: () => string = createId): Board => {
  const card = (number: number, title: string, description: string): Card => ({
    id: newId(),
    number,
    title,
    description,
  });
  return {
    schemaVersion: 2,
    id: newId(),
    title: SAMPLE_BOARD_TITLE,
    nextCardNumber: 4,
    categories: [
      {
        id: newId(),
        title: 'To Do',
        parentId: null,
        color: null,
        cards: [
          card(0, 'Research competitors', 'Analyze top 5 competitors in the market'),
          card(1, 'Design homepage', 'Create wireframes for the new homepage'),
        ],
      },
      {
        id: newId(),
        title: 'In Progress',
        parentId: null,
        color: null,
        cards: [card(2, 'Backend API development', 'Build RESTful API endpoints for user management')],
      },
      {
        id: newId(),
        title: 'Done',
        parentId: null,
        color: null,
        cards: [card(3, 'Project setup', 'Initialize repository and configure development environment')],
      },
    ],
  };
};
