// The LAB, under the WHY gate. Ideas nobody can answer the value questions for yet are
// not rejected: they drop through a trapdoor into the lab, get a small time-boxed
// experiment, and are either promoted back up to the production line or kept as a lesson.
// It looks deliberately unlike the line: dashed glass walls, cyan light, bubbling flasks.

import { C } from './grid.js';
import { BELT_Y, FLOOR_Y, PKG_W, STATION } from './layout.js';

export const LAB_X0 = 34;
export const LAB_X1 = 80;
const TOP = BELT_Y + 3; // just under the belt
const LIFT_X = STATION.why - PKG_W / 2; // packages drop straight down from the gate exit
const ON_BELT = BELT_Y - 3;
const ON_BENCH = FLOOR_Y - 6;

export function createLab(w) {
  const lab = {
    phase: 'idle', // drop, testing, result, lift, shelve
    pkg: null,
    t0: 0,
    y: ON_BENCH,
    outcome: 'promote',
    dur: 3,
    result: null,
    lessons: 2, // a couple already on the shelf
    signal: Array(24).fill(0.15),
    sampleAt: 0,
    bubbles: [],

    get busy() { return lab.phase !== 'idle'; },
    reset() {
      Object.assign(lab, { phase: 'idle', pkg: null, result: null });
    },
    get hatchOpen() { return lab.phase === 'drop' || lab.phase === 'lift'; },

    // Take an experiment off the belt and into the lab.
    take(pkg, t, { outcome = 'promote', dur = 3 } = {}) {
      w.remove(pkg);
      pkg.experiment = true;
      Object.assign(lab, { pkg, outcome, dur, phase: 'drop', t0: t, y: ON_BELT, result: null });
      lab.signal.fill(0.15);
      w.audio?.thunk();
    },

    update(t) {
      const p = (t - lab.t0);
      switch (lab.phase) {
        case 'drop':
          lab.y = ON_BELT + (ON_BENCH - ON_BELT) * Math.min(1, (p / 1) ** 2);
          if (p >= 1) set('testing', t);
          break;
        case 'testing':
          if (p >= lab.dur) {
            lab.result = lab.outcome === 'promote' ? 'PROMOTED' : 'LEARNED';
            if (lab.outcome === 'promote') w.audio?.approve();
            else w.audio?.chime();
            set('result', t);
          }
          break;
        case 'result':
          if (p >= 1.1) set(lab.outcome === 'promote' ? 'lift' : 'shelve', t);
          break;
        case 'lift': {
          // Wait at the hatch until there is a gap on the belt to rejoin.
          const clear = !w.packages.some((q) => Math.abs(q.x - LIFT_X) < PKG_W + 1);
          const k = Math.min(1, p / 1);
          lab.y = ON_BENCH - (ON_BENCH - ON_BELT) * (1 - (1 - k) ** 2);
          if (k >= 1 && clear) {
            const pkg = lab.pkg;
            pkg.experiment = false;
            pkg.x = LIFT_X;
            pkg.flash = 0.4;
            w.insert(pkg);
            w.promoted?.(pkg);
            lab.pkg = null;
            set('idle', t);
          }
          break;
        }
        case 'shelve':
          if (p >= 0.8) {
            lab.lessons++;
            lab.pkg = null;
            set('idle', t);
          }
          break;
      }

      // The signal chart: rising for an idea that is finding users, flat for one that isn't.
      if (t >= lab.sampleAt) {
        lab.sampleAt = t + 0.15;
        const testing = lab.phase === 'testing';
        const k = testing ? Math.min(1, (t - lab.t0) / lab.dur) : 0;
        const target = testing ? (lab.outcome === 'promote' ? 0.2 + k * 0.7 : 0.25) : lab.signal.at(-1) * 0.98;
        lab.signal.push(Math.max(0.05, Math.min(0.95, target + (w.rnd() - 0.5) * 0.15)));
        lab.signal.shift();
      }

      // Flasks bubble while an experiment runs.
      if (lab.phase === 'testing' && w.rnd() < 0.3) {
        lab.bubbles.push({ x: 38 + (w.rnd() < 0.5 ? 1 : 6) + w.rnd(), y: 43, born: t });
      }
      lab.bubbles = lab.bubbles.filter((b) => t - b.born < 1.2);
    },

    draw(g, t) {
      const x0 = LAB_X0, x1 = LAB_X1, y0 = TOP, y1 = FLOOR_Y - 1;
      // Dashed glass walls, so it is plainly not part of the line.
      g.fill(x0 + 1, y0 + 1, x1 - x0 - 1, y1 - y0 - 1, ' ', 0);
      g.text(x0, y0, '╭' + '┄'.repeat(x1 - x0 - 1) + '╮', C.cyanDim);
      g.text(x0, y1, '╰' + '┄'.repeat(x1 - x0 - 1) + '╯', C.cyanDim);
      for (let y = y0 + 1; y < y1; y++) {
        g.put(x0, y, '┆', C.cyanDim);
        g.put(x1, y, '┆', C.cyanDim);
      }
      g.text(x0 + 2, y0, ' LAB ', C.cyan);

      // Signal chart
      g.text(x0 + 2, y0 + 1, 'signal', C.cyanDim);
      lab.signal.forEach((v, i) => {
        if (i % 2) return;
        g.put(x0 + 2 + i / 2, y0 + 2, '▁▂▃▄▅▆▇█'[Math.min(7, Math.floor(v * 8))], v > 0.6 ? C.green : C.cyanDim);
      });

      // Two flasks
      g.text(x0 + 3, y0 + 4, '╭╮   ╭╮', C.steel);
      g.text(x0 + 3, y0 + 5, '││   ││', C.steel);
      g.text(x0 + 2, y0 + 6, '╱░░╲ ╱▒▒╲', C.cyan);
      g.text(x0 + 2, y0 + 7, '╰──╯ ╰──╯', C.steel);
      for (const b of lab.bubbles) g.put(b.x, b.y - (t - b.born) * 2, '•', C.cyan);

      // Time-box countdown
      const left = lab.phase === 'testing' ? Math.max(0, Math.ceil(lab.dur - (t - lab.t0))) : 0;
      g.text(x0 + 2, y0 + 9, 'time-box', C.amberDim);
      g.text(x0 + 11, y0 + 9, `0:${String(left).padStart(2, '0')}`, lab.phase === 'testing' ? C.amber : C.amberDim);

      // The lift shaft and test bench
      for (let y = y0 + 1; y < ON_BENCH + 3; y++) {
        g.put(LIFT_X - 1, y, '┆', C.greyDark);
        g.put(LIFT_X + PKG_W, y, '┆', C.greyDark);
      }
      g.text(LIFT_X - 1, ON_BENCH + 3, '▀'.repeat(PKG_W + 2), C.steel);

      // Status over the bench
      const status = lab.phase === 'testing' ? (Math.floor(t * 3) % 2 ? 'TESTING' : '') : lab.result ?? 'ready';
      const col = status === 'PROMOTED' ? C.green : status === 'LEARNED' ? C.cyan : status === 'ready' ? C.greyDark : C.amber;
      g.text(LIFT_X + Math.floor((PKG_W - status.length) / 2), y0 + 1, status, col);

      // Lessons shelf
      const sx = x1 - 8;
      g.text(sx, y0 + 1, 'lessons', C.cyanDim);
      for (let i = 0; i < Math.min(6, lab.lessons); i++) g.text(sx + 1, ON_BENCH + 2 - i, '▬▬▬▬▬', i % 2 ? C.cyanDim : C.cyan);
      g.text(sx + 1, ON_BENCH + 3, String(lab.lessons).padStart(3, '0'), C.cyan);
    },

    // The package in the lab, drawn after the belt so it can pass through the trapdoor.
    drawPackage(g, drawPkg) {
      if (!lab.pkg) return;
      if (lab.phase === 'shelve') return; // whisked onto the shelf
      drawPkg(g, lab.pkg, LIFT_X, Math.round(lab.y));
    },

    // The trapdoor in the belt over the lift.
    drawHatch(g) {
      if (!lab.hatchOpen) return;
      for (let x = LIFT_X; x < LIFT_X + PKG_W; x++) {
        for (let y = BELT_Y; y < BELT_Y + 3; y++) g.put(x, y, ' ', 0);
      }
    },
  };

  function set(phase, t) {
    lab.phase = phase;
    lab.t0 = t;
  }

  return lab;
}
