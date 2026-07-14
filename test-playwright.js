import { chromium } from '@playwright/test';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER ERROR:', error.message));
  await page.goto('http://localhost:5173/org-chart-creation/');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/tmp/screenshot.png' });
  await browser.close();
})();
