import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('https://playwright.dev/');
  await page.getByRole('link', { name: 'Get started' }).click();
  await page.getByRole('link', { name: 'How to install Playwright' }).click();
  await page.getByText('init playwright@latest').click({
    button: 'right'
  });
  await page.locator('pre').filter({ hasText: 'npm init playwright@latest' }).click();
  await page.getByText('Run the install command and').click({
    button: 'right'
  });
  await page.getByText('Run the install command and').click();
  await page.getByText('Run the install command and').click();
});