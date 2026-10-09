// Opens the built single file straight from disk and checks it runs with no errors.
import { chromium } from 'playwright';
import path from 'node:path';
const url = 'file://' + path.resolve('dist/index.html') + '?on&scene=explore';
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('requestfailed', (r) => errors.push('request failed: ' + r.url()));
await page.goto(url);
await page.waitForFunction(() => window.factory?.perf.frames > 60, null, { timeout: 15000 });
const out = await page.evaluate(() => ({ frames: window.factory.perf.frames, mode: window.factory.world.mode, font: document.fonts.check('20px "JetBrains Mono"'), cv: document.getElementById('cv').textContent.includes('Topflight') }));
await page.screenshot({ path: 'shots/dist-check.png' });
console.log(JSON.stringify({ ...out, errors }));
await browser.close();
