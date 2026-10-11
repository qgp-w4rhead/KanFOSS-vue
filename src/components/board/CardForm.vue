<script setup lang="ts">
import { ref } from 'vue';
import { validateCardDraft, type CardDraft } from '../../domain/cards.ts';
import { toDateTime } from '../../domain/dates.ts';
import type { Card } from '../../domain/types.ts';

const props = defineProps<{
  initial?: Card;
  submitLabel: string;
}>();

const emit = defineEmits<{
  submit: [draft: CardDraft];
  cancel: [];
}>();

const title = ref(props.initial?.title ?? '');
const description = ref(props.initial?.description ?? '');
const link = ref(props.initial?.link ?? '');
const startDate = ref(props.initial?.start?.date ?? '');
const startTime = ref(props.initial?.start?.time ?? '');
const dueDate = ref(props.initial?.due?.date ?? '');
const dueTime = ref(props.initial?.due?.time ?? '');
const error = ref('');

const submit = (): void => {
  const draft: CardDraft = {
    title: title.value,
    description: description.value,
    link: link.value,
    start: toDateTime(startDate.value, startTime.value),
    due: toDateTime(dueDate.value, dueTime.value),
  };
  error.value = validateCardDraft(draft) ?? '';
  if (!error.value) emit('submit', draft);
};
</script>

<template>
  <form
    class="card-form"
    novalidate
    @submit.prevent="submit"
    @keydown.esc="emit('cancel')"
  >
    <label>
      Title
      <input
        v-model="title"
        type="text"
        maxlength="200"
        autocomplete="off"
      >
    </label>
    <label>
      Description
      <textarea
        v-model="description"
        rows="2"
        maxlength="5000"
      />
    </label>
    <label>
      Link
      <input
        v-model="link"
        type="url"
        placeholder="https://"
      >
    </label>
    <div class="dates">
      <span>Start</span>
      <input
        v-model="startDate"
        type="date"
        aria-label="Start date"
      >
      <input
        v-model="startTime"
        type="time"
        aria-label="Start time"
      >
      <span>Due</span>
      <input
        v-model="dueDate"
        type="date"
        aria-label="Due date"
      >
      <input
        v-model="dueTime"
        type="time"
        aria-label="Due time"
      >
    </div>
    <p
      v-if="error"
      class="error"
      role="alert"
    >
      {{ error }}
    </p>
    <div class="buttons">
      <button
        type="submit"
        class="primary"
      >
        {{ submitLabel }}
      </button>
      <button
        type="button"
        @click="emit('cancel')"
      >
        Cancel
      </button>
    </div>
  </form>
</template>

<style scoped>
.card-form {
  display: grid;
  gap: 8px;
}

.card-form label {
  display: grid;
  gap: 4px;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.card-form input,
.card-form textarea {
  width: 100%;
  color: var(--text);
}

.dates {
  display: grid;
  grid-template-columns: auto 1fr 1fr;
  gap: 6px;
  align-items: center;
  font-size: 0.8rem;
  color: var(--text-muted);
}

.error {
  color: var(--cat-red);
  font-size: 0.85rem;
}

.buttons {
  display: flex;
  gap: 6px;
}

.primary {
  background: var(--text);
  color: var(--surface-app);
}

.primary:hover:not(:disabled) {
  background: color-mix(in oklch, var(--text) 85%, var(--surface-app));
}
</style>
