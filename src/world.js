// Phase 0 world: one conveyor line, a welder, a QA arch, background machinery,
// steam and sparks, and the CTO robot patrolling the floor.

import { C } from './grid.js';
import { bigText, bigTextWidth } from './bigtext.js';
import { makeRobot, HEIGHT as ROBOT_H } from './robots.js';

export const FLOOR_Y = 50;
const BELT_Y = 35; // belt surface row, packages sit on the three rows above. Crew walks underneath.
const BELT_X0 = 3;
const BELT_X1 = 176;
const SPEED = 7; // cells per second
const WELDER_X = 74;
const QA_X0 = 114;
const QA_X1 = 132;

const STAGES = [
  { label: '{ idea }', col: C.amber },
  { label: '</> code', col: C.green },
  { label: '✓ tested', col: C.cyan },
];

const QUIPS = [
  { text: 'all green.', mouth: 'smile', mood: 'happy' },
  { text: 'hmm. one odd log line.', mouth: 'worry' },
  { text: 'ship it.', mouth: 'smile', mood: 'happy' },
  { text: 'who touched prod?', mouth: 'o' },
  { text: 'keep it simple.', mouth: 'smile' },
  { text: 'checking. again.', mouth: 'flat' },
];

const LOG_LINES = [
  ['build 4521 .......... ok', C.greenDim], ['tests 812/812 ....... pass', C.greenDim],
  ['deploy eu-west ...... ok', C.greenDim], ['p95 latency 182ms', C.greenDim],
  ['WARN heap 81% api-2', C.amber], ['gc pause 40ms', C.greenDim],
  ['cert renew .......... ok', C.greenDim], ['backup nightly ...... ok', C.greenDim],
  ['cache hit 97.2%', C.greenDim], ['scan deps ........... clean', C.cyanDim],
  ['blocked 203.0.113.7', C.red], ['queue depth 3', C.greenDim],
];

