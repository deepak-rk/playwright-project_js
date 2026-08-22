const { firefox } = require('playwright');

(async () => {
  const browser = await firefox.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://playwright.dev/');
  await page.close();

  // ---------------------
  await context.close();
  await browser.close();
})();