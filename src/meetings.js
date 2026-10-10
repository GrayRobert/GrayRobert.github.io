// The people side of planning and design, on the floor under PLAN and DESIGN.
// Stakeholders are drawn as simple human figures, so they read differently from the
// robots: a steering group around a roadmap, and a sprint demo with an iterating design.

import { C } from './grid.js';
import { FLOOR_Y } from './layout.js';

const PEOPLE = [C.steel, C.amber, C.cyan, C.green, C.white];
const STEER_CHIPS = [['+1', C.green], ['?', C.amber], ['go', C.green], ['risk?', C.amber], ['+1', C.green]];
const DEMO_CHIPS = [['+1', C.green], ['nice', C.green], ['move it', C.amber], ['?', C.amber]];
const LOOP = ['build', 'demo', 'feedback', 'refine'];

export function createMeetings() {
  // A seated person: head and shoulders behind a table.
  function seated(g, x, y, col) {
    g.put(x + 1, y, '●', col);
    g.text(x, y + 1, '╱█╲', col);
  }
  // A standing person.
  function standing(g, x, y, col) {
    g.put(x + 1, y, '●', col);
    g.text(x, y + 1, '╱█╲', col);
    g.text(x, y + 2, '╱`╲', C.grey);
  }
  function chip(g, x, y, [text, col]) {
    g.text(x, y, '`' + text + '`', col);
  }

  // Steering group, under PLAN: a roadmap on the wall and stakeholders round a table.
  function drawSteering(g, t) {
    const top = 38;
    g.text(86, top, ' STEERING GROUP ', C.steel);

    // Roadmap board: cards move from LATER to NEXT to NOW over time.
    const bx = 86, by = top + 1, bw = 21, bh = 7;
    g.box(bx, by, bw, bh, C.grey, 'round');
    g.fill(bx + 1, by + 1, bw - 2, bh - 2, ' ', 0);
    const heads = [['NOW', C.green], ['NEXT', C.amber], ['LATER', C.steel]];
    const counts = [[1, 2, 3], [2, 2, 2], [2, 3, 1], [3, 1, 2], [1, 3, 2], [2, 1, 3]][Math.floor(t / 2.5) % 6];
    heads.forEach(([name, col], k) => {
      const cx = bx + 1 + k * 6;
      g.text(cx, by + 1, name, col);
      for (let i = 0; i < counts[k]; i++) g.text(cx, by + 2 + i, '▪▪▪', col === C.steel ? C.grey : col);
      if (k) for (let y = by + 1; y < by + bh - 1; y++) g.put(cx - 1, y, '┊', C.greyDark);
    });

    // The table, and five people who react in turn.
    const tx = 110;
    for (let i = 0; i < 5; i++) seated(g, tx + 2 + i * 6, FLOOR_Y - 6, PEOPLE[i]);
    g.text(tx, FLOOR_Y - 4, '▀'.repeat(30), C.steel);
    g.put(tx + 1, FLOOR_Y - 3, '║', C.grey);
    g.put(tx + 28, FLOOR_Y - 3, '║', C.grey);
    const who = Math.floor(t / 2) % 5;
    chip(g, tx + 1 + who * 6, FLOOR_Y - 8, STEER_CHIPS[(who + Math.floor(t / 10)) % STEER_CHIPS.length]);
  }

  // Sprint demo, up in the BUILD zone between the pipes and the welder: demos happen while
  // the work is being built. The design on screen changes each revision, people react,
  // and the loop runs build, demo, feedback, refine.
  function drawDemo(g, t) {
    const x0 = 204, x1 = 249, top = 16, bottom = 26;
    g.box(x0, top, x1 - x0 + 1, bottom - top + 1, C.grey, 'round');
    g.fill(x0 + 1, top + 1, x1 - x0 - 1, bottom - top - 1, ' ', 0);
    g.text(x0 + 2, top, ' SPRINT DEMO ', C.steel);
    const sprint = 3 + Math.floor(t / (1.2 * LOOP.length));
    g.text(x1 - 11, top, ` sprint ${String(sprint).padStart(2, '0')} `, C.amberDim);

    // The screen, with the design changing each revision
    const sx = x0 + 2, sy = top + 1, sw = 19, sh = 7;
    const rev = Math.floor(t / 4) % 3;
    g.box(sx, sy, sw, sh, C.grey, 'round');
    g.text(sx + sw - 8, sy + sh - 1, ` rev ${rev + 1} `, C.cyan);
    const ix = sx + 2, iw = sw - 4;
    if (rev === 0) {
      g.box(ix, sy + 1, iw, sh - 2, C.cyanDim, 'light');
    } else {
      g.text(ix, sy + 1, '▀'.repeat(iw), C.cyan);
      const half = Math.floor((iw - 1) / 2);
      g.box(ix, sy + 2, half, sh - 3, C.cyanDim, 'light');
      g.box(ix + half + 1, sy + 2, iw - half - 1, sh - 3, C.cyanDim, 'light');
      if (rev === 2) g.text(ix + iw - 7, sy + sh - 3, '[ ok ]', C.green);
    }

    // Audience
    const ax = sx + sw + 3;
    for (let i = 0; i < 4; i++) standing(g, ax + i * 5, top + 4, PEOPLE[(i + 2) % PEOPLE.length]);
    const who = Math.floor(t / 1.6) % 4;
    chip(g, ax - 1 + who * 5, top + 2, DEMO_CHIPS[(who + Math.floor(t / 4)) % DEMO_CHIPS.length]);

    // The loop, with the current step lit, and its return path back to the start
    const step = Math.floor(t / 1.2) % LOOP.length;
    let x = sx;
    const ly = bottom - 2;
    LOOP.forEach((word, i) => {
      g.text(x, ly, word, i === step ? C.white : C.steel);
      x += word.length;
      if (i < LOOP.length - 1) {
        g.text(x, ly, ' → ', C.greyDark);
        x += 3;
      }
    });
    g.text(x, ly, ' ─╮', C.greyDark);
    const end = x + 2;
    g.text(sx, ly + 1, '▲' + '─'.repeat(end - sx - 1) + '╯', C.greyDark);
  }

  return { drawSteering, drawDemo };
}
