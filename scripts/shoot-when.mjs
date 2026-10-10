// Screenshot the moment a condition becomes true, clipped to a region of the world.
// Usage: node scripts/shoot-when.mjs name 'query' 'condition expression' x0 y0 x1 y1
// The region is in world cells. The condition runs in the page every frame.
import { createServer } from 'vite';
import { chromium } from 'playwright';

const [name, query, condition, ...box] = process.argv.slice(2);
const [x0, y0, x1, y1] = box.map(Number);
const server = await createServer({ server: { port: 5196, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
await page.goto(`http://localhost:5196/?${query}`);
await page.waitForFunction(() => window.factory?.perf.frames > 10);
await page.waitForFunction(`(() => { const f = window.factory; return ${condition}; })()`, null, { timeout: 30000, polling: 'raf' });
await page.evaluate(() => document.querySelector('.strip .pause')?.click());
const clip = await page.evaluate(([x0, y0, x1, y1]) => {
  const r = document.querySelector('.world canvas.main').getBoundingClientRect();
  const cw = r.width / window.factory.grid.cols, ch = r.height / window.factory.grid.rows;
  return { x: r.left + x0 * cw, y: r.top + y0 * ch, width: (x1 - x0) * cw, height: (y1 - y0) * ch };
}, [x0, y0, x1, y1]);
await page.screenshot({ path: `shots/${name}.png`, clip });
console.log(`shots/${name}.png`);
await browser.close();
await server.close();
