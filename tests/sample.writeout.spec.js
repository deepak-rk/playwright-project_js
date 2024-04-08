const { test, expect } = require('@playwright/test');

const { firefox } = require('playwright');
const { sleep } = require('../util/utilites');
test('recordep', async ({ page }) => {

  const browser = await firefox.launch({
    headless: false});
  const context = await browser.newContext();
  await page.goto('https://playwright.dev/');
  sleep(2); 
  await page.getByRole('link', { name: 'Get started' }).click(),

  await expect(page).toHaveTitle(/Playwright/),
  await context.close();
  await browser.close();
});

// @ts-check
