// @ts-check
const { test, expect } = require('@playwright/test');

// context - used for tracing
test('Trace Failure', async ({ page, context }) => {
  await page.goto('https://playwright.dev/');
  await context.tracing.start(

    { snapshots: true, screenshots: true }

  );
  // Click the get started link.
  await page.getByRole('link', { name: 'Get started' }).click();

  // Expects page to have a heading with the name of Installation.
  await expect(page.getByRole('heading', { name: 'Installation' })).toBeVisible();
  await context.tracing.stop(
    {
      path: 'failing-example-trace.zip'
    }

  )

});
// SHIFT+ALT+F for formatting