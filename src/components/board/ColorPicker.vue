<script setup lang="ts">
import { COLOR_KEYS } from '../../domain/board.ts';
import type { Category, ColorKey } from '../../domain/types.ts';
import type { BoardAction } from '../../store/actions.ts';
import UiDialog from '../ui/UiDialog.vue';

const props = defineProps<{
  open: boolean;
  category: Category;
}>();

const emit = defineEmits<{
  action: [action: BoardAction];
  close: [];
}>();

const label = (key: ColorKey): string => key.charAt(0).toUpperCase() + key.slice(1);

const pick = (color: ColorKey | null): void => {
  emit('action', { type: 'set-color', categoryId: props.category.id, color });
  emit('close');
};
</script>

<template>
  <UiDialog
    :open="open"
    :title="'Color: ' + category.title"
    @close="emit('close')"
  >
    <div class="swatch-grid">
      <button
        v-for="key in COLOR_KEYS"
        :key="key"
        type="button"
        class="ui-swatch"
        :data-color="key"
        :aria-pressed="category.color === key"
        :aria-label="label(key)"
        @click="pick(key)"
      />
    </div>
    <div class="ui-rows">
      <button
        type="button"
        class="ui-row"
        @click="pick(null)"
      >
        No color
      </button>
    </div>
  </UiDialog>
</template>

<style scoped>
.swatch-grid {
  display: grid;
  grid-template-columns: repeat(8, 26px);
  gap: 10px;
}

.swatch-grid .ui-swatch[data-color]:hover:not(:disabled),
.swatch-grid .ui-swatch[data-color]:focus-visible {
  background: color-mix(in oklch, var(--cat) 90%, white 10%);
}
</style>
