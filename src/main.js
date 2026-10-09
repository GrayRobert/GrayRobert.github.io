import { createGrid, C } from './grid.js';
import { createRenderer, FONT } from './renderer.js';
import { createWorld } from './world.js';
import { createAudio } from './audio.js';
import { createCards } from './card.js';
import { createCamera } from './camera.js';
import { createHud } from './hud.js';
import { createTour, SCENES } from './tour.js';
import { createTourUI } from './tourui.js';
import { WORLD_COLS, ROWS, view, updateViewCols, viewFor, ZONES } from './layout.js';
import content from './content.json';

const stage = document.getElementById('stage');
const stats = document.getElementById('stats');
const plainToggle = document.getElementById('plain-toggle');
const crewNav = document.getElementById('crew-nav');
const params = new URLSearchParams(location.search);
const EXPLORE = SCENES.length - 1;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

await document.fonts.load(`20px "${FONT}"`);

// How much of the line fits on screen. Must run before the renderer sizes itself.
const fitView = () => stage.clientWidth && updateViewCols(stage.clientWidth, stage.clientHeight);
fitView();
window.addEventListener('resize', fitView);

// Phones and tablets: lighter effects, and a canvas small enough for their limits.
const lite = matchMedia('(pointer: coarse)').matches || view.cols < 140;
document.body.classList.toggle('lite', lite);
if (lite) stage.classList.remove('crt');

const grid = createGrid(WORLD_COLS, ROWS);
const renderer = createRenderer(stage, grid, { viewCols: () => view.cols, maxArea: lite ? 12e6 : Infinity });
const camera = createCamera(stage, renderer);
const audio = createAudio();
const world = createWorld({ seed: Number(params.get('seed') ?? 7), audio });
const cards = createCards();
const ui = createTourUI((i) => tour.go(i), () => tour.skip());
const tour = createTour({ world, camera, ui });
const hud = createHud(stage, renderer, { onPower: togglePower, onSound: toggleSound, soundOn: !audio.muted });
// Start on the opening shot (on a phone that means zoomed out enough to fit the name sign).
const opening = viewFor('base');
camera.to(opening.cx, { zoom: opening.zoom, dur: 0 });
const glyphSheet = params.has('glyphs');

let t = 0;
let paused = params.has('pause') || reducedMotion;
let plain = false;
let resumeAt = null; // scene to come back to after a power cut

function powerUp({ silent = false, scene = null } = {}) {
  if (world.powered) return;
  world.powerOn(t, { silent });
  hud.setPowered(true);
  ui.show();
  if (scene !== null) tour.go(scene);
  else if (resumeAt !== null) tour.go(resumeAt);
  else tour.start(t);
  resumeAt = null;
}

function powerDown() {
  if (!world.powered) return;
  resumeAt = Math.max(2, tour.index); // back into the tour where it was, or explore
  tour.stop();
  world.powerOff();
  hud.setPowered(false);
  camera.free = false;
  const home = viewFor('base');
  camera.to(home.cx, { zoom: home.zoom, now: t, dur: 1.2 }); // back to the lever
  ui.hide();
}

function togglePower() {
  if (world.powered) powerDown();
  else powerUp();
}

function toggleSound() {
  audio.setMuted(!audio.muted);
  hud.setSound(!audio.muted);
  audio.clunk();
}

// Plain text CV: the same content as real HTML, without the factory.
function setPlain(on) {
  plain = on;
  document.body.classList.toggle('plain', on);
  document.documentElement.classList.toggle('plain', on);
  plainToggle.setAttribute('aria-pressed', String(on));
  plainToggle.textContent = on ? '◀ back to the factory' : '≡ plain CV';
  if (on) audio.sleep();
  else {
    if (world.powered) audio.wake();
    window.dispatchEvent(new Event('resize')); // the window may have changed while hidden
  }
}
plainToggle.addEventListener('click', () => {
  setPlain(!plain);
  history.replaceState(null, '', plain ? '#cv' : location.pathname + location.search);
  if (plain) document.getElementById('cv').focus();
});

