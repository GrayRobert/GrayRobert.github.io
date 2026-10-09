// Procedural glyphs. Box drawing, blocks, shades and braille are drawn as rectangles
// instead of font glyphs, so lines join seamlessly at any cell size and in every browser.
// Returns true if the glyph was handled.

// Box drawing arms: [up, right, down, left], weight 0 none, 1 light, 2 heavy, 3 double.
const ARMS = {};
const def = (chars, arms) => [...chars].forEach((c, i) => (ARMS[c] = arms[i]));
def('─│┌┐└┘├┤┬┴┼', [
  [0, 1, 0, 1], [1, 0, 1, 0], [0, 1, 1, 0], [0, 0, 1, 1], [1, 1, 0, 0], [1, 0, 0, 1],
  [1, 1, 1, 0], [1, 0, 1, 1], [0, 1, 1, 1], [1, 1, 0, 1], [1, 1, 1, 1],
]);
def('━┃┏┓┗┛┣┫┳┻╋', [
  [0, 2, 0, 2], [2, 0, 2, 0], [0, 2, 2, 0], [0, 0, 2, 2], [2, 2, 0, 0], [2, 0, 0, 2],
  [2, 2, 2, 0], [2, 0, 2, 2], [0, 2, 2, 2], [2, 2, 0, 2], [2, 2, 2, 2],
]);
def('═║╔╗╚╝╠╣╦╩╬', [
  [0, 3, 0, 3], [3, 0, 3, 0], [0, 3, 3, 0], [0, 0, 3, 3], [3, 3, 0, 0], [3, 0, 0, 3],
  [3, 3, 3, 0], [3, 0, 3, 3], [0, 3, 3, 3], [3, 3, 0, 3], [3, 3, 3, 3],
]);
// Mixed weights and half lines.
def('┸┰┠┨┯┷┿╂', [
  [2, 1, 0, 1], [0, 1, 2, 1], [2, 1, 2, 0], [2, 0, 2, 1],
  [0, 2, 1, 2], [1, 2, 0, 2], [1, 2, 1, 2], [2, 1, 2, 1],
]);
def('╴╵╶╷╸╹╺╻', [
  [0, 0, 0, 1], [1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0],
  [0, 0, 0, 2], [2, 0, 0, 0], [0, 2, 0, 0], [0, 0, 2, 0],
]);
def('╞╡╥╨╪╫╤╧', [
  [1, 3, 1, 0], [1, 0, 1, 3], [0, 1, 3, 1], [3, 1, 0, 1], [1, 3, 1, 3], [3, 1, 3, 1],
  [0, 3, 1, 3], [1, 3, 0, 3],
]);

const ROUND = { '╭': [0, 1, 1, 0], '╮': [0, 0, 1, 1], '╯': [1, 0, 0, 1], '╰': [1, 1, 0, 0] };

// Block elements as fractions of the cell: [x, y, w, h]
const BLOCKS = {
  '█': [[0, 0, 1, 1]],
  '▀': [[0, 0, 1, 0.5]],
  '▄': [[0, 0.5, 1, 0.5]],
  '▌': [[0, 0, 0.5, 1]],
  '▐': [[0.5, 0, 0.5, 1]],
  '▔': [[0, 0, 1, 0.125]],
  '▁': [[0, 0.875, 1, 0.125]],
  '▂': [[0, 0.75, 1, 0.25]],
  '▃': [[0, 0.625, 1, 0.375]],
  '▅': [[0, 0.375, 1, 0.625]],
  '▆': [[0, 0.25, 1, 0.75]],
  '▇': [[0, 0.125, 1, 0.875]],
  '▘': [[0, 0, 0.5, 0.5]],
  '▝': [[0.5, 0, 0.5, 0.5]],
  '▖': [[0, 0.5, 0.5, 0.5]],
  '▗': [[0.5, 0.5, 0.5, 0.5]],
  '▚': [[0, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]],
  '▞': [[0.5, 0, 0.5, 0.5], [0, 0.5, 0.5, 0.5]],
  '▙': [[0, 0, 0.5, 1], [0.5, 0.5, 0.5, 0.5]],
  '▟': [[0.5, 0, 0.5, 1], [0, 0.5, 0.5, 0.5]],
  '▛': [[0, 0, 1, 0.5], [0, 0.5, 0.5, 0.5]],
  '▜': [[0, 0, 1, 0.5], [0.5, 0.5, 0.5, 0.5]],
};

// Shades as a stipple of tiny squares, so they still read as texture, not a flat fill.
const SHADES = { '░': [4, 0.28], '▒': [3, 0.42], '▓': [2, 0.62] };

