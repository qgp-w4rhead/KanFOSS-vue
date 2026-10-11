<script setup lang="ts">
import type { CategoryId } from '../../domain/types.ts';
import type { Destination } from '../board/view-types.ts';
import UiDialog from './UiDialog.vue';

defineProps<{
  open: boolean;
  title: string;
  options: Destination[];
}>();

const emit = defineEmits<{
  pick: [id: CategoryId];
  close: [];
}>();

const pick = (id: CategoryId): void => {
  emit('pick', id);
  emit('close');
};
</script>

<template>
  <UiDialog
    :open="open"
    :title="title"
    @close="emit('close')"
  >
    <div class="ui-rows">
      <button
        v-for="option in options"
        :key="option.id"
        type="button"
        class="ui-row"
        @click="pick(option.id)"
      >
        {{ option.title }}
      </button>
    </div>
  </UiDialog>
</template>
