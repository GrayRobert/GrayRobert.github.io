// Headless screenshots and frame stats. Usage: node scripts/shoot.mjs [name=query ...]
import { createServer } from 'vite';
import { chromium } from 'playwright';
import fs from 'node:fs';

const shots = process.argv.slice(2).map((a) => [a.slice(0, a.indexOf('=')), a.slice(a.indexOf('=') + 1)]);
if (!shots.length) shots.push(['factory', 't=14&fps'], ['glyphs', 'glyphs']);
const viewports = [
  { tag: '1080p', width: 1920, height: 1080, deviceScaleFactor: 1 },
  { tag: '4k', width: 1920, height: 1080, deviceScaleFactor: 2 },
];

fs.mkdirSync('shots', { recursive: true });
const server = await createServer({ server: { port: 5199, strictPort: true }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--enable-gpu-rasterization', '--ignore-gpu-blocklist'] });

for (const vp of viewports) {
  const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height }, deviceScaleFactor: vp.deviceScaleFactor });
  page.on('pageerror', (e) => console.log('PAGE ERROR', e.message));
  page.on('console', (m) => m.type() === 'error' && console.log('CONSOLE', m.text()));
  for (const [name, query] of shots) {
    await page.goto(`http://localhost:5199/?${query}`);
    await page.waitForFunction(() => window.factory?.perf.frames > 30);
    await page.waitForTimeout(2500);
    const file = `shots/${name}-${vp.tag}.png`;
    await page.screenshot({ path: file });
    const stats = await page.evaluate(() => ({ ...window.factory.perf, world: window.factory.world.stats, cell: window.factory.renderer.cell }));
    if (vp.tag === '4k' && stats.world.botX != null) {
      // Close-up of the robot to check glyph joins at high resolution.
      const box = await page.evaluate((botX) => {
        const r = document.querySelector('canvas.main').getBoundingClientRect();
        const cw = r.width / window.factory.grid.cols;
        const ch = r.height / window.factory.grid.rows;
        return { x: r.left + (botX - 6) * cw, y: r.top + 34 * ch, width: 34 * cw, height: 17 * ch };
      }, stats.world.botX);
      await page.screenshot({ path: `shots/${name}-robot-4k.png`, clip: box });
    }
    console.log(file, JSON.stringify(stats, (k, v) => (typeof v === 'number' ? Math.round(v * 100) / 100 : v)));
  }
  await page.close();
}
await browser.close();
await server.close();
