import vue from '@vitejs/plugin-vue';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [vue()],
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['src/**/*.test.ts'],
          exclude: [...configDefaults.exclude, 'src/domain/**'],
        },
      },
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/**/*.test.ts', 'src/domain/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,vue}', 'server/**/*.ts'],
      thresholds: {
        lines: 70,
        'src/domain/**': { lines: 90 },
        'src/dnd/**': { lines: 85 },
      },
    },
  },
});
