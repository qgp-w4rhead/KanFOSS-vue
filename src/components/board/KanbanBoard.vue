<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useColumns } from '../../composables/useColumns.ts';
import { useLayout } from '../../composables/useLayout.ts';
import { canAddCategory } from '../../domain/board.ts';
import { columnOf } from '../../domain/columns.ts';
import { resolveDrop, type DragSource } from '../../domain/drop.ts';
import type { Category } from '../../domain/types.ts';
import { useDragController } from '../../dnd/drag-controller.ts';
import type { BoardAction } from '../../store/actions.ts';
import { appStore } from '../../store/app-store.ts';
import CategoryLane from './CategoryLane.vue';
import type { Destination, DropRejection } from './view-types.ts';

const LANE_WIDTH = 300;
const GAP = 16;

const board = appStore.board;
const { columns } = useColumns();
const { layout } = useLayout();
const renameId = ref<string | null>(null);
const lanesEl = ref<HTMLElement | null>(null);
const containerWidth = ref(0);

const topLevel = computed(() => board.value.categories.filter((category) => category.parentId === null));
const destinations = computed<Destination[]>(() => board.value.categories.map(({ id, title }) => ({ id, title })));
const topLevelDestinations = computed<Destination[]>(() => topLevel.value.map(({ id, title }) => ({ id, title })));

const subcategoriesOf = (parentId: string): Category[] =>
  board.value.categories.filter((category) => category.parentId === parentId);

const autoCount = computed(() => Math.max(1, Math.floor((containerWidth.value + GAP) / (LANE_WIDTH + GAP))));
const columnCount = computed(() => (columns.value === 'auto' ? autoCount.value : Number(columns.value)));
const stacks = computed(() =>
  Array.from({ length: columnCount.value }, (_, s) =>
    topLevel.value.filter((category, i) => columnOf(category, i, columnCount.value) === s),
  ),
);
const canCreate = computed(() => canAddCategory(board.value));

const withColumns = (action: BoardAction): BoardAction => {
  if (layout.value !== 'masonry') return action;
  if (action.type === 'drop' || action.type === 'step-category') return { ...action, columnCount: columnCount.value };
  return action;
};

const dispatch = (action: BoardAction): void => {
  const before = new Set(board.value.categories.map((category) => category.id));
  appStore.dispatch(withColumns(action));
  const added = board.value.categories.find((category) => !before.has(category.id));
  if (added) renameId.value = added.id;
};

const drag = useDragController((source, target) => dispatch({ type: 'drop', source, target }));

const dropRejection = computed<DropRejection | null>(() => {
  const source = drag.state.source;
  const target = drag.state.target;
  if (!drag.state.dragging || source?.kind !== 'category' || target?.kind !== 'category') return null;
  const intent = resolveDrop(source, target, board.value, layout.value === 'masonry' ? columnCount.value : undefined);
  return intent.kind === 'rejected' ? { categoryId: target.categoryId, reason: intent.reason } : null;
});

const addCategoryIn = (index: number): void => {
  dispatch({ type: 'add-category', placement: { index, count: columnCount.value } });
};

const acceptsFooterDrop = (): boolean => canCreate.value || drag.state.source?.kind === 'category';

const isColumnTargeted = (index: number): boolean => {
  const target = drag.state.target;
  return (
    target?.kind === 'add-category' &&
    target.placement !== undefined &&
    target.placement.index === index &&
    target.placement.count === columnCount.value &&
    acceptsFooterDrop()
  );
};

const isListTargeted = (): boolean => drag.state.target?.kind === 'add-category' && acceptsFooterDrop();

const consumeRename = (categoryId: string): void => {
  if (renameId.value === categoryId) renameId.value = null;
};

const lanesStyle = computed(() => ({
  gridTemplateColumns: layout.value === 'masonry' ? `repeat(${columnCount.value}, minmax(0, 1fr))` : 'minmax(0, 1fr)',
}));

onMounted(() => {
  const el = lanesEl.value;
  if (!el || typeof ResizeObserver === 'undefined') return;
  containerWidth.value = el.clientWidth;
  const observer = new ResizeObserver((entries) => {
    containerWidth.value = entries[0]?.contentRect.width ?? el.clientWidth;
  });
  observer.observe(el);
  onBeforeUnmount(() => observer.disconnect());
});

const previewLabel = computed(() => {
  const source: DragSource | null = drag.state.source;
  if (!source) return '';
  if (source.kind === 'category') {
    return board.value.categories.find((category) => category.id === source.categoryId)?.title ?? '';
  }
  const cards = board.value.categories.flatMap((category) => category.cards);
  return cards.find((card) => card.id === source.cardId)?.title ?? '';
});
</script>

