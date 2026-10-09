// The factory: power, zone lighting, the conveyor and its packages, particles, the
// building itself, and draw order. Stations live in stations.js, robots in crew.js.
//
// Two belt modes. In 'tour' the belt only moves when the tour asks it to carry a
// package to a station, then stops there. In 'free' (explore) it runs on its own,
// new ideas keep arriving, and stations trigger themselves as packages pass.

import { C } from './grid.js';
import { bigText, bigTextWidth } from './bigtext.js';
import { createCrew, hash } from './crew.js';
import { createStations } from './stations.js';
import {
  WORLD_COLS, FLOOR_Y, BELT_Y, BELT_X0, BELT_X1, PKG_W, ZONES, STATION, zoneAt,
} from './layout.js';

const STAGES = {
  idea: ['{ idea }', C.amber],
  spec: ['≡ spec ≡', C.steel],
  wire: ['[ wire ]', C.cyan],
  code: ['</> code', C.green],
  secure: ['◈ secure', C.white],
  bug: ['✗ bug!! ', C.red],
  tested: ['✓ tested', C.cyan],
};
const BAD_IDEAS = ['{ hype }', '{ fomo }', '{ meh. }', '{ fad. }'];
const FREE_SPEED = 7; // cells per second
const TOUR_SPEED = 18;

const ZONE_SIGNS = [
  ['plan', 'PLAN', 112], ['design', 'DESIGN', 148], ['build', 'BUILD', 216],
  ['secure', 'SECURE', 275], ['test', 'TEST', 325], ['ship', 'SHIP', 366],
];

const LOG_LINES = [
  ['build .... ok', C.greenDim], ['tests .. pass', C.greenDim], ['deploy ... ok', C.greenDim],
  ['WARN heap 81%', C.amber], ['cache ... 97%', C.greenDim], ['blocked 1 ip', C.red],
  ['backup ... ok', C.greenDim], ['scan .. clean', C.cyanDim], ['p95 ... 182ms', C.greenDim],
];

