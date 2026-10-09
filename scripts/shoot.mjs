// Headless screenshots and frame stats. Usage: node scripts/shoot.mjs [name=query ...]
// Names starting with m- are shot on a phone (390 x 844, touch), the rest at 1080p and 4K.
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.slice(2).map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]);
if (!shots.length) shots.push(['factory', 'on&scene=explore&t=20&fps'], ['glyphs', 'glyphs']);
const viewports = [
  { tag: '1080p', width: 1920, height: 1080, deviceScaleFactor: 1 },
  { tag: '4k', width: 1920, height: 1080, deviceScaleFactor: 2 },
  { tag: 'phone', width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
];

fs.mkdirSync('shots', { recursive: true });
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });

for (const vp of viewports) {
  const mine = shots.filter(([name]) => name.startsWith('m-') === (vp.tag === 'phone'));
  if (!mine.length) continue;
  const { tag, ...opts } = vp;
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, ...opts });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  for (const [name, query] of mine) {
    await page.goto(`http://localhost:5199/?${query}`);
    await page.waitForFunction(() => window.factory && (window.factory.perf.frames > 30 || document.body.classList.contains('plain')));
    await page.waitForTimeout(2500);
    const file = `shots/${name}-${tag}.png`;
    await page.screenshot({ path: file, fullPage: query.includes('#cv') });
    const stats = await page.evaluate(() => ({ ...window.factory.perf, world: window.factory.world.stats, cell: window.factory.renderer.cell }));
    console.log(file, JSON.stringify(stats, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
  }
  await page.close();
}
await browser.close();
await server.close();