<template>
  <main
    class="board"
    aria-label="Board"
  >
    <div
      ref="lanesEl"
      class="lanes"
      :class="[`mode-${layout}`, { 'is-column-target': layout === 'list' && isListTargeted() }]"
      :style="lanesStyle"
      data-drop="lanes"
    >
      <template v-if="layout === 'masonry'">
        <div
          v-for="(stack, s) in stacks"
          :key="s"
          class="stack"
          :class="{ 'is-column-target': isColumnTargeted(s) }"
          :data-column="s"
          data-drop="lanes"
        >
          <CategoryLane
            v-for="category in stack"
            :key="category.id"
            :category="category"
            :subcategories="subcategoriesOf(category.id)"
            :destinations="destinations"
            :top-level="topLevelDestinations"
            :drop-target="drag.state.target"
            :drag-source="drag.state.source"
            :rename-id="renameId"
            :drop-rejection="dropRejection"
            @action="dispatch"
            @drag-start="drag.start"
            @rename-started="consumeRename"
          />
          <button
            type="button"
            class="add-category"
            :data-drop="`add-category:${s}:${columnCount}`"
            :aria-label="`Add category to column ${s + 1}`"
            :class="{ 'is-target': isColumnTargeted(s) }"
            :disabled="!canCreate"
            @click="addCategoryIn(s)"
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
              <path d="M5 12h14" />
              <path d="M12 5v14" />
            </svg>
          </button>
        </div>
      </template>
      <template v-else>
        <CategoryLane
          v-for="category in topLevel"
          :key="category.id"
          :category="category"
          :subcategories="subcategoriesOf(category.id)"
          :destinations="destinations"
          :top-level="topLevelDestinations"
          :drop-target="drag.state.target"
          :drag-source="drag.state.source"
          :rename-id="renameId"
          :drop-rejection="dropRejection"
          @action="dispatch"
          @drag-start="drag.start"
          @rename-started="consumeRename"
        />
        <button
          type="button"
          class="add-category"
          data-drop="add-category"
          aria-label="Add category"
          :class="{ 'is-target': isListTargeted() }"
          :disabled="!canCreate"
          @click="dispatch({ type: 'add-category' })"
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
            <path d="M5 12h14" />
            <path d="M12 5v14" />
          </svg>
        </button>
      </template>
    </div>
    <div
      v-if="drag.state.dragging"
      class="drag-preview"
      :style="{ left: `${drag.state.pointer.x}px`, top: `${drag.state.pointer.y}px` }"
    >
      {{ previewLabel }}
    </div>
  </main>
</template>

<style scoped>
.board {
  flex: 1;
  padding: 24px;
  min-width: 0;
}

.lanes.mode-masonry {
  display: grid;
  align-items: stretch;
  gap: 16px;
}

.lanes.mode-list {
  display: grid;
  align-items: start;
  position: relative;
}

.stack {
  min-width: 0;
  position: relative;
}

.stack.is-column-target::before,
.stack.is-column-target::after,
.lanes.mode-list.is-column-target::before,
.lanes.mode-list.is-column-target::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  border-radius: 2px;
  background: var(--signal-line);
  pointer-events: none;
}

.stack.is-column-target::before,
.lanes.mode-list.is-column-target::before {
  left: -9px;
}

.stack.is-column-target::after,
.lanes.mode-list.is-column-target::after {
  right: -9px;
}

.add-category {
  display: grid;
  place-items: center;
  width: 100%;
  min-height: 72px;
  margin-bottom: 16px;
  break-inside: avoid;
  border: 2px dashed var(--line);
  border-radius: var(--radius);
  color: var(--text-muted);
  font-weight: 600;
}

.add-category svg {
  width: 20px;
  height: 20px;
  display: block;
}

.add-category:hover:not(:disabled) {
  background: var(--hover);
  border-color: var(--text-muted);
  color: var(--text);
}

.add-category.is-target {
  border-color: var(--signal-line);
  color: var(--text);
}

.drag-preview {
  position: fixed;
  z-index: 20;
  max-width: 260px;
  padding: 6px 10px;
  transform: translate(12px, 12px);
  pointer-events: none;
  background: var(--surface-card);
  color: var(--text);
  border-radius: var(--radius);
  box-shadow: var(--elevation-drag);
  font-weight: 600;
}
</style>