export function createWorld({ seed = 7, audio = null } = {}) {
  const rnd = mulberry32(seed);
  const crew = createCrew(rnd, audio);

  const power = { on: false, t0: 0 };
  const lit = {}; // zone id -> time it lit up
  let mode = 'off';
  const belt = { dist: 0, step: 0, speed: 0, target: null };
  let packages = [];
  let particles = [];
  const steam = [];
  let deployed = 0;
  let nextSpawn = 0;
  let nextAttack = 0;
  let domeDownAt = 0;
  let logOffset = 0;
  let logTimer = 0;
  let steamTimer = 0;
  let nextId = 1;
  let hover = null;
  let hits = [];
  let now = 0;

  // Lights come on zone by zone: off, a beat of flicker, then on for good.
  function isAwake(zone, delay = 0) {
    if (!power.on || lit[zone] === undefined) return false;
    const e = now - lit[zone] - delay;
    if (e < 0) return false;
    if (e > 0.45) return true;
    return hash(Math.floor(now * 40) + zone.length * 31 + Math.floor(delay * 100)) % 3 !== 0;
  }

  function light(zone, instant = false) {
    if (lit[zone] !== undefined) return;
    lit[zone] = instant ? -100 : now;
    if (!instant) audio?.thunk();
  }

  function spawn({ stage = 'idea', label = null, bad = false } = {}) {
    const p = { id: nextId++, x: BELT_X0, stage, label, bad, flash: 0, done: {} };
    packages.push(p);
    return p;
  }

  function setStage(pkg, stage) {
    pkg.stage = stage;
    pkg.label = null;
    pkg.flash = 0.25;
  }

  function remove(pkg) {
    packages = packages.filter((p) => p !== pkg);
    if (belt.target?.pkg === pkg) belt.target = null;
  }

  // Particles: braille dots by default, or a character if ch is set.
  function particle(p) {
    particles.push({ age: 0, gravity: 30, bounce: false, ...p });
  }
  function spark(x, y, vx, vy) {
    particle({ x, y, vx, vy, life: 0.35 + rnd() * 0.5, cols: [C.white, C.amber, C.amberDim], gravity: 46, bounce: true });
  }
  function burst(x, y, n, cols, { speed = 12, gravity = 20, life = 0.8 } = {}) {
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2;
      const s = speed * (0.3 + rnd() * 0.7);
      particle({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, life: life * (0.5 + rnd() * 0.5), cols, gravity });
    }
  }
  // A rejected idea blows apart, letters and all.
  function debris(pkg) {
    const label = pkg.label ?? STAGES[pkg.stage][0];
    const chars = ['╭', '╮', '╰', '╯', '│', '─', ...label.replaceAll(' ', '')];
    chars.forEach((ch, i) => {
      particle({
        x: pkg.x + 1 + ((i * 7) % PKG_W), y: BELT_Y - 2 - (i % 3), vx: (rnd() - 0.5) * 30, vy: -8 - rnd() * 14,
        life: 1 + rnd() * 0.6, cols: [C.white, C.amber, C.redDim], gravity: 40, ch, bounce: true,
      });
    });
    burst(pkg.x + PKG_W / 2, BELT_Y - 2, 40, [C.white, C.red, C.amber], { speed: 22, life: 0.7 });
  }
  function exhaust(x, y) {
    particle({ x: x + (rnd() - 0.5), y, vx: (rnd() - 0.5) * 3, vy: 6 + rnd() * 4, life: 0.5, cols: [C.amber, C.amberDim, C.greyDark], gravity: 0 });
  }

  const stations = createStations({
    rnd, audio, lit: isAwake, setStage, remove, burst, debris, spark, exhaust,
    get packages() { return packages; },
    deploy: () => { deployed++; },
    deployed: () => deployed,
  });

  function update(t, dt) {
    now = t;

    // Belt: run freely, carry a package to a stop, or stand still.
    let want = 0;
    if (mode === 'free') want = FREE_SPEED;
    else if (mode === 'tour' && belt.target) {
      const left = belt.target.x - belt.target.pkg.x;
      want = left > 0 ? Math.min(TOUR_SPEED, 3 + left * 1.6) : 0;
      if (left <= 0) belt.target = null;
    }
    belt.speed += Math.max(-40 * dt, Math.min(25 * dt, want - belt.speed));
    if (want === 0 && belt.speed < 1) belt.speed = 0;
    belt.dist += belt.speed * dt;
    let steps = Math.floor(belt.dist) - belt.step;
    // Never carry the target package past its stop.
    if (belt.target) {
      steps = Math.min(steps, belt.target.x - belt.target.pkg.x);
      belt.dist = Math.min(belt.dist, belt.step + steps + 0.999);
    }
    if (steps > 0) {
      belt.step += steps;
      for (const p of packages) p.x += steps;
    }

    for (const p of packages) p.flash = Math.max(0, p.flash - dt);
    if (mode === 'free') freeRun(t);

    const s = stations;
    s.why.update(t);
    s.plan.update(t);
    s.design.update(t);
    s.build.update(t, dt, mode === 'free' && packages.some((p) => p.stage === 'wire' && p.x <= STATION.build && p.x + PKG_W > STATION.build));
    s.secure.update(t, dt);
    s.test.update(t, dt);
    s.ship.update(t, dt);

    for (const p of particles) {
      p.age += dt;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.bounce && p.y > BELT_Y - 0.1 && p.vy > 0 && p.x > BELT_X0 && p.x < BELT_X1) {
        p.vy *= -0.35;
        p.vx *= 0.6;
        p.y = BELT_Y - 0.1;
      }
    }
    particles = particles.filter((p) => p.age < p.life);

    // Roof vents over the build zone breathe steam once it is running.
    steamTimer -= dt;
    if (steamTimer <= 0 && isAwake('build')) {
      steamTimer = 0.06;
      for (const vx of [205, 247]) {
        if (Math.sin(t * 0.8 + vx) > -0.2) {
          steam.push({ x: vx + rnd() * 2, y: 11, vx: (rnd() - 0.5) * 2, vy: -1.4 - rnd() * 1.4, age: 0, life: 2.5 + rnd() * 2, seed: rnd() * 6 });
        }
      }
    }
    for (let i = steam.length - 1; i >= 0; i--) {
      const m = steam[i];
      m.age += dt;
      m.x += (m.vx + Math.sin(t * 1.3 + m.seed) * 1.4) * dt;
      m.y += m.vy * dt;
      if (m.age > m.life || m.y < 3) steam.splice(i, 1);
    }

    logTimer += dt;
    if (logTimer > 0.8) { logTimer = 0; logOffset++; }

    crew.update(t, isAwake);
  }

  // Explore mode: stations trigger themselves as packages pass.
  function freeRun(t) {
    const s = stations;
    if (belt.step >= nextSpawn) {
      const bad = rnd() < 0.25;
      spawn({ bad, label: bad ? BAD_IDEAS[Math.floor(rnd() * BAD_IDEAS.length)] : null });
      nextSpawn = belt.step + 24 + Math.floor(rnd() * 10);
    }
    for (const p of [...packages]) {
      const c = p.x + PKG_W / 2;
      const d = p.done;
      if (!d.why && c >= STATION.why - 5) {
        d.why = true;
        s.why.check(p, !p.bad, t, 0.14);
        p.whyAt = t + s.why.duration(0.14);
      }
      if (p.whyAt && t >= p.whyAt) {
        p.whyAt = 0;
        if (p.bad) { s.why.zap(p, t); continue; }
      }
      if (!d.plan && c >= STATION.plan) { d.plan = true; s.plan.stamp(p, t); }
      if (!d.design && c >= STATION.design - 6) { d.design = true; s.design.project(p, t, 0.8); }
      if (!d.build && c >= STATION.build + 2) { d.build = true; setStage(p, 'code'); }
      if (!d.secure && c >= STATION.secure - 6) { d.secure = true; s.secure.scan(p, t, 0.8); }
      if (!d.test && c >= STATION.test - 6) {
        d.test = true;
        s.test.auto = true;
        s.test.scan(p, t, { bug: rnd() < 0.2, dur: 0.8 });
      }
      if (p.x >= STATION.ship - 8) s.ship.launch(p, t);
    }
    // Every so often, intruders try their luck and the dome goes up.
    if (t > nextAttack) {
      s.secure.raiseDome(true);
      s.secure.attack(5, t);
      domeDownAt = t + 7;
      nextAttack = t + 40 + rnd() * 25;
    }
    if (domeDownAt && t > domeDownAt && !s.secure.busy) {
      s.secure.raiseDome(false);
      domeDownAt = 0;
    }
  }

  function draw(g, t) {
    now = t;
    hits = [];
    const zone = (id, fn) => g.tinted(isAwake(id) ? 0 : C.greyDark, fn);
    const s = stations;

    drawBackdrop(g);
    zone('base', () => drawSign(g, t));
    for (const [id, text, x] of ZONE_SIGNS) zone(id, () => bigText(g, x, 4, text, C.greenDark));
    zone('why', () => drawBoardroom(g, t));
    zone('why', () => s.why.draw(g, t));
    zone('plan', () => drawTower(g));
    zone('build', () => drawPipes(g));
    zone('ship', () => s.ship.draw(g, t));
    for (const m of steam) {
      const k = m.age / m.life;
      g.put(m.x, m.y, k < 0.12 ? '▓' : k < 0.35 ? '▒' : k < 0.75 ? '░' : '·', k < 0.4 ? C.grey : C.greyDark);
    }
    drawBelt(g);
    for (const p of packages) drawPackage(g, p, t);
    zone('plan', () => s.plan.draw(g, t));
    zone('design', () => s.design.draw(g, t));
    zone('build', () => s.build.draw(g, t));
    zone('secure', () => s.secure.draw(g, t));
    zone('test', () => s.test.draw(g, t));
    drawParticles(g);
    crew.draw(g, t, 'upper', { isAwake, hover, hits });
    drawCatwalk(g);
    drawCabinets(g, t);
    crew.draw(g, t, 'floor', { isAwake, hover, hits });
    drawFloor(g, t);
    s.why.drawFx(g, t);
    s.secure.drawFx(g, t);
    s.test.drawFx(g, t);
    s.ship.drawFx(g, t);
    if (!power.on) drawPowerHint(g, t);
  }

  function drawBackdrop(g) {
    g.text(0, 0, '═'.repeat(WORLD_COLS), C.greyDark);
    for (let x = 0; x < WORLD_COLS; x++) g.put(x, 1, x % 2 ? '╱' : '╲', C.greyDark);
    g.text(0, 2, '═'.repeat(WORLD_COLS), C.greyDark);
    for (let y = 5; y < 30; y += 6) {
      for (let x = 3 + (y % 12 ? 0 : 6); x < WORLD_COLS - 2; x += 12) g.put(x, y, '·', C.greyDark);
    }
    // Zone dividers on the back wall
    // (none through the name sign)
    for (const z of ZONES.slice(2)) if (z.x0 > 95) for (let y = 3; y < 11; y++) g.put(z.x0, y, '┊', C.greyDark);
  }

  function drawSign(g, t) {
    const title = 'ROBERT GRAY';
    const w = bigTextWidth(title);
    const x0 = 22;
    const bx = x0 - 6, bw = w + 12, by = 3, bh = 7;
    let i = 0;
    const step = Math.floor(t * 9);
    const bulb = (x, y) => g.put(x, y, '•', (i++ + step) % 3 === 0 ? C.amber : C.amberDim);
    for (let x = bx; x < bx + bw; x += 2) bulb(x, by);
    for (let y = by + 1; y < by + bh - 1; y++) bulb(bx + bw - 1, y);
    for (let x = bx + bw - 1; x >= bx; x -= 2) bulb(x, by + bh - 1);
    for (let y = by + bh - 2; y > by; y--) bulb(bx, y);
    // Letters light one at a time at power on, then the odd one flickers like an old tube.
    const since = t - (lit.base ?? t);
    const flick = Math.floor(t * 20);
    const bad = hash(Math.floor(t * 0.5)) % title.length;
    bigText(g, x0, by + 2, title, C.green, {
      colorAt: (k) => (since < 0.3 + k * 0.08 ? C.greenDark : k === bad && hash(flick) % 7 === 0 ? C.greenDark : C.green),
    });
  }

  function drawBoardroom(g, t) {
    const x0 = 15, y0 = 12, w = 31, h = 15;
    g.box(x0, y0, w, h, C.grey, 'double');
    g.fill(x0 + 1, y0 + 1, w - 2, h - 2, ' ', 0);
    g.text(x0 + 2, y0, ' BOARDROOM ', C.steel);
    g.text(x0 + 3, y0 + 2, '╱', C.cyanDim);
    g.text(x0 + 4, y0 + 2, '╱', C.greyDark);
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

  function drawTower(g) {
    const x0 = 75, y0 = 12, w = 31, h = 15;
    g.box(x0, y0, w, h, C.grey, 'heavy');
    g.fill(x0 + 1, y0 + 1, w - 2, h - 2, ' ', 0);
    g.text(x0 + 2, y0, ' CONTROL ', C.steel);
    const sx = x0 + 15;
    g.box(sx, y0 + 1, 15, 7, C.grey, 'round');
    for (let i = 0; i < 5; i++) {
      const [text, col] = LOG_LINES[(logOffset + i) % LOG_LINES.length];
      g.text(sx + 1, y0 + 2 + i, text, col);
    }
    g.box(sx, y0 + 8, 15, 6, C.grey, 'round');
    const order = ['why', 'plan', 'design', 'build', 'secure', 'test'];
    order.forEach((z, i) => {
      const xx = sx + 2 + (i % 3) * 4;
      const yy = y0 + 9 + Math.floor(i / 3) * 2;
      g.put(xx, yy, '●', isAwake(z) ? C.green : C.greyDark);
    });
    g.text(sx + 1, y0 + 12, 'SHIP ' + String(deployed).padStart(6, '0'), C.cyan);
  }

  function drawPipes(g) {
    g.text(192, 14, '═'.repeat(76), C.grey);
    for (const x of [200, 230, 262]) {
      g.put(x, 14, '╦', C.grey);
      for (let y = 15; y < 27; y++) g.put(x, y, '║', C.greyDark);
      g.put(x, 20, '◎', C.steel);
    }
    for (const x of [205, 247]) g.text(x - 1, 12, '╔╩╗', C.grey);
  }

  function drawCatwalk(g) {
    const x0 = 107, x1 = 190, y = 21;
    for (let x = x0; x <= x1; x++) {
      const col = isAwake(zoneAt(x)) ? C.grey : C.greyDark;
      g.put(x, y, (x - x0) % 4 === 0 ? '┬' : '─', col);
      if ((x - x0) % 4 === 0) g.put(x, y + 1, '│', col);
      g.put(x, y + 2, (x - x0) % 4 === 0 ? '╧' : '═', col);
    }
    for (let yy = 3; yy < y; yy++) {
      g.put(x0, yy, '│', C.greyDark);
      g.put(x1, yy, '│', C.greyDark);
    }
  }

  function drawBelt(g) {
    const spin = '│╱─╲'[Math.floor(belt.dist * 1.5) % 4];
    for (let x = BELT_X0 + 1; x < BELT_X1; x++) {
      const on = isAwake(zoneAt(x));
      g.put(x, BELT_Y, (x - belt.step) % 6 === 0 ? '╤' : '═', on ? C.grey : C.greyDark);
      const r = x % 4;
      g.put(x, BELT_Y + 1, r === 0 ? '(' : r === 1 ? spin : r === 2 ? ')' : ' ', on && r === 1 ? C.steel : C.greyDark);
      g.put(x, BELT_Y + 2, (x + belt.step) % 6 === 0 ? '╧' : '═', C.greyDark);
    }
    g.text(BELT_X0, BELT_Y, '╭', C.grey);
    g.text(BELT_X0, BELT_Y + 1, '│', C.grey);
    g.text(BELT_X0, BELT_Y + 2, '╰', C.grey);
    for (let x = BELT_X0 + 20; x < BELT_X1 - 10; x += 22) {
      for (let y = BELT_Y + 3; y < FLOOR_Y; y++) g.put(x, y, '║', C.greyDark);
      g.put(x - 1, BELT_Y + 3, '╱', C.greyDark);
      g.put(x + 1, BELT_Y + 3, '╲', C.greyDark);
    }
  }

  function drawPackage(g, p, t) {
    const [label0, col0] = STAGES[p.stage];
    const label = p.label ?? label0;
    const col = p.bad ? C.amberDim : col0;
    const welding = stations.build.on && p.x <= STATION.build && p.x + PKG_W > STATION.build;
    const c = p.flash > 0 || (welding && hash(Math.floor(t * 30) + p.id) % 3 === 0) ? C.white : col;
    g.tinted(isAwake(zoneAt(p.x + PKG_W / 2)) ? 0 : C.greyDark, () => {
      g.text(p.x, BELT_Y - 3, '╭' + '─'.repeat(PKG_W - 2) + '╮', c);
      g.text(p.x, BELT_Y - 2, '│`' + label.replaceAll(' ', '`') + '`│', c);
      g.text(p.x, BELT_Y - 1, '╰' + '─'.repeat(PKG_W - 2) + '╯', c);
    });
  }

  function drawParticles(g) {
    for (const p of particles) {
      const k = p.age / p.life;
      const col = p.cols[Math.min(p.cols.length - 1, Math.floor(k * p.cols.length))];
      if (p.ch) g.put(p.x, p.y, p.ch, col);
      else g.dot(p.x, p.y, col);
    }
  }

  function drawCabinets(g, t) {
    const top = BELT_Y - 8;
    const h = FLOOR_Y - top;
    for (const [x, name, zoneId] of [[1, 'INTAKE', 'base'], [386, 'SHIP', 'ship']]) {
      g.tinted(isAwake(zoneId) ? 0 : C.greyDark, () => {
        const col = name === 'SHIP' ? C.green : C.amber;
        g.box(x, top, 13, h, C.grey, 'heavy');
        g.fill(x + 1, top + 1, 11, h - 2, ' ', 0);
        g.text(x + 2, top + 2, name, col);
        g.put(x + 10, top + 2, '▶', Math.floor(t * 3) % 2 ? col : C.greyDark);
        g.text(x + 1, top + 4, '┄'.repeat(11), C.greyDark);
        for (let y = BELT_Y - 3; y < BELT_Y; y++) g.text(x + 2, y, '▒▒▒▒▒▒▒▒▒', C.greyDark);
        for (let y = BELT_Y + 5; y < FLOOR_Y - 3; y += 2) g.text(x + 2, y, '═════════', C.greyDark);
        g.put(x + 2, FLOOR_Y - 2, '●', C.green);
        g.put(x + 4, FLOOR_Y - 2, '●', Math.floor(t * 1.5 + x) % 3 ? C.greenDark : C.green);
      });
    }
  }

  function drawFloor(g, t) {
    g.text(0, FLOOR_Y, '▀'.repeat(WORLD_COLS), C.greyDark);
    for (let x = 0; x < WORLD_COLS; x++) {
      const hazard = x < 16 || x > WORLD_COLS - 16;
      g.put(x, FLOOR_Y + 1, hazard ? (x % 2 ? '▞' : '▚') : '·', hazard && power.on ? C.amberDim : C.greyDark);
    }
    g.text(0, FLOOR_Y + 2, '─'.repeat(WORLD_COLS), C.greyDark);
    if (!power.on) return;
    // Data pulses run along the trench through every zone that is awake.
    for (let k = 0; k < 15; k++) {
      const px = Math.floor((t * 26 + k * 27) % (WORLD_COLS + 10)) - 5;
      if (!isAwake(zoneAt(Math.max(0, px)))) continue;
      g.put(px, FLOOR_Y + 2, '━', C.cyan);
      g.put(px - 1, FLOOR_Y + 2, '━', C.cyanDim);
      g.put(px - 2, FLOOR_Y + 2, '─', C.cyanDim);
    }
  }

  // Before power on: a callout above the belt, with marching dots leading to the lever.
  function drawPowerHint(g, t) {
    const line1 = 'pull the PWR lever to start the factory';
    const line2 = 'or press enter  ·  sound on';
    const w = line1.length + 6;
    const x0 = 32, y0 = 27;
    g.box(x0, y0, w, 4, C.amberDim, 'round');
    g.fill(x0 + 1, y0 + 1, w - 2, 2, ' ', 0);
    g.text(x0 + 3, y0 + 1, line1, C.amber);
    g.text(x0 + 3 + Math.floor((line1.length - line2.length) / 2), y0 + 2, line2, C.steel);
    const path = [];
    for (let x = x0 - 1; x > 14; x--) path.push([x, y0 + 1]);
    for (let y = y0 + 1; y > 6; y--) path.push([14, y]);
    const head = Math.floor(t * 18);
    path.forEach(([x, y], i) => g.put(x, y, '·', (i - head) % 6 === 0 ? C.amber : C.amberDim));
    g.put(14, 6, '◀', Math.floor(t * 2.5) % 2 ? C.amber : C.amberDim);
  }

  return {
    update,
    draw,
    crew,
    stations,
    get powered() { return power.on; },
    get mode() { return mode; },
    get packages() { return packages; },

    powerOn(t, { silent = false } = {}) {
      if (power.on) return;
      power.on = true;
      power.t0 = t;
      now = t;
      audio?.start();
      if (!silent) audio?.clunk();
      light('base', silent);
      mode = 'tour';
    },
    light,
    lightAll(instant = false) { for (const z of ZONES) light(z.id, instant); },
    unlight(ids) { for (const id of ids) delete lit[id]; },

    setMode(m) {
      mode = m;
      crew.chatter = m === 'free';
      if (m === 'free') {
        belt.target = null;
        nextSpawn = belt.step + 4;
        nextAttack = now + 20;
        stations.test.auto = true;
      } else {
        stations.test.auto = false;
      }
    },

    // Wipe the line for a fresh tour scene.
    clearLine() {
      packages = [];
      belt.target = null;
      stations.secure.intruders = [];
      stations.secure.raiseDome(false);
      stations.why.run = null;
      stations.why.verdict = null;
    },

    spawn,
    setStage,
    // Ask the belt to carry a package until its left edge reaches x.
    moveTo(pkg, x) { belt.target = { pkg, x }; },
    arrived(pkg, x) { return !packages.includes(pkg) || pkg.x >= x; },
    place(pkg, x) { pkg.x = x; },
    set deployed(n) { deployed = n; },
    get deployed() { return deployed; },

    hitAt(cx, cy) {
      for (let i = hits.length - 1; i >= 0; i--) {
        const h = hits[i];
        if (cx >= h.x && cx < h.x + h.w && cy >= h.y && cy < h.y + h.h) return h.id;
      }
      return null;
    },
    setHover(id) { hover = id; },
    say(id, text, t, hold) { crew.say(id, text, t, hold); },
    robotX(id) { return crew.agents.find((a) => a.id === id)?.x; },
    get stats() {
      return { packages: packages.length, particles: particles.length, deployed, powered: power.on, mode };
    },
  };
}

function mulberry32(a) {
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
