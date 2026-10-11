<script setup lang="ts">
import { ref } from 'vue';
import { COLUMN_OPTIONS, useColumns } from '../../composables/useColumns.ts';
import { LAYOUT_OPTIONS, useLayout } from '../../composables/useLayout.ts';
import type { Theme } from '../../composables/useTheme.ts';
import { useTheme } from '../../composables/useTheme.ts';
import UiDialog from '../ui/UiDialog.vue';

const open = ref(false);
const { theme } = useTheme();
const { columns } = useColumns();
const { layout } = useLayout();

const layoutLabel = (option: string): string => (option === 'masonry' ? 'Masonry' : 'List');
const columnLabel = (option: string): string =>
  option === 'auto' ? 'Auto columns' : `${option} column${option === '1' ? '' : 's'}`;
const setTheme = (value: Theme): void => {
  theme.value = value;
};
</script>

<template>
  <button
    type="button"
    class="settings-button"
    aria-label="Settings"
    title="Settings"
    :aria-haspopup="'dialog'"
    @click="open = true"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path
        d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
      />
      <circle
        cx="12"
        cy="12"
        r="3"
      />
    </svg>
  </button>
  <UiDialog
    :open="open"
    title="Settings"
    @close="open = false"
  >
    <section>
      <h3 class="ui-heading">
        Layout
      </h3>
      <div
        class="option-row"
        role="group"
        aria-label="Board layout"
      >
        <button
          v-for="option in LAYOUT_OPTIONS"
          :key="option"
          type="button"
          :aria-pressed="layout === option"
          @click="layout = option"
        >
          {{ layoutLabel(option) }}
        </button>
      </div>
    </section>
    <section>
      <h3 class="ui-heading">
        Columns
      </h3>
      <div
        v-if="layout === 'masonry'"
        class="option-row columns-control"
        role="group"
        aria-label="Masonry column count"
      >
        <button
          v-for="option in COLUMN_OPTIONS"
          :key="option"
          type="button"
          :aria-pressed="columns === option"
          :aria-label="columnLabel(option)"
          @click="columns = option"
        >
          {{ option === 'auto' ? 'Auto' : option }}
        </button>
      </div>
      <p
        v-else
        class="columns-note"
      >
        1 column
      </p>
    </section>
    <section>
      <h3 class="ui-heading">
        Theme
      </h3>
      <div
        class="option-row"
        role="group"
        aria-label="Theme"
      >
        <button
          type="button"
          :aria-pressed="theme === 'light'"
          @click="setTheme('light')"
        >
          Light
        </button>
        <button
          type="button"
          :aria-pressed="theme === 'dark'"
          @click="setTheme('dark')"
        >
          Dark
        </button>
      </div>
    </section>
  </UiDialog>
</template>

<style scoped>
.settings-button {
  display: grid;
  place-items: center;
  width: 28px;
  height: 28px;
  padding: 0;
  color: var(--text-muted);
  border-radius: var(--radius);
}

.settings-button svg {
  width: 16px;
  height: 16px;
  display: block;
}

.settings-button:hover:not(:disabled) {
  color: var(--text);
}

.option-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
  font-size: 0.9rem;
}

.option-row button[aria-pressed='true'] {
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.columns-note {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-muted);
}
</style>
