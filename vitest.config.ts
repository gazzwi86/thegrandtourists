import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'url'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json']
    },
    alias: {
      'astro:content': fileURLToPath(new URL('./tests/__mocks__/astro-content.ts', import.meta.url)),
    }
  }
})
