import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execSync } from 'child_process';

const gitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim(); }
  catch { return 'unknown'; }
})();

export default defineConfig({
  plugins: [react()],
  base: '/u7s-waterfall-fixtures/',
  define: {
    __GIT_HASH__: JSON.stringify(gitHash),
  },
  build: {
    outDir: 'dist',
  },
});
