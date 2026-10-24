import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.js'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.js'],
      // Canvas drawing and DOM wiring are covered by the Playwright suite.
      exclude: ['src/main.js', 'src/render.js'],
      thresholds: { lines: 95, functions: 95, branches: 90, statements: 95 },
    },
  },
});