// Deep links: #cv, #build, #agent-qa. Factory links skip the lever. Sound starts on the first click.
function openFromHash() {
  const h = location.hash.slice(1);
  if (h === 'cv') {
    setPlain(true);
    return true;
  }
  if (plain && h) setPlain(false);
  if (h.startsWith('agent-')) {
    showRobot(h.slice(6));
    cards.open(h.slice(6));
    return true;
  }
  const i = SCENES.findIndex((s) => s.id === h);
  if (i < 0) return false;
  if (world.powered) tour.go(i);
  else powerUp({ silent: true, scene: i });
  return true;
}

// Bring a robot into view, waking the whole factory if needed.
function showRobot(id) {
  if (!world.powered) powerUp({ silent: true, scene: EXPLORE });
  else if (tour.index !== EXPLORE) tour.skip();
  const x = world.robotX(id);
  if (x != null) camera.to(x + 6, { now: t, dur: reducedMotion ? 0 : 0.8 });
  world.setHover(id);
}

// Keyboard and screen reader access to the crew: one real button per robot. Focus
// pans the camera to the robot and lights it up, Enter opens its card.
for (const a of content.agents) {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = `${a.title}: ${a.pitch}`;
  b.setAttribute('aria-label', `${a.title}. Open skill card`);
  b.addEventListener('focus', () => showRobot(a.id));
  b.addEventListener('blur', () => world.setHover(null));
  b.addEventListener('click', () => cards.open(a.id));
  crewNav.append(b);
}

if (reducedMotion) {
  // A calm, lit, still factory. Everything is still clickable and the camera still moves.
  powerUp({ silent: true, scene: EXPLORE });
}
if (!openFromHash() && params.has('on')) {
  powerUp({ silent: true, scene: params.has('scene') ? SCENES.findIndex((s) => s.id === params.get('scene')) : null });
}
// Fast forward the simulation, for screenshots of a particular moment. Tour scripts
// continue in promise callbacks, so yield a few microtask turns after every step.
for (let s = 0, end = Number(params.get('t') ?? (reducedMotion ? 30 : 0)); s < end; s += 1 / 60) {
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
  requestAnimationFrame(frame);
  if (plain) return; // nothing to draw behind the plain CV
  const t0 = performance.now();

  // The factory holds still while a skill card is open.
  if (!paused && !cards.isOpen) step(dt);
  else camera.update(reducedMotion ? Infinity : t);

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
    stats.textContent = `${perf.fps.toFixed(0)} fps  work ${perf.workMs.toFixed(2)}ms (max ${perf.workMaxMs.toFixed(1)})  cells ${changed}  atlas ${renderer.atlasSize}  cols ${view.cols}`;
  }
}
requestAnimationFrame(frame);

// Pointer: hovering a robot lights it up, clicking opens its skill card.
function robotUnder(e) {
  if (!world.powered) return null;
  const cell = renderer.cellAt(e.clientX, e.clientY);
  return cell ? world.hitAt(cell.x, cell.y) : null;
}
stage.addEventListener('pointermove', (e) => {
  if (e.pointerType === 'touch') return;
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
function stepStation(dir) {
  const stops = [...new Set(ZONES.slice(1).map((z) => viewFor(z.id).cx))].sort((a, b) => a - b);
  const here = camera.x;
  const next = dir > 0 ? stops.find((v) => v > here + 5) : [...stops].reverse().find((v) => v < here - 5);
  if (next != null) camera.to(next, { now: t, dur: reducedMotion ? 0 : 1 });
}
let glow = true;
window.addEventListener('keydown', (e) => {
  if (cards.isOpen || plain || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target instanceof HTMLButtonElement && (e.key === 'Enter' || e.key === ' ')) return; // let buttons work
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

window.factory = { grid, renderer, world, camera, tour, audio, perf, get t() { return t; }, setPlain, togglePower };
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
