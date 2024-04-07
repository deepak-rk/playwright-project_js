import {test, expect} from '@playwright/test';

test('has title-test', async ({ page }) => {
await page.goto('https://playwright.dev');
await expect(page).toHaveTitle(/modern/);
})


