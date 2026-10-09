import { createGrid, C } from './grid.js';
import { createRenderer, FONT } from './renderer.js';
import { createWorld } from './world.js';

const stage = document.getElementById('stage');
const hud = document.getElementById('hud');
const params = new URLSearchParams(location.search);

await document.fonts.load(`20px "${FONT}"`);

const grid = createGrid();
const renderer = createRenderer(stage, grid);
const world = createWorld(Number(params.get('seed') ?? 7));
const glyphSheet = params.has('glyphs');

// Rolling frame stats, also exposed for headless checks.
const perf = { fps: 0, workMs: 0, workMaxMs: 0, changed: 0, frames: 0 };
const samples = [];

let paused = false;
let t = Number(params.get('t') ?? 0); // jump ahead for screenshots
if (t > 0) for (let s = 0; s < t; s += 1 / 60) world.update(s, 1 / 60);
if (params.has('say')) world.say(params.get('say'), t);
let last = performance.now();

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const t0 = performance.now();
  if (!paused) t += dt;

  grid.clear();
  if (glyphSheet) drawGlyphSheet(grid);
  else {
    if (!paused) world.update(t, dt);
    world.draw(grid, t);
  }
  const changed = renderer.paint();

  const work = performance.now() - t0;
  samples.push([dt, work]);
  if (samples.length > 120) samples.shift();
  perf.frames++;
  perf.changed = changed;
  perf.fps = samples.length / samples.reduce((a, [d]) => a + d, 0);
  perf.workMs = samples.reduce((a, [, w]) => a + w, 0) / samples.length;
  perf.workMaxMs = Math.max(...samples.map(([, w]) => w));
  if (!hud.hidden) {
    hud.textContent = `${perf.fps.toFixed(0)} fps  work ${perf.workMs.toFixed(2)}ms (max ${perf.workMaxMs.toFixed(1)})  cells ${changed}  atlas ${renderer.atlasSize}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

let glow = true;
window.addEventListener('keydown', (e) => {
  if (e.key === ' ') { paused = !paused; e.preventDefault(); }
  if (e.key === 'c') stage.classList.toggle('crt');
  if (e.key === 'g') renderer.setGlow((glow = !glow));
  if (e.key === 'f') hud.hidden = !hud.hidden;
});
if (params.has('fps')) hud.hidden = false;
if (params.has('nocrt')) stage.classList.remove('crt');

window.factory = { grid, renderer, world, perf, get t() { return t; } };

// Every procedural and font glyph we rely on, in tiles, so joins and widths can be checked.
function drawGlyphSheet(g) {
  const sets = [
    ['light', '─│┌┐└┘├┤┬┴┼╴╵╶╷'],
    ['heavy', '━┃┏┓┗┛┣┫┳┻╋┸┰┠┨┯┷┿╂'],
    ['double', '═║╔╗╚╝╠╣╦╩╬╞╡╥╨╪╫╤╧'],
    ['round', '╭╮╯╰╱╲╳'],
    ['blocks', '█▀▄▌▐▔▁▂▃▅▆▇▘▝▖▗▚▞▙▟▛▜░▒▓'],
    ['braille', '⠁⠂⠄⡀⠈⠐⠠⢀⣿⠿⢸⡇⣤⠛'],
    ['font', '◉●○▪•·✓✗✶▼▲◆^→←↑↓≡×±{}</>'],
  ];
  sets.forEach(([name, chars], row) => {
    const y = 2 + row * 6;
    g.text(2, y + 1, name, C.steel);
    [...chars].forEach((ch, i) => {
      const x = 12 + i * 6;
      // 3x3 tile of the glyph so seams between neighbours are visible
      for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) g.put(x + k, y + j, ch, C.green);
      g.put(x + 4, y + 1, ch, C.amber);
    });
  });
  // A composed frame to check corners meet
  g.box(2, 46, 30, 6, C.cyan, 'double');
  g.box(34, 46, 30, 6, C.cyan, 'round');
  g.box(66, 46, 30, 6, C.cyan, 'heavy');
  g.box(98, 46, 30, 6, C.cyan, 'light');
  g.text(4, 48, 'THE QUICK BROWN FOX 0123', C.green);
}
