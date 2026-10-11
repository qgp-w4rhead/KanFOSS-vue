# KanFOSS

A free, open-source Kanban board that runs entirely in your browser.
No accounts, no server, no tracking — your board is saved automatically
to local storage and never leaves your machine.

## What you get

### Boards

KanFOSS gives you a single board with an editable title, saved
automatically as you work — there is no save button and nothing to
lose. A sample board is loaded on first launch so you can explore right
away. Every change is reversible: undo covers your last 50 actions,
including deletes and moves. When you need a backup or want to move to
another browser, the board exports to a JSON file and imports back with
validation that reports warnings instead of failing on minor issues.

### Categories

Work is grouped into categories shown as lanes. You can create them,
rename them inline, and delete them behind a confirmation step —
Shift+click skips it. Each category can take one of 16 colors, and
categories nest one level deep as subcategories that can be promoted
back to the top level at any time. Reordering works by dragging, or
through the lane menu (Move up, Move down, Move into) when
drag-and-drop is inconvenient.

### Cards

Cards are numbered automatically (#1, #2, …) for easy reference. Each
card can hold:

- a title and a description,
- an optional link,
- optional start and due date/times, shown as badges on the card.

Cards can be edited in place, deleted, or moved to any other category
through a picker dialog.

### Drag and drop

- Drag a card to reorder it or move it to another category — insertion
  indicators show exactly where it will land.
- Drop a card on the "add category" zone to create a new category
  containing it.
- Drag a category to reorder it or move it between columns.
- Drop a category onto the center of another to nest it as a
  subcategory.

Invalid drops explain why they were rejected — for example, a category
that already has subcategories cannot be nested — instead of failing
silently.

### Layout and appearance

The masonry layout adapts its column count to your window width
automatically, or you can pin it to a fixed count from 1 to 6 columns.
A single-column list layout is available when you prefer a simple
vertical stack. Light and dark themes follow your system preference by
default, and your layout, column, and theme choices are remembered
across sessions.

## Limits

Designed for personal-scale boards: up to 200 categories, 2,000 cards,
and a 1 MB board file per import.

## Development

Requires Node.js 24+.

```sh
npm install
npm run dev        # start the dev server
npm run build      # production build to dist/
npm run preview    # serve the production build locally
npm run typecheck  # vue-tsc across app, node, and server configs
npm run lint       # eslint
npm test           # vitest
```

## Tech

Vue 3, TypeScript, and Vite. State lives in a small local store with a
repository abstraction over `localStorage`; all board logic (drops,
moves, limits, import/export) is plain, test-covered domain code with
no framework dependencies.
