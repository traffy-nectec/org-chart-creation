import { chromium } from 'playwright';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const errors = [];
  page.on('console', msg => { if(msg.type() === 'error') errors.push(msg.text()) });
  page.on('pageerror', err => errors.push(err.message));
  await page.goto('http://localhost:5173/org-chart-creation/');
  await page.waitForTimeout(3000);
  console.log("ERRORS:", errors);
  const root = await page.evaluate(() => document.querySelector('#root')?.innerHTML.substring(0, 500));
  console.log("ROOT:", root);
  const overlay = await page.evaluate(() => document.querySelector('vite-error-overlay')?.shadowRoot?.innerHTML.substring(0, 500));
  console.log("OVERLAY:", overlay);
  await browser.close();
})();
