// The lever panel: PWR and SND, part of the factory itself, top left at the start of
// the line. It scrolls with the factory. When it is off screen, the "sound" button in
// the page corner (or the M key) still mutes.

import { C } from './grid.js';

const X = 1; // world column of the panel's left edge
const Y = 2; // world row of its top edge
const COLS = 13;
const ROWS = 9;

export function createLeverPanel({ onPower, onSound, soundOn }) {
  const levers = { power: { v: 0, vel: 0, target: 0 }, sound: { v: soundOn ? 1 : 0, vel: 0, target: soundOn ? 1 : 0 } };
  let powered = false;
  let hover = null;
  let hits = [];

  function draw(g, t, dt) {
    for (const l of Object.values(levers)) spring(l, dt);
    hits = [];
    g.box(X, Y, COLS, ROWS, powered ? C.grey : C.greyDark, 'heavy');
    g.fill(X + 1, Y + 1, COLS - 2, ROWS - 2, ' ', 0);
    lever(g, t, 'power', X + 3, Y + 1, 'PWR', powered ? C.green : C.amber);
    lever(g, t, 'sound', X + 9, Y + 1, 'SND', levers.sound.target ? C.green : C.red);
  }

  function lever(g, t, id, x, y, label, lamp) {
    const travel = 3;
    const hy = y + Math.round(levers[id].v * travel);
    const idle = id === 'power' && !powered;
    for (let j = 0; j <= travel; j++) g.put(x, y + j, '║', C.greyDark);
    const pivot = y + travel + 1;
    g.put(x, pivot, '◎', C.steel);
    for (let yy = hy + 1; yy < pivot; yy++) g.put(x, yy, '┃', C.steel);
    const pulse = idle && Math.floor(t * 2.5) % 2 === 0;
    g.text(x - 1, hy, '▐█▌', hover === id ? C.white : pulse ? C.amber : idle ? C.amberDim : C.steel);
    g.put(x + 2, y + travel + 1, '●', id === 'sound' && !powered ? C.greyDark : lamp);
    g.text(x - 1, y + travel + 2, label, powered || id === 'power' ? C.steel : C.greyDark);
    hits.push({ id, x: x - 2, y: y - 1, w: 5, h: travel + 5 });
  }

  return {
    draw,
    // Which lever (if any) is at a world cell.
    hitAt(cx, cy) {
      return hits.find((h) => cx >= h.x && cx < h.x + h.w && cy >= h.y && cy < h.y + h.h)?.id ?? null;
    },
    setHover(id) { hover = id; },
    pull(id) {
      if (id === 'power') onPower();
      if (id === 'sound') onSound();
    },
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
