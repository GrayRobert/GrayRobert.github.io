// The factory floor: layout, the power-on sequence, levers, conveyor, stations,
// background machinery and particles. The crew lives in crew.js.

import { C } from './grid.js';
import { bigText, bigTextWidth } from './bigtext.js';
import { createCrew, hash } from './crew.js';

export const FLOOR_Y = 50;
const BELT_Y = 35; // belt surface. Packages ride on the 3 rows above, the crew walks underneath.
const BELT_X0 = 3;
const BELT_X1 = 176;
const SPEED = 7; // cells per second
const SEC_X0 = 16; // security scanner at the belt entrance
const SEC_X1 = 26;
const WELDER_X = 104;
const QA_X0 = 117;
const QA_X1 = 133;

// The product changes as it passes each station.
const STAGES = [
  { label: '{ idea }', col: C.amber, at: 0 },
  { label: '≡ spec ≡', col: C.steel, at: 58 }, // planned under the PM
  { label: '[ wire ]', col: C.cyan, at: 90 }, // sketched under the designer
  { label: '</> code', col: C.green, at: WELDER_X + 2 }, // built at the welder
  { label: '✓ tested', col: C.cyan, at: QA_X1 - 4 }, // passed QA
];
const PKG_W = 12;

// Seconds after the lever is pulled that each part of the factory lights up.
const WAKE = { panel: 0, sign: 0.5, offices: 0.9, catwalk: 1.2, tower: 1.5, line: 1.9, ship: 2.6, floor: 2.8 };

const LOG_LINES = [
  ['build .... ok', C.greenDim], ['tests .. pass', C.greenDim], ['deploy ... ok', C.greenDim],
  ['WARN heap 81%', C.amber], ['cache ... 97%', C.greenDim], ['blocked 1 ip', C.red],
  ['backup ... ok', C.greenDim], ['scan .. clean', C.cyanDim], ['p95 ... 182ms', C.greenDim],
];

