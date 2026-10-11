import { ref, watch } from 'vue';

export const LAYOUT_STORAGE_KEY = 'kanfoss-layout';
export const LAYOUT_OPTIONS = ['masonry', 'list'] as const;
export type Layout = (typeof LAYOUT_OPTIONS)[number];

export const isLayout = (value: string | null): value is Layout =>
  value !== null && (LAYOUT_OPTIONS as readonly string[]).includes(value);

const readStored = (): Layout => {
  const stored = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
  return isLayout(stored) ? stored : 'masonry';
};

const layout = ref<Layout>(readStored());

watch(layout, (value) => {
  window.localStorage.setItem(LAYOUT_STORAGE_KEY, value);
});

export const useLayout = (): { layout: typeof layout } => ({ layout });
