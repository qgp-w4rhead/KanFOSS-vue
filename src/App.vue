<script setup lang="ts">
import BoardHeader from './components/header/BoardHeader.vue';
import KanbanBoard from './components/board/KanbanBoard.vue';
import { appStore } from './store/app-store.ts';

const message = appStore.message;
</script>

<template>
  <div class="app">
    <BoardHeader />
    <KanbanBoard />
    <p
      class="status"
      role="status"
      aria-live="polite"
    >
      {{ message }}
    </p>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
}

.status {
  min-height: 1.5em;
  padding: 0 24px 12px;
  font-size: 0.875rem;
  color: var(--text-muted);
}
</style>
