import { defineConfig } from 'vite'

export default defineConfig({
  // Relative paths so GitHub Pages project sites work without a custom domain
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
})
