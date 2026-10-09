import { createGrid, C } from './grid.js';
import { createRenderer, FONT } from './renderer.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import { createCards } from './card.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { createTour, SCENES } from './tour.js';
import { createTourUI } from './tourui.js';
import { WORLD_COLS, ROWS, VIEW_COLS, VIEW } from './layout.js';

const stage = document.getElementById('stage');
const stats = document.getElementById('stats');
const params = new URLSearchParams(location.search);

await document.fonts.load(`20px "${FONT}"`);

const grid = createGrid(WORLD_COLS, ROWS);
const renderer = createRenderer(stage, grid, { viewCols: VIEW_COLS });
const camera = createCamera(stage, renderer);
const audio = createAudio();
const world = createWorld({ seed: Number(params.get('seed') ?? 7), audio });
const cards = createCards();
const ui = createTourUI((i) => tour.go(i), () => tour.skip());
const tour = createTour({ world, camera, ui });
const hud = createHud(stage, renderer, { onPower: () => powerUp(), onSound: toggleSound, soundOn: !audio.muted });
const glyphSheet = params.has('glyphs');

let t = 0;
let paused = params.has('pause');

function powerUp({ silent = false, scene = null } = {}) {
  if (world.powered) return;
  world.powerOn(t, { silent });
  hud.setPowered(true);
  ui.show();
  if (scene === null) tour.start(t);
  else tour.go(scene);
}

function toggleSound() {
  audio.setMuted(!audio.muted);
  hud.setSound(!audio.muted);
  audio.clunk();
}

// Deep links (#build, #agent-qa) skip the lever. Sound starts on the first click.
function openFromHash() {
  const h = location.hash.slice(1);
  if (!h) return false;
  if (h.startsWith('agent-')) {
    const id = h.slice(6);
    powerUp({ silent: true, scene: SCENES.length - 1 });
    const x = world.robotX(id);
    if (x != null) camera.to(x + 6, { dur: 0 });
    cards.open(id);
    return true;
  }
  const i = SCENES.findIndex((s) => s.id === h);
  if (i < 0) return false;
  if (world.powered) tour.go(i);
  else powerUp({ silent: true, scene: i });
  return true;
}

if (!openFromHash() && params.has('on')) powerUp({ silent: true, scene: params.has('scene') ? SCENES.findIndex((s) => s.id === params.get('scene')) : null });
// Fast forward the simulation, for screenshots of a particular moment. Tour scripts
// continue in promise callbacks, so yield a few microtask turns after every step.
for (let s = 0, end = Number(params.get('t') ?? 0); s < end; s += 1 / 60) {
  step(1 / 60);
  for (let k = 0; k < 6; k++) await null;
}
if (params.has('say')) world.say(params.get('who') ?? 'cto', params.get('say'), t, 1e9);
if (params.has('card')) cards.open(params.get('card'));
if (params.has('hover')) world.setHover(params.get('hover'));

function step(dt) {
  t += dt;
  world.update(t, dt);
  tour.update(t);
  camera.update(t);
}

// Rolling frame stats, also exposed for headless checks.
const perf = { fps: 0, workMs: 0, workMaxMs: 0, changed: 0, frames: 0 };
const samples = [];
let last = performance.now();

