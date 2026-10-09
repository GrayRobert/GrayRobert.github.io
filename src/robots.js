// Robot generator. A robot is assembled from parts (antenna, head, body, legs, tool),
// so each role is a parameter set, not a drawing from scratch. Every robot fits a
// 13 column box and is positioned by the row its feet stand on.
//
// Part templates use placeholders filled in at draw time:
//   T antenna tip   E eye   M mouth   V visor   P chest lights   L label
// and a backtick for an opaque blank. Masks colour each cell:
//   b body  a accent  g grey  k grey dark  c cyan  y amber  G green  r red  w white

import { C } from './grid.js';

export const W = 13;

const ANTENNAS = {
  none: { rows: [] },
  tip: { rows: ['T', '┃'], mask: ['a', 'g'] },
  twin: { rows: ['T   T', '╲   ╱'], mask: ['a   a', 'g   g'] },
  dish: { rows: ['╰┬╯', ' ┃ '], mask: ['aaa', ' g '] },
};

const HEADS = {
  monitor: { rows: ['╔══╧══╗', '║`E`E`║', '║`MMM`║', '╚═╤═╤═╝'] },
  round: { rows: ['╭──┸──╮', '│`E`E`│', '│`MMM`│', '╰─┬─┬─╯'] },
  square: { rows: ['┌──┸──┐', '│`E`E`│', '│`MMM`│', '└─┬─┬─┘'] },
  dome: { rows: ['╭───┸───╮', '│``E`E``│', '│``MMM``│', '╰──┬─┬──╯'] },
  goggles: {
    rows: ['┌───┸───┐', '│(E)`(E)│', '│``MMM``│', '└──┬─┬──┘'],
    mask: ['bbbbbbbbb', 'bgbggbgbb', 'bbbbbbbbb', 'bbbbbbbbb'],
  },
  beret: {
    rows: ['▗▄▄▄▄▖ ', '╭─────╮', '│`E`E`│', '│`MMM`│', '╰─┬─┬─╯'],
    mask: ['aaaaaa ', 'bbbbbbb', 'bbbbbbb', 'bbbbbbb', 'bbbbbbb'],
  },
  hardhat: {
    rows: ['▗▄███▄▖', '╭─────╮', '│`E`E`│', '╰─┬─┬─╯'],
    mask: ['aaaaaaa', 'bbbbbbb', 'bbbbbbb', 'bbbbbbb'],
  },
  visor: { rows: ['┏━━┷━━┓', '┃VVVVV┃', '┃`MMM`┃', '┗━┯━┯━┛'] },
  mono: { rows: ['╭──┸──╮', '│``E``│', '│`MMM`│', '╰─┬─┬─╯'] },
  split: {
    rows: ['╭──┸──╮', '│`E`E`│', '│`MMM`│', '╰─┬─┬─╯'],
    mask: ['cccbyyy', 'cccbyyy', 'cccbyyy', 'cccbyyy'],
  },
};

// shoulder: row the arms hang from. feet: leg columns relative to the body's left edge.
const BODIES = {
  std: { rows: ['╭──┴─┴──╮', '┤`PPPPP`├', '│`LLLLL`│', '╰┬─────┬╯'], shoulder: 1, feet: [1, 7] },
  tall: {
    rows: ['╭───┴─┴───╮', '┤``PPPPP``├', '│````▼````│', '│``LLLLL``│', '╰┬───────┬╯'],
    mask: ['bbbbbbbbbbb', 'bbbbbbbbbbb', 'bbbbbabbbbb', 'bbbbbbbbbbb', 'bbbbbbbbbbb'],
    shoulder: 1,
    feet: [1, 9],
  },
  wide: { rows: ['╭───┴─┴───╮', '┤`PPPPPPP`├', '│``LLLLL``│', '╰┬───────┬╯'], shoulder: 1, feet: [1, 9] },
  slim: { rows: ['╭─┴─┴─╮', '┤`PPP`├', '│LLLLL│', '╰┬───┬╯'], shoulder: 1, feet: [1, 5] },
  stocky: { rows: ['╭──┴─┴──╮', '┤PPPPPPP├', '│`LLLLL`│', '╰───────╯'], shoulder: 1, feet: null },
  heavy: { rows: ['┏━━┷━┷━━┓', '┫`PPPPP`┣', '┃`LLLLL`┃', '┗┳━━━━━┳┛'], shoulder: 1, feet: [1, 7] },
};

const MOUTHS = { smile: '╰─╯', flat: '───', worry: '╭─╮', open: '╭▄╮', o: '`o`', off: '```' };

