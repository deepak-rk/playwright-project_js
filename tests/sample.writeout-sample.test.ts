import test from "playwright/test";

const { firefox } = require('playwright');

test('sample', async ({page}) => {
  const browser = await firefox.launch({
    headless: false
  });
  const context = await browser.newContext();
  await page.goto('https://playwright.dev/');
  await page.getByRole('link', { name: 'Get started' }).click();

  // ---------------------
  await context.close();
  await browser.close();
});