<script setup lang="ts">
import { computed, ref } from 'vue';
import { END_OF_LIST } from '../../domain/board.ts';
import type { CardDraft } from '../../domain/cards.ts';
import { formatDateTime } from '../../domain/dates.ts';
import type { DragSource, Side } from '../../domain/drop.ts';
import type { Card, CategoryId } from '../../domain/types.ts';
import type { BoardAction } from '../../store/actions.ts';
import PickerDialog from '../ui/PickerDialog.vue';
import CardForm from './CardForm.vue';
import type { Destination } from './view-types.ts';

const props = defineProps<{
  card: Card;
  categoryId: CategoryId;
  destinations: Destination[];
  dropSide: Side | null;
  isDragSource: boolean;
}>();

const emit = defineEmits<{
  action: [action: BoardAction];
  'drag-start': [source: DragSource, event: PointerEvent];
}>();

const editing = ref(false);
const moving = ref(false);

const startText = computed(() => (props.card.start ? `Starts ${formatDateTime(props.card.start)}` : ''));
const dueText = computed(() => (props.card.due ? `Due ${formatDateTime(props.card.due)}` : ''));
const moveOptions = computed(() => props.destinations.filter((destination) => destination.id !== props.categoryId));

const save = (draft: CardDraft): void => {
  editing.value = false;
  emit('action', { type: 'update-card', cardId: props.card.id, draft });
};

const moveTo = (categoryId: CategoryId): void => {
  emit('action', { type: 'move-card', cardId: props.card.id, categoryId, index: END_OF_LIST });
};

const startDrag = (event: PointerEvent): void => {
  const target = event.target;
  if (event.button !== 0 || event.isPrimary === false || editing.value) return;
  if (!(target instanceof Element)) return;
  if (target.closest('button, a, input, textarea, select, form, dialog, [contenteditable], [role="button"]')) return;
  event.preventDefault();
  event.stopPropagation();
  emit('drag-start', { kind: 'card', cardId: props.card.id }, event);
};
</script>

<template>
  <article
    class="card"
    :class="{ 'is-source': isDragSource, 'drop-before': !isDragSource && dropSide === 'before', 'drop-after': !isDragSource && dropSide === 'after' }"
    :data-drop="`card:${card.id}`"
    @pointerdown="startDrag"
  >
    <CardForm
      v-if="editing"
      :initial="card"
      submit-label="Save"
      @submit="save"
      @cancel="editing = false"
    />
    <template v-else>
      <header class="card-head">
        <span class="number">#{{ card.number }}</span>
        <h3 class="title">
          {{ card.title }}
        </h3>
      </header>
      <p
        v-if="card.description"
        class="description"
      >
        {{ card.description }}
      </p>
      <a
        v-if="card.link"
        class="link"
        :href="card.link"
        target="_blank"
        rel="noopener noreferrer"
      >{{ card.link }}</a>
      <p
        v-if="startText || dueText"
        class="schedule"
      >
        <span v-if="startText">{{ startText }}</span>
        <span v-if="dueText">{{ dueText }}</span>
      </p>
      <div class="actions">
        <button
          type="button"
          :aria-label="`Edit card ${card.title}`"
          :title="`Edit ${card.title}`"
          @click="editing = true"
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
            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          </svg>
        </button>
        <button
          type="button"
          :aria-label="`Move card ${card.title}`"
          :title="`Move ${card.title} to another category`"
          :aria-haspopup="'dialog'"
          @click="moving = true"
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
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line
              x1="15"
              y1="12"
              x2="3"
              y2="12"
            />
          </svg>
        </button>
        <button
          type="button"
          class="is-danger"
          :aria-label="`Delete card ${card.title}`"
          :title="`Delete ${card.title}`"
          @click="emit('action', { type: 'delete-card', cardId: card.id })"
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
            <path d="M3 6h18" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line
              x1="10"
              y1="11"
              x2="10"
              y2="17"
            />
            <line
              x1="14"
              y1="11"
              x2="14"
              y2="17"
            />
          </svg>
        </button>
      </div>
    </template>
    <PickerDialog
      :open="moving"
      :title="'Move to: ' + card.title"
      :options="moveOptions"
      @pick="moveTo"
      @close="moving = false"
    />
  </article>
</template>

<style scoped>
.card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  background: var(--surface-card);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.card input,
.card textarea {
  cursor: text;
  user-select: text;
}

.card.is-source {
  opacity: 0.4;
}

.card.drop-before::before,
.card.drop-after::after {
  content: '';
  position: absolute;
  left: -4px;
  right: -4px;
  height: 8px;
  border-radius: 2px;
  background: color-mix(in oklch, var(--signal-line) 25%, transparent);
  pointer-events: none;
}

.card.drop-before::before {
  top: -8px;
}

.card.drop-after::after {
  bottom: -8px;
}

.card-head {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.number {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.title {
  flex: 1;
  min-width: 0;
  font-size: 0.95rem;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.description {
  font-size: 0.875rem;
  color: var(--text-muted);
  overflow-wrap: anywhere;
}

.link {
  font-size: 0.8rem;
  overflow-wrap: anywhere;
}

.schedule {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.actions button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--text-muted);
  border-radius: 2px;
}

.actions svg {
  width: 14px;
  height: 14px;
  display: block;
}

.actions button:hover:not(:disabled) {
  background: none;
  color: var(--text);
}

.actions .is-danger:hover:not(:disabled) {
  color: var(--cat-red);
}
</style>