export function makeRobot({
  label = 'BOT',
  antenna = 'tip',
  head = 'round',
  body = 'std',
  legs = 'legs', // legs | treads | wheel
  tool = null,
  bodyColor = C.steel,
  accent = C.amber,
  eyeColor = C.cyan,
  eye = '◉',
} = {}) {
  const ant = ANTENNAS[antenna];
  const hd = HEADS[head];
  const bd = BODIES[body];
  const legRows = 2;

  // Stack the parts, each centred in the 13 column box.
  const parts = [];
  let row = 0;
  for (const p of [ant, hd, bd]) {
    const width = Math.max(0, ...p.rows.map((r) => r.length));
    parts.push({ p, top: row, x0: Math.floor((W - width) / 2), width });
    row += p.rows.length;
  }
  const bodyPart = parts[2];
  const height = row + legRows;

  const colorOf = (m) =>
    ({ b: bodyColor, a: accent, g: C.grey, k: C.greyDark, c: C.cyan, y: C.amber, G: C.green, r: C.red, w: C.white })[m] ??
    bodyColor;

  function draw(g, x, feetY, pose = {}) {
    const {
      walk = 'stand', look = 0, blink = false, mouth = 'smile', mood, chest = 0, tip = true,
      arm = 'down', swing = 0, asleep = false, visor = 0, roll = 0, highlight = false, t = 0,
    } = pose;
    const top = feetY - height + 1;
    const bc = highlight ? C.white : bodyColor;
    const col = (m) => (m === 'b' && highlight ? C.white : colorOf(m));

    for (const { p, top: pt, x0 } of parts) {
      p.rows.forEach((r, j) => {
        const y = top + pt + j;
        let lCount = 0;
        const lRun = (r.match(/L+/) ?? [''])[0].length;
        const text = label.slice(0, lRun);
        const lPad = Math.floor((lRun - text.length) / 2);
        for (let i = 0; i < r.length; i++) {
          const ch = r[i];
          const cx = x + x0 + i;
          const m = p.mask?.[j]?.[i] ?? 'b';
          if (ch === ' ') continue;
          if (ch === '`') { g.put(cx, y, 32, 0); continue; }
          if (ch === 'T') { g.put(cx, y, '•', tip && !asleep ? accent : C.greyDark); continue; }
          if (ch === 'E') {
            g.put(cx, y, 32, 0);
            const target = r[i + look];
            const ex = target === '`' || target === 'E' ? cx + look : cx;
            const glyph = asleep || blink ? '─' : mood === 'happy' ? '^' : eye;
            g.put(ex, y, glyph, asleep ? C.greyDark : eyeColor);
            continue;
          }
          if (ch === 'M') {
            const k = i - r.indexOf('M');
            const mtext = MOUTHS[asleep ? 'off' : mouth] ?? MOUTHS.smile;
            if (mtext[k] === '`') g.put(cx, y, 32, 0);
            else g.put(cx, y, mtext[k], accent);
            continue;
          }
          if (ch === 'V') {
            const k = i - r.indexOf('V');
            const sweep = ((Math.floor(visor) % 8) + 8) % 8; // ping-pong across the 5 visor cells
            const lit = !asleep && k === (sweep < 5 ? sweep : 8 - sweep);
            g.put(cx, y, '▀', lit ? C.red : asleep ? C.greyDark : C.redDim);
            continue;
          }
          if (ch === 'P') {
            const k = i - r.indexOf('P');
            const lit = (k + chest) % 5;
            g.put(cx, y, lit === 0 ? '▓' : lit === 1 ? '▒' : '░', asleep ? C.greyDark : lit === 0 ? C.green : C.greenDim);
            continue;
          }
          if (ch === 'L') {
            const k = lCount++ - lPad;
            const c = text[k];
            g.put(cx, y, c && c !== ' ' ? c : 32, asleep ? C.greyDark : accent);
            continue;
          }
          g.put(cx, y, ch, col(m));
        }
      });
    }

    // Arms hang from the shoulders, either side of the body.
    const sy = top + bodyPart.top + bd.shoulder;
    const lx = x + bodyPart.x0 - 1;
    const rx = x + bodyPart.x0 + bodyPart.width;
    const hand = asleep ? C.greyDark : accent;
    const leftLen = swing > 0 ? 1 : 2;
    g.put(lx, sy, '╭', bc);
    for (let i = 1; i < leftLen; i++) g.put(lx, sy + i, '│', bc);
    g.put(lx, sy + leftLen, '▪', hand);
    const lh = { x: lx, y: sy + leftLen };
    let rh;
    if (arm === 'up' || arm === 'wave') {
      g.put(rx, sy, '╯', bc);
      g.put(rx, sy - 1, '│', bc);
      const wobble = arm === 'wave' && Math.floor(t * 6) % 2 ? 1 : 0;
      g.put(rx + wobble, sy - 2, '▪', hand);
      rh = { x: rx + wobble, y: sy - 2 };
    } else if (arm === 'reach') {
      g.put(rx, sy, '─', bc);
      g.put(rx + 1, sy, '▪', hand);
      rh = { x: rx + 1, y: sy };
    } else {
      const rightLen = swing < 0 ? 1 : 2;
      g.put(rx, sy, '╮', bc);
      for (let i = 1; i < rightLen; i++) g.put(rx, sy + i, '│', bc);
      g.put(rx, sy + rightLen, '▪', hand);
      rh = { x: rx, y: sy + rightLen };
    }

    // Legs, treads or a wheel.
    const ly = top + height - 2;
    const grey = asleep ? C.greyDark : C.grey;
    if (legs === 'legs') {
      const a = x + bodyPart.x0 + bd.feet[0];
      const b = x + bodyPart.x0 + bd.feet[1];
      if (walk === 'stepA') {
        g.put(a, ly, '┃', grey);
        g.put(b, ly, '╲', grey);
        g.text(a - 1, ly + 1, '▀▀', C.greyDark);
        g.text(b + 1, ly + 1, '▀▀', C.greyDark);
      } else if (walk === 'stepB') {
        g.put(a, ly, '╱', grey);
        g.put(b, ly, '┃', grey);
        g.text(a - 2, ly + 1, '▀▀', C.greyDark);
        g.text(b, ly + 1, '▀▀', C.greyDark);
      } else {
        g.put(a, ly, '┃', grey);
        g.put(b, ly, '┃', grey);
        g.text(a - 1, ly + 1, '▀▀', C.greyDark);
        g.text(b, ly + 1, '▀▀', C.greyDark);
      }
    } else if (legs === 'treads') {
      const x0 = x + 1;
      const step = Math.floor(roll);
      g.put(x0, ly, '╭', grey);
      for (let i = 1; i < 10; i++) g.put(x0 + i, ly, (i + step) % 3 === 0 ? '╤' : '═', grey);
      g.put(x0 + 10, ly, '╮', grey);
      g.text(x0, ly + 1, '╰◉─◉─◉─◉─◉╯', grey);
    } else if (legs === 'wheel') {
      const c = x + Math.floor(W / 2);
      g.text(c - 3, ly, '╰──┬──╯', bc);
      g.put(c - 1, ly + 1, '(', grey);
      g.put(c, ly + 1, '│╱─╲'[((Math.floor(roll) % 4) + 4) % 4], C.steel);
      g.put(c + 1, ly + 1, ')', grey);
    }

    if (tool && TOOLS[tool]) TOOLS[tool](g, { lh, rh, t, asleep, accent, pose });

    return { x, y: top, w: W, h: height, lh, rh };
  }

  draw.height = height;
  return draw;
}

