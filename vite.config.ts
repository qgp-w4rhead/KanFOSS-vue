import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const API_PORT = 8787;

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/api': `http://localhost:${API_PORT}`,
    },
  },
});
