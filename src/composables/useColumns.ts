import { ref, watch } from 'vue';

export const COLUMNS_STORAGE_KEY = 'kanfoss-columns';
export const COLUMN_OPTIONS = ['auto', '1', '2', '3', '4', '5', '6'] as const;
export type Columns = (typeof COLUMN_OPTIONS)[number];

export const isColumns = (value: string | null): value is Columns =>
  value !== null && (COLUMN_OPTIONS as readonly string[]).includes(value);

const readStored = (): Columns => {
  const stored = window.localStorage.getItem(COLUMNS_STORAGE_KEY);
  return isColumns(stored) ? stored : 'auto';
};

const columns = ref<Columns>(readStored());

watch(columns, (value) => {
  window.localStorage.setItem(COLUMNS_STORAGE_KEY, value);
});

export const useColumns = (): { columns: typeof columns } => ({ columns });