export function createWorld(seed = 7) {
  const rnd = mulberry32(seed);
  const cto = makeRobot({ label: 'CTO', head: 'double', antenna: 'tip', accent: C.amber });

  let beltDist = 0;
  let beltStep = 0;
  let nextSpawn = 4;
  let deployed = 0;
  let logOffset = 0;
  let logTimer = 0;
  let steamTimer = 0;
  let welding = false;
  let weldDrop = 0; // 0 torch raised, 1 torch down
  let shipFlash = 0;
  const packages = [];
  const steam = [];
  const sparks = [];

  const bot = {
    x: 30, from: 30, to: 30, t0: 0, dur: 0, state: 'look', until: 1.2, quip: null, quipT: 0, dir: 1,
  };

  function update(t, dt) {
    // Belt moves in whole cell steps so packages and cleats stay locked together.
    beltDist += SPEED * dt;
    beltStep = Math.floor(beltDist);

    if (beltStep >= nextSpawn) {
      packages.push({ start: beltStep, stage: 0 });
      nextSpawn = beltStep + 24 + Math.floor(rnd() * 10);
    }

    welding = false;
    for (let i = packages.length - 1; i >= 0; i--) {
      const p = packages[i];
      const x = pkgX(p);
      const w = pkgW(p);
      const mid = x + w / 2;
      if (p.stage === 0 && x <= WELDER_X && x + w > WELDER_X) welding = true;
      if (p.stage === 0 && mid > WELDER_X + 2) p.stage = 1;
      if (p.stage === 1 && mid > (QA_X0 + QA_X1) / 2 + 3) p.stage = 2;
      if (x > BELT_X1 - 8) {
        packages.splice(i, 1);
        deployed++;
        shipFlash = 0.6;
      }
    }
    shipFlash = Math.max(0, shipFlash - dt);

    // Torch drops when there is work under it, with a little ease.
    weldDrop += ((welding ? 1 : 0) - weldDrop) * Math.min(1, dt * 10);
    if (welding && weldDrop > 0.8) {
      const n = rnd() < 0.5 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        sparks.push({
          x: WELDER_X + 0.5, y: BELT_Y - 3.2,
          vx: (rnd() - 0.5) * 28, vy: -6 - rnd() * 14, age: 0, life: 0.35 + rnd() * 0.5,
        });
      }
    }

    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.age += dt;
      s.vy += 46 * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y > BELT_Y - 0.1 && s.vy > 0) { s.vy *= -0.35; s.vx *= 0.6; s.y = BELT_Y - 0.1; }
      if (s.age > s.life) sparks.splice(i, 1);
    }

    // Steam vents puff in bursts.
    steamTimer -= dt;
    if (steamTimer <= 0) {
      steamTimer = 0.06;
      for (const vx of [24, 156]) {
        if (Math.sin(t * 0.9 + vx) > 0.2) {
          steam.push({ x: vx + rnd() * 2, y: 30, vx: (rnd() - 0.5) * 2.5, vy: -2 - rnd() * 2, age: 0, life: 3 + rnd() * 2.5, seed: rnd() * 6 });
        }
      }
    }
    for (let i = steam.length - 1; i >= 0; i--) {
      const s = steam[i];
      s.age += dt;
      s.x += (s.vx + Math.sin(t * 1.3 + s.seed) * 1.2) * dt;
      s.y += s.vy * dt;
      s.vy *= 1 - dt * 0.3;
      if (s.age > s.life) steam.splice(i, 1);
    }

    logTimer += dt;
    if (logTimer > 0.7) { logTimer = 0; logOffset++; }

    updateBot(t);
  }

  function updateBot(t) {
    const b = bot;
    if (b.state === 'walk') {
      const p = Math.min(1, (t - b.t0) / b.dur);
      b.x = b.from + (b.to - b.from) * easeInOutSine(p);
      if (p >= 1) {
        b.state = 'look';
        b.until = t + 2.8;
        b.quip = QUIPS[Math.floor(rnd() * QUIPS.length)];
        b.quipT = t + 0.35; // a beat of anticipation before speaking
      }
    } else if (t > b.until) {
      let to;
      do to = 14 + Math.floor(rnd() * 130); while (Math.abs(to - b.x) < 24);
      b.from = b.x;
      b.to = to;
      b.dir = Math.sign(to - b.x);
      b.t0 = t;
      b.dur = Math.abs(to - b.x) / 11 + 0.8;
      b.state = 'walk';
      b.quip = null;
    }
  }

  function draw(g, t) {
    drawBackdrop(g);
    for (const s of steam) {
      const k = s.age / s.life;
      g.put(s.x, s.y, k < 0.12 ? '▓' : k < 0.35 ? '▒' : k < 0.75 ? '░' : '·', k < 0.4 ? C.grey : C.greyDark);
    }
    drawSign(g, t);
    drawMonitors(g, t);
    drawCatwalk(g);
    drawBelt(g);
    for (const p of packages) drawPackage(g, p, t);
    drawWelder(g, t);
    drawQA(g, t);
    drawHousings(g, t);
    for (const s of sparks) {
      const k = s.age / s.life;
      g.dot(s.x, s.y, k < 0.2 ? C.white : k < 0.6 ? C.amber : C.amberDim);
    }
    drawBot(g, t);
    drawFloor(g, t);
  }

  function drawBackdrop(g) {
    // Roof truss
    g.text(0, 0, '═'.repeat(180), C.greyDark);
    for (let x = 0; x < 180; x++) g.put(x, 1, x % 2 ? '╱' : '╲', C.greyDark);
    g.text(0, 2, '═'.repeat(180), C.greyDark);

    // Pipes along the back wall with valves and vents
    g.text(0, 31, '═'.repeat(42), C.greyDark);
    g.text(138, 31, '═'.repeat(42), C.greyDark);
    for (const x of [10, 24, 156, 170]) {
      g.put(x, 31, '╦', C.greyDark);
      for (let y = 32; y < FLOOR_Y; y++) g.put(x, y, '║', C.greyDark);
    }
    g.put(24, 31, '╬', C.grey);
    g.put(156, 31, '╬', C.grey);

    // Wall rivets give the dark something to sit on
    for (let y = 5; y < 30; y += 6) {
      for (let x = 3 + (y % 12 ? 0 : 6); x < 178; x += 12) g.put(x, y, '·', C.greyDark);
    }
  }

  function drawSign(g, t) {
    const title = 'ROBERT GRAY';
    const w = bigTextWidth(title);
    const x0 = Math.floor((180 - w) / 2);
    const bx = x0 - 6;
    const bw = w + 12;
    const by = 5;
    const bh = 11;

    // Hangers from the truss
    for (let y = 3; y < by; y++) {
      g.put(bx + 4, y, '│', C.greyDark);
      g.put(bx + bw - 5, y, '│', C.greyDark);
    }

    // Marquee bulbs chase around the frame
    let i = 0;
    const step = Math.floor(t * 9);
    const bulb = (x, y) => {
      g.put(x, y, '•', (i++ + step) % 3 === 0 ? C.amber : C.amberDim);
    };
    for (let x = bx; x < bx + bw; x += 2) bulb(x, by);
    for (let y = by + 1; y < by + bh - 1; y++) bulb(bx + bw - 1, y);
    for (let x = bx + bw - 1; x >= bx; x -= 2) bulb(x, by + bh - 1);
    for (let y = by + bh - 2; y > by; y--) bulb(bx, y);

    // Neon letters, with the odd letter flickering like an old tube
    const flick = Math.floor(t * 20);
    const bad = hash(Math.floor(t * 0.5)) % title.length;
    bigText(g, x0, by + 3, title, C.green, {
      colorAt: (k) => (k === bad && hash(flick) % 7 === 0 ? C.greenDark : C.green),
    });
    const sub = 'CTO   ·   TOPFLIGHT   ·   THE DARK FACTORY';
    g.text(Math.floor((180 - sub.length) / 2), by + 7, sub, C.amber);
  }

  function drawMonitors(g, t) {
    // Left: scrolling ops log
    const lx = 4, ly = 17, lw = 38, lh = 10;
    g.box(lx, ly, lw, lh, C.grey, 'round');
    g.fill(lx + 1, ly + 1, lw - 2, lh - 2, ' ', 0);
    g.text(lx + 2, ly, ' ops.log ', C.steel);
    for (let i = 0; i < lh - 3; i++) {
      const [text, col] = LOG_LINES[(logOffset + i) % LOG_LINES.length];
      g.text(lx + 2, ly + 1 + i, text, col);
    }
    if (Math.floor(t * 2) % 2) g.put(lx + 2, ly + lh - 2, '▌', C.green);
    g.text(lx + 3, ly + lh - 2, '_', C.greenDim);

    // Right: line status and deployed counter
    const rx = 138, ry = 17, rw = 38, rh = 10;
    g.box(rx, ry, rw, rh, C.grey, 'round');
    g.text(rx + 2, ry, ' line.status ', C.steel);
    const stations = [['INTAKE', 'ok'], ['BUILD', welding ? 'busy' : 'ok'], ['QA', 'ok'], ['SHIP', 'ok']];
    stations.forEach(([name, st], i) => {
      g.text(rx + 2, ry + 2 + i, name.padEnd(8, '.'), C.greenDim);
      g.put(rx + 11, ry + 2 + i, '●', st === 'busy' ? (Math.floor(t * 8) % 2 ? C.amber : C.amberDim) : C.green);
      g.text(rx + 13, ry + 2 + i, st, st === 'busy' ? C.amber : C.greenDim);
    });
    g.text(rx + 22, ry + 2, 'DEPLOYED', C.cyanDim);
    bigText(g, rx + 2, ry + 6, String(deployed).padStart(6, '0'), shipFlash > 0 ? C.white : C.cyanDim);
    // Sparkline of belt load
    for (let i = 0; i < 12; i++) {
      const v = (Math.sin(t * 0.7 + i * 0.6) + Math.sin(t * 1.9 + i)) * 0.25 + 0.5;
      g.put(rx + 22 + i, ry + 3, '▁▂▃▄▅▆▇█'[Math.max(0, Math.min(7, Math.floor(v * 8)))], C.cyanDim);
    }
  }

  function drawCatwalk(g) {
    const x0 = 46, x1 = 134, y = 21;
    for (let x = x0; x <= x1; x++) {
      g.put(x, y, (x - x0) % 4 === 0 ? '┬' : '─', C.greyDark);
      if ((x - x0) % 4 === 0) g.put(x, y + 1, '│', C.greyDark);
      g.put(x, y + 2, (x - x0) % 4 === 0 ? '╧' : '═', C.grey);
    }
    for (let yy = 3; yy < y; yy++) {
      g.put(x0, yy, '│', C.greyDark);
      g.put(x1, yy, '│', C.greyDark);
    }
  }

  function drawBelt(g) {
    const spin = '│╱─╲'[Math.floor(beltDist * 1.5) % 4];
    for (let x = BELT_X0 + 1; x < BELT_X1; x++) {
      g.put(x, BELT_Y, (x - beltStep) % 6 === 0 ? '╤' : '═', C.grey);
      const r = x % 4;
      g.put(x, BELT_Y + 1, r === 0 ? '(' : r === 1 ? spin : r === 2 ? ')' : ' ', r === 1 ? C.steel : C.greyDark);
      g.put(x, BELT_Y + 2, (x + beltStep) % 6 === 0 ? '╧' : '═', C.greyDark);
    }
    g.text(BELT_X0, BELT_Y, '╭', C.grey);
    g.text(BELT_X0, BELT_Y + 1, '│', C.grey);
    g.text(BELT_X0, BELT_Y + 2, '╰', C.grey);
    g.text(BELT_X1, BELT_Y, '╮', C.grey);
    g.text(BELT_X1, BELT_Y + 1, '│', C.grey);
    g.text(BELT_X1, BELT_Y + 2, '╯', C.grey);
    // Tall legs with braces. The crew floor runs underneath the line.
    for (let x = BELT_X0 + 20; x < BELT_X1 - 14; x += 22) {
      for (let y = BELT_Y + 3; y < FLOOR_Y; y++) g.put(x, y, '║', C.greyDark);
      g.put(x - 1, BELT_Y + 3, '╱', C.greyDark);
      g.put(x + 1, BELT_Y + 3, '╲', C.greyDark);
    }
  }

  function pkgX(p) { return BELT_X0 + (beltStep - p.start); }
  function pkgW(p) { return STAGES[p.stage].label.length + 4; }

  function drawPackage(g, p, t) {
    const { label, col } = STAGES[p.stage];
    const x = pkgX(p);
    const w = label.length + 4;
    const y = BELT_Y - 3;
    const under = p.stage === 0 && welding && x <= WELDER_X && x + w > WELDER_X;
    const c = under && hash(Math.floor(t * 30) + p.start) % 3 === 0 ? C.white : col;
    g.text(x, y, '╭' + '─'.repeat(w - 2) + '╮', c);
    g.text(x, y + 1, '│`' + label.replaceAll(' ', '`') + '`│', c);
    g.text(x, y + 2, '╰' + '─'.repeat(w - 2) + '╯', c);
  }

  function drawWelder(g, t) {
    const tipY = Math.round(BELT_Y - 6 + weldDrop * 2.4);
    for (let y = 25; y < tipY - 3; y++) g.put(WELDER_X, y, '┃', C.grey);
    g.text(WELDER_X - 1, tipY - 3, '╔╧╗', C.steel);
    g.text(WELDER_X - 1, tipY - 2, '║`║', C.steel);
    g.put(WELDER_X, tipY - 2, '▓', welding ? C.amber : C.amberDim);
    g.text(WELDER_X - 1, tipY - 1, '╚╤╝', C.steel);
    g.put(WELDER_X, tipY, '▼', C.amber);
    if (welding && weldDrop > 0.8) {
      g.put(WELDER_X, tipY + 1, Math.floor(t * 24) % 2 ? '*' : '✶', C.white);
    }
    g.text(WELDER_X - 4, 24, '╘═══╧═══╛', C.grey);
  }

  function drawQA(g, t) {
    g.text(QA_X0, BELT_Y - 8, '╔' + '═'.repeat(QA_X1 - QA_X0 - 1) + '╗', C.grey);
    g.text(QA_X0 + 6, BELT_Y - 8, ' QA ', C.cyan);
    for (let y = BELT_Y - 7; y < BELT_Y; y++) {
      g.put(QA_X0, y, '║', C.grey);
      g.put(QA_X1, y, '║', C.grey);
    }
    const inside = packages.some((p) => p.stage >= 1 && pkgX(p) + pkgW(p) > QA_X0 && pkgX(p) < QA_X1);
    g.put(QA_X0, BELT_Y - 6, '●', inside ? C.cyan : C.cyanDim);
    g.put(QA_X1, BELT_Y - 6, '●', inside ? C.cyan : C.cyanDim);
    if (inside) {
      const span = QA_X1 - QA_X0 - 1;
      const k = (Math.sin(t * 7) + 1) / 2;
      const bx = QA_X0 + 1 + Math.round(k * (span - 1));
      for (let y = BELT_Y - 7; y < BELT_Y; y++) g.put(bx, y, '┊', C.cyan);
    }
  }

  function drawHousings(g, t) {
    // Tall cabinets at each end. Intake hides where ideas appear, ship swallows the finished ones.
    const top = BELT_Y - 8;
    const h = FLOOR_Y - top;
    for (const [x, name, col] of [[1, 'INTAKE', C.amber], [166, 'SHIP', shipFlash > 0 ? C.white : C.green]]) {
      g.box(x, top, 13, h, C.grey, 'heavy');
      g.fill(x + 1, top + 1, 11, h - 2, ' ', 0);
      g.text(x + 2, top + 2, name, col);
      g.put(x + 10, top + 2, '▶', name === 'SHIP' ? col : Math.floor(t * 3) % 2 ? C.amber : C.amberDim);
      g.text(x + 1, top + 4, '┄'.repeat(11), C.greyDark);
      for (let y = BELT_Y - 3; y < BELT_Y; y++) g.text(x + 2, y, '▒▒▒▒▒▒▒▒▒', C.greyDark);
      // Machine detail below the line: a vent grille and two status LEDs
      for (let y = BELT_Y + 3; y < FLOOR_Y - 3; y += 2) g.text(x + 2, y, '═════════', C.greyDark);
      g.put(x + 2, FLOOR_Y - 2, '●', C.green);
      g.put(x + 4, FLOOR_Y - 2, '●', Math.floor(t * 1.5 + x) % 3 ? C.greenDark : C.green);
    }
  }

  function drawBot(g, t) {
    const b = bot;
    const x = Math.round(b.x);
    const y = FLOOR_Y - ROBOT_H;
    let legs = 'stand';
    let swing = 0;
    if (b.state === 'walk') {
      const phase = Math.floor(Math.abs(b.x - b.from) / 1.6) % 4;
      legs = ['stand', 'stepA', 'stand', 'stepB'][phase];
      swing = [0, 1, 0, -1][phase];
    }
    const blink = hash(Math.floor(t * 0.4)) % 3 === 0 && (t * 0.4) % 1 < 0.06;
    const speaking = b.quip && t > b.quipT;
    cto(g, x, y, {
      legs,
      look: b.state === 'walk' ? b.dir : 0,
      blink,
      mouth: speaking ? b.quip.mouth : 'smile',
      mood: speaking ? b.quip.mood : undefined,
      chest: Math.floor(t * 6),
      tip: Math.floor(t * 2) % 2 === 0,
      swing,
      wave: speaking && b.quip.text === 'ship it.',
    });
    if (speaking) drawBubble(g, x, y, b.quip.text, Math.floor((t - b.quipT) * 28));
  }

  function drawFloor(g, t) {
    g.text(0, FLOOR_Y, '▀'.repeat(180), C.greyDark);
    for (let x = 0; x < 180; x++) {
      const hazard = x < 16 || x > 163;
      g.put(x, FLOOR_Y + 1, hazard ? (x % 2 ? '▞' : '▚') : '·', hazard ? C.amberDim : C.greyDark);
    }
    // Cable trench with data pulses running down the line
    g.text(0, FLOOR_Y + 2, '─'.repeat(180), C.greyDark);
    for (let k = 0; k < 7; k++) {
      const px = Math.floor((t * 26 + k * 27) % 190) - 5;
      g.put(px, FLOOR_Y + 2, '━', C.cyan);
      g.put(px - 1, FLOOR_Y + 2, '━', C.cyanDim);
      g.put(px - 2, FLOOR_Y + 2, '─', C.cyanDim);
    }
  }

  return {
    update,
    draw,
    // Debug: make the robot stop and say something, so speech can be checked on demand.
    say(text, t) {
      const quip = QUIPS.find((q) => q.text === text) ?? { text, mouth: 'smile' };
      Object.assign(bot, { state: 'look', until: t + 1e9, quip, quipT: t });
    },
    get stats() {
      return { packages: packages.length, sparks: sparks.length, steam: steam.length, deployed, botX: Math.round(bot.x) };
    },
  };
}

function drawBubble(g, rx, ry, text, n) {
  const shown = text.slice(0, Math.max(0, n));
  const w = text.length + 4;
  // Beside the head, flipped to the left side near the right edge of the floor.
  const left = rx + 12 + w > 165;
  const x = left ? rx - w - 1 : rx + 12;
  const y = ry + 2;
  g.text(x, y, '╭' + '─'.repeat(w - 2) + '╮', C.steel);
  g.text(x, y + 1, '│`' + '`'.repeat(text.length) + '`│', C.steel);
  g.text(x + 2, y + 1, shown, C.white);
  g.text(x, y + 2, '╰' + '─'.repeat(w - 2) + '╯', C.steel);
  g.put(left ? x + w : x - 1, y + 1, left ? '▶' : '◀', C.steel);
}

function easeInOutSine(p) {
  return -(Math.cos(Math.PI * p) - 1) / 2;
}

function hash(n) {
  n = (n ^ 61) ^ (n >>> 16);
  n = (n + (n << 3)) | 0;
  n ^= n >>> 4;
  n = Math.imul(n, 0x27d4eb2d);
  return (n ^ (n >>> 15)) >>> 0;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
