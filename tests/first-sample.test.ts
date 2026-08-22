import {expect, test} from '@playwright/test';

test('has title-test', async ({ page }) => {
await page.goto('https://playwright.dev');
await expect(page).toHaveTitle('Fast and reliable end-to-end testing for modern web apps | Playwright');
})


