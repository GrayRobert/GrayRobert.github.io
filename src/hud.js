// The lever panel. It is drawn with the same grid and renderer as the factory, but on
// its own small canvas pinned to the screen, so the levers stay in reach while the
// camera moves along the line.

import { createGrid, C } from './grid.js';
import { createRenderer } from './renderer.js';
import { ROWS, view, screenCentreY } from './layout.js';

const COLS = 13;
const HUD_ROWS = 9;
const TOP = 2; // screen row it sits on: tucked under the roof, top left

export function createHud(stage, mainRenderer, { onPower, onSound, soundOn }) {
  const grid = createGrid(COLS, HUD_ROWS);
  const renderer = createRenderer(stage, grid, { cell: () => mainRenderer.cell, className: 'hud' });
  const levers = { power: { v: 0, vel: 0, target: 0 }, sound: { v: soundOn ? 1 : 0, vel: 0, target: soundOn ? 1 : 0 } };
  let powered = false;
  let hover = null;
  let hits = [];

  function place() {
    const { w, h } = mainRenderer.cssCell;
    const left = stage.clientWidth / 2 - (Math.min(view.cols, stage.clientWidth / w) / 2 - 1) * w;
    const top = screenCentreY(stage.clientHeight) - (ROWS / 2 - TOP) * h;
    renderer.layer.style.transform = `translate(${left}px, ${top}px)`;
  }
  place();
  window.addEventListener('resize', place);

  function draw(t, dt) {
    for (const l of Object.values(levers)) spring(l, dt);
    grid.clear();
    hits = [];
    grid.box(0, 0, COLS, HUD_ROWS, powered ? C.grey : C.greyDark, 'heavy');
    grid.fill(1, 1, COLS - 2, HUD_ROWS - 2, ' ', 0);
    lever(t, 'power', 3, 1, 'PWR', powered ? C.green : C.amber);
    lever(t, 'sound', 9, 1, 'SND', levers.sound.target ? C.green : C.red);
    renderer.paint();
  }

  function lever(t, id, x, y, label, lamp) {
    const travel = 3;
    const hy = y + Math.round(levers[id].v * travel);
    const idle = id === 'power' && !powered;
    for (let j = 0; j <= travel; j++) grid.put(x, y + j, '║', C.greyDark);
    const pivot = y + travel + 1;
    grid.put(x, pivot, '◎', C.steel);
    for (let yy = hy + 1; yy < pivot; yy++) grid.put(x, yy, '┃', C.steel);
    const pulse = idle && Math.floor(t * 2.5) % 2 === 0;
    grid.text(x - 1, hy, '▐█▌', hover === id ? C.white : pulse ? C.amber : idle ? C.amberDim : C.steel);
    grid.put(x + 2, y + travel + 1, '●', id === 'sound' && !powered ? C.greyDark : lamp);
    grid.text(x - 1, y + travel + 2, label, powered || id === 'power' ? C.steel : C.greyDark);
    hits.push({ id, x: x - 2, y: y - 1, w: 5, h: travel + 5 });
  }

  function hitAt(e) {
    const cell = renderer.cellAt(e.clientX, e.clientY);
    if (!cell) return null;
    return hits.find((h) => cell.x >= h.x && cell.x < h.x + h.w && cell.y >= h.y && cell.y < h.y + h.h)?.id ?? null;
  }
  renderer.layer.addEventListener('pointermove', (e) => {
    hover = hitAt(e);
    renderer.layer.style.cursor = hover ? 'pointer' : '';
  });
  renderer.layer.addEventListener('pointerleave', () => { hover = null; });
  renderer.layer.addEventListener('click', (e) => {
    e.stopPropagation();
    const id = hitAt(e);
    if (id === 'power') onPower();
    if (id === 'sound') onSound();
  });

  return {
    draw,
    setPowered(on) {
      powered = on;
      levers.power.target = on ? 1 : 0;
    },
    setSound(on) { levers.sound.target = on ? 1 : 0; },
  };
}

// Underdamped spring: a heavy handle that slams past its stop and settles back.
function spring(l, dt) {
  const step = Math.min(dt, 1 / 30);
  l.vel += ((l.target - l.v) * 260 - l.vel * 16) * step;
  l.v += l.vel * step;
}
