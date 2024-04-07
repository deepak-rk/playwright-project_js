const { chromium } = require('playwright');
(async () => {
    console.log('start');
    try {
        const browser = await chromium.launch();
        const page = await browser.newPage();
        await page.goto('https://example.com');
        await browser.close();
    } catch (error) {
        console.log(error);
    }
 
})();