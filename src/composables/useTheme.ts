import { ref, watch } from 'vue';

export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'theme';

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';

export const useTheme = () => {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = ref<Theme>(isTheme(stored) ? stored : prefersDark ? 'dark' : 'light');

  watch(
    theme,
    (value) => {
      document.documentElement.dataset.theme = value;
      window.localStorage.setItem(THEME_STORAGE_KEY, value);
    },
    { immediate: true },
  );

  const toggleTheme = (): void => {
    theme.value = theme.value === 'dark' ? 'light' : 'dark';
  };

  return { theme, toggleTheme };
};
