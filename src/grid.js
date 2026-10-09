// The cell buffer. Everything on screen is a character and a palette colour in this grid.
// Scenes draw into it each frame, the renderer paints only what changed.

export const COLS = 180;
export const ROWS = 54;

// One small fixed palette so the whole scene feels like one world.
export const PALETTE = [
  '#000000', // 0 unused (empty cell)
  '#33ff66', // 1 green, the main ink
  '#1f9e45', // 2 green dim
  '#0f5a2a', // 3 green dark
  '#ffb000', // 4 amber
  '#8a5f00', // 5 amber dim
  '#4de1ff', // 6 cyan
  '#23798c', // 7 cyan dim
  '#ff5566', // 8 red
  '#4f6660', // 9 machine grey-green
  '#25342f', // 10 machine dark
  '#eafff0', // 11 hot white
  '#8fa39b', // 12 steel
  '#7a2a35', // 13 red dim
];

export const C = {
  green: 1, greenDim: 2, greenDark: 3,
  amber: 4, amberDim: 5,
  cyan: 6, cyanDim: 7,
  red: 8, redDim: 13,
  grey: 9, greyDark: 10,
  white: 11, steel: 12,
};

const BRAILLE = 0x2800;
// Braille dot bit for sub-cell position (col 0..1, row 0..3).
const DOT_BITS = [
  [0x01, 0x08],
  [0x02, 0x10],
  [0x04, 0x20],
  [0x40, 0x80],
];

export function createGrid(cols = COLS, rows = ROWS) {
  const ch = new Uint16Array(cols * rows);
  const fg = new Uint8Array(cols * rows);
  const cam = { x: 0, y: 0 };
  // When set, every draw uses this colour instead. Used to draw things unlit or highlighted.
  const paint = { override: 0 };

  function put(x, y, code, col) {
    x = Math.round(x - cam.x);
    y = Math.round(y - cam.y);
    if (x < 0 || y < 0 || x >= cols || y >= rows) return;
    const i = y * cols + x;
    ch[i] = code;
    fg[i] = paint.override || col;
  }

  return {
    cols, rows, ch, fg, cam,

    // Runs draw() with every colour replaced by col (0 means no change).
    tinted(col, draw) {
      const prev = paint.override;
      paint.override = col || prev;
      draw();
      paint.override = prev;
    },

    clear() {
      ch.fill(0);
      fg.fill(0);
    },

    put(x, y, c, col) {
      put(x, y, typeof c === 'string' ? c.charCodeAt(0) : c, col);
    },

    // Code 0 is an empty, transparent cell. Code 32 is an opaque blank: it draws nothing
    // but still hides what is behind it. In text, spaces are transparent and a
    // backtick is an opaque blank.
    text(x, y, str, col) {
      for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        if (code === 32) continue;
        put(x + i, y, code === 96 ? 32 : code, col);
      }
    },

    fill(x, y, w, h, c, col) {
      const code = c.charCodeAt(0);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, code, col);
    },

    // Make cells empty again (transparent, and free for braille dots).
    erase(x, y, w, h) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, 0, 0);
    },

    box(x, y, w, h, col, style = 'light') {
      const s = BOX_STYLES[style];
      this.put(x, y, s[0], col);
      this.put(x + w - 1, y, s[1], col);
      this.put(x, y + h - 1, s[2], col);
      this.put(x + w - 1, y + h - 1, s[3], col);
      for (let i = 1; i < w - 1; i++) {
        this.put(x + i, y, s[4], col);
        this.put(x + i, y + h - 1, s[4], col);
      }
      for (let j = 1; j < h - 1; j++) {
        this.put(x, y + j, s[5], col);
        this.put(x + w - 1, y + j, s[5], col);
      }
    },

    // A single braille dot at sub-cell resolution (2 x 4 dots per cell).
    // Dots in the same cell merge, so particles move smoothly while staying pure text.
    // A scanner beam: recolours whatever is already in the cell, or draws c if it is empty.
    // That way a beam sweeps across text without erasing it.
    scan(x, y, c, col) {
      x = Math.round(x - cam.x);
      y = Math.round(y - cam.y);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const i = y * cols + x;
      if (ch[i] === 0) ch[i] = c.charCodeAt(0);
      fg[i] = paint.override || col;
    },

    dot(px, py, col) {
      const sx = Math.floor(px * 2);
      const sy = Math.floor(py * 4);
      const x = Math.floor(sx / 2) - Math.round(cam.x);
      const y = Math.floor(sy / 4) - Math.round(cam.y);
      if (x < 0 || y < 0 || x >= cols || y >= rows) return;
      const i = y * cols + x;
      const bit = DOT_BITS[sy & 3][sx & 1];
      const cur = ch[i];
      if (cur !== 0 && !(cur >= BRAILLE && cur < BRAILLE + 256)) return; // particles pass behind real glyphs
      ch[i] = cur ? cur | bit : BRAILLE | bit;
      fg[i] = paint.override || col;
    },
  };
}

const BOX_STYLES = {
  light: '┌┐└┘─│',
  round: '╭╮╰╯─│',
  heavy: '┏┓┗┛━┃',
  double: '╔╗╚╝═║',
};