export function drawProcedural(ctx, code, x, y, w, h) {
  const c = String.fromCharCode(code);

  if (code >= 0x2800 && code <= 0x28ff) {
    drawBraille(ctx, code - 0x2800, x, y, w, h);
    return true;
  }

  const t = Math.max(1, Math.round(w * 0.13)); // light line thickness
  const cx = x + Math.floor((w - t) / 2);
  const cy = y + Math.floor((h - t) / 2);

  const arms = ARMS[c];
  if (arms) {
    drawArms(ctx, arms, x, y, w, h, t, cx, cy);
    return true;
  }

  const round = ROUND[c];
  if (round) {
    const r = Math.min(w, h) / 2;
    const mx = cx + t / 2;
    const my = cy + t / 2;
    ctx.lineWidth = t;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    const [, right, down] = round;
    const ex = right ? x + w : x;
    const ey = down ? y + h : y;
    ctx.moveTo(ex, my);
    ctx.arcTo(mx, my, mx, ey, r * 0.9);
    ctx.lineTo(mx, ey);
    ctx.stroke();
    return true;
  }

  const blocks = BLOCKS[c];
  if (blocks) {
    for (const [bx, by, bw, bh] of blocks) {
      const x0 = Math.round(x + bx * w);
      const y0 = Math.round(y + by * h);
      ctx.fillRect(x0, y0, Math.round(x + (bx + bw) * w) - x0, Math.round(y + (by + bh) * h) - y0);
    }
    return true;
  }

  const shade = SHADES[c];
  if (shade) {
    const [div, alpha] = shade;
    const sw = w / div;
    const sh = h / (div * 2);
    const dot = Math.max(1, Math.round(Math.min(sw, sh) * 0.7));
    ctx.globalAlpha = Math.min(1, alpha * 1.6);
    for (let j = 0; j < div * 2; j++) {
      for (let i = 0; i < div; i++) {
        if ((i + j) % 2) continue;
        ctx.fillRect(Math.round(x + i * sw), Math.round(y + j * sh), dot, dot);
      }
    }
    ctx.globalAlpha = 1;
    return true;
  }

  if (c === '╱' || c === '╲' || c === '╳') {
    ctx.lineWidth = t;
    ctx.strokeStyle = ctx.fillStyle;
    ctx.beginPath();
    if (c !== '╲') { ctx.moveTo(x, y + h); ctx.lineTo(x + w, y); }
    if (c !== '╱') { ctx.moveTo(x, y); ctx.lineTo(x + w, y + h); }
    ctx.stroke();
    return true;
  }

  return false;
}

function drawArms(ctx, [up, right, down, left], x, y, w, h, t, cx, cy) {
  const g = Math.max(t, Math.round(w * 0.17)); // gap between double lines
  const thick = (wt) => (wt === 2 ? t * 2 : t);
  const off = (wt) => (wt === 2 ? Math.floor(t / 2) : 0);

  // Single and heavy arms run from the cell centre to the edge.
  if (up === 1 || up === 2) ctx.fillRect(cx - off(up), y, thick(up), cy - y + thick(up));
  if (down === 1 || down === 2) ctx.fillRect(cx - off(down), cy, thick(down), y + h - cy);
  if (left === 1 || left === 2) ctx.fillRect(x, cy - off(left), cx - x + thick(left), thick(left));
  if (right === 1 || right === 2) ctx.fillRect(cx, cy - off(right), x + w - cx, thick(right));

  // Double arms are two parallel lines. A line on the same side as a double
  // perpendicular arm stops short (inner corner), a line on the far side reaches
  // past the centre (outer corner). That gives clean corners, tees and crossings.
  const reach = (near, far) => (near === 3 ? g : far === 3 ? -g : 0);
  for (const side of [-1, 1]) {
    const r = side < 0 ? reach(up, down) : reach(down, up);
    const yy = cy + side * g;
    if (right === 3) ctx.fillRect(cx + r, yy, x + w - cx - r, t);
    if (left === 3) ctx.fillRect(x, yy, cx - r + t - x, t);

    const rv = side < 0 ? reach(left, right) : reach(right, left);
    const xx = cx + side * g;
    if (down === 3) ctx.fillRect(xx, cy + rv, t, y + h - cy - rv);
    if (up === 3) ctx.fillRect(xx, y, t, cy - rv + t - y);
  }
}

function drawBraille(ctx, bits, x, y, w, h) {
  const d = Math.max(1, Math.round(w * 0.3));
  for (let row = 0; row < 4; row++) {
    for (let col = 0; col < 2; col++) {
      const bit = row < 3 ? (col ? 0x08 : 0x01) << row : col ? 0x80 : 0x40;
      if (!(bits & bit)) continue;
      const px = x + Math.round(((col + 0.5) / 2) * w - d / 2);
      const py = y + Math.round(((row + 0.5) / 4) * h - d / 2);
      ctx.fillRect(px, py, d, d);
    }
  }
}
