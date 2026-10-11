<script setup lang="ts">
import { parseBoardFile, serializeBoard, validateImportSize } from '../../domain/import-export.ts';
import { appStore } from '../../store/app-store.ts';
import SettingsMenu from './SettingsMenu.vue';

const board = appStore.board;
const canUndo = appStore.canUndo;

const exportFileName = (): string => `${board.value.title.trim().toLowerCase().replace(/\s+/g, '-') || 'board'}-board.json`;

const exportBoard = (): void => {
  const url = URL.createObjectURL(new Blob([serializeBoard(board.value)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = exportFileName();
  link.click();
  URL.revokeObjectURL(url);
};

const renameBoard = (event: Event): void => {
  appStore.dispatch({ type: 'rename-board', title: (event.target as HTMLInputElement).value });
};

const importFile = async (event: Event): Promise<void> => {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file) return;
  const sizeError = validateImportSize(file.size);
  if (sizeError) {
    appStore.notify(sizeError);
    return;
  }
  try {
    const result = parseBoardFile(await file.text());
    appStore.dispatch({ type: 'replace-board', board: result.board });
    appStore.notify(result.warnings.length > 0 ? `Imported with notes: ${result.warnings.join(' ')}` : 'Board imported');
  } catch (error) {
    appStore.notify(error instanceof Error ? error.message : 'Import failed');
  }
};
</script>

<template>
  <header class="header">
    <div class="brand">
      <span
        class="mark"
        aria-hidden="true"
      />
      <span>KanFOSS</span>
    </div>
    <input
      class="board-title"
      :value="board.title"
      aria-label="Board title"
      maxlength="200"
      @change="renameBoard"
    >
    <div class="tools">
      <button
        type="button"
        :disabled="!canUndo"
        @click="appStore.undo()"
      >
        Undo
      </button>
      <button
        type="button"
        @click="exportBoard"
      >
        Export
      </button>
      <label class="file-button">
        Import
        <input
          type="file"
          accept=".json,application/json"
          @change="importFile"
        >
      </label>
      <SettingsMenu />
    </div>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px 16px;
  padding: 12px 24px;
  background: var(--surface-app);
  border-bottom: 1px solid var(--line);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.mark {
  width: 14px;
  height: 14px;
  border: 2px dashed var(--signal-line);
  border-radius: 2px;
}

.board-title {
  flex: 1 1 200px;
  min-width: 0;
  padding: 4px 6px;
  font-size: 1.1rem;
  font-weight: 600;
  border-color: transparent;
  background: transparent;
}

.board-title:focus {
  border-color: var(--line);
}

.tools {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.file-button {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: var(--radius);
  cursor: pointer;
}

.file-button:hover {
  background: var(--hover);
}

.file-button input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
