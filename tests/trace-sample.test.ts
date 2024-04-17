import {expect, test} from '@playwright/test';
import { name } from '../playwright.config';
// trace validation, run with command 'npx playwright test ./tests/trace-sample.test.ts --headed --project=chromium'
test('has title-test', async ({ page }) => {
await page.goto('https://playwright.dev');
await expect(page).toHaveTitle(/modern/);
await page.getByRole('link',{name:'Get Started'}).click();
await expect(page.getByRole('heading',{name:'InstallationFailedWithIntent'})).toBeVisible();
})