// Tools are drawn relative to a hand. Most go in the right hand.
const TOOLS = {
  clipboard(g, { rh, asleep }) {
    const c = asleep ? C.greyDark : C.amber;
    g.text(rh.x + 1, rh.y - 1, '┌┴┐', c);
    g.text(rh.x + 1, rh.y, '│≡│', c);
    g.text(rh.x + 1, rh.y + 1, '└─┘', c);
  },

  // A kanban board held up high. Cards move from TODO to DONE over time.
  kanban(g, { rh, t, asleep }) {
    const c = asleep ? C.greyDark : C.steel;
    const x0 = rh.x - 1;
    const y0 = rh.y - 4;
    g.text(x0, y0, '┌─┬─┬─┐', c);
    g.text(x0, y0 + 1, '│`│`│`│', c);
    g.text(x0, y0 + 2, '│`│`│`│', c);
    g.text(x0, y0 + 3, '└┬┴─┴─┘', c);
    if (asleep) return;
    const phase = ((Math.floor(t / 1.5) % 6) + 6) % 6 || 0; // always 0 to 5, even for odd values of t
    const cols = [[2, 1, 0], [1, 2, 0], [1, 1, 1], [0, 2, 1], [0, 1, 2], [1, 0, 2]][phase];
    const colors = [C.red, C.amber, C.green];
    cols.forEach((n, k) => {
      for (let i = 0; i < n; i++) g.put(x0 + 1 + k * 2, y0 + 1 + i, '▪', colors[k]);
    });
  },

  stylus(g, { rh, asleep }) {
    g.put(rh.x + 1, rh.y - 1, '╱', asleep ? C.greyDark : C.steel);
    g.put(rh.x + 2, rh.y - 2, '•', asleep ? C.greyDark : C.cyan);
  },

  palette(g, { rh, asleep }) {
    g.put(rh.x + 1, rh.y, '(', asleep ? C.greyDark : C.steel);
    [C.green, C.amber, C.cyan].forEach((c, i) => g.put(rh.x + 2 + i, rh.y, '•', asleep ? C.greyDark : c));
    g.put(rh.x + 5, rh.y, ')', asleep ? C.greyDark : C.steel);
  },

  bridge(g, { rh, asleep }) {
    g.put(rh.x + 1, rh.y, '↔', asleep ? C.greyDark : C.white);
  },

  magnifier(g, { rh, asleep }) {
    g.put(rh.x + 1, rh.y - 1, '╱', asleep ? C.greyDark : C.steel);
    g.put(rh.x + 2, rh.y - 2, '◯', asleep ? C.greyDark : C.cyan);
  },

  plug(g, { rh, asleep }) {
    g.put(rh.x + 1, rh.y, '╼', asleep ? C.greyDark : C.amber);
  },

  shield(g, { lh, asleep }) {
    const c = asleep ? C.greyDark : C.red;
    g.text(lh.x - 3, lh.y - 1, '▗▄▖', c);
    g.text(lh.x - 3, lh.y, '█`█', c);
    g.put(lh.x - 2, lh.y, '◈', asleep ? C.greyDark : C.cyan);
    g.text(lh.x - 3, lh.y + 1, '▝█▘', c);
  },
};
