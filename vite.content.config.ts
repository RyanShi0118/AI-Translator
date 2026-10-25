import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

// Build 2: the content script, bundled into a single self-contained IIFE.
// Tailwind CSS is imported with `?inline` and injected into a Shadow DOM.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(mode === 'development' ? 'development' : 'production'),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    target: 'es2020',
    lib: {
      entry: resolve(root, 'src/content/index.tsx'),
      name: 'LucidContent',
      formats: ['iife'],
      fileName: () => 'content.js',
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
}));
