// A Star Trek style transporter shimmer, applied to a box of cells after a robot has
// been drawn into a grid. solid: 1 is the robot fully there, 0 fully dissolved into
// sparkle. sparkle: how dense the twinkling column is (0 to 1). Pure text: dissolved
// cells become braille dots, so the sparkle stays on the character grid.

import { C } from './grid.js';

const BRAILLE = 0x2800;
const TWINKLE = [C.white, C.amber, C.amberDim, C.white, C.cyanDim];

export function shimmer(g, box, solid, sparkle, t, seed = 0) {
  const frame = Math.floor(t * 24);
  for (let j = 0; j < box.h; j++) {
    for (let i = 0; i < box.w; i++) {
      const cx = box.x + i - Math.round(g.cam.x);
      const cy = box.y + j - Math.round(g.cam.y);
      if (cx < 0 || cy < 0 || cx >= g.cols || cy >= g.rows) continue;
      const idx = cy * g.cols + cx;
      const code = g.ch[idx];
      const figure = code !== 0 && code !== 32;
      // Each cell has its own moment to dissolve, so the figure breaks up unevenly.
      const threshold = rand(cx * 7919 + cy * 104729 + seed);
      const twinkle = rand(cx * 31 + cy * 977 + frame * 131 + seed);
      if (figure && threshold > solid) {
        g.ch[idx] = BRAILLE | (Math.floor(twinkle * 255) + 1);
        g.fg[idx] = TWINKLE[Math.floor(twinkle * TWINKLE.length)];
      } else if (!figure && twinkle < sparkle * 0.35) {
        // the column of sparkle around the figure
        g.ch[idx] = BRAILLE | (1 << Math.floor(rand(idx + frame) * 8));
        g.fg[idx] = TWINKLE[(idx + frame) % TWINKLE.length];
      }
    }
  }
}

// Beaming out: hold, dissolve, then the sparkle fades. p runs 0 to 1.
export function beamOut(p) {
  return {
    solid: p < 0.25 ? 1 : Math.max(0, 1 - (p - 0.25) / 0.5),
    sparkle: p < 0.85 ? Math.min(1, p * 3) : Math.max(0, (1 - p) / 0.15),
  };
}

// Beaming in is the same, backwards.
export function beamIn(p) {
  return beamOut(1 - p);
}

function rand(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  return ((n ^ (n >>> 15)) >>> 0) / 4294967296;
}
