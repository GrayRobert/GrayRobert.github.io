// Robot generator. Every role is a parameter set (head, antenna, accent, label, eyes),
// not a drawing from scratch. A robot is 11 columns by 12 rows, feet on the bottom row.

import { C } from './grid.js';

const HEADS = {
  round: { top: '╭──┸──╮', side: '│', bottom: '╰─┬─┬─╯' },
  square: { top: '┌──┸──┐', side: '│', bottom: '└─┬─┬─┘' },
  double: { top: '╔══╧══╗', side: '║', bottom: '╚═╤═╤═╝' },
};

const MOUTHS = { smile: '╰─╯', flat: '───', worry: '╭─╮', open: '╭▄╮', o: '`o`' };

const LEGS = {
  stand: ['  ┃     ┃  ', ' ▀▀     ▀▀ '],
  stepA: ['  ┃     ╲  ', ' ▀▀      ▀▀'],
  stepB: ['  ╱     ┃  ', '▀▀     ▀▀  '],
  squat: ['  ╲     ╱  ', ' ▀▀▀   ▀▀▀ '],
};

export const WIDTH = 11;
export const HEIGHT = 12;

export function makeRobot({
  label = 'BOT',
  head = 'round',
  antenna = 'tip',
  body = C.steel,
  accent = C.amber,
  eyeColor = C.cyan,
  eye = '◉',
} = {}) {
  const h = HEADS[head];
  const tag = label.slice(0, 5).padStart(Math.ceil((5 + label.length) / 2), '`').padEnd(5, '`');

  // pose: { legs, look (-1 left, 0 ahead, 1 right), blink, mouth, mood, chest (phase), tip (bool), wave, swing (-1, 0, 1) }
  return function drawRobot(g, x, y, pose = {}) {
    const { legs = 'stand', look = 0, blink = false, mouth = 'smile', mood, chest = 0, tip = true, wave = false, swing = 0 } = pose;

    // Antenna
    if (antenna === 'tip') {
      g.put(x + 5, y, '•', tip ? accent : C.amberDim);
      g.put(x + 5, y + 1, head === 'double' ? '│' : '┃', C.grey);
    } else if (antenna === 'twin') {
      g.put(x + 3, y, '•', tip ? accent : C.amberDim);
      g.put(x + 7, y, '•', tip ? C.amberDim : accent);
      g.text(x + 3, y + 1, '╲   ╱', C.grey);
    } else if (antenna === 'dish') {
      g.text(x + 4, y, '╰┬╯', tip ? accent : C.amberDim);
      g.put(x + 5, y + 1, '┃', C.grey);
    }

    // Head
    g.text(x + 2, y + 2, h.top, body);
    g.text(x + 2, y + 3, h.side + '`````' + h.side, body);
    g.text(x + 2, y + 4, h.side + '`````' + h.side, body);
    g.text(x + 2, y + 5, h.bottom, body);

    const ex = x + 4 + Math.max(-1, Math.min(1, look));
    const eyeGlyph = blink ? '─' : mood === 'happy' ? '^' : eye;
    g.put(ex, y + 3, eyeGlyph, eyeColor);
    g.put(ex + 2, y + 3, eyeGlyph, eyeColor);
    g.text(x + 4, y + 4, MOUTHS[mouth] ?? MOUTHS.smile, accent);

    // Body
    g.text(x + 1, y + 6, '╭──┴─┴──╮', body);
    g.text(x + 1, y + 7, '┤```````├', body);
    g.text(x + 1, y + 8, '│```````│', body);
    g.text(x + 1, y + 9, '╰┬─────┬╯', body);

    // Arms hang from the shoulders. `swing` lifts one hand at a time while walking.
    const leftLen = swing > 0 ? 1 : 2;
    const rightLen = swing < 0 ? 1 : 2;
    g.put(x, y + 7, '╭', body);
    for (let i = 1; i < leftLen; i++) g.put(x, y + 7 + i, '│', body);
    g.put(x, y + 7 + leftLen, '▪', accent);
    if (wave) {
      g.put(x + 10, y + 7, '╯', body);
      g.put(x + 10, y + 6, '│', body);
      g.put(x + 10, y + 5, '▪', accent);
    } else {
      g.put(x + 10, y + 7, '╮', body);
      for (let i = 1; i < rightLen; i++) g.put(x + 10, y + 7 + i, '│', body);
      g.put(x + 10, y + 7 + rightLen, '▪', accent);
    }

    // Chest status lights roll along, label underneath in the accent colour
    for (let i = 0; i < 5; i++) {
      const lit = (i + chest) % 5;
      g.put(x + 3 + i, y + 7, lit === 0 ? '▓' : lit === 1 ? '▒' : '░', lit === 0 ? C.green : C.greenDim);
    }
    g.text(x + 3, y + 8, tag, accent);

    // Legs
    const [l1, l2] = LEGS[legs] ?? LEGS.stand;
    g.text(x, y + 10, l1, C.grey);
    g.text(x, y + 11, l2, C.greyDark);
  };
}
