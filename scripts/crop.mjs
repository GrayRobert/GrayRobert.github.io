// Crop a region of a screenshot in grid cells: node scripts/crop.mjs in.png out.png x y w h
import { chromium } from 'playwright';
import fs from 'node:fs';
const [inp, out, x, y, w, h] = process.argv.slice(2);
const b64 = fs.readFileSync(inp).toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setContent(`<canvas id=c></canvas>`);
const data = await page.evaluate(async ({ b64, x, y, w, h }) => {
  const img = new Image();
  img.src = 'data:image/png;base64,' + b64;
  await img.decode();
  // Grid canvas is centred, 180 x 54 cells, cell ratio 1.9.
  const cw = Math.floor(Math.min(img.width / 180, img.height / (54 * 1.9)));
  const ch = Math.round(cw * 1.9);
  const ox = (img.width - cw * 180) / 2, oy = (img.height - ch * 54) / 2;
  const c = document.getElementById('c');
  c.width = w * cw; c.height = h * ch;
  c.getContext('2d').drawImage(img, ox + x * cw, oy + y * ch, w * cw, h * ch, 0, 0, w * cw, h * ch);
  return c.toDataURL('image/png').split(',')[1];
}, { b64, x: +x, y: +y, w: +w, h: +h });
fs.writeFileSync(out, Buffer.from(data, 'base64'));
await browser.close();
