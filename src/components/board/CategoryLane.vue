<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue';
import type { CardDraft } from '../../domain/cards.ts';
import type { DragSource, DropTarget, Side, Zone } from '../../domain/drop.ts';
import type { Category } from '../../domain/types.ts';
import type { BoardAction } from '../../store/actions.ts';
import CardItem from './CardItem.vue';
import CardForm from './CardForm.vue';
import ColorPicker from './ColorPicker.vue';
import LaneMenu from './LaneMenu.vue';
import type { Destination, DropRejection } from './view-types.ts';

const props = defineProps<{
  category: Category;
  subcategories: Category[];
  destinations: Destination[];
  topLevel: Destination[];
  dropTarget: DropTarget | null;
  dragSource: DragSource | null;
  renameId: string | null;
  dropRejection?: DropRejection | null;
}>();

const emit = defineEmits<{
  action: [action: BoardAction];
  'drag-start': [source: DragSource, event: PointerEvent];
  'rename-started': [categoryId: string];
}>();

const isSub = computed(() => props.category.parentId !== null);
const cardCount = computed(
  () => props.category.cards.length + props.subcategories.reduce((total, sub) => total + sub.cards.length, 0),
);
const nestTargets = computed(() => props.topLevel.filter((parent) => parent.id !== props.category.id));

const isRejected = computed(
  () =>
    props.dropRejection?.categoryId === props.category.id &&
    props.dropTarget?.kind === 'category' &&
    props.dropTarget.categoryId === props.category.id &&
    props.dragSource?.kind === 'category' &&
    props.dragSource.categoryId !== props.category.id,
);

const rejectionReason = computed(() => props.dropRejection?.reason ?? '');

const panelZone = computed((): Zone | null => {
  const target = props.dropTarget;
  const fromOther = props.dragSource?.kind === 'category' && props.dragSource.categoryId !== props.category.id;
  return fromOther && !isRejected.value && target?.kind === 'category' && target.categoryId === props.category.id
    ? target.zone
    : null;
});

const isPanelSource = computed(
  () => props.dragSource?.kind === 'category' && props.dragSource.categoryId === props.category.id,
);

const laneTargeted = computed(() => {
  const target = props.dropTarget;
  if (isRejected.value) return false;
  if (!target || target.kind === 'card' || target.kind === 'add-category' || target.categoryId !== props.category.id) {
    return false;
  }
  if (target.kind === 'lane') return target.zone === undefined || target.zone === 'center';
  return target.zone === 'center' && props.dragSource?.kind === 'card';
});

const cardAppendSeam = computed(
  () => laneTargeted.value && props.dragSource?.kind === 'card' && props.category.cards.length > 0,
);

const lastCardId = computed(() => {
  const cards = props.category.cards;
  return cards.length > 0 ? cards[cards.length - 1].id : null;
});

const dropSideFor = (cardId: string): Side | null => {
  const target = props.dropTarget;
  if (target?.kind === 'card' && target.cardId === cardId) return target.side;
  if (cardAppendSeam.value && cardId === lastCardId.value) return 'after';
  return null;
};

const isDragSource = (cardId: string): boolean =>
  props.dragSource?.kind === 'card' && props.dragSource.cardId === cardId;

const editing = ref(false);
const draftTitle = ref('');
const adding = ref(false);
const pickingColor = ref(false);
const titleInput = ref<HTMLInputElement | null>(null);

const startRename = (): void => {
  draftTitle.value = props.category.title;
  editing.value = true;
  nextTick(() => {
    titleInput.value?.focus();
    if (props.renameId === props.category.id) emit('rename-started', props.category.id);
  });
};

const finishRename = (): void => {
  if (!editing.value) return;
  editing.value = false;
  emit('action', { type: 'rename-category', categoryId: props.category.id, title: draftTitle.value });
};

watch(
  () => props.renameId === props.category.id,
  (isTarget) => {
    if (isTarget) startRename();
  },
  { immediate: true },
);

const addCard = (draft: CardDraft): void => {
  adding.value = false;
  emit('action', { type: 'add-card', categoryId: props.category.id, draft });
};

const PANEL_CONTROLS = 'button, a, input, textarea, select, form, dialog, [contenteditable], [role="button"], .card';

