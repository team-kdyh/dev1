import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { defineConfig } from 'vite';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const editorRoot = path.join(workspaceRoot, 'tools', 'balance-editor');

export default defineConfig({
  root: editorRoot,
  base: './',
  server: {
    open: '/',
    fs: { allow: [workspaceRoot] }
  },
  build: {
    outDir: path.join(workspaceRoot, 'dist', 'balance-editor'),
    emptyOutDir: true
  }
});
