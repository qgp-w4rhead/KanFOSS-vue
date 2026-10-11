<script setup lang="ts">
import { ref, useId, watch } from 'vue';

const props = defineProps<{
  open: boolean;
  title: string;
}>();

const emit = defineEmits<{
  close: [];
}>();

const dialog = ref<HTMLDialogElement | null>(null);
const titleId = useId();

watch(
  () => props.open,
  (open) => {
    const el = dialog.value;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  },
);

const onBackdropClick = (event: MouseEvent): void => {
  if (event.target === dialog.value) emit('close');
};

const onClose = (): void => {
  if (props.open) emit('close');
};
</script>

<template>
  <dialog
    ref="dialog"
    class="ui-dialog"
    :aria-labelledby="titleId"
    @click="onBackdropClick"
    @close="onClose"
    @cancel="onClose"
  >
    <div class="ui-panel">
      <h2
        :id="titleId"
        class="ui-title"
      >
        {{ title }}
      </h2>
      <slot />
    </div>
  </dialog>
</template>

<style scoped>
.ui-dialog {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text);
  max-width: min(380px, calc(100vw - 24px));
  max-height: calc(100dvh - 48px);
}

.ui-dialog::backdrop {
  background: var(--scrim);
}

.ui-panel {
  display: grid;
  gap: 14px;
  padding: 16px;
  min-width: min(320px, 80vw);
  background: var(--surface-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  box-shadow: var(--elevation-drag);
  overflow-y: auto;
}

.ui-title {
  font-size: 1rem;
  overflow-wrap: anywhere;
}
</style>

<style>
.ui-heading {
  margin: 0 0 6px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--text-muted);
}

.ui-rows {
  display: grid;
  gap: 2px;
}

.ui-row {
  display: block;
  width: 100%;
  padding: 6px 8px;
  text-align: left;
  border-radius: var(--radius);
  overflow-wrap: anywhere;
}

.ui-row.is-danger {
  color: var(--cat-red);
}

.ui-swatches {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ui-swatch {
  width: 24px;
  height: 24px;
  padding: 0;
  border: 2px solid var(--line);
  border-radius: 50%;
  background: var(--cat, transparent);
}

.ui-swatch.is-none {
  background: transparent;
  border-style: dashed;
}

.ui-swatches .ui-swatch:hover:not(:disabled) {
  background: var(--cat, transparent);
}

.ui-swatches .ui-swatch.is-none:hover:not(:disabled) {
  background: var(--hover);
}

.ui-swatch[aria-pressed='true'] {
  border-color: var(--signal-line);
  box-shadow:
    0 0 0 2px var(--surface-card),
    0 0 0 4px var(--signal-line);
}
</style>
