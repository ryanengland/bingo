import { defineConfig } from '@playwright/test';

export default defineConfig({
  workers: 1,
  webServer: {
    command: 'npx live-server --port=8081 --no-browser',
    url: 'http://127.0.0.1:8081',
    reuseExistingServer: true,
  },
  use: {
    baseURL: 'http://127.0.0.1:8081',
  },
});