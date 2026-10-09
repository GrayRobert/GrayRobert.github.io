// Paints the cell buffer onto a canvas. Each (glyph, colour) pair is rasterised once into
// an atlas, then cells are blitted with drawImage. Only cells that changed get repainted.
// Glow comes from downscaled copies of the canvas blurred by CSS, which is cheap on the GPU.

import { PALETTE } from './grid.js';
import { drawProcedural } from './glyphs.js';

export const FONT = 'JetBrains Mono';
const CELL_RATIO = 1.9; // cell height / cell width
const ADVANCE = 0.6; // JetBrains Mono advance width in em

export function createRenderer(stage, grid) {
  const main = document.createElement('canvas');
  const glowNear = document.createElement('canvas');
  const glowFar = document.createElement('canvas');
  main.className = 'layer main';
  glowNear.className = 'layer glow near';
  glowFar.className = 'layer glow far';
  stage.append(glowFar, glowNear, main);

  const ctx = main.getContext('2d');
  const nearCtx = glowNear.getContext('2d');
  const farCtx = glowFar.getContext('2d');

  const n = grid.cols * grid.rows;
  const prevCh = new Uint16Array(n);
  const prevFg = new Uint8Array(n);

  let cw = 0, chH = 0; // cell size in device pixels
  let atlas, actx, slots, nextSlot, atlasCols;
  let glowOn = true;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const availW = stage.clientWidth * dpr;
    const availH = stage.clientHeight * dpr;
    cw = Math.max(2, Math.floor(Math.min(availW / grid.cols, availH / (grid.rows * CELL_RATIO))));
    chH = Math.round(cw * CELL_RATIO);

    main.width = grid.cols * cw;
    main.height = grid.rows * chH;
    const cssW = main.width / dpr;
    const cssH = main.height / dpr;
    for (const c of [main, glowNear, glowFar]) {
      c.style.width = cssW + 'px';
      c.style.height = cssH + 'px';
    }
    glowNear.width = Math.ceil(main.width / 3);
    glowNear.height = Math.ceil(main.height / 3);
    glowFar.width = Math.ceil(main.width / 8);
    glowFar.height = Math.ceil(main.height / 8);
    stage.style.setProperty('--cell-css', cw / dpr + 'px');

    // Fresh atlas for the new cell size.
    atlasCols = 64;
    atlas = document.createElement('canvas');
    atlas.width = atlasCols * cw;
    atlas.height = 64 * chH;
    actx = atlas.getContext('2d');
    slots = new Map();
    nextSlot = 0;

    prevCh.fill(0xffff); // force a full repaint
    ctx.clearRect(0, 0, main.width, main.height);
  }

  function slotFor(code, col) {
    const key = code * 32 + col;
    let s = slots.get(key);
    if (s !== undefined) return s;
    s = nextSlot++;
    if (s >= atlasCols * (atlas.height / chH)) {
      // Atlas full: grow it. Rare, so a simple copy is fine.
      const bigger = document.createElement('canvas');
      bigger.width = atlas.width;
      bigger.height = atlas.height * 2;
      bigger.getContext('2d').drawImage(atlas, 0, 0);
      atlas = bigger;
      actx = atlas.getContext('2d');
    }
    const x = (s % atlasCols) * cw;
    const y = Math.floor(s / atlasCols) * chH;
    actx.save();
    actx.beginPath();
    actx.rect(x, y, cw, chH);
    actx.clip();
    actx.fillStyle = PALETTE[col];
    if (!drawProcedural(actx, code, x, y, cw, chH)) {
      actx.font = `${cw / ADVANCE}px "${FONT}"`;
      actx.textBaseline = 'middle';
      actx.textAlign = 'center';
      actx.fillText(String.fromCharCode(code), x + cw / 2, y + chH * 0.54);
    }
    actx.restore();
    slots.set(key, s);
    return s;
  }

  function paint() {
    const { ch, fg, cols } = grid;
    let changed = 0;
    for (let i = 0; i < n; i++) {
      const c = ch[i];
      const f = fg[i];
      if (c === prevCh[i] && f === prevFg[i]) continue;
      prevCh[i] = c;
      prevFg[i] = f;
      changed++;
      const x = (i % cols) * cw;
      const y = ((i / cols) | 0) * chH;
      ctx.clearRect(x, y, cw, chH);
      if (c === 0 || c === 32) continue;
      const s = slotFor(c, f);
      ctx.drawImage(atlas, (s % atlasCols) * cw, ((s / atlasCols) | 0) * chH, cw, chH, x, y, cw, chH);
    }
    if (changed && glowOn) {
      nearCtx.clearRect(0, 0, glowNear.width, glowNear.height);
      nearCtx.drawImage(main, 0, 0, glowNear.width, glowNear.height);
      farCtx.clearRect(0, 0, glowFar.width, glowFar.height);
      farCtx.drawImage(glowNear, 0, 0, glowFar.width, glowFar.height);
    }
    return changed;
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    paint,
    resize,
    get cell() { return { w: cw, h: chH }; },
    // Grid cell under a point on screen, or null outside the canvas.
    cellAt(clientX, clientY) {
      const r = main.getBoundingClientRect();
      const cx = Math.floor(((clientX - r.left) / r.width) * grid.cols);
      const cy = Math.floor(((clientY - r.top) / r.height) * grid.rows);
      return cx < 0 || cy < 0 || cx >= grid.cols || cy >= grid.rows ? null : { x: cx, y: cy };
    },
    get atlasSize() { return slots.size; },
    setGlow(on) {
      glowOn = on;
      glowNear.hidden = glowFar.hidden = !on;
    },
  };
}
