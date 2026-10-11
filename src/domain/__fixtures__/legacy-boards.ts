export const legacySample = {
  id: 'legacy-sample',
  title: 'My First Board',
  columnCounter: 3,
  categoryCounter: 3,
  columns: [
    {
      id: 'todo',
      categoryId: 0,
      title: 'To Do',
      tasks: [
        { id: 'task-a', taskId: 0, title: 'Research competitors', description: 'Analyze top 5 competitors in the market' },
        { id: 'task-b', taskId: 1, title: 'Design homepage', description: 'Create wireframes for the new homepage' },
      ],
    },
    {
      id: 'in-progress',
      categoryId: 1,
      title: 'In Progress',
      tasks: [
        { id: 'task-c', taskId: 2, title: 'Backend API development', description: 'Build RESTful API endpoints for user management' },
      ],
    },
    {
      id: 'done',
      categoryId: 2,
      title: 'Done',
      tasks: [{ id: 'task-d', taskId: 3, title: 'Project setup', description: 'Initialize repository and configure development environment' }],
    },
  ],
};

export const legacyEdge = {
  id: 'legacy-edge',
  title: 'Edge board',
  columnCounter: 4,
  categoryCounter: 4,
  columns: [
    {
      id: 'todo',
      categoryId: 0,
      title: 'Todo',
      color: { bg: 'bg-blue-100', border: 'border-blue-300' },
      tasks: [
        {
          id: 'task-zero',
          taskId: 0,
          title: 'Card zero',
          description: '',
          startDate: '2024-03-01',
          startTime: '09:00',
          dueDate: '2024-03-02',
          contentLink: 'https://example.com',
        },
      ],
    },
    {
      id: 'sub-1',
      categoryId: 1,
      title: 'Todo - 1',
      parentId: 'todo',
      color: { bg: 'bg-white-100', border: 'border-white-300' },
      tasks: [],
    },
    {
      id: 'orphan',
      categoryId: 2,
      title: 'Orphan',
      parentId: 'ghost',
      tasks: [{ id: 'task-five', taskId: 5, title: 'Orphan card', description: '' }],
    },
  ],
};
