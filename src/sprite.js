// Sprites are arrays of strings plus an optional colour mask of the same shape.
// Spaces are transparent, a backtick is an opaque blank (so sprites can hide what is behind).

import { C } from './grid.js';

// Mask letters to palette colours. Sprites can add their own with `colors`.
const MASK = {
  g: C.green, d: C.greenDim, k: C.greenDark,
  a: C.amber, A: C.amberDim,
  c: C.cyan, C: C.cyanDim,
  r: C.red, R: C.redDim,
  m: C.grey, M: C.greyDark,
  s: C.steel, w: C.white,
};

const MIRROR = {
  '/': '\\', '\\': '/', '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<',
  '╭': '╮', '╮': '╭', '╰': '╯', '╯': '╰', '┌': '┐', '┐': '┌', '└': '┘', '┘': '└',
  '╔': '╗', '╗': '╔', '╚': '╝', '╝': '╚', '├': '┤', '┤': '├', '╠': '╣', '╣': '╠',
  '╱': '╲', '╲': '╱', '▌': '▐', '▐': '▌', '▘': '▝', '▝': '▘', '▖': '▗', '▗': '▖',
  '╶': '╴', '╴': '╶', '◀': '▶', '▶': '◀', '┠': '┨', '┨': '┠',
};

export function defineSprite({ frames, color = C.green, colors = {}, anchor = [0, 0] }) {
  const palette = { ...MASK, ...colors };
  const compiled = frames.map((f) => {
    const art = Array.isArray(f) ? f : f.art;
    const mask = Array.isArray(f) ? null : f.mask;
    const width = Math.max(...art.map((r) => r.length));
    const cells = [];
    art.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === ' ') continue;
        const m = mask?.[y]?.[x];
        const col = m && m !== ' ' ? palette[m] ?? color : color;
        cells.push({ x, y, ch: ch === '`' ? 32 : ch.charCodeAt(0), mch: ch === '`' ? 32 : (MIRROR[ch] ?? ch).charCodeAt(0), col });
      }
    });
    return { cells, width, height: art.length };
  });
  return { frames: compiled, anchor };
}

export function drawSprite(g, sprite, frame, x, y, { flip = false, tint } = {}) {
  const f = sprite.frames[frame % sprite.frames.length];
  const ox = x - sprite.anchor[0];
  const oy = y - sprite.anchor[1];
  for (const c of f.cells) {
    const cx = flip ? ox + f.width - 1 - c.x : ox + c.x;
    g.put(cx, oy + c.y, flip ? c.mch : c.ch, tint ?? c.col);
  }
}
