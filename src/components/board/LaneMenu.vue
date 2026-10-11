<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Category } from '../../domain/types.ts';
import type { BoardAction } from '../../store/actions.ts';
import UiDialog from '../ui/UiDialog.vue';
import type { Destination } from './view-types.ts';

const props = defineProps<{
  category: Category;
  cardCount: number;
  nestTargets: Destination[];
}>();

const emit = defineEmits<{
  action: [action: BoardAction];
}>();

const open = ref(false);
const confirming = ref(false);
const isSub = computed(() => props.category.parentId !== null);

const close = (): void => {
  open.value = false;
  confirming.value = false;
};

const act = (action: BoardAction): void => {
  close();
  emit('action', action);
};

const remove = (): void => {
  act({ type: 'delete-category', categoryId: props.category.id });
};

const requestDelete = (): void => {
  confirming.value = true;
  open.value = true;
};

const deleteClicked = (event: MouseEvent): void => {
  if (event.shiftKey) {
    remove();
    return;
  }
  requestDelete();
};

const cardWord = computed(() => (props.cardCount === 1 ? 'card' : 'cards'));
</script>

<template>
  <button
    type="button"
    class="menu-button"
    :aria-label="`Move or manage ${category.title}`"
    :aria-haspopup="'dialog'"
    @click="open = true"
  >
    <span aria-hidden="true">→</span>
  </button>
  <button
    type="button"
    class="delete-button"
    aria-haspopup="dialog"
    :aria-label="`Delete category ${category.title}`"
    :title="`Delete category ${category.title} — Shift+click skips confirmation`"
    @click="deleteClicked"
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
    </svg>
  </button>
  <UiDialog
    :open="open"
    :title="confirming ? `Delete ${category.title}` : category.title"
    @close="close"
  >
    <template v-if="!confirming">
      <div v-if="!isSub && nestTargets.length > 0">
        <h3 class="ui-heading">
          Move into
        </h3>
        <div class="ui-rows">
          <button
            v-for="target in nestTargets"
            :key="target.id"
            type="button"
            class="ui-row"
            @click="act({ type: 'nest-category', categoryId: category.id, parentId: target.id })"
          >
            {{ target.title }}
          </button>
        </div>
      </div>
      <div class="ui-rows">
        <button
          type="button"
          class="ui-row"
          @click="act({ type: 'step-category', categoryId: category.id, delta: -1 })"
        >
          Move up
        </button>
        <button
          type="button"
          class="ui-row"
          @click="act({ type: 'step-category', categoryId: category.id, delta: 1 })"
        >
          Move down
        </button>
        <button
          v-if="isSub"
          type="button"
          class="ui-row"
          @click="act({ type: 'promote-category', categoryId: category.id })"
        >
          Top level
        </button>
        <button
          v-else
          type="button"
          class="ui-row"
          @click="act({ type: 'add-subcategory', parentId: category.id })"
        >
          Add subcategory
        </button>
        <button
          type="button"
          class="ui-row is-danger"
          @click="requestDelete"
        >
          Delete…
        </button>
      </div>
    </template>
    <template v-else>
      <p class="confirm-text">
        Delete "{{ category.title }}"<template v-if="cardCount > 0">
          and its {{ cardCount }} {{ cardWord }}
        </template>?
        <template v-if="!isSub">
          Its subcategories are deleted too.
        </template>
        You can undo this afterwards.
      </p>
      <div class="ui-rows">
        <button
          type="button"
          class="ui-row is-danger"
          @click="remove"
        >
          Delete
        </button>
        <button
          type="button"
          class="ui-row"
          @click="close"
        >
          Cancel
        </button>
      </div>
    </template>
  </UiDialog>
</template>

<style scoped>
.menu-button {
  padding: 0 6px;
  color: var(--text-muted);
  font-size: 1.1rem;
  font-weight: 600;
  line-height: 1;
}

.delete-button {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  padding: 0;
  color: var(--text-muted);
  border-radius: 2px;
}

.delete-button svg {
  width: 14px;
  height: 14px;
  display: block;
}

.delete-button:hover:not(:disabled) {
  background: none;
  color: var(--cat-red);
}

.confirm-text {
  font-size: 0.9rem;
}
</style>
