/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base './' zodat de gebouwde app vanuit elke map (bv. GitHub Pages) werkt.
export default defineConfig({
  base: './',
  plugins: [react()],
  // De gebouwde app komt in huizenjacht/app/ en wordt meegecommit, zodat GitHub Pages
  // hem serveert op https://nickyjansen96-tech.github.io/Wrapped/huizenjacht/app/
  build: { outDir: 'app', emptyOutDir: true },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
