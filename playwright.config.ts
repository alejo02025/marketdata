import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
 testDir:'./tests',
 timeout:30000,
 retries:1,
 use:{baseURL:'http://127.0.0.1:4173/marketdata/',trace:'retain-on-failure',screenshot:'only-on-failure',...devices['Desktop Chrome']},
 webServer:{command:'npm run preview -- --host 127.0.0.1 --port 4173',url:'http://127.0.0.1:4173/marketdata/',reuseExistingServer:!process.env.CI,timeout:90000},
 reporter:'list'
});
