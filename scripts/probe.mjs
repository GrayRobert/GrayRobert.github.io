// Evaluate an expression in the page at a given URL query: node scripts/probe.mjs 'query' 'expr'
import { createServer } from 'vite';
import { chromium } from 'playwright';
const [query, expr, wait = '500'] = process.argv.slice(2);
const server = await createServer({ server: { port: 5198, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://localhost:5198/?${query}`);
await page.waitForFunction(() => window.factory?.perf.frames > 5);
await page.waitForTimeout(Number(wait));
console.log(JSON.stringify(await page.evaluate(expr), null, 1));
await browser.close();
await server.close();
