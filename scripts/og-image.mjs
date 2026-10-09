// Captures the social preview image (public/og.png) from the running factory.
import { createServer } from 'vite';
import { chromium } from 'playwright';
const server = await createServer({ server: { port: 5197, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 2 });
await page.goto('http://localhost:5197/?on&scene=why&t=12.4&pause&nocrt');
await page.waitForFunction(() => window.factory?.perf.frames > 20);
// Hide the page chrome so the picture is just the factory.
await page.addStyleTag({ content: '.tour, #page-links { display: none !important; }' });
await page.waitForTimeout(800);
await page.screenshot({ path: 'public/og.png' });
await browser.close();
await server.close();
console.log('saved public/og.png');
