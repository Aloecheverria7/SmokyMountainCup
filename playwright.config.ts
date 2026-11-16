import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  testMatch: '*.e2e.ts',
  use: {
    baseURL: process.env.SMC_HOSTED_URL || 'http://127.0.0.1:5173',
    launchOptions: {
      executablePath:
        process.env.CHROME_PATH ||
        (process.platform === 'darwin'
          ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
          : undefined),
    },
  },
  webServer: process.env.SMC_HOSTED_URL
    ? undefined
    : {
        command: 'npm run dev -w @smoky/web',
        url: 'http://127.0.0.1:5173',
        reuseExistingServer: false,
      },
  reporter: 'list',
});