function frame(nowMs) {
  const dt = Math.min(0.05, (nowMs - last) / 1000);
  last = nowMs;
  const t0 = performance.now();

  // The factory holds still while a skill card is open.
  if (!paused && !cards.isOpen) step(dt);
  else camera.update(t);

  grid.clear();
  if (glyphSheet) drawGlyphSheet(grid);
  else world.draw(grid, t);
  const changed = renderer.paint();
  hud.draw(t, dt);
  ui.update();

  const work = performance.now() - t0;
  samples.push([dt, work]);
  if (samples.length > 120) samples.shift();
  perf.frames++;
  perf.changed = changed;
  perf.fps = samples.length / samples.reduce((a, [d]) => a + d, 0);
  perf.workMs = samples.reduce((a, [, w]) => a + w, 0) / samples.length;
  perf.workMaxMs = Math.max(...samples.map(([, w]) => w));
  if (!stats.hidden) {
    stats.textContent = `${perf.fps.toFixed(0)} fps  work ${perf.workMs.toFixed(2)}ms (max ${perf.workMaxMs.toFixed(1)})  cells ${changed}  atlas ${renderer.atlasSize}`;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Pointer: hovering a robot lights it up, clicking opens its skill card.
function robotUnder(e) {
  if (!world.powered) return null;
  const cell = renderer.cellAt(e.clientX, e.clientY);
  return cell ? world.hitAt(cell.x, cell.y) : null;
}
stage.addEventListener('pointermove', (e) => {
  const id = robotUnder(e);
  world.setHover(id);
  stage.style.cursor = id ? 'pointer' : camera.free ? 'grab' : '';
});
stage.addEventListener('pointerleave', () => world.setHover(null));
stage.addEventListener('click', (e) => {
  const id = robotUnder(e);
  if (id) cards.open(id);
});

// Keys: Enter or Space pulls the lever. Then arrows and Space move through the tour,
// or from station to station in explore mode.
const stations = Object.values(VIEW).filter((v, i, a) => a.indexOf(v) === i).sort((a, b) => a - b);
function stepStation(dir) {
  const here = camera.x;
  const next = dir > 0 ? stations.find((v) => v > here + 5) : [...stations].reverse().find((v) => v < here - 5);
  if (next != null) camera.to(next, { now: t, dur: 1 });
}
let glow = true;
window.addEventListener('keydown', (e) => {
  if (cards.isOpen || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!world.powered) {
    if (e.key === 'Enter' || e.key === ' ') { powerUp(); e.preventDefault(); }
    if (e.key === 'm') toggleSound();
    return;
  }
  const explore = camera.free;
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
    if (explore) stepStation(1);
    else tour.next();
    e.preventDefault();
  }
  if (['ArrowLeft', 'PageUp'].includes(e.key)) {
    if (explore) stepStation(-1);
    else tour.prev();
    e.preventDefault();
  }
  if (e.key === 'Escape' && !explore) tour.skip();
  if (e.key === 'm') toggleSound();
  if (e.key === 'p') paused = !paused;
  if (e.key === 'c') stage.classList.toggle('crt');
  if (e.key === 'g') renderer.setGlow((glow = !glow));
  if (e.key === 'f') stats.hidden = !stats.hidden;
});

// The scroll wheel moves through the tour (explore mode uses it to pan instead).
let wheelLock = 0;
stage.addEventListener('wheel', (e) => {
  if (!world.powered || camera.free) return;
  e.preventDefault();
  if (performance.now() < wheelLock || Math.abs(e.deltaY) < 8) return;
  wheelLock = performance.now() + 900;
  if (e.deltaY > 0) tour.next();
  else tour.prev();
}, { passive: false });

window.addEventListener('hashchange', openFromHash);

if (params.has('fps')) stats.hidden = false;
if (params.has('nocrt')) stage.classList.remove('crt');

window.factory = { grid, renderer, world, camera, tour, perf, get t() { return t; } };
// A small deck-style navigator, as in the talk that inspired this, for debugging.
window.deck = {
  goto: (id) => tour.goto(id),
  next: () => tour.next(),
  prev: () => tour.prev(),
  get index() { return tour.index; },
  labels: SCENES.map((s) => s.id),
};

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
      for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) g.put(x + k, y + j, ch, C.green);
      g.put(x + 4, y + 1, ch, C.amber);
    });
  });
  g.box(2, 46, 30, 6, C.cyan, 'double');
  g.box(34, 46, 30, 6, C.cyan, 'round');
  g.box(66, 46, 30, 6, C.cyan, 'heavy');
  g.box(98, 46, 30, 6, C.cyan, 'light');
  g.text(4, 48, 'THE QUICK BROWN FOX 0123', C.green);
}