export function createWorld({ seed = 7, audio = null } = {}) {
  const rnd = mulberry32(seed);
  const crew = createCrew(rnd, audio);

  const power = { on: false, t0: 0 };
  // Lever positions: 0 up, 1 down. Each one is a little damped spring so it overshoots and settles.
  const soundOn = audio && !audio.muted ? 1 : 0;
  const levers = { power: { v: 0, vel: 0 }, sound: { v: soundOn, vel: 0 } };
  const leverTarget = { power: 0, sound: soundOn };
  let hover = null;
  let hits = [];

  let beltDist = 0;
  let beltStep = 0;
  let nextSpawn = 2;
  let deployed = 0;
  let logOffset = 0;
  let logTimer = 0;
  let steamTimer = 0;
  let welding = false;
  let weldDrop = 0;
  let shipFlash = 0;
  const packages = [];
  const steam = [];
  const sparks = [];
  let now = 0;

  // 0 before its moment, flickering for a beat, then on for good.
  function awakeAt(delay) {
    if (!power.on) return false;
    const e = now - power.t0 - delay;
    if (e < 0) return false;
    if (e > 0.45) return true;
    return hash(Math.floor(now * 40) + Math.floor(delay * 100)) % 3 !== 0;
  }

  function update(t, dt) {
    now = t;
    for (const k of ['power', 'sound']) spring(levers[k], leverTarget[k], dt);

    const lineOn = power.on && t - power.t0 > WAKE.line;
    const ramp = lineOn ? Math.min(1, (t - power.t0 - WAKE.line) / 1.5) : 0;
    beltDist += SPEED * ramp * ramp * dt;
    beltStep = Math.floor(beltDist);

    if (lineOn && beltStep >= nextSpawn) {
      packages.push({ start: beltStep, stage: 0, flash: 0 });
      nextSpawn = beltStep + 22 + Math.floor(rnd() * 10);
    }

    welding = false;
    for (let i = packages.length - 1; i >= 0; i--) {
      const p = packages[i];
      const x = pkgX(p);
      const mid = x + PKG_W / 2;
      p.flash = Math.max(0, p.flash - dt);
      const next = STAGES[p.stage + 1];
      if (next?.at === WELDER_X + 2 && x <= WELDER_X && x + PKG_W > WELDER_X) welding = true;
      if (next && mid > next.at) { p.stage++; p.flash = 0.25; }
      if (x > BELT_X1 - 8) {
        packages.splice(i, 1);
        deployed++;
        shipFlash = 0.6;
        audio?.ship();
      }
    }
    shipFlash = Math.max(0, shipFlash - dt);

    weldDrop += ((welding ? 1 : 0) - weldDrop) * Math.min(1, dt * 10);
    audio?.weld(welding && weldDrop > 0.8 ? 0.4 + rnd() * 0.6 : 0);
    if (welding && weldDrop > 0.8) {
      const n = rnd() < 0.5 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        sparks.push({ x: WELDER_X + 0.5, y: BELT_Y - 3.2, vx: (rnd() - 0.5) * 28, vy: -6 - rnd() * 14, age: 0, life: 0.35 + rnd() * 0.5 });
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

    // The chimney above the ship dock breathes steam once the line is running.
    steamTimer -= dt;
    if (steamTimer <= 0 && lineOn) {
      steamTimer = 0.05;
      if (Math.sin(t * 0.8) > -0.3) {
        steam.push({ x: 171.5 + rnd() * 2, y: 15, vx: (rnd() - 0.5) * 2, vy: -1.6 - rnd() * 1.6, age: 0, life: 3 + rnd() * 2.5, seed: rnd() * 6 });
      }
    }
    for (let i = steam.length - 1; i >= 0; i--) {
      const s = steam[i];
      s.age += dt;
      s.x += (s.vx + Math.sin(t * 1.3 + s.seed) * 1.4 - 0.6) * dt;
      s.y += s.vy * dt;
      s.vy *= 1 - dt * 0.25;
      if (s.age > s.life || s.y < 3) steam.splice(i, 1);
    }

    logTimer += dt;
    if (logTimer > 0.8) { logTimer = 0; logOffset++; }

    crew.update(t, awakeAt);
  }

  function draw(g, t) {
    now = t;
    hits = [];
    const dark = (delay, fn) => g.tinted(awakeAt(delay) ? 0 : C.greyDark, fn);

    drawBackdrop(g);
    dark(WAKE.sign, () => drawSign(g, t));
    dark(WAKE.offices, () => drawOffice(g, t));
    dark(WAKE.tower, () => drawTower(g, t));
    drawChimney(g);
    for (const s of steam) {
      const k = s.age / s.life;
      g.put(s.x, s.y, k < 0.12 ? '▓' : k < 0.35 ? '▒' : k < 0.75 ? '░' : '·', k < 0.4 ? C.grey : C.greyDark);
    }
    dark(WAKE.line, () => {
      drawBelt(g);
      for (const p of packages) drawPackage(g, p, t);
      drawSecurityGate(g, t);
      drawWelder(g, t);
      drawQA(g, t);
    });
    for (const s of sparks) {
      const k = s.age / s.life;
      g.dot(s.x, s.y, k < 0.2 ? C.white : k < 0.6 ? C.amber : C.amberDim);
    }
    crew.draw(g, t, 'upper', { awakeAt, hover, hits });
    dark(WAKE.catwalk, () => drawCatwalkRail(g));
    dark(WAKE.line, () => drawCabinets(g, t));
    crew.draw(g, t, 'floor', { awakeAt, hover, hits });
    dark(WAKE.floor, () => drawFloor(g, t));
    drawPanel(g, t);
    if (!power.on) drawPowerHint(g, t);
  }

  function drawBackdrop(g) {
    g.text(0, 0, '═'.repeat(180), C.greyDark);
    for (let x = 0; x < 180; x++) g.put(x, 1, x % 2 ? '╱' : '╲', C.greyDark);
    g.text(0, 2, '═'.repeat(180), C.greyDark);
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
    const by = 4;
    const bh = 7;
    g.put(bx + 4, 3, '│', C.greyDark);
    g.put(bx + bw - 5, 3, '│', C.greyDark);

    let i = 0;
    const step = Math.floor(t * 9);
    const bulb = (x, y) => g.put(x, y, '•', (i++ + step) % 3 === 0 ? C.amber : C.amberDim);
    for (let x = bx; x < bx + bw; x += 2) bulb(x, by);
    for (let y = by + 1; y < by + bh - 1; y++) bulb(bx + bw - 1, y);
    for (let x = bx + bw - 1; x >= bx; x -= 2) bulb(x, by + bh - 1);
    for (let y = by + bh - 2; y > by; y--) bulb(bx, y);

    // Letters light up one at a time at power on, then the odd one flickers like an old tube.
    const since = t - power.t0 - WAKE.sign;
    const flick = Math.floor(t * 20);
    const bad = hash(Math.floor(t * 0.5)) % title.length;
    bigText(g, x0, by + 2, title, C.green, {
      colorAt: (k) => {
        if (since < k * 0.06) return C.greenDark;
        return k === bad && hash(flick) % 7 === 0 ? C.greenDark : C.green;
      },
    });
  }

  // The boardroom, upper left, where the CEO keeps an eye on the numbers.
  function drawOffice(g, t) {
    const x0 = 15, y0 = 12, w = 31, h = 15;
    g.box(x0, y0, w, h, C.grey, 'double');
    g.fill(x0 + 1, y0 + 1, w - 2, h - 2, ' ', 0);
    g.text(x0 + 2, y0, ' BOARDROOM ', C.steel);
    // Glass glints
    g.text(x0 + 3, y0 + 2, '╱', C.cyanDim);
    g.text(x0 + 4, y0 + 2, '╱', C.greyDark);
    // Revenue ticker on the desk screen: always trending the right way
    const sx = x0 + 19, sy = y0 + 4;
    g.box(sx, sy, 11, 6, C.grey, 'round');
    g.text(sx + 2, sy, ' rev ', C.amberDim);
    for (let i = 0; i < 9; i++) {
      const v = Math.min(7, Math.max(0, Math.floor(i * 0.7 + 1 + Math.sin(t * 1.5 + i) * 1.2)));
      g.put(sx + 1 + i, sy + 3, '▁▂▃▄▅▆▇█'[v], C.amber);
    }
    g.put(sx + 9, sy + 2, '▲', Math.floor(t * 2) % 2 ? C.green : C.greenDim);
    g.text(sx, sy + 6, '───┴─┴───', C.grey);
  }

  // The control tower, upper right. The CTO's screens show the whole line.
  function drawTower(g, t) {
    const x0 = 135, y0 = 12, w = 31, h = 15;
    g.box(x0, y0, w, h, C.grey, 'heavy');
    g.fill(x0 + 1, y0 + 1, w - 2, h - 2, ' ', 0);
    g.text(x0 + 2, y0, ' CONTROL ', C.steel);
    const sx = x0 + 15;
    g.box(sx, y0 + 1, 15, 7, C.grey, 'round');
    for (let i = 0; i < 5; i++) {
      const [text, col] = LOG_LINES[(logOffset + i) % LOG_LINES.length];
      g.text(sx + 1, y0 + 2 + i, text.slice(0, 13), col);
    }
    g.box(sx, y0 + 8, 15, 6, C.grey, 'round');
    const stations = [['SEC', true], ['PLAN', true], ['BUILD', !welding], ['QA', true]];
    stations.forEach(([name, ok], i) => {
      const yy = y0 + 9 + (i % 2) * 2;
      const xx = sx + 1 + Math.floor(i / 2) * 7;
      g.put(xx, yy, '●', ok ? C.green : Math.floor(t * 8) % 2 ? C.amber : C.amberDim);
      g.text(xx + 1, yy, name, C.greenDim);
    });
    g.text(sx + 1, y0 + 12, 'SHIP ' + String(deployed).padStart(6, '0'), shipFlash > 0 ? C.white : C.cyan);
  }

  function drawChimney(g) {
    g.tinted(awakeAt(WAKE.ship) ? 0 : C.greyDark, () => {
      g.text(169, 16, '╔════╗', C.grey);
      for (let y = 17; y < 27; y++) g.text(169, y, '║````║', C.grey);
      g.text(170, 20, '≋≋≋≋', C.greyDark);
    });
  }

  function drawCatwalkRail(g) {
    const x0 = 47, x1 = 133, y = 21;
    for (let x = x0; x <= x1; x++) {
      g.put(x, y, (x - x0) % 4 === 0 ? '┬' : '─', C.grey);
      if ((x - x0) % 4 === 0) g.put(x, y + 1, '│', C.grey);
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
    for (let x = BELT_X0 + 20; x < BELT_X1 - 14; x += 22) {
      for (let y = BELT_Y + 3; y < FLOOR_Y; y++) g.put(x, y, '║', C.greyDark);
      g.put(x - 1, BELT_Y + 3, '╱', C.greyDark);
      g.put(x + 1, BELT_Y + 3, '╲', C.greyDark);
    }
  }

  function pkgX(p) { return BELT_X0 + (beltStep - p.start); }

  function drawPackage(g, p, t) {
    const { label, col } = STAGES[p.stage];
    const x = pkgX(p);
    const y = BELT_Y - 3;
    const under = welding && x <= WELDER_X && x + PKG_W > WELDER_X;
    const c = p.flash > 0 || (under && hash(Math.floor(t * 30) + p.start) % 3 === 0) ? C.white : col;
    g.text(x, y, '╭' + '─'.repeat(PKG_W - 2) + '╮', c);
    g.text(x, y + 1, '│`' + label.replaceAll(' ', '`') + '`│', c);
    g.text(x, y + 2, '╰' + '─'.repeat(PKG_W - 2) + '╯', c);
  }

  function drawSecurityGate(g, t) {
    const top = BELT_Y - 7;
    g.text(SEC_X0, top, '┏' + '━'.repeat(SEC_X1 - SEC_X0 - 1) + '┓', C.grey);
    g.text(SEC_X0 + 3, top, ' SEC ', C.red);
    for (let y = top + 1; y < BELT_Y; y++) {
      g.put(SEC_X0, y, '┃', C.grey);
      g.put(SEC_X1, y, '┃', C.grey);
    }
    const inside = packages.some((p) => pkgX(p) + PKG_W > SEC_X0 && pkgX(p) < SEC_X1);
    if (inside) {
      const k = (Math.sin(t * 9) + 1) / 2;
      const by = top + 1 + Math.round(k * 5);
      for (let x = SEC_X0 + 1; x < SEC_X1; x++) g.scan(x, by, '┄', C.red);
    }
  }

  function drawWelder(g, t) {
    const tipY = Math.round(BELT_Y - 6 + weldDrop * 2.4);
    for (let y = 25; y < tipY - 3; y++) g.put(WELDER_X, y, '┃', C.grey);
    g.text(WELDER_X - 1, tipY - 3, '╔╧╗', C.steel);
    g.text(WELDER_X - 1, tipY - 2, '║`║', C.steel);
    g.put(WELDER_X, tipY - 2, '▓', welding ? C.amber : C.amberDim);
    g.text(WELDER_X - 1, tipY - 1, '╚╤╝', C.steel);
    g.put(WELDER_X, tipY, '▼', C.amber);
    if (welding && weldDrop > 0.8) g.put(WELDER_X, tipY + 1, Math.floor(t * 24) % 2 ? '*' : '✶', C.white);
    g.text(WELDER_X - 4, 24, '╘═══╧═══╛', C.grey);
  }

  function drawQA(g, t) {
    const top = BELT_Y - 8;
    g.text(QA_X0, top, '╔' + '═'.repeat(QA_X1 - QA_X0 - 1) + '╗', C.grey);
    g.text(QA_X0 + 6, top, ' QA ', C.cyan);
    for (let y = top + 1; y < BELT_Y; y++) {
      g.put(QA_X0, y, '║', C.grey);
      g.put(QA_X1, y, '║', C.grey);
    }
    const inside = packages.some((p) => p.stage >= 3 && pkgX(p) + PKG_W > QA_X0 && pkgX(p) < QA_X1);
    g.put(QA_X0, top + 2, '●', inside ? C.cyan : C.cyanDim);
    g.put(QA_X1, top + 2, '●', inside ? C.cyan : C.cyanDim);
    if (inside) {
      const span = QA_X1 - QA_X0 - 1;
      const bx = QA_X0 + 1 + Math.round(((Math.sin(t * 7) + 1) / 2) * (span - 1));
      for (let y = top + 1; y < BELT_Y; y++) g.scan(bx, y, '┊', C.white);
    }
  }

  function drawCabinets(g, t) {
    const top = BELT_Y - 8;
    const h = FLOOR_Y - top;
    for (const [x, name, col] of [[1, 'INTAKE', C.amber], [166, 'SHIP', shipFlash > 0 ? C.white : C.green]]) {
      g.box(x, top, 13, h, C.grey, 'heavy');
      g.fill(x + 1, top + 1, 11, h - 2, ' ', 0);
      g.text(x + 2, top + 2, name, col);
      g.put(x + 10, top + 2, '▶', name === 'SHIP' ? col : Math.floor(t * 3) % 2 ? C.amber : C.amberDim);
      g.text(x + 1, top + 4, '┄'.repeat(11), C.greyDark);
      for (let y = BELT_Y - 3; y < BELT_Y; y++) g.text(x + 2, y, '▒▒▒▒▒▒▒▒▒', C.greyDark);
      for (let y = BELT_Y + 5; y < FLOOR_Y - 3; y += 2) g.text(x + 2, y, '═════════', C.greyDark);
      g.put(x + 2, FLOOR_Y - 2, '●', C.green);
      g.put(x + 4, FLOOR_Y - 2, '●', Math.floor(t * 1.5 + x) % 3 ? C.greenDark : C.green);
    }
    g.text(168, BELT_Y + 2, 'shipped', C.greenDim);
    g.text(168, BELT_Y + 3, String(deployed).padStart(6, '0'), shipFlash > 0 ? C.white : C.cyan);
  }

  // Control panel, upper left: the power lever and the sound lever.
  function drawPanel(g, t) {
    const x0 = 1, y0 = 12, w = 13, h = 15;
    g.box(x0, y0, w, h, power.on ? C.grey : C.greyDark, 'heavy');
    g.fill(x0 + 1, y0 + 1, w - 2, h - 2, ' ', 0);
    lever(g, t, 'power', x0 + 3, y0 + 2, 'PWR', power.on ? C.green : C.amber);
    lever(g, t, 'sound', x0 + 9, y0 + 2, 'SND', levers.sound.v > 0.5 ? C.green : C.red);
  }

  function lever(g, t, id, x, y, label, lamp) {
    const travel = 7;
    const hy = y + Math.round(levers[id].v * travel);
    const hovered = hover === id;
    const idle = id === 'power' && !power.on;
    for (let j = 0; j <= travel; j++) g.put(x, y + j, '║', C.greyDark);
    // Rod from the pivot below the slot up (or down) to the handle
    const pivot = y + travel + 1;
    g.put(x, pivot, '◎', C.steel);
    for (let yy = hy + 1; yy < pivot; yy++) g.put(x, yy, '┃', C.steel);
    const pulse = idle && Math.floor(t * 2.5) % 2 === 0;
    g.text(x - 1, hy, '▐█▌', hovered ? C.white : pulse ? C.amber : idle ? C.amberDim : C.steel);
    g.text(x - 1, y + travel + 3, label, power.on || id === 'power' ? C.steel : C.greyDark);
    g.put(x, y + travel + 2, '●', id === 'sound' && !power.on ? C.greyDark : lamp);
    hits.push({ id, x: x - 2, y: y - 1, w: 5, h: travel + 5 });
  }

  // Before power on: a callout in the empty band above the belt, with a trail of
  // marching dots leading back to the lever.
  function drawPowerHint(g, t) {
    const line1 = 'pull the PWR lever to start the factory';
    const line2 = 'or press enter  ·  sound on';
    const w = line1.length + 6;
    const x0 = 32;
    const y0 = 27;
    g.box(x0, y0, w, 4, C.amberDim, 'round');
    g.fill(x0 + 1, y0 + 1, w - 2, 2, ' ', 0);
    g.text(x0 + 3, y0 + 1, line1, C.amber);
    g.text(x0 + 3 + Math.floor((line1.length - line2.length) / 2), y0 + 2, line2, C.steel);

    const path = [];
    for (let x = x0 - 1; x > 14; x--) path.push([x, y0 + 1]);
    for (let y = y0 + 1; y > 19; y--) path.push([14, y]);
    const head = Math.floor(t * 18);
    path.forEach(([x, y], i) => g.put(x, y, '·', (i - head) % 6 === 0 ? C.amber : C.amberDim));
    g.put(14, 19, '◀', Math.floor(t * 2.5) % 2 ? C.amber : C.amberDim);
  }

  function drawFloor(g, t) {
    g.text(0, FLOOR_Y, '▀'.repeat(180), C.greyDark);
    for (let x = 0; x < 180; x++) {
      const hazard = x < 16 || x > 163;
      g.put(x, FLOOR_Y + 1, hazard ? (x % 2 ? '▞' : '▚') : '·', hazard ? C.amberDim : C.greyDark);
    }
    g.text(0, FLOOR_Y + 2, '─'.repeat(180), C.greyDark);
    if (!power.on) return;
    for (let k = 0; k < 7; k++) {
      const px = Math.floor((t * 26 + k * 27) % 190) - 5;
      g.put(px, FLOOR_Y + 2, '━', C.cyan);
      g.put(px - 1, FLOOR_Y + 2, '━', C.cyanDim);
      g.put(px - 2, FLOOR_Y + 2, '─', C.cyanDim);
    }
  }

  function powerOn(t) {
    if (power.on) return;
    power.on = true;
    power.t0 = t;
    leverTarget.power = 1;
    audio?.start();
    audio?.clunk();
  }

  return {
    update,
    draw,
    powerOn,
    get powered() { return power.on; },
    // Topmost thing under a cell, or null.
    hitAt(cx, cy) {
      for (let i = hits.length - 1; i >= 0; i--) {
        const h = hits[i];
        if (cx >= h.x && cx < h.x + h.w && cy >= h.y && cy < h.y + h.h) return h.id;
      }
      return null;
    },
    setHover(id) { hover = id; },
    // Returns what was clicked: 'power', 'sound', or a crew id.
    activate(id, t) {
      if (id === 'power') {
        powerOn(t);
      } else if (id === 'sound') {
        if (!power.on) return id;
        leverTarget.sound = leverTarget.sound ? 0 : 1;
        audio?.clunk();
        audio?.setMuted(!leverTarget.sound);
      }
      return id;
    },
    say(text, t, id = 'cto') { crew.say(id, text, t); },
    get stats() {
      return { packages: packages.length, sparks: sparks.length, steam: steam.length, deployed, powered: power.on };
    },
  };
}

// Underdamped spring: a heavy handle that slams past its stop and settles back.
function spring(l, target, dt) {
  const step = Math.min(dt, 1 / 30);
  l.vel += ((target - l.v) * 260 - l.vel * 16) * step;
  l.v += l.vel * step;
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