const startPanelDrag = (event: PointerEvent): void => {
  if (event.button !== 0 || event.isPrimary === false) return;
  const target = event.target;
  if (!(target instanceof Element) || target.closest('.lane') !== event.currentTarget) return;
  if (target.closest(PANEL_CONTROLS)) return;
  if (editing.value) finishRename();
  event.preventDefault();
  event.stopPropagation();
  emit('drag-start', { kind: 'category', categoryId: props.category.id }, event);
};
</script>

<template>
  <section
    class="lane"
    :class="{
      'is-sub': isSub,
      'is-source': isPanelSource,
      'is-drop-rejected': isRejected,
      'drop-before': panelZone === 'before',
      'drop-after': panelZone === 'after',
      'drop-center': panelZone === 'center',
    }"
    :data-color="category.color"
    :aria-label="category.title"
    :data-drop="`category:${category.id}`"
    @pointerdown="startPanelDrag"
  >
    <span
      v-if="isRejected"
      class="drop-rejection"
      role="img"
      :aria-label="`Cannot drop here: ${rejectionReason}`"
    >
      <svg
        class="drop-rejection-x"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        stroke="currentColor"
        stroke-width="1.5"
        stroke-linecap="round"
        aria-hidden="true"
      >
        <path
          d="M0 0 L100 100 M100 0 L0 100"
          vector-effect="non-scaling-stroke"
        />
      </svg>
      <span class="drop-rejection-label">{{ rejectionReason }}</span>
    </span>
    <header class="lane-head">
      <div class="lane-row">
        <button
          type="button"
          class="grip"
          aria-label="Drag category"
          @pointerdown="emit('drag-start', { kind: 'category', categoryId: category.id }, $event)"
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <button
          type="button"
          class="color-dot"
          :class="{ 'is-none': category.color === null }"
          :data-color="category.color"
          :aria-label="`${category.title} color`"
          aria-haspopup="dialog"
          @click="pickingColor = true"
        />
        <h2 class="lane-title">
          <input
            v-if="editing"
            ref="titleInput"
            v-model="draftTitle"
            class="title-input"
            aria-label="Category title"
            maxlength="200"
            @keydown.enter.prevent="finishRename"
            @keydown.esc="editing = false"
            @blur="finishRename"
          >
          <button
            v-else
            type="button"
            class="title-button"
            @click="startRename"
          >
            {{ category.title }}
          </button>
        </h2>
        <span
          class="count"
          :aria-label="`${category.cards.length} cards`"
        >{{ category.cards.length }}</span>
        <LaneMenu
          :category="category"
          :card-count="cardCount"
          :nest-targets="nestTargets"
          @action="emit('action', $event)"
        />
      </div>
    </header>
    <div
      class="lane-body"
      :class="{ 'is-target': laneTargeted && !cardAppendSeam }"
      :data-drop="`lane:${category.id}`"
    >
      <CardItem
        v-for="card in category.cards"
        :key="card.id"
        :card="card"
        :category-id="category.id"
        :destinations="destinations"
        :drop-side="dropSideFor(card.id)"
        :is-drag-source="isDragSource(card.id)"
        @action="emit('action', $event)"
        @drag-start="(source, event) => emit('drag-start', source, event)"
      />
      <p
        v-if="category.cards.length === 0 && !adding"
        class="empty"
      >
        No cards yet. Drop a card here or add one.
      </p>
      <CardForm
        v-if="adding"
        submit-label="Add card"
        @submit="addCard"
        @cancel="adding = false"
      />
      <button
        v-else
        type="button"
        class="add-card"
        :aria-label="`Add card to ${category.title}`"
        :title="`Add card to ${category.title}`"
        @click="adding = true"
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
    <CategoryLane
      v-for="sub in subcategories"
      :key="sub.id"
      :category="sub"
      :subcategories="[]"
      :destinations="destinations"
      :top-level="topLevel"
      :drop-target="dropTarget"
      :drag-source="dragSource"
      :rename-id="renameId"
      :drop-rejection="dropRejection"
      @action="emit('action', $event)"
      @drag-start="(source, event) => emit('drag-start', source, event)"
      @rename-started="(categoryId) => emit('rename-started', categoryId)"
    />
    <ColorPicker
      :open="pickingColor"
      :category="category"
      @action="emit('action', $event)"
      @close="pickingColor = false"
    />
  </section>
</template>

<style scoped src="./CategoryLane.css"></style>
