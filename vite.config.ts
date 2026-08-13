import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { leaderboardApiPlugin } from './vite-plugin-leaderboard-api'

export default defineConfig({
  plugins: [react(), leaderboardApiPlugin()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
